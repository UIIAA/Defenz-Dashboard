# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Defenz Dashboard** (V5.7-comissao-owner-canal) is a multi-page sales intelligence platform for the Defenz cybersecurity company. It provides executive metrics (revenue, commissions, funnel) and operational deal tracking (activity timelines, aging, stale alerts). Data is sourced from Google Sheets (populated by an N8N workflow from Zoho CRM, Apollo, Callbox, and Microsoft Calendar). There is no database. See `docs/STATUS_REPORT.md` for stakeholder-facing project status and `docs/ROADMAP.md` for feature roadmap.

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
| `/atividade` | Stub | Planned: Activity per seller |
| `/metas` | Stub | Planned: Weekly targets TV dashboard |
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
| `DATABASE_URL` | Yes | Neon (Postgres) — auth individual, metas por canal e ingestão |
| `INGEST_TOKEN` | Yes (escrita dupla) | Segredo máquina-a-máquina do `POST /api/ingest`. Mínimo 32 chars. Sem ele a rota fica **fechada** (401). Gerar com `openssl rand -hex 32` |

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
| API Série Diária de Ligações | `src/app/api/ligacoes-serie/route.ts` |
| API Relatório Mensal consolidado | `src/app/api/relatorio-mensal/route.ts` |
| API Excel export | `src/app/api/export/excel/route.ts` |
| API Ingestão Neon (POST, n8n) | `src/app/api/ingest/route.ts` |
| API Paridade Neon × Sheets (GET) | `src/app/api/ingest/paridade/route.ts` |
| Validação/forma da ingestão | `src/lib/ingest/schema.ts` |
| Normalização de dimensões | `src/lib/ingest/normalize.ts` |
| Upserts transacionais (SQL) | `src/lib/ingest/repo.ts` |
| Comparador de paridade | `src/lib/ingest/paridade.ts` |
| Schema de dados de negócio | `db/migrations/0003_dados_negocio.sql` |
| Estado do negócio + ficha (f-038) | `src/lib/estado.ts` |
| Schema estado/ficha no Neon | `db/migrations/0009_estado_negocio.sql` |
| Backfill histórico | `scripts/backfill-neon.mjs` |
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
| Status do Projeto | `docs/STATUS_REPORT.md` |
| Roadmap | `docs/ROADMAP.md` |

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

A funcao `classifyOrigin()` no Code Node `Consolidar` do N8N aplica essas regras (sera migrada para `src/lib/metrics.ts`). Se um deal esta classificado errado, corrigir o `Lead_Source` no Zoho CRM.

### Convencao de Reunioes

Para aparecer no funil via Microsoft Calendar, o assunto do evento no Outlook deve conter `<>` (ex: `Defenz <> FDC`). Quando a integração com Microsoft Calendar está indisponível (token expirado — P4), a métrica de reuniões é derivada de eventos `[REUNIAO]` no campo `Resultados` dos deals no Zoho CRM (mesma técnica de `extractEventDates` usada para `[APRESENTACAO]` e `[PROPOSTA]`).

**Estratégia de fallback em `computeMetrics` (V5.4+)**:
1. `dashboard-sheets/route.ts` tenta buscar a aba `reunioes` da planilha via `fetchFromSheetsNullable`
2. Se a aba existir (tab creada pelo N8N quando Calendar funcionar): usa dados da planilha → `coverage.reunioes.source = 'sheet'`
3. Se a aba não existir (`null` retornado): deriva de `[REUNIAO]` em `deals.resultados` → `coverage.reunioes.source = 'resultados-proxy'`
4. `coverage.reunioes.source` exponha a origem para debug e futuros banners de cobertura

### Fontes de Dados por Metrica

