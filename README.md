# BizFlow ERP — Mini ERP + CRM Operations Portal

A small ERP/CRM for a wholesale/distribution company: customer CRM, product &
inventory management with a full stock-movement audit log, and a sales
challan flow (Draft → Confirm) that atomically reduces stock and never lets
it go negative. Built for the "Mini ERP + CRM Operations Portal" full-stack
case study.

## Architecture

```
┌────────────────────┐        HTTPS / JSON         ┌──────────────────────┐        SQL        ┌────────────┐
│  React frontend     │ ───────────────────────────▶│  Express REST API    │ ─────────────────▶│ PostgreSQL │
│  (TanStack Start,   │◀─────────────────────────── │  (Node.js + TS)      │◀─────────────────  │            │
│  client-rendered)   │      Bearer JWT auth         │  backend/             │                    └────────────┘
└────────────────────┘                              └──────────────────────┘
```

- **Frontend** — `src/`: React + TypeScript, TanStack Start/Router (used purely
  as a client-side SPA router here — `ssr: false` on every authenticated
  route) and TanStack Query for data fetching, Tailwind + shadcn/ui for the
  UI. Talks to the backend exclusively over `fetch` (see `src/lib/api.ts`);
  it holds no direct database access and no business logic.
- **Backend** — `backend/`: a standalone Node.js + TypeScript + Express REST
  API. Owns authentication (JWT, bcrypt password hashing), role-based access
  control, input validation (zod), and every business rule — most
  importantly, atomic stock handling with row-level locking so stock can
  never go negative under concurrent requests. See `backend/README.md` for
  route-by-route details.
- **Database** — plain PostgreSQL (`backend/db/schema.sql`). No
  platform-specific extensions are required — it runs unmodified on a local
  Postgres install or any free managed Postgres (Neon, Supabase's Postgres,
  Render Postgres, Railway, etc.), because the schema only uses core
  PostgreSQL features.

The two halves are fully decoupled: the backend is a normal REST API you
could point a mobile app or Postman at directly, and the frontend never talks
to the database.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Node.js, TypeScript, Express, PostgreSQL (`pg`), JWT (`jsonwebtoken`), `bcryptjs`, `zod` validation |
| Frontend | React, TypeScript, TanStack Start/Router, TanStack Query, Tailwind CSS, shadcn/ui |
| Auth | Simple JWT-based auth, 4 roles: Admin, Sales, Warehouse, Accounts |

## Project layout

```
.
├── backend/                 # Express REST API
│   ├── db/schema.sql        # Postgres schema (tables, triggers, no RLS — auth is app-level)
│   ├── src/
│   │   ├── routes/          # One router per resource (auth, customers, products, ...)
│   │   ├── services/        # Transactional business logic (stock, challans)
│   │   ├── middleware/      # JWT auth, role guard, validation, error handler
│   │   └── scripts/         # db:init (apply schema) and db:seed (demo data)
│   └── README.md            # Full API reference
├── src/                     # React frontend
│   ├── routes/               # File-based routes (dashboard, customers, products, ...)
│   ├── lib/api.ts            # fetch wrapper — the only place that talks to the backend
│   └── lib/auth.tsx          # Auth context (JWT stored in localStorage)
└── postman_collection.json  # Import into Postman to exercise every endpoint
```

## Running locally

You need Node.js 18+ and a PostgreSQL database (local, or a free one from
Neon / Supabase / Render — see below).

### 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env — at minimum set DATABASE_URL to your Postgres connection string
npm install
npm run db:init      # creates tables
npm run db:seed      # optional: demo customers/products + one login per role
npm run dev           # starts the API on http://localhost:4000
```

### 2. Frontend

In a second terminal, from the project root:

```bash
cp .env.example .env   # VITE_API_URL defaults to http://localhost:4000, adjust if needed
npm install
npm run dev
```

The app runs at `http://localhost:5173` and talks to the API at the URL in
`VITE_API_URL`.

### Demo logins

After `npm run db:seed` (password is `Passw0rd!` unless you changed
`SEED_PASSWORD` in `backend/.env`):

| Role | Email |
|---|---|
| Admin | `admin@bizflow.in` |
| Sales | `sales@bizflow.in` |
| Warehouse | `warehouse@bizflow.in` |
| Accounts | `accounts@bizflow.in` |

You can also register a new account from the sign-in page and pick any role —
useful for testing role-based access quickly.

