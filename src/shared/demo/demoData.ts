const DEMO_ORG_ID = 'demo-org-001';

// ── ID Generator ──────────────────────────────────────────────
let _idSeq = 0;
function id(prefix: string) {
  _idSeq++;
  return `${prefix}-${String(_idSeq).padStart(3, '0')}`;
}

// ── Helpers ───────────────────────────────────────────────────
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dayStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// ── Data Types ────────────────────────────────────────────────
interface DemoIncome {
  id: string; description: string; amount: number; month: number; year: number;
}

interface DemoManualExpense {
  id: string; description: string; amount: number; category: string;
  expense_date: string; payment_method: string; notes: string | null;
}

interface DemoWhatsAppExpense {
  id: string; vendor: string | null; date: string | null; total: number | null;
  currency: string | null; category: string | null;
  items: Array<{ description: string; quantity: number | null; unit_price: number | null; amount: number }>;
  invoiceNumber: string | null; paymentMethod: string | null;
  storagePath: string | null; imageHash: string | null; contentHash: string | null;
  rawResponse: string | null; rawMessage: unknown;
  createdAt: string; status: string;
}

interface DemoCreditCard {
  id: string; name: string; credit_limit: number | null;
  closing_day: number; due_day: number; is_active: boolean;
}

interface DemoPurchase {
  id: string; credit_card_id: string; description: string;
  total_amount: number; total_installments: number; installment_value: number;
  purchase_date: string; first_installment_month: number; first_installment_year: number;
  category: string; notes: string | null;
}

interface DemoFixedExpense {
  id: string; name: string; amount: number; category: string;
  due_day: number | null; is_active: boolean;
}

interface DemoFixedPayment {
  id: string; fixed_expense_id: string; month: number; year: number;
  amount_paid: number; is_paid: boolean; paid_date: string | null;
}

// ── Data Stores (mutable for CRUD) ────────────────────────────
let demoIncomes: DemoIncome[] = [];
let demoWhatsApp: DemoWhatsAppExpense[] = [];
let demoManual: DemoManualExpense[] = [];
let demoCards: DemoCreditCard[] = [];
let demoPurchases: DemoPurchase[] = [];
let demoFixed: DemoFixedExpense[] = [];
let demoPayments: DemoFixedPayment[] = [];

