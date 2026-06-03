import { createApp } from '@/app.js';
import { env } from '@/shared/config/env.js';
import { logger } from '@/shared/utils/logger.js';

async function main() {
  logger.info('Starting ExpenseFlow Demo...');
  const { expressApp } = createApp();

  expressApp.listen(env.PORT, () => {
    logger.info(`Demo server ready at http://localhost:${env.PORT}`);
  });
}

main();
