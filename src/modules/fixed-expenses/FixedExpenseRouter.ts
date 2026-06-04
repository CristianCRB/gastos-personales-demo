import { Router } from 'express';
import {
  DEMO_SESSION_TOKEN, getAllDemoFixed, addDemoFixed, updateDemoFixed,
  deleteDemoFixed, getDemoFixedMonthly, toggleDemoFixedPayment,
} from '../../shared/demo/demoData.js';

const router = Router();

function checkAuth(authHeader: string | undefined): boolean {
  if (!authHeader) return false;
  return authHeader.replace('Bearer ', '') === DEMO_SESSION_TOKEN;
}

router.get('/', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  res.json(getAllDemoFixed());
});

router.post('/', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { name, amount, category, dueDay, isActive } = req.body as {
    name: string; amount: number; category?: string; dueDay?: number | null; isActive?: boolean;
  };

  if (!name || amount === undefined) {
    return res.status(400).json({ error: 'name y amount son requeridos' });
  }

  res.json(addDemoFixed({ name, amount, category, dueDay, isActive }));
});

router.put('/:id', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const updated = updateDemoFixed(req.params.id!, req.body);
  if (!updated) return res.status(404).json({ error: 'Gasto fijo no encontrado' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (deleteDemoFixed(req.params.id!)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Gasto fijo no encontrado' });
  }
});

router.get('/monthly', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { month, year } = req.query as { month: string; year: string };
  if (!month || !year) return res.status(400).json({ error: 'month y year son requeridos' });

  res.json(getDemoFixedMonthly(parseInt(month), parseInt(year)));
});

router.post('/:id/pay', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { month, year, isPaid } = req.body as { month: number; year: number; isPaid: boolean };
  if (!month || !year) return res.status(400).json({ error: 'month y year son requeridos' });

  const result = toggleDemoFixedPayment(req.params.id!, month, year, isPaid);
  if (!result) return res.status(404).json({ error: 'Gasto fijo no encontrado' });
  res.json(result);
});

const _router: Router = router;
export { _router as fixedExpenseRouter };
