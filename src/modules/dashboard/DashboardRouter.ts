import { Router } from 'express';
import {
  DEMO_SESSION_TOKEN, getAllDemoWhatsApp, getDemoStats,
} from '@/shared/demo/demoData.js';

const router = Router();

function checkAuth(authHeader: string | undefined): boolean {
  if (!authHeader) return false;
  return authHeader.replace('Bearer ', '') === DEMO_SESSION_TOKEN;
}

router.get('/check-auth', (_req, res) => {
  res.json({ connected: true, phoneNumber: 'Demo', sessionToken: DEMO_SESSION_TOKEN });
});

router.get('/session/:id', (req, res) => {
  if (req.params.id !== DEMO_SESSION_TOKEN) {
    return res.status(401).json({ error: 'Sesion invalida' });
  }
  res.json({ phoneNumber: 'Demo', connected: true });
});

router.get('/expenses', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  res.json(getAllDemoWhatsApp());
});

router.get('/stats', (_req, res) => {
  res.json(getDemoStats());
});

router.get('/status', (_req, res) => {
  res.json({ whatsappConnected: true, phoneNumber: 'Demo' });
});

router.post('/verify-login', (_req, res) => {
  res.json({ success: true, sessionToken: DEMO_SESSION_TOKEN });
});

router.post('/logout-portal', (req, res) => {
  if (checkAuth(req.headers.authorization)) {
    return res.json({ success: true });
  }
  res.json({ success: false });
});

router.post('/disconnect-whatsapp', (req, res) => {
  res.json({ success: true });
});

router.post('/reconnect-whatsapp', (_req, res) => {
  res.json({ qr: null });
});

router.get('/qr-login', (_req, res) => {
  res.json({ qr: null, alreadyConnected: true, phoneNumber: 'Demo', sessionToken: DEMO_SESSION_TOKEN });
});

const _router: import('express').Router = router;
export { _router as dashboardRouter };
