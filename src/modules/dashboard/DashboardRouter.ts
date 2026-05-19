import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { sessionService } from '@/services/SessionService.js';
import { defaultReceiptRepository } from '@/services/DefaultReceiptRepository.js';
import { whatsAppService } from '@/modules/whatsapp/WhatsAppService.js';
import { socketManager } from './SocketManager.js';
import { logger } from '@/shared/utils/logger.js';

const router = Router();

router.get('/check-auth', async (_req, res) => {
  const phone = whatsAppService.getConnectedPhoneNumber();
  if (phone) {
    let session = await sessionService.getSessionByPhone(phone);
    if (!session) {
      const sessionId = await sessionService.createSession(phone);
      if (!sessionId) {
        return res.status(500).json({ error: 'No se pudo crear la sesión' });
      }
      session = await sessionService.getSession(sessionId);
    }
    if (!session?.id) {
      return res.status(500).json({ error: 'No se pudo obtener ID de sesión' });
    }
    return res.json({ connected: true, phoneNumber: phone, sessionToken: session.id });
  }
  res.json({ connected: false });
});

router.get('/session/:id', async (req, res) => {
  const session = await sessionService.getSession(req.params.id!);
  if (!session) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }
  res.json({
    phoneNumber: session.phoneNumber,
    connected: whatsAppService.isConnected(),
  });
});

router.get('/expenses', async (req, res) => {
  const authHeader = req.headers.authorization;
  const sessionId = authHeader ? authHeader.replace('Bearer ', '') : null;
  const session = sessionId ? await sessionService.getSession(sessionId) : null;

  if (!session) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (!defaultReceiptRepository.isReady()) {
    return res.status(503).json({ error: 'Sistema no disponible', message: 'Repositorio no inicializado' });
  }

  try {
    const receipts = await defaultReceiptRepository.getAllReceipts();
    res.json(receipts);
  } catch (err) {
    logger.error('Error fetching expenses:', err);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

router.get('/stats', async (_req, res) => {
  if (!defaultReceiptRepository.isReady()) {
    return res.status(503).json({ error: 'Sistema no disponible' });
  }
  const stats = await defaultReceiptRepository.getStats();
  res.json(stats);
});

router.get('/status', (_req, res) => {
  res.json({
    whatsappConnected: whatsAppService.isConnected(),
    phoneNumber: whatsAppService.getConnectedPhoneNumber(),
  });
});

router.post('/verify-login', async (req, res) => {
  const { token } = req.body as { token?: string };
  const pending = sessionService.getPendingSession();

  if (!token || !pending) {
    return res.json({ success: false });
  }

  const phone = whatsAppService.getConnectedPhoneNumber();
  if (phone) {
    const sessionId = await sessionService.createSession(phone);
    sessionService.clearPendingSession();
    return res.json({ success: true, sessionToken: sessionId });
  }

  res.json({ success: false });
});

router.post('/logout-portal', async (req, res) => {
  const authHeader = req.headers.authorization;
  const sessionId = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (sessionId && await sessionService.getSession(sessionId)) {
    await sessionService.deleteSession(sessionId);
    return res.json({ success: true });
  }
  res.json({ success: false });
});

router.post('/disconnect-whatsapp', async (req, res) => {
  const authHeader = req.headers.authorization;
  const sessionId = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!sessionId || !(await sessionService.getSession(sessionId))) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  await whatsAppService.logout();
  await sessionService.deleteSession(sessionId);
  res.json({ success: true });
});

router.post('/reconnect-whatsapp', async (req, res) => {
  const authHeader = req.headers.authorization;
  const sessionId = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!sessionId || !(await sessionService.getSession(sessionId))) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  let aborted = false;
  req.on('close', () => {
    aborted = true;
    logger.info('Client disconnected from /api/reconnect-whatsapp');
  });

  logger.info('POST /api/reconnect-whatsapp: forcing reconnection');
  const qrValue = await whatsAppService.forceReconnect();

  if (aborted) return;

  if (!qrValue) {
    return res.status(500).json({ error: 'No se pudo generar el codigo QR' });
  }

  try {
    const qrDataURL = await QRCode.toDataURL(qrValue, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    res.json({ qr: qrDataURL });
  } catch (err) {
    logger.error('Error generating QR code', err);
    res.status(500).json({ error: 'Error al generar el codigo QR' });
  }
});

router.get('/qr-login', async (req, res) => {
  logger.info('GET /api/qr-login');

  const phone = whatsAppService.getConnectedPhoneNumber();
  if (phone) {
    let session = await sessionService.getSessionByPhone(phone);
    if (!session) {
      const sessionId = await sessionService.createSession(phone);
      if (!sessionId) {
        return res.status(500).json({ error: 'No se pudo crear la sesión' });
      }
      session = await sessionService.getSession(sessionId);
    }
    if (!session?.id) {
      return res.status(500).json({ error: 'No se pudo obtener ID de sesión' });
    }
    return res.json({ qr: null, alreadyConnected: true, phoneNumber: phone, sessionToken: session.id });
  }

  const initialQR = whatsAppService.getCurrentQR();
  if (initialQR) {
    try {
      const qrDataURL = await QRCode.toDataURL(initialQR, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      const token = uuidv4();
      sessionService.setPendingSession(initialQR);
      return res.json({ qr: qrDataURL, token });
    } catch (err) {
      logger.error('Error generating QR code', err);
      return res.status(500).json({ error: 'Error generating QR code' });
    }
  }

  let aborted = false;
  req.on('close', () => {
    aborted = true;
    logger.info('Client disconnected from /api/qr-login');
  });

  for (let i = 0; i < 10; i++) {
    if (aborted) return;
    await new Promise(r => setTimeout(r, 1000));
    
    const connectedPhone = whatsAppService.getConnectedPhoneNumber();
    if (connectedPhone) {
      return res.json({ qr: null, alreadyConnected: true, phoneNumber: connectedPhone });
    }
  }

  let currentQR = whatsAppService.getCurrentQR();

  if (!currentQR) {
    for (let i = 0; i < 90; i++) {
      if (aborted) return;
      await new Promise(r => setTimeout(r, 1000));
      currentQR = whatsAppService.getCurrentQR();
      if (currentQR) break;
    }
  }

  if (!currentQR) {
    if (!aborted) {
      res.json({ qr: '', token: null, waiting: true });
    }
    return;
  }

  try {
    const qrDataURL = await QRCode.toDataURL(currentQR, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const token = uuidv4();
    sessionService.setPendingSession(currentQR);

    if (!aborted) {
      res.json({ qr: qrDataURL, token });
    }
  } catch (err) {
    logger.error('Error generating QR code', err);
    if (!aborted) {
      res.status(500).json({ error: 'Error generating QR code' });
    }
  }
});

const _router: import('express').Router = router;
export { _router as dashboardRouter };