// ── Initialize Demo Store ─────────────────────────────────────
export function initializeDemoStore(): void {
  _idSeq = 0;

  // ──── Incomes ────
  const incomes: DemoIncome[] = [];
  for (let m = 1; m <= 6; m++) {
    incomes.push({
      id: id('income'), description: 'Salario', amount: m === 1 ? 4000 : 3500, month: m, year: 2026,
    });
  }
  demoIncomes = incomes;

  // ──── WhatsApp Expenses per month ────
  const whatsappData: DemoWhatsAppExpense[] = [];

  function addWA(month: number, year: number, vendor: string, day: number, total: number, category: string, items: Array<{ desc: string; qty: number | null; up: number | null; amt: number }>) {
    const date = dayStr(year, month, day);
    const createdAt = `${date}T${pad(10 + items.length)}:00:00Z`;
    whatsappData.push({
      id: id('exp'), vendor, date, total, currency: 'ARS', category,
      items: items.map(i => ({ description: i.desc, quantity: i.qty, unit_price: i.up, amount: i.amt })),
      invoiceNumber: `FC-${pad(month)}-${pad(day)}-${year}`,
      paymentMethod: 'Debito',
      storagePath: null, imageHash: null, contentHash: null,
      rawResponse: null, rawMessage: {},
      createdAt, status: 'processed',
    });
  }

  // Jan 2026
  addWA(1, 2026, 'Supermercado Coto', 5, 287.50, 'Alimentos', [
    { desc: 'Carne Vacuna', qty: 3, up: 28.50, amt: 85.50 },
    { desc: 'Leche x6', qty: 2, up: 13.00, amt: 26.00 },
    { desc: 'Pan Lactal', qty: 3, up: 4.80, amt: 14.40 },
    { desc: 'Huevos x12', qty: 2, up: 9.00, amt: 18.00 },
    { desc: 'Queso Cremoso', qty: 1, up: 18.60, amt: 18.60 },
  ]);
  addWA(1, 2026, 'Uber', 8, 52.30, 'Transporte', [
    { desc: 'Viaje Aeropuerto EZE', qty: 1, up: 52.30, amt: 52.30 },
  ]);
  addWA(1, 2026, 'Farmacity', 12, 28.40, 'Salud', [
    { desc: 'Ibuprofeno 400mg x30', qty: 2, up: 8.20, amt: 16.40 },
    { desc: 'Vitamina C x60', qty: 1, up: 12.00, amt: 12.00 },
  ]);
  addWA(1, 2026, 'PedidosYa', 15, 35.00, 'Alimentos', [
    { desc: 'Pizza Mozzarella', qty: 1, up: 22.00, amt: 22.00 },
    { desc: 'Empanadas x6', qty: 1, up: 13.00, amt: 13.00 },
  ]);
  addWA(1, 2026, 'Shell', 20, 72.00, 'Transporte', [
    { desc: 'Nafta Super x30L', qty: 30, up: 2.40, amt: 72.00 },
  ]);

  // Feb 2026
  addWA(2, 2026, 'Disco Jumbo', 3, 156.30, 'Alimentos', [
    { desc: 'Arroz x5kg', qty: 1, up: 22.50, amt: 22.50 },
    { desc: 'Aceite Oliva', qty: 2, up: 15.00, amt: 30.00 },
    { desc: 'Pollo Entero', qty: 3, up: 12.60, amt: 37.80 },
    { desc: 'Verduras Varias', qty: 1, up: 28.00, amt: 28.00 },
  ]);
  addWA(2, 2026, 'Uber', 7, 38.50, 'Transporte', [
    { desc: 'Viaje Oficina', qty: 1, up: 38.50, amt: 38.50 },
  ]);
  addWA(2, 2026, 'Amazon', 10, 89.99, 'Tecnologia', [
    { desc: 'Mouse Logitech', qty: 1, up: 89.99, amt: 89.99 },
  ]);
  addWA(2, 2026, 'Rappi', 14, 42.00, 'Alimentos', [
    { desc: 'Sushi Roll x12', qty: 2, up: 21.00, amt: 42.00 },
  ]);
  addWA(2, 2026, 'Shell', 22, 58.00, 'Transporte', [
    { desc: 'Nafta Super x24L', qty: 24, up: 2.42, amt: 58.08 },
  ]);

  // Mar 2026
  addWA(3, 2026, 'Carrefour', 4, 198.20, 'Alimentos', [
    { desc: 'Milanesas Pollo', qty: 2, up: 22.00, amt: 44.00 },
    { desc: 'Lentejas x1kg', qty: 1, up: 8.50, amt: 8.50 },
    { desc: 'Yogurt Griego x4', qty: 2, up: 12.00, amt: 24.00 },
    { desc: 'Galletitas surtido', qty: 3, up: 5.60, amt: 16.80 },
  ]);
  addWA(3, 2026, 'Cabify', 9, 22.00, 'Transporte', [
    { desc: 'Viaje Centro', qty: 1, up: 22.00, amt: 22.00 },
  ]);
  addWA(3, 2026, 'Rappi', 13, 35.50, 'Alimentos', [
    { desc: 'Hamburguesa Completa', qty: 2, up: 17.75, amt: 35.50 },
  ]);
  addWA(3, 2026, 'Netflix', 18, 11.99, 'Entretenimiento', [
    { desc: 'Suscripcion Mensual', qty: 1, up: 11.99, amt: 11.99 },
  ]);
  addWA(3, 2026, 'Farmacity', 22, 15.00, 'Salud', [
    { desc: 'Alcohol en Gel', qty: 2, up: 7.50, amt: 15.00 },
  ]);

  // Apr 2026
  addWA(4, 2026, 'Supermercado Coto', 2, 245.00, 'Alimentos', [
    { desc: 'Cerveza Artesanal x6', qty: 2, up: 18.00, amt: 36.00 },
    { desc: 'Papel Higienico x12', qty: 1, up: 24.00, amt: 24.00 },
    { desc: 'Detergente', qty: 2, up: 8.50, amt: 17.00 },
    { desc: 'Fideos x500g', qty: 5, up: 3.20, amt: 16.00 },
  ]);
  addWA(4, 2026, 'Uber', 6, 55.30, 'Transporte', [
    { desc: 'Viaje Aeropuerto AEP', qty: 1, up: 55.30, amt: 55.30 },
  ]);
  addWA(4, 2026, 'Spotify', 12, 9.99, 'Entretenimiento', [
    { desc: 'Suscripcion Premium', qty: 1, up: 9.99, amt: 9.99 },
  ]);
  addWA(4, 2026, 'PedidosYa', 18, 28.00, 'Alimentos', [
    { desc: 'Lomito Completo', qty: 1, up: 28.00, amt: 28.00 },
  ]);
  addWA(4, 2026, 'YPF', 25, 65.00, 'Transporte', [
    { desc: 'Diesel x25L', qty: 25, up: 2.60, amt: 65.00 },
  ]);

  // May 2026
  addWA(5, 2026, 'Disco Jumbo', 4, 178.40, 'Alimentos', [
    { desc: 'Cafe Molido x500g', qty: 1, up: 32.00, amt: 32.00 },
    { desc: 'Avena x1kg', qty: 2, up: 6.50, amt: 13.00 },
    { desc: 'Tomate Lata x6', qty: 2, up: 7.20, amt: 14.40 },
    { desc: 'Atun x6 latas', qty: 1, up: 18.00, amt: 18.00 },
  ]);
  addWA(5, 2026, 'Didi', 8, 28.00, 'Transporte', [
    { desc: 'Viaje Casa-Oficina', qty: 1, up: 28.00, amt: 28.00 },
  ]);
  addWA(5, 2026, 'Farmacity', 14, 45.60, 'Salud', [
    { desc: 'Protector Solar', qty: 1, up: 28.60, amt: 28.60 },
    { desc: 'Shampoo', qty: 1, up: 17.00, amt: 17.00 },
  ]);
  addWA(5, 2026, 'Netflix', 19, 11.99, 'Entretenimiento', [
    { desc: 'Suscripcion Mensual', qty: 1, up: 11.99, amt: 11.99 },
  ]);
  addWA(5, 2026, 'Uber', 25, 42.00, 'Transporte', [
    { desc: 'Viaje Restaurante', qty: 1, up: 42.00, amt: 42.00 },
  ]);

  // Jun 2026
  addWA(6, 2026, 'Carrefour', 2, 212.00, 'Alimentos', [
    { desc: 'Carne Vacuna', qty: 2, up: 25.50, amt: 51.00 },
    { desc: 'Leche x6', qty: 1, up: 12.80, amt: 12.80 },
    { desc: 'Pan Lactal', qty: 2, up: 4.50, amt: 9.00 },
    { desc: 'Huevos x12', qty: 1, up: 8.40, amt: 8.40 },
    { desc: 'Queso Cremoso', qty: 1, up: 15.30, amt: 15.30 },
  ]);
  addWA(6, 2026, 'Uber', 5, 42.00, 'Transporte', [
    { desc: 'Viaje Oficina', qty: 1, up: 42.00, amt: 42.00 },
  ]);
  addWA(6, 2026, 'PedidosYa', 10, 31.50, 'Alimentos', [
    { desc: 'Tacos x4', qty: 2, up: 15.75, amt: 31.50 },
  ]);
  addWA(6, 2026, 'Netflix', 15, 11.99, 'Entretenimiento', [
    { desc: 'Suscripcion Mensual', qty: 1, up: 11.99, amt: 11.99 },
  ]);

  demoWhatsApp = whatsappData;

  // ──── Manual Expenses per month ────
  const manualData: DemoManualExpense[] = [];

  function addManual(month: number, year: number, desc: string, day: number, amount: number, category: string, payment: string) {
    manualData.push({
      id: id('manual'), description: desc, amount, category,
      expense_date: dayStr(year, month, day),
      payment_method: payment, notes: null,
    });
  }

  const manualPerMonth: Array<[number, string, number, string, string]> = [
    [3, 'Cafe Martinez', 4.50, 'Alimentos', 'Efectivo'],
    [8, 'Taxi', 12.00, 'Transporte', 'Efectivo'],
    [14, 'Propina Restaurant', 8.00, 'Alimentos', 'Efectivo'],
    [18, 'Estacionamiento', 6.00, 'Transporte', 'Efectivo'],
    [25, 'Diario La Nacion', 2.50, 'Entretenimiento', 'Efectivo'],
  ];

  for (let m = 1; m <= 6; m++) {
    for (const [day, desc, amt, cat, pay] of manualPerMonth) {
      addManual(m, 2026, desc, day, amt, cat, pay);
    }
  }
  demoManual = manualData;

  // ──── Credit Cards ────
  const cards: DemoCreditCard[] = [
    { id: id('cc'), name: 'Visa Clásica', credit_limit: 5000, closing_day: 15, due_day: 22, is_active: true },
    { id: id('cc'), name: 'Mastercard Black', credit_limit: 3000, closing_day: 20, due_day: 28, is_active: true },
    { id: id('cc'), name: 'Amex Gold', credit_limit: 2000, closing_day: 5, due_day: 12, is_active: true },
  ];
  demoCards = cards;

  // ──── Purchases ────
  const purchaseData: DemoPurchase[] = [
    {
      id: id('pch'), credit_card_id: cards[0]!.id, description: 'TV Samsung 55" 4K',
      total_amount: 1200, total_installments: 12, installment_value: 100,
      purchase_date: '2025-10-15', first_installment_month: 10, first_installment_year: 2025,
      category: 'Tecnologia', notes: null,
    },
    {
      id: id('pch'), credit_card_id: cards[1]!.id, description: 'iPhone 16 Pro 256GB',
      total_amount: 1800, total_installments: 24, installment_value: 75,
      purchase_date: '2026-03-10', first_installment_month: 3, first_installment_year: 2026,
      category: 'Tecnologia', notes: null,
    },
    {
      id: id('pch'), credit_card_id: cards[0]!.id, description: 'Cama King Size',
      total_amount: 600, total_installments: 6, installment_value: 100,
      purchase_date: '2026-01-20', first_installment_month: 1, first_installment_year: 2026,
      category: 'Hogar', notes: null,
    },
    {
      id: id('pch'), credit_card_id: cards[1]!.id, description: 'MacBook Air M4',
      total_amount: 2400, total_installments: 18, installment_value: 133.33,
      purchase_date: '2026-04-05', first_installment_month: 4, first_installment_year: 2026,
      category: 'Tecnologia', notes: null,
    },
    {
      id: id('pch'), credit_card_id: cards[2]!.id, description: 'Audifonos Sony WH-1000XM5',
      total_amount: 350, total_installments: 3, installment_value: 116.67,
      purchase_date: '2026-05-12', first_installment_month: 5, first_installment_year: 2026,
      category: 'Entretenimiento', notes: null,
    },
  ];
  demoPurchases = purchaseData;

  // ──── Fixed Expenses ────
  const fixedData: DemoFixedExpense[] = [
    { id: id('fixed'), name: 'Netflix', amount: 11.99, category: 'Entretenimiento', due_day: 18, is_active: true },
    { id: id('fixed'), name: 'Spotify', amount: 9.99, category: 'Entretenimiento', due_day: 12, is_active: true },
    { id: id('fixed'), name: 'Internet Fibra', amount: 45.00, category: 'Servicios', due_day: 8, is_active: true },
    { id: id('fixed'), name: 'Renta', amount: 850.00, category: 'Vivienda', due_day: 5, is_active: true },
    { id: id('fixed'), name: 'Gimnasio SportClub', amount: 35.00, category: 'Salud', due_day: 1, is_active: true },
    { id: id('fixed'), name: 'Seguro Auto', amount: 120.00, category: 'Servicios', due_day: 15, is_active: true },
  ];
  demoFixed = fixedData;

  // ──── Fixed Payments ────
  const paymentData: DemoFixedPayment[] = [];

  for (let m = 1; m <= 5; m++) {
    for (const fe of fixedData) {
      paymentData.push({
        id: id('pay'), fixed_expense_id: fe.id, month: m, year: 2026,
        amount_paid: fe.amount, is_paid: true,
        paid_date: dayStr(2026, m, Math.min(fe.due_day ?? 1, 28)),
      });
    }
  }

  for (const fe of fixedData) {
    const isGym = fe.name === 'Gimnasio SportClub';
    paymentData.push({
      id: id('pay'), fixed_expense_id: fe.id, month: 6, year: 2026,
      amount_paid: fe.amount, is_paid: !isGym,
      paid_date: isGym ? null : dayStr(2026, 6, 1),
    });
  }

  demoPayments = paymentData;
}

