import { Router } from 'express';
import { getSupabaseClient } from '@/services/SupabaseService.js';
import { sessionService } from '@/services/SessionService.js';
import { creditCardService } from '@/modules/credit-cards/CreditCardService.js';
import { logger } from '@/shared/utils/logger.js';
import type { MonthlySummary } from '@/shared/types/index.js';

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

  const now = new Date();
  const month = parseInt(req.query.month as string) || (now.getMonth() + 1);
  const year = parseInt(req.query.year as string) || now.getFullYear();

  try {
    const incomePromise = supabase
      .from('incomes')
      .select('*')
      .eq('organization_id', auth.orgId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    const whatsappPromise = supabase
      .from('receipts')
      .select('*')
      .eq('organization_id', auth.orgId)
      .eq('status', 'processed')
      .order('created_at', { ascending: false });

    const manualPromise = supabase
      .from('manual_expenses')
      .select('*')
      .eq('organization_id', auth.orgId)
      .order('expense_date', { ascending: false });

    const fixedPromise = (async () => {
      const { data: fe } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('organization_id', auth.orgId)
        .eq('is_active', true);

      const { data: payments } = await supabase
        .from('fixed_expense_payments')
        .select('*')
        .eq('organization_id', auth.orgId)
        .eq('month', month)
        .eq('year', year);

      const paymentMap = new Map<string, Record<string, unknown>>();
      for (const p of (payments || []) as Array<Record<string, unknown>>) {
        paymentMap.set(p['fixed_expense_id'] as string, p);
      }

      const items: Array<Record<string, unknown>> = [];
      for (const f of (fe || []) as Array<Record<string, unknown>>) {
        const payment = paymentMap.get(f['id'] as string) || null;
        items.push({
          ...f,
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

      return { totalPaid, totalPending, items };
    })();

    const [incomeRes, whatsappRes, manualRes, fixedRes] = await Promise.all([
      incomePromise,
      whatsappPromise,
      manualPromise,
      fixedPromise,
    ]);

    const activeInstallments = await creditCardService.getActiveInstallments(auth.orgId, month, year);
    const installmentTotal = activeInstallments.reduce((s, i) => s + i.installmentValue, 0);

    const incomeRow = incomeRes.data as Record<string, unknown> | null;
    const income = incomeRow
      ? {
          id: incomeRow['id'] as string,
          description: incomeRow['description'] as string,
          amount: incomeRow['amount'] as number,
        }
      : null;

    const allReceipts = (whatsappRes.data || []) as Array<Record<string, unknown>>;
    const manualExpenses = (manualRes.data || []) as Array<Record<string, unknown>>;

    const whatsappThisMonth = allReceipts.filter((r) => {
      const d = r['date'] as string | undefined;
      if (!d) return false;
      const dt = new Date(d);
      return !isNaN(dt.getTime()) && dt.getMonth() + 1 === month && dt.getFullYear() === year;
    });

    const manualThisMonth = manualExpenses.filter((r) => {
      const dt = new Date(r['expense_date'] as string);
      return !isNaN(dt.getTime()) && dt.getMonth() + 1 === month && dt.getFullYear() === year;
    });

    const whatsappTotal = whatsappThisMonth.reduce((s, r) => s + ((r['total'] as number) || 0), 0);
    const manualTotal = manualThisMonth.reduce((s, r) => s + ((r['amount'] as number) || 0), 0);
    const fixedTotal = fixedRes.totalPaid;
    const totalExpenses = whatsappTotal + manualTotal + installmentTotal + fixedTotal;
    const incomeAmount = income?.amount || 0;
    const balance = incomeAmount - totalExpenses;
    const usagePercent = incomeAmount > 0 ? (totalExpenses / incomeAmount) * 100 : 0;

    const alerts: string[] = [];
    if (balance < 0) alerts.push('Gastos superan ingresos este mes');
    if (usagePercent > 80) alerts.push('Has usado más del 80% de tus ingresos');
    if (usagePercent > 60 && usagePercent <= 80) alerts.push('Has usado entre el 60% y 80% de tus ingresos');

    for (const inst of activeInstallments) {
      if (inst.remainingInstallments <= 2) {
        alerts.push(`"${inst.description}" (${inst.creditCardName}) — última${inst.remainingInstallments === 1 ? '' : 's ' + inst.remainingInstallments} cuota${inst.remainingInstallments === 1 ? '' : 's'}`);
      }
    }

    const unpaidCount = fixedRes.items.filter((i: Record<string, unknown>) => {
      const p = i['payment'] as Record<string, unknown> | null;
      return !p || !p['isPaid'];
    }).length;
    if (unpaidCount > 0) {
      alerts.push(`${unpaidCount} gasto${unpaidCount === 1 ? '' : 's'} fijo${unpaidCount === 1 ? '' : 's'} pendiente${unpaidCount === 1 ? '' : 's'} de pago`);
    }

    const byCategory: Record<string, number> = {};
    for (const r of whatsappThisMonth) {
      const cat = (r['category'] as string) || 'Otros';
      byCategory[cat] = (byCategory[cat] || 0) + ((r['total'] as number) || 0);
    }
    for (const r of manualThisMonth) {
      const cat = (r['category'] as string) || 'Otros';
      byCategory[cat] = (byCategory[cat] || 0) + ((r['amount'] as number) || 0);
    }
    for (const inst of activeInstallments) {
      const cat = inst.category || 'Otros';
      byCategory[cat] = (byCategory[cat] || 0) + inst.installmentValue;
    }
    for (const fe of fixedRes.items) {
      const p = fe['payment'] as Record<string, unknown> | null;
      if (p && p['isPaid']) {
        const cat = (fe['category'] as string) || 'Servicios';
        byCategory[cat] = (byCategory[cat] || 0) + (fe['amount'] as number);
      }
    }

    const summary: MonthlySummary = {
      income,
      whatsappExpenses: {
        total: whatsappTotal,
        count: whatsappThisMonth.length,
        items: whatsappThisMonth as unknown as MonthlySummary['whatsappExpenses']['items'],
      },
      manualExpenses: {
        total: manualTotal,
        count: manualThisMonth.length,
        items: manualThisMonth as unknown as MonthlySummary['manualExpenses']['items'],
      },
      creditCardInstallments: {
        total: installmentTotal,
        count: activeInstallments.length,
        items: activeInstallments,
      },
      fixedExpenses: {
        total: fixedTotal,
        count: fixedRes.items.length,
        items: fixedRes.items as unknown as MonthlySummary['fixedExpenses']['items'],
      },
      totalExpenses,
      balance,
      usagePercent: Math.round(usagePercent * 100) / 100,
      byCategory,
      alerts,
    };

    res.json(summary);
  } catch (err) {
    logger.error('SummaryRouter.get:', err);
    res.status(500).json({ error: 'Error al obtener resumen mensual' });
  }
});

const _router: Router = router;
export { _router as summaryRouter };
