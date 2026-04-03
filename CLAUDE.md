# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Defenz Dashboard** is a multi-page sales intelligence platform for the Defenz cybersecurity company. It provides executive metrics (revenue, commissions, funnel) and operational deal tracking (activity timelines, aging, stale alerts). Data is sourced from Google Sheets (populated by an N8N workflow from Zoho CRM, Apollo, and Microsoft Calendar). There is no database.

## Key Technologies

- **Framework**: Next.js 16 (App Router)
- **Runtime**: React 19
- **Styling**: Tailwind CSS 4 with CSS custom properties ("Defenz Lux" theme)
- **Animations**: Framer Motion
- **Charts**: Recharts (operational charts) + custom SVG funnel (`FunnelChart.tsx`)
- **Excel export**: exceljs (multi-sheet styled exports)
- **Date handling**: date-fns with pt-BR locale, react-day-picker
- **UI primitives**: Radix UI (Popover), Lucide icons
- **Auth**: Custom HMAC-SHA256 signed cookies (no NextAuth, no third-party auth)
- **Utilities**: clsx, tailwind-merge

## Development Commands

```bash
npm run dev       # Start dev server (Turbopack)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # Run ESLint
```

There are no database commands, no test commands, and no test suite.

## Architecture

### File Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout (Outfit + Inter fonts, pt-BR lang)
│   ├── globals.css                   # Defenz Lux theme (white + red) + Tailwind 4
│   ├── login/
│   │   ├── page.tsx                  # Login page (password-only)
│   │   ├── actions.ts                # Server action: loginAction
│   │   └── _components/
│   │       └── LoginForm.tsx         # Client-side login form
│   ├── (dashboard)/                  # Route group (shared navbar + DateRangeProvider)
│   │   ├── layout.tsx                # Navbar + ClientProviders + ErrorBoundary
│   │   ├── providers.tsx             # Client-side DateRangeProvider wrapper
│   │   ├── page.tsx                  # / → ExecutiveDashboard
│   │   ├── operacional/
│   │   │   └── page.tsx              # /operacional → OperationalDashboard
│   │   ├── atividade/
│   │   │   └── page.tsx              # /atividade → Stub (V4.0)
│   │   └── metas/
│   │       └── page.tsx              # /metas → Stub (V5.0)
│   └── api/
│       ├── dashboard/route.ts        # POST: proxies date range to N8N webhook
│       ├── dashboard-sheets/route.ts # GET: reads metrics from Google Sheets
│       ├── operational/route.ts      # GET: reads deals + activities from Sheets
│       ├── esforco/route.ts          # GET: reads IA classification data from Sheets
│       ├── agenda/route.ts           # GET: reads agenda/tasks from Sheets
│       ├── export/excel/route.ts     # POST: multi-sheet Excel export (rate limited 30s)
│       └── auth/logout/route.ts      # GET: clears session cookie, redirects to /login
├── components/
│   ├── ErrorBoundary.tsx             # React error boundary with reload button
│   ├── navigation/
│   │   ├── AppNavbar.tsx             # Top navbar (logo, nav links, date filter, logout)
│   │   └── NavLink.tsx               # Link with active state via usePathname
│   ├── dashboard/
│   │   ├── ExecutiveDashboard.tsx     # Executive page (stats, funnel, tables)
│   │   ├── StatCard.tsx              # Reusable metric card
│   │   ├── DealRow.tsx               # Deal row with origin badge
│   │   ├── DealsTable.tsx            # Scrollable deals table
│   │   ├── PartnersCard.tsx          # Partners list
│   │   ├── LastClientCard.tsx        # Last closed client card
│   │   ├── AgendaSection.tsx         # Agenda prospection section
│   │   └── EsforcoSection.tsx        # IA effort funnel section
│   ├── operational/
│   │   ├── OperationalDashboard.tsx   # Operational page (pipeline, activities)
│   │   ├── DealPipelineRow.tsx        # Expandable deal row with aging + timeline
│   │   ├── ActivityMetricsRow.tsx     # Activity metrics row
│   │   ├── ActivityTimeline.tsx       # Activity timeline per deal
│   │   ├── DealAgingBadge.tsx         # Color-coded days-in-stage badge
│   │   ├── StaleAlert.tsx             # Red stale activity alert
│   │   └── charts/                    # 7 Recharts components (pipeline, aging, effort, etc.)
│   ├── shared/
│   │   └── ErrorState.tsx            # Error display with retry
│   ├── charts/
│   │   └── FunnelChart.tsx           # Custom SVG sales funnel visualization
│   └── ui/
│       ├── MagicCard.tsx             # Animated card with gradient border effect
│       ├── DateFilter.tsx            # Date range picker (preset ranges + custom)
│       ├── Tooltip.tsx               # Tooltip component
│       ├── calendar.tsx              # shadcn/ui calendar (react-day-picker)
│       └── popover.tsx               # shadcn/ui popover (Radix)
├── hooks/
│   ├── useDashboardData.ts           # Executive data fetch cascade
│   ├── useOperationalData.ts         # Operational data fetch + cache
│   ├── useEsforcoData.ts             # IA classification data fetch
│   ├── useEsforcoDiario.ts           # Daily effort tracking
│   ├── useAgendaData.ts              # Agenda data fetch
│   ├── useActivityMetrics.ts         # Activity metrics calculations
│   └── useOperationalCharts.ts       # Chart data aggregation
├── providers/
│   └── DateRangeProvider.tsx          # Shared date range context
├── lib/
│   ├── auth.ts                       # HMAC-JWT session management
│   ├── types.ts                      # All TypeScript interfaces
│   ├── sheets.ts                     # Shared fetchFromSheets() — Google Sheets gviz API
│   ├── correlate.ts                  # Lead↔call↔email correlation (phone 8+9 dig, domain fallback)
│   ├── excel-builder.ts              # Multi-sheet Excel builder with styling (5 tabs)
│   ├── formatters.ts                 # Currency, date, origin formatting
│   ├── validation.ts                 # N8N data validation + consistency
│   ├── cache.ts                      # sessionStorage cache utilities
│   ├── mock-data.ts                  # Mock data generator (fallback)
│   └── utils.ts                      # cn() utility (clsx + tailwind-merge)
└── middleware.ts                     # Auth guard: redirects unauthenticated users to /login
```

### Multi-Page Architecture (V3.0)

The dashboard uses a Next.js App Router route group `(dashboard)` with shared layout:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `ExecutiveDashboard` | Executive metrics: commissions, win rate, funnel, deals tables |
| `/operacional` | `OperationalDashboard` | Deal pipeline: aging, activity timelines, stale alerts |
| `/atividade` | Stub | Planned V4.0: Activity per seller |
| `/metas` | Stub | Planned V5.0: Weekly targets TV dashboard |
| `/login` | LoginForm | Password-only auth (outside route group) |

The route group layout wraps all pages with `ErrorBoundary`, `DateRangeProvider`, and `AppNavbar`.

### Authentication

Password-only authentication using a custom HMAC-SHA256 token system (no user accounts, no NextAuth):

1. User enters password at `/login`
2. `loginAction` (server action) compares against `DASHBOARD_PASSWORD` env var using constant-time comparison
3. On success, creates an HMAC-signed session token and sets it as an httpOnly cookie (`defenz_session`, 7-day expiry)
4. `src/middleware.ts` verifies the session cookie on every request (except `/login`, `/_next`, `/favicon.ico`)
5. Logout via `GET /api/auth/logout` clears the cookie and redirects to `/login`

Key files:
- `src/lib/auth.ts` — `createSession()`, `verifySession()`, `constantTimeEqual()`, HMAC sign/verify
- `src/app/login/actions.ts` — `loginAction` server action
- `src/middleware.ts` — auth guard

### Data Flow

1. `Dashboard.tsx` calls `POST /api/dashboard` with `{ data_inicio, data_fim }` (YYYY-MM-DD format)
2. `src/app/api/dashboard/route.ts` validates the session, rate-limits by IP, validates dates, then proxies to the N8N webhook
3. Response is validated client-side by `validateN8nData()` and checked for consistency by `checkConsistency()`
4. If the webhook fails or returns unexpected data, the dashboard falls back to mock data (`generateMockData()`)

### N8N Data Shape (`N8nData` interface)

The webhook returns a JSON object with these fields:

```typescript
interface N8nData {
  data: string;              // Date string
  hora: string;              // Time string
  periodo: string;           // Period description
  ligacoes: number;          // Total calls
  ligacoes_atendidas: number; // Answered calls
  taxa_conectividade: number; // Connection rate (%)
  emails: number;
  reunioes: number;          // Meetings
  apresentacoes: number;     // Presentations
  propostas: number;         // Proposals
  deals_novos: number;       // New deals
  deals_fechados: number;    // Closed deals
  valor_pipeline: number;    // Pipeline value (BRL)
  valor_fechado: number;     // Closed revenue (BRL)
  ultimo_cliente: Client;    // Last closed client
  parceiros: Partners;       // Active partners
  deals_ativos: Deal[];      // Active deals list
  clientes_fechados: Deal[]; // Closed clients list
}
```

### Date Filtering

The `DateFilter` component provides preset ranges and a custom calendar picker:

- Presets: Hoje (today), 7 Dias, 15 Dias, 30 Dias, Este Mes (current month)
- Custom: calendar date range picker via react-day-picker
- Custom ranges are encoded as `custom:YYYY-MM-DD:YYYY-MM-DD` in state

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | HMAC signing key (min 32 chars) for session tokens |
| `DASHBOARD_PASSWORD` | Yes | Single shared password for dashboard access |
| `N8N_WEBHOOK_URL` | Yes | Full URL of the N8N webhook that returns sales data |

## Security

The application implements several security hardening measures:

- **CSP headers**: Configured in `next.config.ts` — restricts `default-src`, `script-src`, `frame-ancestors`
- **Additional headers**: X-Frame-Options (DENY), X-Content-Type-Options (nosniff), HSTS, Referrer-Policy, Permissions-Policy
- **Rate limiting**: In-memory rate limiter on `/api/dashboard` (30 requests/minute per IP, max 1000 tracked IPs)
- **Session cookies**: httpOnly, secure (in production), sameSite: lax, 7-day expiry
- **Constant-time password comparison**: Prevents timing attacks on login
- **Date validation**: Strict YYYY-MM-DD format, max 366-day range, `data_inicio <= data_fim`
- **Request timeout**: 15s abort on upstream N8N calls
- **Client-side validation**: `validateN8nData()` sanitizes all fields from the webhook response
- **Source maps disabled**: `productionBrowserSourceMaps: false`

## Design System

**Theme**: "Defenz Lux" — white background with red (#dc2626) accents

- **Fonts**: Outfit (display/headings via `--font-outfit`) + Inter (body via `--font-inter`)
- **Primary color**: `hsl(350 89% 60%)` (vivid red/crimson)
- **Cards**: Use `<MagicCard>` component with animated gradient border on hover
- **Animations**: Framer Motion for page transitions, stat reveals, and list items
- **Currency**: BRL format via `Intl.NumberFormat('pt-BR', ...)`
- **Language**: All UI text is in Brazilian Portuguese

## Important Notes

- **No database**: All data comes from the N8N webhook. There is no Prisma, no ORM, no database.
- **No tests**: There is no test suite or test runner configured.
- **Mock fallback**: When the N8N webhook fails, the dashboard renders mock data rather than showing an error state. The mock data generator is in `Dashboard.tsx` (`generateMockData()`).
- **Client-side throttle**: Dashboard enforces a 5-second minimum interval between fetches to prevent rapid re-requests.
- **Consistency warnings**: The dashboard validates data consistency (e.g., `deals_fechados` count vs `clientes_fechados` array length) and shows a warning icon in the header if discrepancies are found.
- **TypeScript strict mode**: Enabled in `tsconfig.json`.
- **Path alias**: `@/*` maps to `src/*`.

## File Locations Reference

| Purpose | File |
|---------|------|
| Auth (HMAC sessions) | `src/lib/auth.ts` |
| Auth guard middleware | `src/middleware.ts` |
| Login server action | `src/app/login/actions.ts` |
| API proxy to N8N | `src/app/api/dashboard/route.ts` |
| API Google Sheets (executive) | `src/app/api/dashboard-sheets/route.ts` |
| API Operational (deals+activities) | `src/app/api/operational/route.ts` |
| API Esforco (IA classification) | `src/app/api/esforco/route.ts` |
| API Agenda (tasks/prospection) | `src/app/api/agenda/route.ts` |
| API Excel export | `src/app/api/export/excel/route.ts` |
| Logout endpoint | `src/app/api/auth/logout/route.ts` |
| Route group layout | `src/app/(dashboard)/layout.tsx` |
| Executive dashboard | `src/components/dashboard/ExecutiveDashboard.tsx` |
| Operational dashboard | `src/components/operational/OperationalDashboard.tsx` |
| Navigation | `src/components/navigation/AppNavbar.tsx` |
| Shared types | `src/lib/types.ts` |
| Executive data hook | `src/hooks/useDashboardData.ts` |
| Operational data hook | `src/hooks/useOperationalData.ts` |
| Esforco data hook | `src/hooks/useEsforcoData.ts` |
| Agenda data hook | `src/hooks/useAgendaData.ts` |
| Shared Sheets fetcher | `src/lib/sheets.ts` |
| Lead correlation engine | `src/lib/correlate.ts` |
| Excel export builder | `src/lib/excel-builder.ts` |
| Date range context | `src/providers/DateRangeProvider.tsx` |
| Funnel chart | `src/components/charts/FunnelChart.tsx` |
| Date filter | `src/components/ui/DateFilter.tsx` |
| Theme / CSS | `src/app/globals.css` |
| Next.js config (CSP) | `next.config.ts` |
| Documentacao Arquitetura | `docs/NOVA_ARQUITETURA_N8N.md` |

---

## Business Rules

### Logica de Comissao

A comissao da Defenz depende da origem do deal (`Lead_Source` no Zoho):

| Lead_Source contem | Categoria | Taxa Defenz |
|---|---|---|
| `securisoft` ou `parceiro ss` | securisoft | **5%** |
| `apollo`, `linkedin`, `cold call`, `chamada surpresa` | direto | **58%** |
| `parceiro` (generico) | parceiro | **43%** |
| qualquer outra coisa (default) | direto | **58%** |

A funcao `classifyOrigin()` no Code Node `Consolidar` do N8N aplica essas regras. Se um deal esta classificado errado, corrigir o `Lead_Source` no Zoho CRM.

### Convencao de Reunioes

Para aparecer no funil, o assunto do evento no Outlook deve conter `<>` (ex: `Defenz <> FDC`).

### Fontes de Dados por Metrica

| Metrica | Fonte | Filtro |
|---------|-------|--------|
| Ligacoes | Callbox (telefonia real) | periodo |
| Emails | Apollo.io | `completed_at` no periodo |
| Reunioes | Microsoft Calendar | Subject contem `<>` |
| Apresentacoes | Zoho Deals | `Resultados` contem `[APRESENTACAO]` |
| Propostas | Zoho Deals | Stage = "Proposta Enviada" OU `[PROPOSTA]` |

### Caching Strategy

- **Server**: In-memory cache 30min TTL on all API routes (except export)
- **Client**: sessionStorage cache 30min TTL via `src/lib/cache.ts`
- **Data source badge**: Azul (Cache), Verde (Planilha), Amarelo (N8N), Cinza (Mock)
- **Fetch cascade**: Cache local → Google Sheets → N8N webhook → Mock data

### Google Sheets Structure

Planilha `19-01_Dashboard_Defenz` com 7+ abas (metricas, deals_ativos, clientes_fechados, atividades, classificacao_ia, agenda, ligacoes_raw, emails_raw, leads_completo). Alimentada pelo N8N (Cron 6am/18pm). Schema detalhado em `docs/NOVA_ARQUITETURA_N8N.md`.

### N8N Workflow

- ID: `QjnzGicZHIPBNN1g` | 41 nos | Cron 6am/18pm + Webhook + Manual
- Fontes: Zoho CRM (Deals, Leads), Apollo (Emails), Callbox (Calls), Microsoft Calendar
- Detalhes em `docs/NOVA_ARQUITETURA_N8N.md`
