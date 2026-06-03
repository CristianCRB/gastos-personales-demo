import express, { type Express } from 'express';
import cors from 'cors';
import { initializeDemoStore } from '@/shared/demo/demoData.js';
import { dashboardRouter } from '@/modules/dashboard/DashboardRouter.js';
import { incomeRouter } from '@/modules/income/IncomeRouter.js';
import { manualExpenseRouter } from '@/modules/manual-expenses/ManualExpenseRouter.js';
import { fixedExpenseRouter } from '@/modules/fixed-expenses/FixedExpenseRouter.js';
import { creditCardRouter } from '@/modules/credit-cards/CreditCardRouter.js';
import { summaryRouter } from '@/modules/summary/SummaryRouter.js';

export function createApp(): { expressApp: Express } {
  initializeDemoStore();

  const expressApp = express();
  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(express.static('public'));

  expressApp.use('/api', dashboardRouter);
  expressApp.use('/api/incomes', incomeRouter);
  expressApp.use('/api/manual-expenses', manualExpenseRouter);
  expressApp.use('/api/fixed-expenses', fixedExpenseRouter);
  expressApp.use('/api/credit-cards', creditCardRouter);
  expressApp.use('/api/monthly-summary', summaryRouter);

  expressApp.get('/', (_req, res) => {
    res.sendFile('public/index.html', { root: process.cwd() });
  });

  return { expressApp };
}