## Environment variables

**`backend/.env`** (see `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `PORT` | Port the API listens on (default `4000`) |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_SSL` | Set `true` for managed Postgres providers that require SSL |
| `JWT_SECRET` | Signing secret for auth tokens — change this before deploying |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `SEED_PASSWORD` | Password used for demo accounts created by `npm run db:seed` |

**`.env`** (frontend, see `.env.example`):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |

## Deployment

No AWS spend is required — this deploys entirely on free tiers:

1. **Database** — create a free Postgres instance on [Neon](https://neon.tech),
   [Supabase](https://supabase.com) (Postgres only, its client SDK isn't
   used), or [Render Postgres](https://render.com). Copy the connection
   string into `DATABASE_URL` (set `DATABASE_SSL=true`).
2. **Backend** — deploy `backend/` to [Render](https://render.com) or
   [Railway](https://railway.app) as a Node web service:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start` (runs `dist/index.js`)
   - Run `npm run db:init` (and optionally `npm run db:seed`) once, either as
     a one-off job or locally against the same `DATABASE_URL`.
   - Set the environment variables above, with `CORS_ORIGIN` set to your
     deployed frontend's URL.
3. **Frontend** — deploy the project root to [Vercel](https://vercel.com) or
   [Netlify](https://netlify.com):
   - Build command: `npm run build`
   - Set `VITE_API_URL` to your deployed backend's URL.

## API overview

Full reference with request/response examples is in
[`backend/README.md`](backend/README.md). Highlights:

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET/POST/PUT /customers`, `GET/POST /customers/:id/followups`
- `GET/POST/PUT /products`
- `GET/POST /stock-movements`
- `GET/POST /challans`, `GET /challans/:id`, `POST /challans/:id/confirm`
- `GET /dashboard`
- `GET /users` (Admin only — team directory)

Every list endpoint supports pagination (`?page=&pageSize=`) and most support
search/filtering. All mutating endpoints validate input with `zod` and return
proper HTTP status codes (`400` validation, `401` unauthenticated, `403`
wrong role, `404` not found, `409` conflict — e.g. insufficient stock).

Import `postman_collection.json` into Postman for ready-made requests against
every endpoint (it uses a collection variable for the base URL and stores the
JWT automatically after login).

## Architecture notes & key decisions

- **Stock is never edited directly.** It only changes through a logged stock
  movement (`IN`/`OUT`), including a product's opening stock at creation
  time and every unit a confirmed challan deducts. `backend/src/services/stock.ts`
  locks the product row (`SELECT ... FOR UPDATE`) inside a transaction before
  adjusting it, so concurrent requests can never push stock negative — an
  `OUT` movement that exceeds available stock is rejected with `409`.
- **Challans snapshot product data.** `challan_items` stores the product
  name, SKU and unit price at the time the challan line was created, so
  historical challans stay accurate even if a product is later renamed,
  repriced, or removed.
- **Confirming a challan is one transaction.** If any line item has
  insufficient stock, the whole confirmation is rolled back — no partial
  stock deductions.
- **Authorization is enforced server-side**, not just hidden in the UI:
  every write route checks the caller's role via `requireRole(...)`
  middleware, so a Sales user calling the Products API directly (e.g. via
  Postman) still gets a `403`.
- **Follow-up notes** are a small append-only log (`customer_followups`)
  separate from the single `notes` field on a customer, so a customer can
  accumulate a dated history of calls/visits instead of overwriting one note.

## Known limitations / not implemented

- No password reset / email verification flow (out of scope for the 48-hour
  brief — registration + login only).
- No file/image uploads (e.g. invoice PDF export, product images) — listed
  as bonus items in the brief and left out to prioritize the core modules.
- No automated test suite.
- `user_roles` is a single role per user rather than many-to-many — the
  brief's four roles map naturally to one role per employee, which also
  keeps the JWT payload simple.
- AWS deployment was not set up; the app deploys to free-tier alternatives
  (Vercel/Render/Neon) as the brief allows.
- No Docker setup or CI/CD pipeline (both are listed as bonus items).

## Assumptions

- "Simple JWT-based authentication" was taken literally: any authenticated
  user can self-register and choose their role (no invite-only admin
  approval step), matching a small internal tool used by a handful of
  trusted employees.
- Challans are scoped to a single company/warehouse context (no multi-tenant
  support), matching the brief's single wholesale/distribution company.
