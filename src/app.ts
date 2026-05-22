import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { dashboardRouter } from '@/modules/dashboard/DashboardRouter.js';
import { incomeRouter } from '@/modules/income/IncomeRouter.js';
import { manualExpenseRouter } from '@/modules/manual-expenses/ManualExpenseRouter.js';
import { fixedExpenseRouter } from '@/modules/fixed-expenses/FixedExpenseRouter.js';
import { creditCardRouter } from '@/modules/credit-cards/CreditCardRouter.js';
import { summaryRouter } from '@/modules/summary/SummaryRouter.js';
import { socketManager } from '@/modules/dashboard/SocketManager.js';
import { whatsAppService } from '@/modules/whatsapp/WhatsAppService.js';
import { receiptService } from '@/modules/receipts/ReceiptService.js';
import { sessionService } from '@/services/SessionService.js';

interface AppResult {
  expressApp: express.Express;
  httpServer: import('http').Server;
  io: import('socket.io').Server;
}

export function createApp(): AppResult {
  const expressApp = express();
  const httpServer = createServer(expressApp);

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(express.static('public'));

  // Inject Socket.IO into modules
  socketManager.setIO(io);
  whatsAppService.setIO(io);
  receiptService.setIO(io);

  // Set up Socket.IO events
  socketManager.setup();

  // Set up WhatsApp callbacks
  whatsAppService.setLogoutCallback(async () => {
    const count = await sessionService.clearAllSessions();
    console.log('=== Sesiones del portal limpiadas:', count, 'sesiones eliminadas ===');
    socketManager.emitSessionsCleared();
  });

  whatsAppService.setOnConnectedCallback((userId: string) => {
    const phone = userId
      .replace(/:\d+@s\.whatsapp\.net$/, '')
      .replace('@s.whatsapp.net', '');
    if (phone) {
      receiptService.sendWelcome(phone).catch(() => {});
    }
  });

  // Attach WhatsApp message handler
  whatsAppService.setMessageHandler((events) => {
    receiptService.attachMessageHandler(events);
  });

  // Mount dashboard routes under /api
  expressApp.use('/api', dashboardRouter);
  expressApp.use('/api/incomes', incomeRouter);
  expressApp.use('/api/manual-expenses', manualExpenseRouter);
  expressApp.use('/api/fixed-expenses', fixedExpenseRouter);
  expressApp.use('/api/credit-cards', creditCardRouter);
  expressApp.use('/api/monthly-summary', summaryRouter);

  // Serve index.html for root
  expressApp.get('/', (_req, res) => {
    res.sendFile('public/index.html', { root: process.cwd() });
  });

  return { expressApp, httpServer, io };
}
