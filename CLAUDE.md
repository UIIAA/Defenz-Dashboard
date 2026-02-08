# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Defenz Dashboard** is a multi-page sales intelligence platform for the Defenz cybersecurity company. It provides executive metrics (revenue, commissions, funnel) and operational deal tracking (activity timelines, aging, stale alerts). Data is sourced from Google Sheets (populated by an N8N workflow from Zoho CRM, Apollo, and Microsoft Calendar). There is no database.

## Key Technologies

- **Framework**: Next.js 16 (App Router)
- **Runtime**: React 19
- **Styling**: Tailwind CSS 4 with CSS custom properties ("Defenz Lux" theme)
- **Animations**: Framer Motion
- **Charts**: Custom SVG funnel chart (`FunnelChart.tsx`)
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
│   │   └── LastClientCard.tsx        # Last closed client card
│   ├── operational/
│   │   ├── OperationalDashboard.tsx   # Operational page (pipeline, activities)
│   │   ├── DealPipelineRow.tsx        # Expandable deal row with aging + timeline
│   │   ├── ActivityTimeline.tsx       # Activity timeline per deal
│   │   ├── DealAgingBadge.tsx         # Color-coded days-in-stage badge
│   │   └── StaleAlert.tsx             # Red stale activity alert
│   ├── shared/
│   │   └── ErrorState.tsx            # Error display with retry
│   ├── charts/
│   │   └── FunnelChart.tsx           # Custom SVG sales funnel visualization
│   └── ui/
│       ├── MagicCard.tsx             # Animated card with gradient border effect
│       ├── DateFilter.tsx            # Date range picker (preset ranges + custom)
│       ├── calendar.tsx              # shadcn/ui calendar (react-day-picker)
│       └── popover.tsx               # shadcn/ui popover (Radix)
├── hooks/
│   ├── useDashboardData.ts           # Executive data fetch cascade
│   └── useOperationalData.ts         # Operational data fetch + cache
├── providers/
│   └── DateRangeProvider.tsx          # Shared date range context
├── lib/
│   ├── auth.ts                       # HMAC-JWT session management
│   ├── types.ts                      # All TypeScript interfaces
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
| Logout endpoint | `src/app/api/auth/logout/route.ts` |
| Route group layout | `src/app/(dashboard)/layout.tsx` |
| Executive dashboard | `src/components/dashboard/ExecutiveDashboard.tsx` |
| Operational dashboard | `src/components/operational/OperationalDashboard.tsx` |
| Navigation | `src/components/navigation/AppNavbar.tsx` |
| Shared types | `src/lib/types.ts` |
| Executive data hook | `src/hooks/useDashboardData.ts` |
| Operational data hook | `src/hooks/useOperationalData.ts` |
| Date range context | `src/providers/DateRangeProvider.tsx` |
| Funnel chart | `src/components/charts/FunnelChart.tsx` |
| Date filter | `src/components/ui/DateFilter.tsx` |
| Theme / CSS | `src/app/globals.css` |
| Next.js config (CSP) | `next.config.ts` |
| Documentacao Arquitetura | `docs/NOVA_ARQUITETURA_N8N.md` |

---

## CHANGELOG - Fevereiro 2026

### 2026-02-04: Nova Arquitetura de Dados

**Problema identificado:** Os filtros de periodo (7 dias, 15 dias, etc.) nao funcionavam corretamente porque o N8N fazia multiplas chamadas de API em tempo real, causando lentidao e dados inconsistentes.

**Solucao implementada:**

#### 1. Nova API Route: `/api/dashboard-sheets`

Criada nova rota que le dados diretamente do Google Sheets:
- Arquivo: `src/app/api/dashboard-sheets/route.ts`
- Le da aba `metricas` da planilha `19-01_Dashboard_Defenz`
- Cache em memoria de 30 minutos
- Fallback automatico para N8N se a planilha nao tiver dados

#### 2. Cache no Cliente (sessionStorage)

O Dashboard agora implementa cache local:
- Dados sao salvos no `sessionStorage` por 30 minutos
- Ao trocar de filtro, primeiro verifica o cache
- Indicador visual mostra a fonte dos dados: Cache, Planilha, N8N, ou Mock

#### 3. Indicador de Fonte de Dados

No header do dashboard, apos "Atualizado:", aparece um badge colorido:
- **Azul (Cache)**: Dados do cache local
- **Verde (Planilha)**: Dados do Google Sheets
- **Amarelo (N8N)**: Dados do webhook em tempo real
- **Cinza (Mock)**: Dados simulados (fallback)

#### 4. Estrutura da Planilha (V2.2 - Atualizada 2026-02-07)

A planilha `19-01_Dashboard_Defenz` tem 3 abas:

**Aba `metricas`** (5 linhas, 1 por periodo):

