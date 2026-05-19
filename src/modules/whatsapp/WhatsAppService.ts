import makeWASocket, {
  DisconnectReason,
  initAuthCreds,
  BufferJSON,
} from '@whiskeysockets/baileys';
import type {
  AuthenticationCreds,
  AuthenticationState,
  SignalKeyStore,
  SignalDataSet,
  BaileysEventEmitter,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { logger } from '@/shared/utils/logger.js';
import { sessionRepository } from '@/services/SessionRepository.js';
import { sessionService } from '@/services/SessionService.js';
import type { ConnectionStatus } from '@/shared/types/whatsapp.js';

// ─── BufferJSON serialization helpers ────────────────────────
// Converts Uint8Array/Buffer ↔ base64 for JSONB storage.

function serialize(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj, BufferJSON.replacer));
}

function deserialize<T = unknown>(obj: unknown): T {
  const str = JSON.stringify(obj);
  if (str === undefined) return undefined as T;
  return JSON.parse(str, BufferJSON.reviver) as T;
}

// ─── SignalKeyStore backed by JSONB cache ────────────────────
// Stores keys in memory; persists to session_data JSONB via debounced writes.

class SupabaseKeyStore implements SignalKeyStore {
  private cache: Record<string, Record<string, unknown>> = {};
  private sessionDbId: string | null = null;
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;
  private persistDirty = false;
  private credsRef: (() => AuthenticationCreds | null) | null = null;

  setSessionId(id: string | null): void {
    this.sessionDbId = id;
  }

  setCredsRef(ref: () => AuthenticationCreds | null): void {
    this.credsRef = ref;
  }

  loadKeys(keys: Record<string, Record<string, unknown>>): void {
    this.cache = {};
    for (const [type, entries] of Object.entries(keys)) {
      this.cache[type] = deserialize<Record<string, unknown>>(entries) ?? {};
    }
  }

  dumpKeys(): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {};
    for (const [type, entries] of Object.entries(this.cache)) {
      result[type] = serialize(entries) as Record<string, unknown>;
    }
    return result;
  }

  async get<T extends keyof import('@whiskeysockets/baileys').SignalDataTypeMap>(
    type: T,
    ids: string[],
  ): Promise<{ [id: string]: import('@whiskeysockets/baileys').SignalDataTypeMap[T] }> {
    const typeStore = this.cache[type] ?? {};
    const result: Record<string, unknown> = {};
    for (const id of ids) {
      const value = typeStore[id];
      if (value !== undefined) {
        result[id] = value;
      }
    }
    return result as any;
  }

  async set(data: SignalDataSet): Promise<void> {
    for (const [type, entries] of Object.entries(data)) {
      if (!this.cache[type]) {
        this.cache[type] = {};
      }
      for (const [id, value] of Object.entries(entries ?? {})) {
        if (value === null) {
          delete this.cache[type][id];
        } else {
          this.cache[type][id] = value;
        }
      }
    }
    this.schedulePersist();
  }

  async clear(): Promise<void> {
    this.cache = {};
  }

  // ── Debounced persist ──────────────────────────────────────

  private schedulePersist(): void {
    this.persistDirty = true;
    if (this.persistTimeout) return;
    this.persistTimeout = setTimeout(() => {
      this.persistTimeout = null;
      if (this.persistDirty) {
        this.persistDirty = false;
        this.persistNow().catch((err) =>
          logger.error('SupabaseKeyStore persist failed', err),
        );
      }
    }, 1000);
  }

  async flush(): Promise<void> {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    if (this.persistDirty) {
      this.persistDirty = false;
      await this.persistNow();
    }
  }

  private async persistNow(): Promise<void> {
    if (!this.sessionDbId) return;
    const creds = this.credsRef?.();
    if (!creds) return;
    logger.info('SupabaseKeyStore: persisting keys to session_data');
    await sessionRepository.updateSessionData(this.sessionDbId, {
      creds: serialize(creds) as Record<string, unknown>,
      keys: this.dumpKeys(),
    });
  }
}