| Metrica | Fonte | Filtro |
|---------|-------|--------|
| Ligacoes | Callbox (telefonia real) | periodo |
| Emails | Apollo.io | `completed_at` no periodo |
| Reunioes | aba `reunioes` (se existir) → fallback `[REUNIAO]` em deals.resultados | periodo |
| Apresentacoes | Zoho Deals | `Resultados` contem `[APRESENTACAO]` |
| Propostas | Zoho Deals | Stage = "Proposta Enviada" OU `[PROPOSTA]` |

### Valor do Deal (`valor`) e Farol de Metas

**Regra canônica:** o campo `valor` de cada deal — e portanto a receita do **Farol de Metas** (`src/lib/farol.ts`) — vem **SEMPRE do campo `Amount` do Zoho (rótulo "Montante" na UI)**. Isso já é o comportamento do export: o nó `Format Deals Raw` (workflow `QjnzGicZHIPBNN1g`) faz `valor = Number(d.Amount) || 0` e o nó `Zoho Deals` busca `Amount`.

- **Não usar** `Valor estimado` (custom) nem `Receita Esperada` (`Expected_Revenue = Amount × Probabilidade`) como fonte primária. O Montante é a verdade do valor fechado.
- **Failure mode:** um deal `Fechado Ganho`/`Contrato Enviado` que aparece com `valor = 0` (Farol R$ 0) significa que o **`Amount` está vazio no Zoho** — corrigir o Montante no Zoho. O cron (6h/18h) relê o `Amount` e faz upsert por `id`, então a correção reflete no Sheets/Farol no próximo run (ou rodar o workflow manualmente pra refletir na hora).
- Fallback opcional (decisão de negócio, **não** default): se quiser que um ganho com Montante 0 mostre um valor provisório, cair para `Expected_Revenue` e depois `Valor estimado` — muda a fonte-da-verdade, então só com aprovação.

### Caching Strategy

- **Server**: In-memory cache 30min TTL on all API routes (except export)
- **Client**: sessionStorage cache 30min TTL via `src/lib/cache.ts`
- **Data source badge**: Azul (Cache), Verde (Planilha), Amarelo (N8N), Cinza (Mock)
- **Fetch cascade**: Cache local → Google Sheets → N8N webhook → Mock data

### Google Sheets Structure

Planilha `19-01_Dashboard_Defenz` com 7+ abas (metricas, deals_ativos, clientes_fechados, atividades, classificacao_ia, agenda, ligacoes_raw, emails_raw, leads_completo). Alimentada pelo N8N (Cron 6am/18pm). Schema detalhado em `docs/NOVA_ARQUITETURA_N8N.md`.

**Aba `pocs` (schema V1 — a criar):** 13 colunas — `poc_id | deal_id | deal_nome | empresa | data_inicio | data_fim_prevista | data_fim_real | status | descricao | responsavel | resultado | created_time | modified_time`. `status` ∈ `{ativa, convertida, perdida}`. `deal_id` FK para `deals.id` (opcional). Spec: `docs/features/feature-poc-schema.md`. Tipos: `RawPoc`, `Poc`, `PocStatus`, `PocMetrics`, `WeeklyBucket` em `src/lib/types.ts`.

### Escrita dupla Sheets → Neon (feature-migracao-neon, Fase 1)

O n8n grava **no Sheets e no Neon**. O **Sheets continua sendo a fonte da verdade**: nesta fase
**nada é lido do Neon** e nenhum comportamento do dashboard muda. Spec: `docs/features/feature-migracao-neon.md`.

- O n8n **não** fala com o Postgres direto — faz `POST /api/ingest` com `{ tabela, execucao, linhas }`
  (as `linhas` são exatamente o que já vai pro Sheets) e o código valida/normaliza/grava.
- Auth: header `X-Ingest-Token` (`INGEST_TOKEN`), comparado em tempo constante. A rota está na
  allowlist do `src/middleware.ts` porque é máquina-a-máquina.