// ── Session ────────────────────────────────────────────────────
export const DEMO_SESSION_TOKEN = 'demo-session-token';

// ── Query Functions ───────────────────────────────────────────

export function getAllDemoIncomes(): DemoIncome[] {
  return [...demoIncomes];
}

export function getDemoIncomesFiltered(month?: number, year?: number): DemoIncome[] {
  let result = [...demoIncomes];
  if (year) result = result.filter(i => i.year === year);
  if (month) result = result.filter(i => i.month === month);
  return result.sort((a, b) => b.year - a.year || b.month - a.month);
}

interface IncomeInput { description: string; amount: number; month: number; year: number }

export function addDemoIncome(data: IncomeInput): DemoIncome {
  const existing = demoIncomes.find(i => i.month === data.month && i.year === data.year);
  if (existing) {
    existing.amount = data.amount;
    existing.description = data.description;
    return existing;
  }
  const entry: DemoIncome = { id: id('income'), ...data };
  demoIncomes.push(entry);
  return entry;
}

export function updateDemoIncome(id: string, data: Partial<DemoIncome>): DemoIncome | null {
  const idx = demoIncomes.findIndex(i => i.id === id);
  if (idx === -1) return null;
  Object.assign(demoIncomes[idx]!, data);
  return demoIncomes[idx]!;
}

