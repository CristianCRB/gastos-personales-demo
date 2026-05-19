import { createApp } from '@/app.js';
import { sessionService } from '@/services/SessionService.js';
import { defaultReceiptRepository } from '@/services/DefaultReceiptRepository.js';
import { whatsAppService } from '@/modules/whatsapp/WhatsAppService.js';
import { env } from '@/shared/config/env.js';
import { logger } from '@/shared/utils/logger.js';
import { createReceiptWorker, closeWorker } from '@/workers/receipt.worker.js';
import { checkSupabaseConnection, isSupabaseAvailable } from '@/services/SupabaseService.js';

async function main() {
  logger.info('Starting ExpenseFlow...');

  if (!isSupabaseAvailable()) {
    logger.error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabaseConnected = await checkSupabaseConnection();
  if (!supabaseConnected) {
    logger.error('Failed to connect to Supabase. Please check your configuration.');
    process.exit(1);
  }

  try {
    await sessionService.initialize();
    await defaultReceiptRepository.initialize();

    const { httpServer } = createApp();

    const receiptWorker = await createReceiptWorker();
    if (receiptWorker) {
      logger.info('Receipt processing worker started');
    } else {
      logger.warn('Receipt processing disabled — install Redis to enable');
    }

    await whatsAppService.connect();
    logger.info('WhatsApp service started');

    httpServer.listen(env.PORT, () => {
      logger.info(`Server ready at http://localhost:${env.PORT}`);
    });

    const shutdown = async () => {
      logger.info('Shutting down...');
      await closeWorker();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    logger.error('Failed to start', {
      message: err instanceof Error ? err.message : err,
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}

main();