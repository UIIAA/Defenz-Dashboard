# Defenz Dashboard — Roadmap

> **Atualizado:** 2026-02-08
> **Versao Atual:** V3.1 (bugfix)
> **Workflow N8N:** QjnzGicZHIPBNN1g (20 nos, ativo, Cron 6am/18pm)

---

## Historico de Versoes

| Versao | Data | Resumo |
|--------|------|--------|
| V1.0 | 2026-02-04 | Arquitetura Sheets + cache sessionStorage + fallback N8N → Mock |
| V2.0 | 2026-02-06 | Workflow N8N com 5 periodos, filtro reunioes `<>`, paginacao |
| V2.1 | 2026-02-07 AM | Paginacao Apollo/Calls, fix emails trailing space, fix id/empresa |
| V2.2 | 2026-02-07 PM | Comissao por categoria, win rate, ticket medio, 6 cards executivos |
| V3.0 | 2026-02-07 PM | Multi-page (executivo + operacional), decomposicao Dashboard.tsx monolito em 15+ modulos, aba atividades N8N, pipeline aging, stale alerts, activity timeline, charts operacionais (pipeline by stage, health, aging distribution, commission by category) |
| **V3.1** | **2026-02-08** | **Bugfix: filtros operacional (throttle 5s removido), getDateBounds("alltime") corrigido, deals alltime sem filtro de data** |

---

## Estado Atual — O que funciona

### Pagina Executiva (`/`)
- [x] 6 StatCards: Comissao Pipeline, Comissao Ganha, Win Rate, Ticket Medio, Taxa Conectividade, Ultimo Fechamento
- [x] Funil SVG interativo com tooltips
- [x] Tabela deals ativos com badge de categoria (SS 5%, Direto 58%, Parceiro 43%)
- [x] Tabela clientes fechados
- [x] Card parceiros
- [x] Card ultimo cliente
- [x] Filtro de data (hoje, 7d, 15d, 30d, mes, custom range)
- [x] Cascade: cache → Sheets → N8N → Mock
- [x] Indicador de fonte de dados (Cache/Planilha/N8N/Mock)

### Pagina Operacional (`/operacional`)
- [x] 4 StatCards: Deals Ativos, Parados 7d+, Dias Medio, Pipeline
- [x] Activity Metrics Row (emails, ligacoes, reunioes, apresentacoes, propostas)
- [x] Filtro local: Todos / Parados / Por Stage
- [x] Lista colapsavel de deals com expand/collapse
- [x] DealPipelineRow expandivel com activity timeline
- [x] Aging badges coloridos (verde/amarelo/vermelho)
- [x] Stale alerts (deals sem atividade no periodo)
- [x] 4 Charts: Pipeline por Stage, Saude do Pipeline, Distribuicao Aging, Comissao por Canal
- [x] Filtros de data atualizam cards imediatamente (V3.1 fix)
- [x] "All time" funciona corretamente (V3.1 fix)

### Autenticacao
- [x] Login password-only com HMAC-SHA256 signed cookies
- [x] Middleware auth guard em todas as rotas
- [x] Logout com redirect
- [x] Rate limiting (30 req/min por IP)
- [x] CSP headers + security hardening

### Infraestrutura
- [x] N8N workflow V3.0 (20 nos, Cron 6am/18pm + Webhook)
- [x] Google Sheets com 4 abas: metricas, deals_ativos, clientes_fechados, atividades
- [x] Correlacao atividades ↔ deals (calls via Contact_Name, meetings via `<>`)

---

## Pendencias Tecnicas (Tech Debt)

Correcoes e melhorias que nao requerem features novas.

| # | Item | Prioridade | Esforco | Detalhes |
|---|------|-----------|---------|----------|
| T1 | Planilha publica para leitura | P0 | 5min | Sem isso, API Sheets nao funciona sem OAuth. Configurar no Google Sheets > Compartilhar > "Qualquer pessoa com link" |
| T2 | Lead_Source errados no Zoho | P1 | 15min | JRC Law = "Parceiro" mas deveria ser "Direto". Revisar cada deal no Zoho CRM |
| T3 | Account_Name vazio | P1 | 10min | Alguns deals tem empresa = "-". Preencher Account_Name no Zoho |
| T4 | Deals inativos na aba deals_ativos | P2 | 30min | Deals que mudam para "Fechado Perdido" continuam na aba. Opcao: N8N limpar antes de gravar, ou filtrar no frontend |
| T5 | Testes automatizados | P2 | 2-4h | Nao existe test suite. Adicionar Vitest + React Testing Library para hooks e utils |
| T6 | Responsividade mobile | P2 | 1-2h | Dashboard funciona em desktop. Mobile precisa ajustes de layout |

---

## Roadmap de Features

### V3.2 — Quick Wins (proxima sessao)

Melhorias incrementais no que ja existe, sem nova pagina.

| # | Feature | Pagina | Descricao |
|---|---------|--------|-----------|
| 3.2.1 | Exportar para PDF/CSV | Executivo | Botao para exportar metricas e tabela de deals |
| 3.2.2 | Ordenacao nas tabelas | Executivo | Clicar no header para ordenar por valor, empresa, stage |
| 3.2.3 | Busca de deals | Operacional | Input para filtrar deals por nome/empresa |
| 3.2.4 | Notificacao de deals stale | Operacional | Badge no navbar quando ha deals parados 7d+ |
| 3.2.5 | Auto-refresh silencioso | Ambas | Re-fetch automatico a cada 15min (sem reload de pagina) |

---

### V4.0 — Dashboard Atividade (`/atividade`)

