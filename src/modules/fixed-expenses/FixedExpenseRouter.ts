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

  try {
    const { data, error } = await supabase
      .from('fixed_expenses')
      .select('*')
      .eq('organization_id', auth.orgId)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('FixedExpenseRouter.get:', err);
    res.status(500).json({ error: 'Error al obtener gastos fijos' });
  }
});

router.post('/', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { name, amount, category = 'Servicios', dueDay, isActive = true } = req.body as {
    name: string;
    amount: number;
    category?: string;
    dueDay?: number | null;
    isActive?: boolean;
  };

  if (!name || amount === undefined) {
    return res.status(400).json({ error: 'name y amount son requeridos' });
  }

  try {
    const { data, error } = await supabase
      .from('fixed_expenses')
      .insert({
        organization_id: auth.orgId,
        name,
        amount,
        category,
        due_day: dueDay || null,
        is_active: isActive,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('FixedExpenseRouter.post:', err);
    res.status(500).json({ error: 'Error al crear gasto fijo' });
  }
});

router.put('/:id', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { name, amount, category, dueDay, isActive } = req.body as Record<string, unknown>;

  try {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates['name'] = name;
    if (amount !== undefined) updates['amount'] = amount;
    if (category !== undefined) updates['category'] = category;
    if (dueDay !== undefined) updates['due_day'] = dueDay;
    if (isActive !== undefined) updates['is_active'] = isActive;

    const { data, error } = await supabase
      .from('fixed_expenses')
      .update(updates)
      .eq('id', req.params.id!)
      .eq('organization_id', auth.orgId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Gasto fijo no encontrado' });
    res.json(data);
  } catch (err) {
    logger.error('FixedExpenseRouter.put:', err);
    res.status(500).json({ error: 'Error al actualizar gasto fijo' });
  }
});

router.delete('/:id', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  try {
    const { error } = await supabase
      .from('fixed_expenses')
      .delete()
      .eq('id', req.params.id!)
      .eq('organization_id', auth.orgId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error('FixedExpenseRouter.delete:', err);
    res.status(500).json({ error: 'Error al eliminar gasto fijo' });
  }
});

router.get('/monthly', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { month, year } = req.query as { month: string; year: string };
  if (!month || !year) return res.status(400).json({ error: 'month y year son requeridos' });

  const m = parseInt(month);
  const y = parseInt(year);

  try {
    const { data: fixedExpenses } = await supabase
      .from('fixed_expenses')
      .select('*')
      .eq('organization_id', auth.orgId)
      .eq('is_active', true);

    if (!fixedExpenses) return res.json({ totalPaid: 0, totalPending: 0, allPaid: false, items: [] });

    const { data: payments } = await supabase
      .from('fixed_expense_payments')
      .select('*')
      .eq('organization_id', auth.orgId)
      .eq('month', m)
      .eq('year', y);

    const paymentMap = new Map<string, Record<string, unknown>>();
    for (const p of (payments || []) as Array<Record<string, unknown>>) {
      paymentMap.set(p['fixed_expense_id'] as string, p);
    }

    const items: Array<Record<string, unknown>> = [];
    for (const fe of fixedExpenses as Array<Record<string, unknown>>) {
      const payment = paymentMap.get(fe['id'] as string) || null;
      items.push({
        ...fe,
        payment: payment
          ? {
              id: payment['id'],
              organizationId: payment['organization_id'],
              fixedExpenseId: payment['fixed_expense_id'],
              month: payment['month'],
              year: payment['year'],
              amountPaid: payment['amount_paid'],
              isPaid: payment['is_paid'],
              paidDate: payment['paid_date'],
              createdAt: payment['created_at'],
            }
          : null,
      });
    }

    let totalPaid = 0;
    let totalPending = 0;
    for (const i of items) {
      const p = i['payment'] as Record<string, unknown> | null;
      if (p && p['isPaid']) {
        totalPaid += (p['amountPaid'] as number);
      } else {
        totalPending += (i['amount'] as number);
      }
    }

    res.json({
      totalPaid,
      totalPending,
      allPaid: items.every((i) => {
        const p = i['payment'] as Record<string, unknown> | null;
        return p && p['isPaid'];
      }),
      items,
    });
  } catch (err) {
    logger.error('FixedExpenseRouter.monthly:', err);
    res.status(500).json({ error: 'Error al obtener resumen mensual' });
  }
});

router.post('/:id/pay', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { month, year, isPaid } = req.body as { month: number; year: number; isPaid: boolean };

  if (!month || !year) return res.status(400).json({ error: 'month y year son requeridos' });

  try {
    const { data: fe } = await supabase
      .from('fixed_expenses')
      .select('amount')
      .eq('id', req.params.id!)
      .eq('organization_id', auth.orgId)
      .single();

    if (!fe) return res.status(404).json({ error: 'Gasto fijo no encontrado' });

    const amount = (fe as Record<string, unknown>)['amount'] as number;

    const { data: existing } = await supabase
      .from('fixed_expense_payments')
      .select('id')
      .eq('fixed_expense_id', req.params.id!)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('fixed_expense_payments')
        .update({
          is_paid: isPaid,
          paid_date: isPaid ? new Date().toISOString().split('T')[0] : null,
          amount_paid: amount,
        })
        .eq('id', (existing as Record<string, unknown>)['id'])
        .select()
        .single();

      if (error) throw error;
      return res.json(data);
    }

    const { data, error } = await supabase
      .from('fixed_expense_payments')
      .insert({
        organization_id: auth.orgId,
        fixed_expense_id: req.params.id!,
        month,
        year,
        amount_paid: amount,
        is_paid: isPaid,
        paid_date: isPaid ? new Date().toISOString().split('T')[0] : null,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('FixedExpenseRouter.pay:', err);
    res.status(500).json({ error: 'Error al actualizar pago' });
  }
});

const _router: Router = router;
export { _router as fixedExpenseRouter };