export function deleteDemoIncome(id: string): boolean {
  const idx = demoIncomes.findIndex(i => i.id === id);
  if (idx === -1) return false;
  demoIncomes.splice(idx, 1);
  return true;
}

export function getAllDemoWhatsApp(): DemoWhatsAppExpense[] {
  return [...demoWhatsApp];
}

export function getAllDemoManual(): DemoManualExpense[] {
  return [...demoManual];
}

export function getDemoManualFiltered(year: number, month: number, category?: string): DemoManualExpense[] {
  let result = demoManual.filter(e => {
    const d = new Date(e.expense_date);
    return !isNaN(d.getTime()) && d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  if (category) result = result.filter(e => e.category === category);
  return result.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
}

export function addDemoManual(data: {
  description: string; amount: number; category: string;
  expenseDate?: string; paymentMethod?: string; notes?: string | null;
}): DemoManualExpense {
  const dateStr = new Date().toISOString().split('T')[0];
  const entry = {
    id: id('manual'), description: data.description, amount: data.amount,
    category: data.category,
    expense_date: data.expenseDate || dateStr,
    payment_method: data.paymentMethod || 'Efectivo',
    notes: data.notes || null,
  } as DemoManualExpense;
  demoManual.push(entry);
  return entry;
}

export function updateDemoManual(id: string, data: Record<string, unknown>): DemoManualExpense | null {
  const idx = demoManual.findIndex(e => e.id === id);
  if (idx === -1) return null;
  const e = demoManual[idx]!;
  if (data['description'] !== undefined) e.description = data['description'] as string;
  if (data['amount'] !== undefined) e.amount = data['amount'] as number;
  if (data['category'] !== undefined) e.category = data['category'] as string;
  if (data['expenseDate'] !== undefined) e.expense_date = data['expenseDate'] as string;
  if (data['paymentMethod'] !== undefined) e.payment_method = data['paymentMethod'] as string;
  if (data['notes'] !== undefined) e.notes = data['notes'] as string | null;
  return e;
}

export function deleteDemoManual(id: string): boolean {
  const idx = demoManual.findIndex(e => e.id === id);
  if (idx === -1) return false;
  demoManual.splice(idx, 1);
  return true;
}

export function getAllDemoCards(): DemoCreditCard[] {
  return [...demoCards];
}

interface CardInput { name: string; creditLimit?: number | null; closingDay: number; dueDay: number }

export function addDemoCard(data: CardInput): DemoCreditCard {
  const entry: DemoCreditCard = {
    id: id('cc'), name: data.name, credit_limit: data.creditLimit ?? null,
    closing_day: data.closingDay, due_day: data.dueDay, is_active: true,
  };
  demoCards.push(entry);
  return entry;
}

export function updateDemoCard(id: string, data: Record<string, unknown>): DemoCreditCard | null {
  const idx = demoCards.findIndex(c => c.id === id);
  if (idx === -1) return null;
  const c = demoCards[idx]!;
  if (data['name'] !== undefined) c.name = data['name'] as string;
  if (data['creditLimit'] !== undefined) c.credit_limit = data['creditLimit'] as number | null;
  if (data['closingDay'] !== undefined) c.closing_day = data['closingDay'] as number;
  if (data['dueDay'] !== undefined) c.due_day = data['dueDay'] as number;
  return c;
}

export function deleteDemoCard(id: string): boolean {
  const idx = demoCards.findIndex(c => c.id === id);
  if (idx === -1) return false;
  demoCards.splice(idx, 1);
  demoPurchases = demoPurchases.filter(p => p.credit_card_id !== id);
  return true;
}

export function getDemoPurchases(cardId: string): DemoPurchase[] {
  return demoPurchases.filter(p => p.credit_card_id === cardId)
    .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));
}

