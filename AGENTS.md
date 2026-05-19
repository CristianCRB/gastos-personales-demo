# ExpenseFlow AGENTS.md

## Commands

- `pnpm start` — tsx src/server.ts
- `pnpm dev` — tsx --watch src/server.ts
- `pnpm build` — tsc (compila a dist/)
- `pnpm typecheck` — tsc --noEmit
- `pnpm add <pkg>` — add dependency

No tests or lint step exist.

## Architecture (TypeScript — 2026)

```
src/
  server.ts                  # Entry point: init DB, create app, connect WhatsApp
  app.ts                     # Express + Socket.IO wiring, DI injection
  modules/
    whatsapp/                # Baileys connection, QR auth, reconnect (max 3)
    receipts/                # Message handlers: image → Gemini, "gastos"/"estado" summary
    ai/                      # GeminiService: Gemini 2.5 Flash, strict JSON prompt
    dashboard/               # Express routes (/api/*) + SocketManager for real-time events
  services/
    DatabaseService.ts       # SQLite via sql.js — sessions + expenses tables
    SessionService.ts        # Session token management on top of DB
  shared/
    types/                   # Zod-free interfaces: Expense, Session, GeminiReceiptResult
    config/env.ts            # Zod schema for env vars (GEMINI_API_KEY, PORT)
    utils/logger.ts          # Structured console logger with timestamps
  queues/                    # Reserved for future async job processing
  workers/                   # Reserved for future background workers
```

## Key quirks

- ESM (`"type": "module"` in package.json) — all imports use `.js` extension (even .ts files)
- Path alias `@/` maps to `./src/` (resolved at runtime by tsx)
- QR arrives both via Socket.IO event `whatsapp-qr-image` and REST endpoint `/api/qr-login`
- WhatsApp session folder name uses timestamp: `auth_info_${Date.now()}`
- WhatsApp responds to: **image** (receipt → Gemini → save → confirm) and **"gastos" / "estado"** (text summary)
- Gemini prompt demands strict JSON only; response is cleaned of markdown fences; category defaults to "Otros"
- API auth: Bearer token from localStorage `sessionToken`, validated via `/api/check-auth`
- `.env` keys: `GEMINI_API_KEY` (required), `PORT` (default 3000)
- `diseñador.md` has explicit UI style constraints

## Dependency injection pattern

Classes receive `setIO(io)`, `setLogoutCallback(fn)`, etc. at bootstrap time in `app.ts`.
Singletons are exported for convenience (`databaseService`, `sessionService`, `whatsAppService`, etc.)

## Sensitive / gitignored

- `auth_info_*` directories (WhatsApp session credentials)
- `.env`
- `node_modules/`
- `data/` (SQLite database file)
