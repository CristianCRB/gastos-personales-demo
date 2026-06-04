import { Router } from 'express';
import {
  DEMO_SESSION_TOKEN, getAllDemoCards, addDemoCard, updateDemoCard,
  deleteDemoCard, getDemoPurchases, addDemoPurchase, deleteDemoPurchase,
  getDemoActiveInstallments,
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
  res.json(getAllDemoCards());
});

router.post('/', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { name, creditLimit, closingDay, dueDay } = req.body as {
    name: string; creditLimit?: number | null; closingDay: number; dueDay: number;
  };

  if (!name || !closingDay || !dueDay) {
    return res.status(400).json({ error: 'name, closingDay y dueDay son requeridos' });
  }

  res.json(addDemoCard({ name, creditLimit, closingDay, dueDay }));
});

router.put('/:id', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const updated = updateDemoCard(req.params.id!, req.body);
  if (!updated) return res.status(404).json({ error: 'Tarjeta no encontrada' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (deleteDemoCard(req.params.id!)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Tarjeta no encontrada' });
  }
});

router.get('/installments', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { month, year } = req.query as { month: string; year: string };
  if (!month || !year) return res.status(400).json({ error: 'month y year son requeridos' });

  const items = getDemoActiveInstallments(parseInt(month), parseInt(year));
  const total = items.reduce((s, i) => s + i.installmentValue, 0);
  res.json({ total, count: items.length, items });
});

router.get('/:cardId/purchases', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  res.json(getDemoPurchases(req.params.cardId!));
});

router.post('/:cardId/purchases', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { description, totalAmount, totalInstallments, installmentValue, purchaseDate, firstInstallmentMonth, firstInstallmentYear, category, notes } = req.body as {
    description: string; totalAmount: number; totalInstallments: number;
    installmentValue: number; purchaseDate?: string; firstInstallmentMonth: number;
    firstInstallmentYear: number; category?: string; notes?: string | null;
  };

  if (!description || !totalAmount || !totalInstallments || !installmentValue || !firstInstallmentMonth || !firstInstallmentYear) {
    return res.status(400).json({ error: 'Campos requeridos incompletos' });
  }

  res.json(addDemoPurchase(req.params.cardId!, {
    description, totalAmount, totalInstallments, installmentValue,
    purchaseDate, firstInstallmentMonth, firstInstallmentYear, category, notes,
  }));
});

router.delete('/:cardId/purchases/:purchaseId', (req, res) => {
  if (!checkAuth(req.headers.authorization)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (deleteDemoPurchase(req.params.cardId!, req.params.purchaseId!)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Compra no encontrada' });
  }
});

const _router: Router = router;
export { _router as creditCardRouter };