// ─── WhatsApp Service ────────────────────────────────────────

export class WhatsAppService {
  private sock: ReturnType<typeof makeWASocket> | null = null;
  private currentQRValue: string | null = null;
  private isPairing = false;
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 3;

  // Auth state (memory-backed, persisted to Supabase JSONB)
  private keyStore = new SupabaseKeyStore();
  private creds: AuthenticationCreds | null = null;
  private sessionDbId: string | null = null;
  private hasStoredSession = false;

  private io: import('socket.io').Server | null = null;
  private onLogoutCallback: (() => void) | null = null;
  private onConnectedCallback: ((userId: string) => void) | null = null;
  private messageHandler: ((events: BaileysEventEmitter) => void) | null = null;

  setIO(io: import('socket.io').Server): void {
    this.io = io;
  }

  setLogoutCallback(callback: () => void): void {
    this.onLogoutCallback = callback;
  }

  setOnConnectedCallback(callback: (userId: string) => void): void {
    this.onConnectedCallback = callback;
  }

  setMessageHandler(handler: (events: BaileysEventEmitter) => void): void {
    this.messageHandler = handler;
  }

  getSock(): typeof this.sock {
    return this.sock;
  }

  getCurrentQR(): string | null {
    return this.currentQRValue;
  }

  isConnected(): boolean {
    return this.sock?.user !== undefined && this.sock?.user !== null;
  }

  getConnectedPhoneNumber(): string | null {
    if (!this.sock?.user) return null;
    return this.sock.user.id
      .replace(/:\d+@s\.whatsapp\.net$/, '')
      .replace('@s.whatsapp.net', '');
  }

  // ─── Connection lifecycle ──────────────────────────────────

  async connect(): Promise<void> {
    await this.restoreAuthState();
    await this.startConnection();
  }

  // ─── Auth state: restore from Supabase ─────────────────────

  private async restoreAuthState(): Promise<void> {
    const orgId = sessionService.getOrganizationId();
    logger.info('restoreAuthState: looking up session', { organizationId: orgId });

    const session = await sessionRepository.getSession({
      organizationId: orgId,
      sessionName: 'main',
    });

    if (!session?.sessionData?.creds || !session.id) {
      logger.info('restoreAuthState: no stored session found — QR scan required');
      return;
    }

    this.sessionDbId = session.id;
    this.hasStoredSession = true;

    this.creds = deserialize<AuthenticationCreds>(session.sessionData.creds);
    this.keyStore.setSessionId(this.sessionDbId);
    this.keyStore.setCredsRef(() => this.creds);
    this.keyStore.loadKeys(
      (session.sessionData.keys as Record<string, Record<string, unknown>>) ?? {},
    );

    logger.info('restoreAuthState: session restored from Supabase JSONB', {
      sessionId: this.sessionDbId,
      phoneNumber: this.creds?.me?.id,
    });
  }

  // ─── Auth state: save to Supabase ──────────────────────────

  private async saveAuthState(): Promise<void> {
    if (!this.sessionDbId) {
      logger.warn('saveAuthState: no sessionDbId — cannot persist');
      return;
    }
    if (!this.creds) {
      logger.warn('saveAuthState: creds is null — cannot persist');
      return;
    }

    const serializedCreds = serialize(this.creds) as Record<string, unknown>;
    const serializedKeys = this.keyStore.dumpKeys();

    logger.info('saveAuthState: persisting session_data JSONB', {
      sessionId: this.sessionDbId,
      credsKeys: Object.keys(serializedCreds),
      keyTypes: Object.keys(serializedKeys),
    });

    const ok = await sessionRepository.updateSessionData(this.sessionDbId, {
      creds: serializedCreds,
      keys: serializedKeys,
    });

    if (ok) {
      logger.info('saveAuthState: session_data persisted successfully');
    } else {
      logger.error('saveAuthState: sessionRepository.updateSessionData returned false');
    }
  }

