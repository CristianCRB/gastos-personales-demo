import { Router } from 'express';
import { getSupabaseClient } from '@/services/SupabaseService.js';
import { sessionService } from '@/services/SessionService.js';
import { logger } from '@/shared/utils/logger.js';

const router = Router();

function getAuthOrg(authHeader: string | undefined): { orgId: string; sessionId: string } | null {
  if (!authHeader) return null;
  const sessionId = authHeader.replace('Bearer ', '');
  if (!sessionId) return null;
  const orgId = sessionService.getOrganizationId();
  return { orgId, sessionId };
}

router.get('/', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { year, month } = req.query as { year?: string; month?: string };

  try {
    let query = supabase
      .from('incomes')
      .select('*')
      .eq('organization_id', auth.orgId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (year) query = query.eq('year', parseInt(year));
    if (month) query = query.eq('month', parseInt(month));

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('IncomeRouter.get:', err);
    res.status(500).json({ error: 'Error al obtener ingresos' });
  }
});

router.post('/', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { description = 'Salario', amount, month, year } = req.body as {
    description?: string;
    amount: number;
    month: number;
    year: number;
  };

  if (!amount || !month || !year) {
    return res.status(400).json({ error: 'amount, month y year son requeridos' });
  }

  try {
    const { data: existing } = await supabase
      .from('incomes')
      .select('id')
      .eq('organization_id', auth.orgId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabase
        .from('incomes')
        .update({ amount, description, updated_at: new Date().toISOString() })
        .eq('id', (existing as Record<string, unknown>)['id'])
        .select()
        .single();

      if (error) throw error;
      return res.json(updated);
    }

    const { data, error } = await supabase
      .from('incomes')
      .insert({
        organization_id: auth.orgId,
        description,
        amount,
        month,
        year,
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('IncomeRouter.post:', err);
    res.status(500).json({ error: 'Error al guardar ingreso' });
  }
});

router.put('/:id', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  const { description, amount, month, year } = req.body as Record<string, unknown>;

  try {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (description !== undefined) updates['description'] = description;
    if (amount !== undefined) updates['amount'] = amount;
    if (month !== undefined) updates['month'] = month;
    if (year !== undefined) updates['year'] = year;

    const { data, error } = await supabase
      .from('incomes')
      .update(updates)
      .eq('id', req.params.id!)
      .eq('organization_id', auth.orgId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ingreso no encontrado' });
    res.json(data);
  } catch (err) {
    logger.error('IncomeRouter.put:', err);
    res.status(500).json({ error: 'Error al actualizar ingreso' });
  }
});

router.delete('/:id', async (req, res) => {
  const auth = getAuthOrg(req.headers.authorization);
  if (!auth) return res.status(401).json({ error: 'No autorizado' });

  const supabase = getSupabaseClient();
  if (!supabase) return res.status(503).json({ error: 'Sistema no disponible' });

  try {
    const { error } = await supabase
      .from('incomes')
      .delete()
      .eq('id', req.params.id!)
      .eq('organization_id', auth.orgId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error('IncomeRouter.delete:', err);
    res.status(500).json({ error: 'Error al eliminar ingreso' });
  }
});

const _router: Router = router;
export { _router as incomeRouter };
