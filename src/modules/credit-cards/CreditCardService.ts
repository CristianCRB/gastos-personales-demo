import { getSupabaseClient } from '@/services/SupabaseService.js';
import { logger } from '@/shared/utils/logger.js';
import type { ActiveInstallment } from '@/shared/types/index.js';

export class CreditCardService {
  async getActiveInstallments(
    orgId: string,
    month: number,
    year: number,
  ): Promise<ActiveInstallment[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const currentN = year * 12 + month;

    try {
      const { data: purchases, error } = await supabase
        .from('credit_card_purchases')
        .select('*, credit_cards!inner(name)')
        .eq('organization_id', orgId);

      if (error || !purchases) {
        logger.error('CreditCardService.getActiveInstallments:', error?.message);
        return [];
      }

      const active: ActiveInstallment[] = [];

      for (const p of purchases as Array<Record<string, unknown>>) {
        const firstYear = p['first_installment_year'] as number;
        const firstMonth = p['first_installment_month'] as number;
        const totalInst = p['total_installments'] as number;
        const startN = firstYear * 12 + firstMonth;
        const endN = startN + totalInst - 1;

        if (currentN >= startN && currentN <= endN) {
          const paidCount = currentN - startN;
          const remaining = endN - currentN + 1;
          const creditCardData = p['credit_cards'] as Record<string, unknown> | undefined;
          const cardName = creditCardData?.['name'] as string || 'Sin nombre';

          active.push({
            purchaseId: p['id'] as string,
            creditCardId: p['credit_card_id'] as string,
            creditCardName: cardName,
            description: p['description'] as string,
            totalAmount: p['total_amount'] as number,
            totalInstallments: totalInst,
            installmentValue: p['installment_value'] as number,
            currentInstallment: paidCount + 1,
            remainingInstallments: remaining,
            category: (p['category'] as string) || 'Otros',
          });
        }
      }

      return active;
    } catch (err) {
      logger.error('CreditCardService.getActiveInstallments:', err);
      return [];
    }
  }
}

export const creditCardService = new CreditCardService();
