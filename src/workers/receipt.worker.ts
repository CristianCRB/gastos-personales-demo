import { createHash } from 'node:crypto';
import { Worker } from 'bullmq';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import type { WAMessage } from '@whiskeysockets/baileys';
import { v4 as uuidv4 } from 'uuid';
import { env } from '@/shared/config/env.js';
import { logger } from '@/shared/utils/logger.js';
import { defaultReceiptRepository, computeContentHash } from '@/services/DefaultReceiptRepository.js';
import { receiptExtractorService, receiptParserService, receiptValidatorService } from '@/modules/ai/index.js';
import { whatsAppService } from '@/modules/whatsapp/WhatsAppService.js';
import { socketManager } from '@/modules/dashboard/SocketManager.js';
import type { Expense, GeminiReceiptResult } from '@/shared/types/index.js';
import type { ReceiptJobData } from '@/queues/receipt.queue.js';
import { checkRedisConnection } from '@/queues/connection.js';
import { uploadReceiptImage, deleteReceiptImage } from '@/services/StorageService.js';

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

let worker: Worker<ReceiptJobData> | null = null;

async function buildWorker(): Promise<Worker<ReceiptJobData> | null> {
  const available = await checkRedisConnection();
  if (!available) return null;

  const w = new Worker<ReceiptJobData>(
    'receipt-processing',
    async (job) => {
      const { serializedMessage, phoneNumber, from, mimeType } = job.data;
      const jobId = job.id ?? 'unknown';

      logger.info(`[Worker ${jobId}] Processing receipt from ${phoneNumber}`);

      const message = JSON.parse(serializedMessage) as WAMessage;
      if (!message.key) {
        throw new Error('Invalid message: missing key');
      }

      logger.info(`[Worker ${jobId}] Downloading media...`);
      const buffer = await downloadMediaMessage(message, 'buffer', {});

      const upload = await uploadReceiptImage(buffer, 'default', mimeType);
      if (!upload) {
        logger.warn(`[Worker ${jobId}] Storage upload failed — proceeding without storage`);
      }

      logger.info(`[Worker ${jobId}] Extracting text via Gemini...`);
      const rawText = await receiptExtractorService.extractFromImage(buffer, mimeType);

      const parsed = receiptParserService.parse(rawText);
      const receiptData = receiptValidatorService.validate(parsed);

      logger.info(`[Worker ${jobId}] OCR result: ${JSON.stringify(receiptData).slice(0, 150)}`);

      const msgRef = { remoteJid: job.data.msgKey.remoteJid, id: job.data.msgKey.id, fromMe: job.data.msgKey.fromMe };
      const imageHash = createHash('sha256').update(buffer).digest('hex');
      const contentHash = computeContentHash(receiptData);

      const existingByHash = await defaultReceiptRepository.findByImageHash(imageHash);
      if (existingByHash) {
        logger.warn(`[Worker ${jobId}] Duplicate image skipped (hash): ${existingByHash.vendor} ${existingByHash.date} ${existingByHash.total}`);
        if (upload) { deleteReceiptImage(upload.storagePath).catch(() => {}); }
        const sock = whatsAppService.getSock();
        if (sock) {
          await sock.sendMessage(from, { text: `ℹ️ Esta imagen ya fue registrada anteriormente (${existingByHash.vendor ?? 'comercio desconocido'}, $${(existingByHash.total ?? 0).toLocaleString('es-CO')}). Envia otra diferente para procesarla.` }).catch(() => {});
        }
        return { expenseId: null, skipped: true };
      }

      const existingByContent = await defaultReceiptRepository.findByContentHash(contentHash);
      if (existingByContent) {
        logger.warn(`[Worker ${jobId}] Duplicate content skipped (hash): ${existingByContent.vendor} ${existingByContent.date} ${existingByContent.total}`);
        if (upload) { deleteReceiptImage(upload.storagePath).catch(() => {}); }
        const sock = whatsAppService.getSock();
        if (sock) {
          await sock.sendMessage(from, { text: `ℹ️ Esta factura de *${receiptData.vendor ?? 'comercio desconocido'}* por *$${(receiptData.total ?? 0).toLocaleString('es-CO')}* ya fue registrada anteriormente. Envia otra diferente para procesarla.` }).catch(() => {});
        }
        return { expenseId: null, skipped: true };
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
        logger.error(`[Worker ${jobId}] Failed to save receipt to Supabase`);
        throw new Error('Failed to save receipt');
      }

      logger.info(`[Worker ${jobId}] Receipt saved: ${expense.id}`);

      socketManager.emitNewExpense(savedExpense);

      const sock = whatsAppService.getSock();
      if (sock) {
        const confirmation = formatConfirmation(receiptData);
        try {
          await sock.sendMessage(from, { text: confirmation });
          logger.info(`[Worker ${jobId}] Confirmation sent to ${phoneNumber}`);
        } catch (sendErr) {
          logger.error(`[Worker ${jobId}] Failed to send confirmation`, sendErr);
        }
      } else {
        logger.warn(`[Worker ${jobId}] No WhatsApp socket available to send confirmation`);
      }

      return { expenseId: expense.id, vendor: receiptData.vendor, total: receiptData.total };
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 5,
      lockDuration: 60000,
      stalledInterval: 30000,
      maxStalledCount: 3,
    }
  );

  w.on('completed', (job) => {
    const ret = job.returnvalue as { expenseId?: string | null; skipped?: boolean } | undefined;
    if (ret?.skipped) {
      logger.info(`[Worker ${job.id}] Completed — skipped duplicate`);
    } else {
      logger.info(`[Worker ${job.id}] Completed — expense: ${ret?.expenseId ?? '?'}`);
    }
  });

  w.on('failed', (job, err) => {
    const attempt = job?.attemptsMade ?? 0;
    logger.error(`[Worker ${job?.id}] Failed (attempt ${attempt + 1}/10): ${err.message}`);
  });

  w.on('error', (err: Error) => {
    if (err.message?.includes('ECONNREFUSED')) return;
    if (err.message?.toLowerCase().includes('version')) return;
    logger.error('Worker redis error:', err.message);
  });

  worker = w;
  return w;
}

export async function getOrCreateWorker(): Promise<Worker<ReceiptJobData> | null> {
  if (worker) return worker;
  return buildWorker();
}

export async function createReceiptWorker(): Promise<Worker<ReceiptJobData> | null> {
  if (worker) return worker;
  return buildWorker();
}

export async function closeWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}