  // ─── Baileys socket bootstrap ─────────────────────────────

  private buildAuthState(): AuthenticationState {
    return {
      creds: this.creds!,
      keys: this.keyStore,
    };
  }

  private async startConnection(): Promise<void> {
    if (!this.creds) {
      this.creds = initAuthCreds() as unknown as AuthenticationCreds;
      logger.info('startConnection: initialized fresh auth creds');
    }

    this.keyStore.setCredsRef(() => this.creds);

    const authState = this.buildAuthState();

    const sock = makeWASocket({
      auth: authState,
      logger: pino({ level: 'info' }),
      printQRInTerminal: false,
      browser: ['Chrome', 'Windows', '10'],
      qrTimeout: 120000,
      connectTimeoutMs: 120000,
      emitOwnEvents: true,
      retryRequestDelayMs: 2000,
    });

    // ── connection.update handler ────────────────────────────
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info(`connection.update: QR received (len=${qr.length})`);
        this.currentQRValue = qr;
        this.isPairing = true;
        this.shouldReconnect = true;
        await this.emitQR(qr);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        logger.info(`connection.update: closed (code=${statusCode}, isLoggedOut=${isLoggedOut})`);

        if (isLoggedOut) {
          await this.handleLogout();
          return;
        }

        if (this.shouldReconnect && this.reconnectAttempts < this.MAX_RECONNECT) {
          this.reconnectAttempts++;
          logger.info(`connection.update: reconnecting (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT})`);
          this.isPairing = false;
          await new Promise((r) => setTimeout(r, 3000));
          await this.startConnection();
        }
      } else if (connection === 'open') {
        logger.info('connection.update: connection OPEN — upserting session');

        // Upsert session row (create on first auth, update on reconnect)
        await this.upsertSession(sock);

        // Persist full auth state to the (now-existing) session
        await this.saveAuthState();

        // Mark connection healthy
        await this.handleConnected(sock);
      }
    });

    // ── creds.update handler ─────────────────────────────────
    sock.ev.on('creds.update', async () => {
      if (!this.creds) return;
      logger.info('creds.update: creds were updated', {
        hasMe: !!this.creds.me,
        hasAccount: !!this.creds.account,
        registered: this.creds.registered,
        hasSessionId: !!this.sessionDbId,
      });

      // If we already have a session, persist. Otherwise the first
      // persist happens inside upsertSession when connection opens.
      if (this.sessionDbId) {
        await this.saveAuthState();
      } else {
        logger.info('creds.update: no session yet — creds buffered in memory');
      }
    });

    // ── Message handler ──────────────────────────────────────
    if (this.messageHandler) {
      this.messageHandler(sock.ev);
    }

    this.sock = sock;
    logger.info('startConnection: Baileys socket created');
  }

  // ─── Upsert session row (atomic create-or-update) ─────────

  private async upsertSession(sock: ReturnType<typeof makeWASocket>): Promise<void> {
    // If we already have a valid sessionDbId from restoreAuthState,
    // just update it via the creds.update/saveAuthState flow.
    if (this.sessionDbId) {
      logger.info('upsertSession: reusing existing session', { sessionId: this.sessionDbId });
      return;
    }

    if (!sock.user) {
      logger.warn('upsertSession: sock.user is null — cannot create session');
      return;
    }

    const phone = sock.user.id
      .replace(/:\d+@s\.whatsapp\.net$/, '')
      .replace('@s.whatsapp.net', '');

    logger.info('upsertSession: creating session row', { phoneNumber: phone });

    const orgId = sessionService.getOrganizationId();

    const session = await sessionRepository.upsertSession({
      organizationId: orgId,
      sessionName: 'main',
      phoneNumber: phone,
      sessionData: {
        creds: this.creds
          ? (serialize(this.creds) as Record<string, unknown>)
          : undefined,
        keys: this.keyStore.dumpKeys(),
      },
      status: 'active',
    });

    if (session?.id) {
      this.sessionDbId = session.id;
      this.keyStore.setSessionId(this.sessionDbId);
      this.hasStoredSession = true;
      logger.info('upsertSession: session row created/updated in Supabase', {
        sessionId: this.sessionDbId,
        phoneNumber: phone,
      });
    } else {
      logger.error('upsertSession: sessionRepository.upsertSession returned null/undefined');
    }
  }

  // ─── QR ────────────────────────────────────────────────────

  private async emitQR(qr: string): Promise<void> {
    try {
      const qrDataURL = await QRCode.toDataURL(qr, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      if (this.io) {
        this.io.emit('whatsapp-qr-image', qrDataURL);
      }
    } catch (err) {
      logger.error('Error generating QR image', err);
    }
  }

  // ─── Connected ─────────────────────────────────────────────

  private async handleConnected(sock: ReturnType<typeof makeWASocket>): Promise<void> {
    logger.info('WhatsApp connected');
    this.currentQRValue = null;
    this.isPairing = false;
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;

    if (this.io) {
      this.io.emit('whatsapp-connected');
    }

    if (sock.user && this.onConnectedCallback) {
      const userId = sock.user.id;
      let syncDone = false;
      let lastHistory = Date.now();

      const monitor = setInterval(() => {
        if (syncDone) return;
        if (Date.now() - lastHistory > 3000) {
          syncDone = true;
          clearInterval(monitor);
          this.onConnectedCallback?.(userId);
        }
      }, 2000);

      (sock.ev as unknown as import('events').EventEmitter).on('history.notification', () => {
        lastHistory = Date.now();
      });

      setTimeout(() => {
        if (!syncDone) {
          clearInterval(monitor);
          syncDone = true;
          this.onConnectedCallback?.(userId);
        }
      }, 20000);
    }
  }

  // ─── Logout / Disconnect ───────────────────────────────────

  async logout(): Promise<void> {
    if (this.sock) {
      try {
        await this.sock.logout();
        logger.info('WhatsApp logged out');
      } catch (err) {
        logger.error('Error during WhatsApp logout', err);
      }
    }
    await this.clearStoredSession();
  }

  private async clearStoredSession(): Promise<void> {
    if (this.sessionDbId) {
      logger.info('clearStoredSession: deleting session row from Supabase', { sessionDbId: this.sessionDbId });
      await sessionRepository.deleteSession(this.sessionDbId);
      this.sessionDbId = null;
      this.hasStoredSession = false;
    }
    this.creds = null;
    this.keyStore.setSessionId(null);
    this.keyStore.loadKeys({});
    await this.keyStore.flush();
    logger.info('clearStoredSession: auth state and session row cleared');
  }

  private async handleLogout(): Promise<void> {
    logger.info('handleLogout: session closed from WhatsApp');
    this.shouldReconnect = false;
    this.isPairing = false;
    await this.clearStoredSession();
    this.onLogoutCallback?.();
    if (this.io) {
      this.io.emit('whatsapp-disconnected');
    }
    logger.info('handleLogout: complete');
  }

  async forceReconnect(): Promise<string | null> {
    logger.info('forceReconnect: ending current connection and clearing session');

    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (_) { /* ignore */ }
      this.sock = null;
    }

    await this.clearStoredSession();
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.isPairing = false;
    this.currentQRValue = null;

    await this.connect();

    for (let i = 0; i < 30; i++) {
      if (this.currentQRValue) return this.currentQRValue;
      await new Promise((r) => setTimeout(r, 1000));
    }

    logger.warn('forceReconnect: no QR received after 30s');
    return null;
  }
}

export const whatsAppService = new WhatsAppService();