export function addDemoPurchase(cardId: string, data: {
  description: string; totalAmount: number; totalInstallments: number;
  installmentValue: number; purchaseDate?: string; firstInstallmentMonth: number;
  firstInstallmentYear: number; category?: string; notes?: string | null;
}): DemoPurchase {
  const dateStr = new Date().toISOString().split('T')[0];
  const entry = {
    id: id('pch'), credit_card_id: cardId,
    description: data.description, total_amount: data.totalAmount,
    total_installments: data.totalInstallments, installment_value: data.installmentValue,
    purchase_date: data.purchaseDate || dateStr,
    first_installment_month: data.firstInstallmentMonth,
    first_installment_year: data.firstInstallmentYear,
    category: data.category || 'Otros',
    notes: data.notes || null,
  } as DemoPurchase;
  demoPurchases.push(entry);
  return entry;
}

export function deleteDemoPurchase(cardId: string, purchaseId: string): boolean {
  const idx = demoPurchases.findIndex(p => p.id === purchaseId && p.credit_card_id === cardId);
  if (idx === -1) return false;
  demoPurchases.splice(idx, 1);
  return true;
}

interface ActiveInstallmentDemo {
  purchaseId: string;
  creditCardId: string;
  creditCardName: string;
  description: string;
  totalAmount: number;
  totalInstallments: number;
  installmentValue: number;
  currentInstallment: number;
  remainingInstallments: number;
  category: string;
}

