import { createHash } from 'node:crypto';
import { type BaileysEventEmitter } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import type { WAMessage } from '@whiskeysockets/baileys';
import type { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { defaultReceiptRepository, computeContentHash } from '@/services/DefaultReceiptRepository.js';
import { receiptExtractorService, receiptParserService, receiptValidatorService } from '@/modules/ai/index.js';
import { logger } from '@/shared/utils/logger.js';
import { whatsAppService } from '@/modules/whatsapp/WhatsAppService.js';
import { addReceiptJob } from '@/queues/receipt.queue.js';
import { MemoryQueue } from '@/services/MemoryQueue.js';
import { ConcurrencyLimiter } from '@/services/RateLimiter.js';
import { uploadReceiptImage, deleteReceiptImage } from '@/services/StorageService.js';
import type { Expense, GeminiReceiptResult } from '@/shared/types/index.js';

function extractPhoneNumber(from: string): string {
  return from
    .replace(/(:\d+)?@s\.whatsapp\.net$/, '')
    .replace('@g.us', '');
}

function msgKeyStr(m: WAMessage): string {
  return `${m.key.remoteJid}_${m.key.id}`;
}

async function formatSummary(): Promise<string> {
  const receipts = await defaultReceiptRepository.getAllReceipts();
  if (receipts.length === 0) return 'No hay gastos registrados.';
  const total = receipts.reduce((sum, e) => sum + (e.total ?? 0), 0);
  const last = receipts[0]!;
  return [
    'Resumen de gastos:',
    `- Total de recibos: ${receipts.length}`,
    `- Monto total: ${total.toFixed(2)}`,
    `- Ultimo recibo: ${last.vendor ?? 'N/A'} (${last.total ?? 0})`,
  ].join('\n');
}

function formatConfirmation(data: GeminiReceiptResult): string {
  const lines: string[] = ['✅ Recibo procesado exitosamente!\n'];
  if (data.vendor) lines.push(`🏪 *Comercio:* ${data.vendor}`);
  if (data.date) lines.push(`📅 *Fecha:* ${data.date}`);
  if (data.invoiceNumber) lines.push(`📄 *Factura:* ${data.invoiceNumber}`);
  lines.push('');
  if (data.subtotal) lines.push(`Subtotal: ${data.currency ?? ''} ${data.subtotal}`);
  if (data.tax) lines.push(`Impuesto: ${data.currency ?? ''} ${data.tax}`);
  lines.push(`💰 *Total:* ${data.currency ?? ''} ${data.total ?? 0}`);
  lines.push(`📂 *Categoria:* ${data.category ?? 'Otros'}`);
  if (data.paymentMethod) lines.push(`💳 *Pago:* ${data.paymentMethod}`);
  lines.push('\nLos datos ya estan disponibles en el dashboard.');
  return lines.join('\n');
}

export class ReceiptService {
  private io: SocketIOServer | null = null;
  private welcomeSent = new Set<string>();
  private processedKeys = new Set<string>();
  private syncQueue = new MemoryQueue();
  private syncLimiter = new ConcurrencyLimiter(1);

  constructor() {
    this.initDedup();
  }

  private async initDedup(): Promise<void> {
    try {
      this.processedKeys = await defaultReceiptRepository.initializeDedup();
    } catch {
      logger.warn('Could not initialize dedup set from existing receipts');
    }
  }

  setIO(io: SocketIOServer): void {
    this.io = io;
  }

  attachMessageHandler(events: BaileysEventEmitter): void {
    events.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const m of messages) {
        await this.handleMessage(m);
      }
    });
  }

  private async handleMessage(m: WAMessage): Promise<void> {
    const from = m.key.remoteJid;
    if (!from) return;

    const phoneNumber = extractPhoneNumber(from);

    if (m.key.fromMe && !m.message?.imageMessage) return;

    if (m.message?.imageMessage) {
      await this.processImage(m, from, phoneNumber);
    } else {
      const text =
        m.message?.conversation ??
        m.message?.extendedTextMessage?.text ??
        '';
      if (text.toLowerCase().includes('estado') || text.toLowerCase().includes('gastos')) {
        await this.sendSummary(from);
      }
    }
  }

  private isDuplicate(m: WAMessage): boolean {
    const key = msgKeyStr(m);
    if (this.processedKeys.has(key)) {
      logger.info(`Duplicate message skipped: ${key}`);
      return true;
    }
    return false;
  }

  private markProcessed(m: WAMessage): void {
    this.processedKeys.add(msgKeyStr(m));
  }

  private async processImage(m: WAMessage, from: string, phoneNumber: string): Promise<void> {
    if (this.isDuplicate(m)) return;

    const mimeType = m.message?.imageMessage?.mimetype ?? 'image/jpeg';
    const serializedMessage = JSON.stringify(m);

    try {
      const sock = whatsAppService.getSock();
      if (!sock) return;

      await sock.sendMessage(from, { text: 'Procesando tu recibo...' });

      const jobId = await addReceiptJob({
        serializedMessage,
        phoneNumber,
        from,
        mimeType,
        msgKey: {
          remoteJid: m.key.remoteJid!,
          id: m.key.id!,
          fromMe: m.key.fromMe ?? false,
          participant: m.key.participant ?? null,
        },
      });

      if (jobId) {
        this.markProcessed(m);
        logger.info(`Receipt queued for processing: ${phoneNumber}`);
        return;
      }

      logger.warn(`Redis unavailable — enqueued for sync processing: ${phoneNumber}`);
      await this.syncQueue.enqueue(`receipt:${phoneNumber}`, () =>
        this.syncLimiter.run(() => this.processSynchronously(m, from, phoneNumber, mimeType))
      );
    } catch (error) {
      const err = error as Error;
      logger.error('Error processing receipt:', err.message);
      const sock = whatsAppService.getSock();
      if (sock) {
        try {
          await sock.sendMessage(from, {
            text: 'Error al procesar el recibo. Intenta con una imagen mas clara.',
          });
        } catch {}
      }
    }
  }

  private async processSynchronously(m: WAMessage, from: string, phoneNumber: string, mimeType: string): Promise<void> {
    let buffer: Buffer;
    try {
      buffer = await downloadMediaMessage(m, 'buffer', {});
    } catch {
      logger.warn(`Media download failed for ${msgKeyStr(m)} — skipping`);
      return;
    }

    const upload = await uploadReceiptImage(buffer, 'default', mimeType);
    if (!upload) {
      logger.warn(`Storage upload failed for ${msgKeyStr(m)} — proceeding without storage`);
    }

    let receiptData: GeminiReceiptResult;
    try {
      const rawText = await receiptExtractorService.extractFromImage(buffer, mimeType);
      const parsed = receiptParserService.parse(rawText);
      receiptData = receiptValidatorService.validate(parsed);
    } catch {
      logger.warn(`OCR failed for ${msgKeyStr(m)} — skipping`);
      if (upload) { deleteReceiptImage(upload.storagePath).catch(() => {}); }
      return;
    }

    const msgRef = { remoteJid: m.key.remoteJid, id: m.key.id, fromMe: m.key.fromMe };
    const imageHash = createHash('sha256').update(buffer).digest('hex');
    const contentHash = computeContentHash(receiptData);

    const existingByHash = await defaultReceiptRepository.findByImageHash(imageHash);
    if (existingByHash) {
      logger.warn(`Duplicate image skipped (hash): ${existingByHash.vendor} ${existingByHash.date} ${existingByHash.total}`);
      this.markProcessed(m);
      if (upload) { deleteReceiptImage(upload.storagePath).catch(() => {}); }
      const sock = whatsAppService.getSock();
      if (sock) {
        await sock.sendMessage(from, { text: `ℹ️ Esta imagen ya fue registrada anteriormente (${existingByHash.vendor ?? 'comercio desconocido'}, $${(existingByHash.total ?? 0).toLocaleString('es-CO')}). Envia otra diferente para procesarla.` }).catch(() => {});
      }
      return;
    }

    const existingByContent = await defaultReceiptRepository.findByContentHash(contentHash);
    if (existingByContent) {
      logger.warn(`Duplicate content skipped (hash): ${existingByContent.vendor} ${existingByContent.date} ${existingByContent.total}`);
      this.markProcessed(m);
      if (upload) { deleteReceiptImage(upload.storagePath).catch(() => {}); }
      const sock = whatsAppService.getSock();
      if (sock) {
        await sock.sendMessage(from, { text: `ℹ️ Esta factura de *${receiptData.vendor ?? 'comercio desconocido'}* por *$${(receiptData.total ?? 0).toLocaleString('es-CO')}* ya fue registrada anteriormente. Envia otra diferente para procesarla.` }).catch(() => {});
      }
      return;
    }

    const expense: Expense = {
      id: uuidv4(),
      phoneNumber,
      ...receiptData,
      storagePath: upload?.storagePath ?? null,
      imageHash,
      contentHash,
      rawResponse: null,
      rawMessage: msgRef,
      createdAt: new Date().toISOString(),
      status: 'processed',
    };

    const savedExpense = await defaultReceiptRepository.addReceipt(expense);
    if (!savedExpense) {
      logger.error('Failed to save receipt to Supabase');
      return;
    }

    this.markProcessed(m);
    logger.info(`Receipt processed (sync): ${expense.id}`);

    if (this.io) {
      this.io.emit('new-expense', savedExpense);
    }

    const sock = whatsAppService.getSock();
    if (sock) {
      const confirmation = formatConfirmation(receiptData);
      try {
        await sock.sendMessage(from, { text: confirmation });
      } catch (sendErr) {
        logger.error('Failed to send confirmation (sync)', sendErr);
      }
    }
  }

  private async sendSummary(from: string): Promise<void> {
    const summary = await formatSummary();
    const sock = whatsAppService.getSock();
    if (sock) {
      await sock.sendMessage(from, { text: summary });
    }
  }

  async sendWelcome(phoneNumber: string): Promise<void> {
    if (this.welcomeSent.has(phoneNumber)) {
      logger.info(`Welcome already sent for: ${phoneNumber}`);
      return;
    }
    this.welcomeSent.add(phoneNumber);

    const sock = whatsAppService.getSock();
    if (!sock) return;

    const jid = `${phoneNumber}@s.whatsapp.net`;
    const message = `Hola! Soy el asistente de ExpenseFlow. Envíame una foto de tu recibo o factura para registrarlo.\n\nNumero vinculado: ${phoneNumber}`;

    const doSend = (attempt: number): void => {
      sock.sendMessage(jid, { text: message })
        .then(() => logger.info(`Welcome sent to ${phoneNumber}`))
        .catch((err: Error) => {
          logger.error(`Error sending welcome (attempt ${attempt}):`, err.message);
          if (attempt < 2) setTimeout(() => doSend(attempt + 1), 3000);
        });
    };
    doSend(1);
  }
}

export const receiptService = new ReceiptService();