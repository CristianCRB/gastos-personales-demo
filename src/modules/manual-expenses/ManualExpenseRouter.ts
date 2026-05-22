import { Router } from 'express';
import { getSupabaseClient } from '@/services/SupabaseService.js';
import { sessionService } from '@/services/SessionService.js';
import { logger } from '@/shared/utils/logger.js';

const router = Router();

function getAuthOrg(authHeader: string | undefined): { orgId: string } | null {
  if (!authHeader) return null;
  const sessionId = authHeader.replace('Bearer ', '');
  if (!sessionId) return null;
  const orgId = sessionService.getOrganizationId();
  return { orgId };
}

router.get('/', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { year, month, category } = req.query as { year?: string; month?: string; category?: string };

  try {
    let query = supabase
      .from('manual_expenses')
      .select('*')
      .eq('organization_id', auth.orgId)
      .order('expense_date', { ascending: false });

    if (year && month) {
      const m = parseInt(month);
      const y = parseInt(year);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDate = new Date(y, m, 0);
      const end = `${y}-${String(m).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      query = query.gte('expense_date', start).lte('expense_date', end);
    } else if (year) {
      query = query.gte('expense_date', `${year}-01-01`).lte('expense_date', `${year}-12-31`);
    }

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('ManualExpenseRouter.get:', err);
    res.status(500).json({ error: 'Error al obtener gastos manuales' });
  }
});

router.post('/', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { description, amount, category = 'Otros', expenseDate, paymentMethod = 'Efectivo', notes } = req.body as {
    description: string;
    amount: number;
    category?: string;
    expenseDate?: string;
    paymentMethod?: string;
    notes?: string | null;
  };

  if (!description || amount === undefined) {
    return res.status(400).json({ error: 'description y amount son requeridos' });
  }

  try {
    const { data, error } = await supabase
      .from('manual_expenses')
      .insert({
        organization_id: auth.orgId,
        description,
        amount,
        category,
        expense_date: expenseDate || new Date().toISOString().split('T')[0],
        payment_method: paymentMethod,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('ManualExpenseRouter.post:', err);
    res.status(500).json({ error: 'Error al crear gasto manual' });
  }
});

router.put('/:id', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { description, amount, category, expenseDate, paymentMethod, notes } = req.body as Record<string, unknown>;

  try {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (description !== undefined) updates['description'] = description;
    if (amount !== undefined) updates['amount'] = amount;
    if (category !== undefined) updates['category'] = category;
    if (expenseDate !== undefined) updates['expense_date'] = expenseDate;
    if (paymentMethod !== undefined) updates['payment_method'] = paymentMethod;
    if (notes !== undefined) updates['notes'] = notes;

    const { data, error } = await supabase
      .from('manual_expenses')
      .update(updates)
      .eq('id', req.params.id!)
      .eq('organization_id', auth.orgId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Gasto no encontrado' });
    res.json(data);
  } catch (err) {
    logger.error('ManualExpenseRouter.put:', err);
    res.status(500).json({ error: 'Error al actualizar gasto' });
  }
});

router.delete('/:id', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  try {
    const { error } = await supabase
      .from('manual_expenses')
      .delete()
      .eq('id', req.params.id!)
      .eq('organization_id', auth.orgId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error('ManualExpenseRouter.delete:', err);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

const _router: Router = router;
export { _router as manualExpenseRouter };