export function getDemoActiveInstallments(month: number, year: number): ActiveInstallmentDemo[] {
  const current = year * 12 + month;
  const result: ActiveInstallmentDemo[] = [];

  for (const p of demoPurchases) {
    if (!p.installment_value || p.installment_value <= 0) continue;
    const start = p.first_installment_year * 12 + p.first_installment_month;
    const end = start + p.total_installments - 1;
    if (current >= start && current <= end) {
      const card = demoCards.find(c => c.id === p.credit_card_id);
      const paidCount = current - start;
      const remaining = end - current + 1;
      result.push({
        purchaseId: p.id,
        creditCardId: p.credit_card_id,
        creditCardName: card?.name ?? 'Desconocida',
        description: p.description,
        totalAmount: p.total_amount,
        totalInstallments: p.total_installments,
        installmentValue: p.installment_value,
        currentInstallment: paidCount,
        remainingInstallments: remaining,
        category: p.category,
      });
    }
  }
  return result;
}

export function getAllDemoFixed(): DemoFixedExpense[] {
  return [...demoFixed];
}

interface FixedInput { name: string; amount: number; category?: string; dueDay?: number | null; isActive?: boolean }

export function addDemoFixed(data: FixedInput): DemoFixedExpense {
  const entry: DemoFixedExpense = {
    id: id('fixed'), name: data.name, amount: data.amount,
    category: data.category ?? 'Servicios', due_day: data.dueDay ?? null,
    is_active: data.isActive ?? true,
  };
  demoFixed.push(entry);
  return entry;
}