| Coluna | Descricao |
|--------|-----------|
| data_coleta | Data da coleta (YYYY-MM-DD) |
| periodo | Identificador: `hoje`, `7d`, `15d`, `30d`, `mes` |
| data_inicio | Inicio do periodo |
| data_fim | Fim do periodo |
| ligacoes | Total de ligacoes (Zoho Calls) |
| ligacoes_atendidas | Ligacoes atendidas |
| taxa_conectividade | Percentual (0-100) |
| emails | Emails enviados pelo Apollo (APENAS Apollo no V1) |
| reunioes | Reunioes de pipeline (filtradas por `<>` no Subject) |
| apresentacoes | Deals com [APRESENTACAO] |
| propostas | Deals com Stage "Proposta Enviada" ou [PROPOSTA] |
| deals_ativos | Quantidade de deals ativos |
| deals_fechados | Quantidade fechados no periodo |
| valor_pipeline | Soma dos deals ativos |
| valor_fechado | Soma dos fechados |
| ultimo_cliente_nome | Nome do ultimo cliente |
| ultimo_cliente_origem | Origem do ultimo cliente |
| ultimo_cliente_valor | Valor do ultimo cliente |
| **comissao_pipeline** | Soma das comissoes dos deals ativos (V2.2) |
| **comissao_fechado** | Soma das comissoes dos deals fechados no periodo (V2.2) |
| **ticket_medio** | Valor medio por deal (V2.2) |
| **win_rate** | % deals ganhos / (ganhos + perdidos) (V2.2) |

**Aba `deals_ativos`** (snapshot de todos os deals ativos):

| Coluna | Descricao |
|--------|-----------|
| id | ID do deal no Zoho |
| data | Data da coleta |
| nome | Nome do deal |
| empresa | Account_Name do Zoho |
| stage | Stage atual do deal |
| valor | Valor bruto (Amount) |
| origem | Lead_Source crua do Zoho |
| categoria | securisoft, direto, ou parceiro |
| comissao_valor | Valor da comissao Defenz |
| modified_time | Data ultima modificacao (Zoho) (V3.0) |
| days_in_stage | Dias no stage atual (V3.0) |
| last_activity_date | Data da ultima atividade (V3.0) |
| last_activity_type | call/email/meeting/none (V3.0) |

**Aba `clientes_fechados`** (todos os deals com Stage "Fechado Ganho"):

| Coluna | Descricao |
|--------|-----------|
| id | ID do deal no Zoho |
| data | Closing_Date |
| nome | Nome do deal |
| empresa | Account_Name do Zoho |
| valor | Valor bruto (Amount) |
| **origem** | Lead_Source crua do Zoho (V2.2) |
| **categoria** | securisoft, direto, ou parceiro (V2.2) |
| comissao_valor | Valor da comissao Defenz |

**Aba `atividades`** (atividades correlacionadas a deals, V3.0):

| Coluna | Descricao |
|--------|-----------|
| deal_id | ID do deal Zoho (ou 'unmatched') |
| deal_nome | Nome do deal/contato |
| tipo | `call`, `email`, `meeting` |
| data | YYYY-MM-DD |
| descricao | Descricao da atividade |
| vendedor | Quem realizou |

> **Planilha alimentada automaticamente pelo N8N** (workflow ativo, Cron 6am/18pm + webhook). Agora com 4 abas.

#### 5. Decisoes de Produto V1 (Dashboard Executivo)

| Metrica | Fonte | Filtro | Nota |
|---------|-------|--------|------|
| **Ligacoes** | Zoho Calls | `Call_Start_Time` no periodo | Atendidas = Subject contem "atendida" |
| **Emails** | Apollo.io | `completed_at` no periodo | **Apenas enviados.** Microsoft Emails fora do V1 |
| **Reunioes** | Microsoft Calendar | **Subject contem `<>`** | Padrao: `[Quem] <> [Cliente]` |
| **Apresentacoes** | Zoho Deals | `Resultados` contem `[APRESENTACAO]` | |
| **Propostas** | Zoho Deals | Stage = "Proposta Enviada" OU `[PROPOSTA]` | |
| **Deals** | Zoho Deals | Stage para ativo/fechado | |

**Convencao de Reunioes:** Para aparecer no funil, o assunto do evento no Outlook deve conter `<>`. Exemplos:
- `BitDefender <> Consube Agropecuaria` (SecuriSoft agenda)
- `Defenz <> FDC - Fundacao Dom Cabral` (equipe Defenz agenda)

#### 6. Logica de Comissao (V2.2 - 2026-02-07)

A comissao da Defenz depende da origem do deal (`Lead_Source` no Zoho):

| Lead_Source contem | Categoria | Taxa Defenz |
|---|---|---|
| `securisoft` ou `parceiro ss` | securisoft | **5%** |
| `apollo`, `linkedin`, `cold call`, `chamada surpresa` | direto | **58%** |
| `parceiro` (generico) | parceiro | **43%** |
| qualquer outra coisa (default) | direto | **58%** |