**Objetivo:** Visao de atividade diaria por vendedor. Permite ao gestor ver quem esta produzindo e quem esta parado.

**Dados necessarios:** Ja existem na aba `atividades` da planilha (deal_id, tipo, data, descricao, vendedor).

| # | Feature | Descricao |
|---|---------|-----------|
| 4.1 | Tabela de atividades por vendedor | Linhas = vendedores, colunas = calls/emails/reunioes no periodo |
| 4.2 | Heatmap de atividade | Grid visual: dias (x) vs vendedores (y), cor = volume de atividade |
| 4.3 | Ranking de produtividade | Top vendedores por volume de atividade no periodo |
| 4.4 | Timeline de atividades | Lista cronologica de todas as atividades, filtrada por vendedor |
| 4.5 | Indicador de "vendedor parado" | Alerta quando um vendedor nao tem atividade em X dias |

**Pre-requisitos:**
- API route `/api/activities` lendo da aba `atividades` da planilha
- Hook `useActivityData.ts` com cache e filtro por periodo
- Garantir que o campo `vendedor` esta preenchido corretamente no N8N

**Complexidade:** Media. Dados ja existem, precisa apenas de frontend + API route.

---

### V5.0 — Dashboard TV / Metas (`/metas`)

**Objetivo:** Tela para TV do escritorio com metas semanais e auto-refresh. Mostra progresso em tempo real.

| # | Feature | Descricao |
|---|---------|-----------|
| 5.1 | Metas semanais configuraveis | Admin define meta de calls, emails, reunioes, deals por semana |
| 5.2 | Barra de progresso por meta | Visual de % atingido vs meta para cada metrica |
| 5.3 | Modo TV (fullscreen) | Layout otimizado para TV, sem navbar, fonte grande |
| 5.4 | Auto-refresh (60s) | Atualiza dados automaticamente a cada minuto |
| 5.5 | Celebracao visual | Animacao quando uma meta e batida (confetti, flash verde) |
| 5.6 | Historico semanal | Grafico de barras mostrando semanas anteriores vs metas |

**Pre-requisitos:**
- Definir onde armazenar metas (nova aba na planilha? .env? Hardcoded inicial?)
- Auto-refresh sem flicker (SWR ou polling com diff)
- CSS otimizado para TV 1080p

**Complexidade:** Media-Alta. Requer decisao de produto sobre metas + UX para TV.

---

### V6.0 — Inteligencia e Alertas

**Objetivo:** Dashboard proativo — alerta sobre riscos e oportunidades antes que o gestor precise procurar.

| # | Feature | Descricao |
|---|---------|-----------|
| 6.1 | Score de risco por deal | Combinacao de dias no stage + valor + inatividade = score 0-100 |
| 6.2 | Previsao de fechamento | Estimativa baseada em velocidade historica do funil |
| 6.3 | Alertas por email/Slack | Notificacao quando deal fica stale ou meta semanal esta em risco |
| 6.4 | Comparativo periodo anterior | Card mostrando "+X% vs semana passada" para cada metrica |
| 6.5 | Tendencia de pipeline | Grafico de evolucao do valor do pipeline ao longo do tempo |

**Pre-requisitos:**
- Historico de metricas (hoje so tem snapshot — precisaria gravar historico na planilha ou DB)
- Integracao Slack/email para alertas (pode usar N8N)

**Complexidade:** Alta. Requer dados historicos que ainda nao existem.

---

## Ordem Sugerida de Execucao

```
Agora          → T1 (planilha publica) + T2 (Lead_Source Zoho)
Proxima sessao → V3.2 (quick wins: busca, ordenacao, auto-refresh)
Depois         → V4.0 (atividade por vendedor)
Depois         → V5.0 (TV com metas)
Futuro         → V6.0 (inteligencia e alertas)
Paralelo       → T5 (testes) + T6 (mobile)
```

---

## Como Retomar

Para continuar o desenvolvimento em uma nova sessao:

1. **Ler este arquivo** (`docs/ROADMAP.md`) para contexto completo
2. **Verificar CLAUDE.md** na raiz para arquitetura e convencoes
3. **Build de verificacao**: `npm run build` — deve compilar sem erros
4. **Workflow N8N**: ID `QjnzGicZHIPBNN1g` em `https://code.escaladaonline.com.br`
5. **Planilha**: ID `1U6ley8bTw6SuVqoxLJDlVUFCkkYSAVPz9AZm6AU40p4` (4 abas)
6. **Dev server**: `npm run dev` e acessar `localhost:3000`
7. **Escolher proximo item** do roadmap acima e pedir para implementar

### Arquivos-chave por area

| Area | Arquivos |
|------|----------|
| Executivo | `src/components/dashboard/ExecutiveDashboard.tsx`, `src/hooks/useDashboardData.ts` |
| Operacional | `src/components/operational/OperationalDashboard.tsx`, `src/hooks/useOperationalData.ts` |
| Atividade (V4.0) | `src/app/(dashboard)/atividade/page.tsx` (stub) |
| Metas (V5.0) | `src/app/(dashboard)/metas/page.tsx` (stub) |
| N8N Workflow | `docs/NOVA_ARQUITETURA_N8N.md` |
| API Sheets | `src/app/api/dashboard-sheets/route.ts`, `src/app/api/operational/route.ts` |
| Auth | `src/lib/auth.ts`, `src/middleware.ts` |
| Tipos | `src/lib/types.ts` |
| Formatadores | `src/lib/formatters.ts` |
| Tema/CSS | `src/app/globals.css` |
