import { Router } from 'express';
import {
  DEMO_SESSION_TOKEN, getAllDemoIncomes, getDemoIncomesFiltered,
  addDemoIncome, updateDemoIncome, deleteDemoIncome,
} from '@/shared/demo/demoData.js';

const router = Router();

function checkAuth(authHeader: string | undefined): boolean {
  if (!authHeader) return false;
  return authHeader.replace('Bearer ', '') === DEMO_SESSION_TOKEN;
}

router.get('/', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { year, month } = req.query as { year?: string; month?: string };
  const y = year ? parseInt(year) : undefined;
  const m = month ? parseInt(month) : undefined;

  const data = (y !== undefined || m !== undefined)
    ? getDemoIncomesFiltered(m, y)
    : getAllDemoIncomes();

  res.json(data);
});

router.post('/', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { description = 'Salario', amount, month, year } = req.body as {
    description?: string; amount: number; month: number; year: number;
  };

  if (!amount || !month || !year) {
    return res.status(400).json({ error: 'amount, month y year son requeridos' });
  }

  res.json(addDemoIncome({ description, amount, month, year }));
});

router.put('/:id', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { description, amount, month, year } = req.body as Record<string, unknown>;
  const updated = updateDemoIncome(req.params.id!, { description: description as string | undefined, amount: amount as number | undefined, month: month as number | undefined, year: year as number | undefined } as any);
  if (!updated) return res.status(404).json({ error: 'Ingreso no encontrado' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (deleteDemoIncome(req.params.id!)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Ingreso no encontrado' });
  }
});

const _router: Router = router;
export { _router as incomeRouter };