A funcao `classifyOrigin()` no Code Node `Consolidar` do N8N aplica essas regras.

**IMPORTANTE**: Se um deal esta classificado errado, corrigir o `Lead_Source` no Zoho CRM. A classificacao e automatica a partir da proxima execucao do workflow.

#### 7. Dashboard Executivo (V2.2 - 2026-02-07)

6 cards em grid 3x2:

| Card | Valor Principal | Subtexto |
|------|----------------|----------|
| Comissao Pipeline | `comissao_pipeline` em BRL | X deals ativos — Pipeline: valor_pipeline |
| Comissao Ganha | `comissao_fechado` em BRL | X negocios ganhos — Total: valor_fechado |
| Win Rate | `win_rate%` | X ganhos de Y total |
| Ticket Medio | `ticket_medio` em BRL | Valor medio por deal |
| Taxa Conectividade | `taxa_conectividade%` | X de Y ligacoes |
| Ultimo Fechamento | valor do ultimo cliente | Nome do cliente |

**DealRow**: Badge colorido por categoria (`SS 5%` vermelho, `Direto 58%` verde, `Parceiro 43%` azul). Comissao como valor principal, valor bruto como subtexto.

#### 8. Fluxo de Dados V3.0

```
N8N Workflow: QjnzGicZHIPBNN1g (20 nos, ATIVO)
Triggers: Cron 6am/18pm + Webhook POST + Manual
    |
    +-- Definir periodo (30 dias de lookback)
    +-- Apollo Emails → Agg Apollo (paginacao)
    +-- Zoho Deals (todos, com Lead_Source + Modified_Time)
    +-- Zoho Calls → Agg Calls (paginacao)
    +-- Microsoft Reunioes (Calendar)
    +-- Consolidar V3.0:
    |   - classifyOrigin() por Lead_Source
    |   - 5 periodos (hoje, 7d, 15d, 30d, mes)
    |   - Comissao por deal + agregados
    |   - Win rate (fechados vs perdidos)
    |   - Ticket medio
    |   - Correlacao atividades↔deals (calls via Contact_Name, meetings via <>)
    |   - days_in_stage, last_activity_date, last_activity_type
    |   - atividades[] array
    +-- Split → Sheets Metricas (appendOrUpdate por periodo)
    +-- Split → Sheets Deals Ativos (appendOrUpdate por id)
    +-- Split → Sheets Clientes Fechados (appendOrUpdate por id)
    +-- Split Atividades → Sheets Atividades (appendOrUpdate por deal_id+data+tipo)
    +-- Respond Webhook (JSON completo)

Dashboard (Multi-page)
    |
    +-- / (Executivo)
    |   +-- 1. Cache local (sessionStorage, 30min)
    |   +-- 2. Google Sheets (/api/dashboard-sheets)
    |   +-- 3. Fallback N8N (/api/dashboard)
    |   +-- 4. Fallback Mock data
    |
    +-- /operacional
        +-- 1. Cache local (sessionStorage, 30min)
        +-- 2. Google Sheets (/api/operational) → deals_ativos + atividades
```

#### 9. Estado Atual e Proximos Passos

**Concluido V3.0:**
- [x] Planilha com 4 abas (metricas, deals_ativos, clientes_fechados, atividades)
- [x] Workflow N8N V3.0 (20 nos) com correlacao de atividades, aging, operational data
- [x] Multi-page: Executivo (`/`), Operacional (`/operacional`), stubs (`/atividade`, `/metas`)
- [x] Dashboard.tsx monolito decomposto em 15+ modulos
- [x] Route group com navbar compartilhada + DateRangeProvider
- [x] Pagina operacional com deal pipeline, aging badges, stale alerts, activity timeline
- [x] Removido coluna legada `id_data` do workflow N8N
- [x] Adicionado `Modified_Time` ao Zoho Deals query

**Pendente / Proximas iteracoes:**
- [ ] Tornar planilha publica para leitura (necessario para API Sheets funcionar sem OAuth)
- [ ] Revisar Lead_Source dos deals no Zoho (ex: JRC Law esta como "Parceiro" mas deveria ser "Direto")
- [ ] Melhorar campo `empresa` (Account_Name vazio no Zoho → "-")
- [ ] Deals inativos nao sao removidos da aba deals_ativos (limitacao)
- [ ] V4.0: Dashboard atividade por vendedor (`/atividade`)
- [ ] V5.0: Dashboard TV com metas semanais (`/metas`)

#### Documentacao Detalhada

Ver arquivo `docs/NOVA_ARQUITETURA_N8N.md` para:
- Estrutura completa da planilha
- Codigo do Code Node do N8N com filtros
- Convencao de reunioes `<>`
- Fluxo completo dos nos do N8N
