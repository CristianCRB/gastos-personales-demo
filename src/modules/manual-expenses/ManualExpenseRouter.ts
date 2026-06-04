import { Router } from 'express';
import {
  DEMO_SESSION_TOKEN, getAllDemoManual, getDemoManualFiltered,
  addDemoManual, updateDemoManual, deleteDemoManual,
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

  const { year, month, category } = req.query as { year?: string; month?: string; category?: string };
  if (year && month) {
    let result = getDemoManualFiltered(parseInt(year), parseInt(month), category);
    return res.json(result);
  }

  let result = getAllDemoManual();
  if (category) result = result.filter(e => e.category === category);
  res.json(result);
});

router.post('/', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { description, amount, category = 'Otros', expenseDate, paymentMethod = 'Efectivo', notes } = req.body as {
    description: string; amount: number; category?: string;
    expenseDate?: string; paymentMethod?: string; notes?: string | null;
  };

  if (!description || amount === undefined) {
    return res.status(400).json({ error: 'description y amount son requeridos' });
  }

  res.json(addDemoManual({ description, amount, category, expenseDate, paymentMethod, notes }));
});

router.put('/:id', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const updated = updateDemoManual(req.params.id!, req.body);
  if (!updated) return res.status(404).json({ error: 'Gasto no encontrado' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (deleteDemoManual(req.params.id!)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Gasto no encontrado' });
  }
});

const _router: Router = router;
export { _router as manualExpenseRouter };
