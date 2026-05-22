import { Router } from 'express';
import { getSupabaseClient } from '@/services/SupabaseService.js';
import { sessionService } from '@/services/SessionService.js';
import { creditCardService } from './CreditCardService.js';
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
      .from('credit_cards')
      .select('*')
      .eq('organization_id', auth.orgId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('CreditCardRouter.get:', err);
    res.status(500).json({ error: 'Error al obtener tarjetas' });
  }
});

router.post('/', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { name, creditLimit, closingDay, dueDay } = req.body as {
    name: string;
    creditLimit?: number | null;
    closingDay: number;
    dueDay: number;
  };

  if (!name || !closingDay || !dueDay) {
    return res.status(400).json({ error: 'name, closingDay y dueDay son requeridos' });
  }

  try {
    const { data, error } = await supabase
      .from('credit_cards')
      .insert({
        organization_id: auth.orgId,
        name,
        credit_limit: creditLimit || null,
        closing_day: closingDay,
        due_day: dueDay,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('CreditCardRouter.post:', err);
    res.status(500).json({ error: 'Error al crear tarjeta' });
  }
});

router.put('/:id', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { name, creditLimit, closingDay, dueDay } = req.body as Record<string, unknown>;

  try {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates['name'] = name;
    if (creditLimit !== undefined) updates['credit_limit'] = creditLimit;
    if (closingDay !== undefined) updates['closing_day'] = closingDay;
    if (dueDay !== undefined) updates['due_day'] = dueDay;

    const { data, error } = await supabase
      .from('credit_cards')
      .update(updates)
      .eq('id', req.params.id!)
      .eq('organization_id', auth.orgId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Tarjeta no encontrada' });
    res.json(data);
  } catch (err) {
    logger.error('CreditCardRouter.put:', err);
    res.status(500).json({ error: 'Error al actualizar tarjeta' });
  }
});

router.delete('/:id', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  try {
    const { error } = await supabase
      .from('credit_cards')
      .delete()
      .eq('id', req.params.id!)
      .eq('organization_id', auth.orgId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error('CreditCardRouter.delete:', err);
    res.status(500).json({ error: 'Error al eliminar tarjeta' });
  }
});

router.get('/installments', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const { month, year } = req.query as { month: string; year: string };
  if (!month || !year) return res.status(400).json({ error: 'month y year son requeridos' });

  const active = await creditCardService.getActiveInstallments(auth.orgId, parseInt(month), parseInt(year));
  const total = active.reduce((s, i) => s + i.installmentValue, 0);

  res.json({ total, count: active.length, items: active });
});

router.get('/:cardId/purchases', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  try {
    const { data, error } = await supabase
      .from('credit_card_purchases')
      .select('*')
      .eq('organization_id', auth.orgId)
      .eq('credit_card_id', req.params.cardId!)
      .order('purchase_date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('CreditCardRouter.purchases.get:', err);
    res.status(500).json({ error: 'Error al obtener compras' });
  }
});

router.post('/:cardId/purchases', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { description, totalAmount, totalInstallments, installmentValue, purchaseDate, firstInstallmentMonth, firstInstallmentYear, category = 'Otros', notes } = req.body as {
    description: string;
    totalAmount: number;
    totalInstallments: number;
    installmentValue: number;
    purchaseDate?: string;
    firstInstallmentMonth: number;
    firstInstallmentYear: number;
    category?: string;
    notes?: string | null;
  };

  if (!description || !totalAmount || !totalInstallments || !installmentValue || !firstInstallmentMonth || !firstInstallmentYear) {
    return res.status(400).json({ error: 'description, totalAmount, totalInstallments, installmentValue, firstInstallmentMonth y firstInstallmentYear son requeridos' });
  }

  try {
    const { data, error } = await supabase
      .from('credit_card_purchases')
      .insert({
        organization_id: auth.orgId,
        credit_card_id: req.params.cardId!,
        description,
        total_amount: totalAmount,
        total_installments: totalInstallments,
        installment_value: installmentValue,
        purchase_date: purchaseDate || new Date().toISOString().split('T')[0],
        first_installment_month: firstInstallmentMonth,
        first_installment_year: firstInstallmentYear,
        category,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('CreditCardRouter.purchases.post:', err);
    res.status(500).json({ error: 'Error al crear compra' });
  }
});

router.delete('/:cardId/purchases/:purchaseId', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  try {
    const { error } = await supabase
      .from('credit_card_purchases')
      .delete()
      .eq('id', req.params.purchaseId!)
      .eq('credit_card_id', req.params.cardId!)
      .eq('organization_id', auth.orgId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error('CreditCardRouter.purchases.delete:', err);
    res.status(500).json({ error: 'Error al eliminar compra' });
  }
});

const _router: Router = router;
export { _router as creditCardRouter };
