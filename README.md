# ExpenseFlow Demo

Dashboard financiero personal con datos de ejemplo. Una aplicación web demo para visualizar y gestionar gastos personales, ingresos, tarjetas de crédito y gastos fijos.

## Demo

La aplicación está disponible en **Vercel**: [gastos-personales-demo.vercel.app](https://gastos-personales-demo.vercel.app)

Haz clic en **"Ingresar como Demo"** para explorar el dashboard sin necesidad de registro.

## Funcionalidades

- **Dashboard** — Resumen financiero con balance, gastos del mes, ingresos, evolución 6 meses y gráfico de categorías
- **Gastos** — Lista de gastos (WhatsApp + manuales) con filtro por mes, detalle de artículos, y CRUD completo
- **Ingresos** — Registro de ingresos mensuales (salario) con historial
- **Tarjetas de Crédito** — Control de compras a cuotas con cálculo de cuotas mensuales, saldo restante y deuda total
- **Gastos Fijos** — Gestión de suscripciones y gastos recurrentes con toggle de pago

## Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: HTML + CSS vanilla (sin frameworks)
- **Datos**: 6 meses de datos demo generados en memoria (Enero - Junio 2026)
- **Despliegue**: Vercel (serverless)

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`

## Estructura

```
src/
├── server.ts                         # Entry point (local)
├── app.ts                            # Express app + rutas
├── shared/
│   ├── config/env.ts                 # Config (PORT)
│   └── demo/demoData.ts              # Datos demo + CRUD en memoria
└── modules/
    ├── dashboard/DashboardRouter.ts  # Dashboard + sesión
    ├── income/IncomeRouter.ts        # CRUD ingresos
    ├── manual-expenses/ManualExpenseRouter.ts
    ├── fixed-expenses/FixedExpenseRouter.ts
    ├── credit-cards/CreditCardRouter.ts
    └── summary/SummaryRouter.ts      # Resumen mensual
api/
└── index.ts                          # Entry point serverless (Vercel)
public/
└── index.html                        # Frontend completo
```