- Máx. **500 linhas por requisição**; upsert idempotente pela chave natural; transacional por lote.
- Linha inválida é **rejeitada e reportada** (`erros: [{linha, campo, motivo}]`), nunca coagida.
  Chave repetida no lote → `duplicados`. Tarefa de `agenda` cujo lead não existe é gravada com
  `lead_id` nulo e contada em `orfaos`; classificação sem lead é rejeitada (o lead é metade da
  chave natural). Tudo reportado na resposta.
- Portão: `GET /api/ingest/paridade` compara Neon × Sheets. **Divergência se investiga — não se
  ajusta o comparador.** A fase fecha com 7 dias corridos de verde nas 7 tabelas.
- Backfill do histórico: `node scripts/backfill-neon.mjs --url <base>` (leads antes de
  classificacao_ia/agenda — essas duas têm FK pra leads).
- Teste de integração do SQL (pula por padrão): `PGTEST_URL=... npm run test:sql`.

### N8N Workflow

- ID: `QjnzGicZHIPBNN1g` | 54 nos | Cron 6am/18pm + Webhook + Manual

**Janela de coleta INCREMENTAL desde 26/08/2026** (`feature-coleta-incremental.md`). O
`Definir periodo` nao le mais desde `2025-11-01` a cada execucao: usa **retrolook de 1 dia**
(`hoje` calculado em `America/Sao_Paulo`, nao UTC). Motivo: reler 295 dias por execucao
inviabiliza rodar de hora em hora, e o Callbox estava a ~7 dias do teto de 20 paginas
(18.270 ligacoes de 20.000, a 234/dia).

- **Backfill:** `POST` no webhook com `{"full": true}` (desde 2025-11-01) ou `{"dias": N}`.
  Execucao **manual roda incremental** de proposito — e assim que se testa a janela.
- **Invariante do `call_id`:** `Format Ligacoes Raw` agrupa o payload da execucao para
  desempatar pernas com ordinal (`base#2`). Isso so e seguro porque `isoDate` e o primeiro
  campo da chave, logo todo membro de um grupo cai no mesmo dia. Ha uma **guarda executavel**
  descartando linha com data nao parseavel — sem ela, `isoDate=''` faria a chave ficar sem
  data e um grupo atravessaria dias, e a janela reatribuiria o ordinal reescrevendo a linha
  errada. Verificacao: `node scripts/teste-nos-n8n.mjs`.
- **Cadencia por entidade (planejado, NAO aplicado):** fatos + deals de hora em hora; leads e
  agenda 2x/dia. Sem isso, subir a frequencia AUMENTA a escrita no Sheets em 33%, porque as
  dimensoes seguem full refresh (3.034 linhas so de leads por execucao).
- Fontes: Zoho CRM (Deals, Leads), Apollo (Emails), Callbox (Calls), Microsoft Calendar, Gemini (IA classification)
- Detalhes em `docs/NOVA_ARQUITETURA_N8N.md`

### Callbox API (Telefonia)

- URL: `https://defenz.callbox.com.br`
- Login: `POST /callbox-api/login` → token no campo `data` do response body
- Calls: `POST /callbox-api/relatorios/bilhetagem/tab_chamadas` com Bearer token
- Body: `{ filter_start_date, filter_end_date, page }` (page no POST body, nao query param)
- Response: `{ data: { result: [...], pages: N } }` — 1000 records/pagina

### `src/lib/metrics.ts` — Coverage Diagnostics (2026-05-05)

`computeMetrics()` now returns a `coverage: CoverageReport` field with stats per data source (deals, calls, emails, classificacoes). Each source exposes `{ total, in_range, dropped_invalid_date, min_date, max_date }`. The `dateInRange` helper now validates the YYYY-MM-DD format via DATE_RE, so invalid dates are counted rather than silently dropped. Types `CoverageSourceStats` and `CoverageReport` are exported from `src/lib/types.ts`. Consumers of `ComputedMetrics` can use `coverage` to display a data-coverage banner (P10).
