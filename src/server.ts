import { createApp } from './app.js';
import { env } from './shared/config/env.js';

async function main() {
  console.log('[INFO] Starting ExpenseFlow Demo...');
  const { expressApp } = createApp();

  expressApp.listen(env.PORT, () => {
    console.log(`[INFO] Demo server ready at http://localhost:${env.PORT}`);
  });
}

main();