export function updateDemoFixed(id: string, data: Record<string, unknown>): DemoFixedExpense | null {
  const idx = demoFixed.findIndex(f => f.id === id);
  if (idx === -1) return null;
  const f = demoFixed[idx]!;
  if (data['name'] !== undefined) f.name = data['name'] as string;
  if (data['amount'] !== undefined) f.amount = data['amount'] as number;
  if (data['category'] !== undefined) f.category = data['category'] as string;
  if (data['dueDay'] !== undefined) f.due_day = data['dueDay'] as number | null;
  if (data['isActive'] !== undefined) f.is_active = data['isActive'] as boolean;
  return f;
}

export function deleteDemoFixed(id: string): boolean {
  const idx = demoFixed.findIndex(f => f.id === id);
  if (idx === -1) return false;
  demoFixed.splice(idx, 1);
  demoPayments = demoPayments.filter(p => p.fixed_expense_id !== id);
  return true;
}

export function getDemoFixedMonthly(month: number, year: number) {
  const active = demoFixed.filter(f => f.is_active);
  const monthPayments = demoPayments.filter(p => p.month === month && p.year === year);
  const pmtMap = new Map<string, DemoFixedPayment>();
  for (const p of monthPayments) pmtMap.set(p.fixed_expense_id, p);

  const items = active.map(fe => {
    const payment = pmtMap.get(fe.id) || null;
    return {
      id: fe.id, name: fe.name, amount: fe.amount, category: fe.category,
      due_day: fe.due_day, is_active: fe.is_active,
      payment: payment ? {
        id: payment.id, organizationId: DEMO_ORG_ID,
        fixedExpenseId: payment.fixed_expense_id,
        month: payment.month, year: payment.year,
        amountPaid: payment.amount_paid, isPaid: payment.is_paid,
        paidDate: payment.paid_date, createdAt: '',
      } : null,
    };
  });

  let totalPaid = 0;
  let totalPending = 0;
  for (const i of items) {
    if (i.payment?.isPaid) totalPaid += i.amount;
    else totalPending += i.amount;
  }

  return { totalPaid, totalPending, allPaid: items.every(i => i.payment?.isPaid), items };
}

export function toggleDemoFixedPayment(fixedExpenseId: string, month: number, year: number, isPaid: boolean) {
  const fe = demoFixed.find(f => f.id === fixedExpenseId);
  if (!fe) return null;

  const existing = demoPayments.find(p => p.fixed_expense_id === fixedExpenseId && p.month === month && p.year === year);
  if (existing) {
    existing.is_paid = isPaid;
    existing.paid_date = isPaid ? dayStr(year, month, Math.min(fe.due_day ?? 1, 28)) : null;
    return existing;
  }

  const entry: DemoFixedPayment = {
    id: id('pay'), fixed_expense_id: fixedExpenseId,
    month, year, amount_paid: fe.amount, is_paid: isPaid,
    paid_date: isPaid ? dayStr(year, month, Math.min(fe.due_day ?? 1, 28)) : null,
  };
  demoPayments.push(entry);
  return entry;
}

export function getDemoStats() {
  const totalCount = demoWhatsApp.length;
  const totalExpenses = demoWhatsApp.reduce((s, e) => s + (e.total || 0), 0);
  const byCategory: Record<string, number> = {};
  const byVendor: Record<string, number> = {};
  for (const e of demoWhatsApp) {
    const cat = e.category || 'Otros';
    byCategory[cat] = (byCategory[cat] || 0) + (e.total || 0);
    if (e.vendor) byVendor[e.vendor] = (byVendor[e.vendor] || 0) + (e.total || 0);
  }
  const sorted = [...demoWhatsApp].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return { totalExpenses, totalCount, byCategory, byVendor, lastExpense: sorted[0] || null };
}

