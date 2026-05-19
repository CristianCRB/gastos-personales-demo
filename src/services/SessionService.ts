import { v4 as uuidv4 } from 'uuid';
import { sessionRepository } from './SessionRepository.js';
import { defaultReceiptRepository } from '@/services/DefaultReceiptRepository.js';
import type { Session, SessionCreateInput, WhatsAppSessionData } from '@/shared/types/index.js';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000000';

export class SessionService {
  private pendingSession: { qr: string; createdAt: number } | null = null;
  private memorySessions: Map<string, Session> = new Map();

  getPendingSession(): typeof this.pendingSession {
    return this.pendingSession;
  }

  setPendingSession(qr: string): void {
    this.pendingSession = { qr, createdAt: Date.now() };
  }

  clearPendingSession(): void {
    this.pendingSession = null;
  }

  getOrganizationId(): string {
    if (defaultReceiptRepository.isReady()) {
      const orgId = (defaultReceiptRepository as unknown as { defaultOrgId: string | null }).defaultOrgId;
      return orgId || DEFAULT_ORG_ID;
    }
    return DEFAULT_ORG_ID;
  }

  async createSession(phoneNumber: string, sessionData?: WhatsAppSessionData): Promise<string | null> {
    const organizationId = this.getOrganizationId();
    
    const input: SessionCreateInput = {
      organizationId,
      sessionName: 'main',
      phoneNumber,
      sessionData,
      status: 'active',
    };

    const dbSession = await sessionRepository.createSession(input);
    if (dbSession) {
      return dbSession.id;
    }

    const id = uuidv4();
    const session: Session = {
      id,
      organizationId,
      sessionName: 'main',
      phoneNumber,
      sessionData: sessionData || {},
      status: 'active',
      deviceInfo: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memorySessions.set(id, session);
    return id;
  }

  async getSession(id: string): Promise<Session | null> {
    const organizationId = this.getOrganizationId();
    
    const dbSession = await sessionRepository.getSession({ organizationId, sessionName: 'main' });
    if (dbSession) return dbSession;
    
    return this.memorySessions.get(id) || null;
  }

  async getSessionByPhone(phoneNumber: string): Promise<Session | null> {
    const organizationId = this.getOrganizationId();
    
    const dbSession = await sessionRepository.getSessionByPhone(organizationId, phoneNumber);
    if (dbSession) return dbSession;
    
    for (const [, s] of this.memorySessions) {
      if (s.phoneNumber === phoneNumber && s.status === 'active') return s;
    }
    return null;
  }

  async updateSessionData(id: string, sessionData: WhatsAppSessionData): Promise<boolean> {
    const updated = await sessionRepository.updateSessionData(id, sessionData);
    if (updated) {
      const memorySession = this.memorySessions.get(id);
      if (memorySession) {
        memorySession.sessionData = sessionData;
      }
    }
    return updated;
  }

  async updateSessionStatus(id: string, status: Session['status']): Promise<boolean> {
    return sessionRepository.updateStatus(id, status);
  }

  async deleteSession(id: string): Promise<void> {
    await sessionRepository.deleteSession(id);
    this.memorySessions.delete(id);
  }

  async clearAllSessions(): Promise<number> {
    const organizationId = this.getOrganizationId();
    const count = await sessionRepository.clearAllSessions(organizationId);
    this.memorySessions.clear();
    return count;
  }

  async initialize(): Promise<void> {
    await sessionRepository.initialize();
  }
}

export const sessionService = new SessionService();