interface MonthlySummaryResult {
  income: { id: string; description: string; amount: number } | null;
  whatsappExpenses: { total: number; count: number; items: DemoWhatsAppExpense[] };
  manualExpenses: { total: number; count: number; items: DemoManualExpense[] };
  creditCardInstallments: { total: number; count: number; items: ActiveInstallmentDemo[] };
  fixedExpenses: { total: number; count: number; items: Array<Record<string, unknown>> };
  totalExpenses: number;
  balance: number;
  usagePercent: number;
  byCategory: Record<string, number>;
  alerts: string[];
}

export function getDemoMonthlySummary(month: number, year: number): MonthlySummaryResult {
  const income = demoIncomes.find(i => i.month === month && i.year === year) || null;
  const incomeAmount = income?.amount || 0;

  const whatsAppThisMonth = demoWhatsApp.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return !isNaN(d.getTime()) && d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const whatsappTotal = whatsAppThisMonth.reduce((s, e) => s + (e.total || 0), 0);

  const manualThisMonth = demoManual.filter(e => {
    const d = new Date(e.expense_date);
    return !isNaN(d.getTime()) && d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const manualTotal = manualThisMonth.reduce((s, e) => s + e.amount, 0);

  const activeInstallments = getDemoActiveInstallments(month, year);
  const installmentTotal = activeInstallments.reduce((s, i) => s + i.installmentValue, 0);

  const fixedMonthly = getDemoFixedMonthly(month, year);
  const fixedTotal = fixedMonthly.totalPaid;

  const totalExpenses = whatsappTotal + manualTotal + installmentTotal + fixedTotal;
  const balance = incomeAmount - totalExpenses;
  const usagePercent = incomeAmount > 0 ? (totalExpenses / incomeAmount) * 100 : 0;

  const alerts: string[] = [];
  if (balance < 0) alerts.push('Gastos superan ingresos este mes');
  if (usagePercent > 80) alerts.push('Has usado más del 80% de tus ingresos');
  if (usagePercent > 60 && usagePercent <= 80) alerts.push('Has usado entre el 60% y 80% de tus ingresos');
  for (const inst of activeInstallments) {
    if (inst.remainingInstallments <= 2) {
      const label = inst.remainingInstallments === 1 ? 'última cuota' : `últimas ${inst.remainingInstallments} cuotas`;
      alerts.push(`"${inst.description}" (${inst.creditCardName}) — ${label}`);
    }
  }
  const unpaidFixed = fixedMonthly.items.filter((i: Record<string, unknown>) => {
    const p = i['payment'] as Record<string, unknown> | null;
    return !p || !p['isPaid'];
  });
  if (unpaidFixed.length > 0) {
    const count = unpaidFixed.length;
    alerts.push(`${count} gasto${count === 1 ? '' : 's'} fijo${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'} de pago`);
  }

  const byCategory: Record<string, number> = {};
  for (const e of whatsAppThisMonth) {
    const cat = e.category || 'Otros';
    byCategory[cat] = (byCategory[cat] || 0) + (e.total || 0);
  }
  for (const e of manualThisMonth) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }
  for (const inst of activeInstallments) {
    const cat = inst.category || 'Otros';
    byCategory[cat] = (byCategory[cat] || 0) + inst.installmentValue;
  }
  for (const fe of fixedMonthly.items) {
    const p = fe['payment'] as Record<string, unknown> | null;
    if (p && p['isPaid']) {
      byCategory[fe['category'] as string] = (byCategory[fe['category'] as string] || 0) + (fe['amount'] as number);
    }
  }

  return {
    income: income ? { id: income.id, description: income.description, amount: income.amount } : null,
    whatsappExpenses: { total: whatsappTotal, count: whatsAppThisMonth.length, items: whatsAppThisMonth },
    manualExpenses: { total: manualTotal, count: manualThisMonth.length, items: manualThisMonth },
    creditCardInstallments: { total: installmentTotal, count: activeInstallments.length, items: activeInstallments },
    fixedExpenses: { total: fixedTotal, count: fixedMonthly.items.length, items: fixedMonthly.items },
    totalExpenses, balance,
    usagePercent: Math.round(usagePercent * 100) / 100,
    byCategory, alerts,
  };
}
