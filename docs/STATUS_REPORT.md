# Defenz Dashboard — Relatorio de Status

> **Data:** 2026-05-05
> **Versao Atual:** V5.4 — Data Quality
> **Autor:** Equipe de Engenharia

---

## Resumo Executivo

O **Defenz Dashboard** e uma plataforma de inteligencia comercial que consolida dados de 5 fontes externas (Zoho CRM, Apollo.io, Callbox, Microsoft Calendar e classificacao IA) em um painel executivo e operacional em tempo real. A plataforma permite que a gestao da Defenz acompanhe receita, pipeline, comissoes, funil de vendas e atividade dos vendedores — tudo em um unico lugar, atualizado automaticamente 2x ao dia.

**Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind CSS 4, N8N (automacao), Google Sheets (data lake), Vercel (hospedagem).

---

## Evolucao do Projeto

| Versao | Data | Marco |
|--------|------|-------|
| **V1.0** | 04/02/2026 | Arquitetura base: Sheets + cache + fallback N8N → Mock |
| **V2.0** | 06/02/2026 | Workflow N8N com 5 periodos, filtro reunioes, paginacao |
| **V2.1** | 07/02/2026 | Paginacao Apollo/Callbox, fix emails, fix IDs |
| **V2.2** | 07/02/2026 | Comissao por categoria (5%/43%/58%), win rate, 6 cards |
| **V3.0** | 07/02/2026 | Multi-page: Executivo + Operacional. Decomposicao do monolito em 15+ modulos. Pipeline aging, stale alerts, activity timeline, 4 charts operacionais |
| **V3.1** | 08/02/2026 | Bugfix: filtros operacional, alltime sem filtro de data |
| **V3.2** | — | Hero cards com hierarquia, comparacao temporal, redesign esforco |
| **V3.3–V3.9** | — | Funil IA, integracao Callbox, Agenda, Excel export multi-aba, correlacao leads |
| **V4.0** | 03/04/2026 | Funil hero horizontal, 5 drill-down cards, Consolidar V4.0 no N8N (win rate fix, snapshot apresentacoes, CLOSED_LOST expandido), Clear Deals Ativos |
| **V5.0–V5.3** | 05/05/2026 | Arquitetura hibrida: N8N como ETL puro, Vercel como motor de negocio. `src/lib/metrics.ts` centralizado. Integracao Google Sheets via gviz/tq. Auditoria completa de qualidade de dados. |
| **V5.4** | 05/05/2026 | Data Quality: smoke test manual, DataHealthPanel, indicadores de fonte ausente (ponto vermelho + tooltip), mapeamento P4/P9/P10. |

**Total:** 11 commits significativos em 2 meses de desenvolvimento.

---

## Entregaveis Concretos

### O que ja funciona em producao

**Pagina Executiva (`/`)**
- Funil de vendas SVG interativo (hero) com 5 estagios drill-down
- 4 cards financeiros: Comissao Pipeline, Comissao Ganha, Win Rate, Ticket Medio
- Tabelas de deals ativos e clientes fechados com badges de origem
- Filtro de data (hoje, 7d, 15d, 30d, mes, custom range)
- Indicador de fonte de dados (Cache/Planilha/N8N/Mock)
- Comparacao temporal (tendencia vs periodo anterior)

**Pagina Operacional (`/operacional`)**
- Pipeline completo com aging por deal (verde/amarelo/vermelho)
- Timeline de atividades por deal (expandivel)
- Alertas de deals parados (>7 dias sem atividade)
- 4 charts: Pipeline por Stage, Saude, Distribuicao Aging, Comissao por Canal
- Metricas de atividade: emails, ligacoes, reunioes, apresentacoes, propostas

**Excel Export**
- Exportacao multi-aba (5 tabs) com formatacao profissional
- Correlacao automatica de leads com ligacoes e emails
- Classificacao IA com cor por nivel (decisor, tecnico, secretaria)
- Scorecard KPI com indicadores de status

**Seguranca**
- Autenticacao HMAC-SHA256 com cookies httpOnly
- CSP headers, HSTS, X-Frame-Options, Referrer-Policy
- Rate limiting por IP (30 req/min API, 1 req/30s export)
- Validacao de datas, sanitizacao de dados, timeout 15s

**Automacao N8N**
- Workflow com 42 nos integrado a 5 fontes de dados
- Cron automatico 6am/18pm + webhook manual
- 7+ abas no Google Sheets (data lake completo)
- Classificacao IA de leads via Gemini

---

## Desafios Tecnicos Enfrentados

### Problemas Resolvidos (4/8)

#### P1: Acumulo de deals antigos na planilha
**Problema:** A aba `deals_ativos` acumulava registros de execucoes anteriores do N8N, inflando de 43 para 83+ registros.
**Solucao:** Criacao do node "Clear Deals Ativos" no N8N que limpa a aba antes de reescrever. Requer posicionamento estrategico no workflow (antes dos splits) para evitar rate limit de 60 writes/min do Google Sheets.
**Status:** Resolvido.

#### P2: Apresentacoes e Propostas com contagem incorreta
**Problema:** Metricas de apresentacoes/propostas eram filtradas por `Created_Time`, ignorando deals criados antes do periodo mas com atividade recente.
**Solucao:** Consolidar V4.0 usa snapshot (contagem total sem filtro temporal), refletindo o estado real do pipeline.
**Status:** Resolvido.

#### P3: Win Rate retornando "None"
**Problema:** O calculo de win rate nao reconhecia variantes de "Fechado Perdido" no Zoho (case sensitivity, variantes com "concorrencia", "Perdido" isolado).
**Solucao:** Expansao do mapeamento CLOSED_LOST para incluir todas as variantes: "Fechado perdido", "Fechado perdido para a concorrencia", variantes de case, "Perdido". Resultado: win rate 77% alltime, 75% 30d, 50% 7d.
**Status:** Resolvido.

#### P4: Reunioes sempre retornando 0
**Problema:** Integracao com Microsoft Calendar nao retorna eventos. URL corrigida de `/me/calendar/calendarView` para `/me/calendarView` (todos os calendarios).
**Diagnostico:** Token OAuth do Microsoft pode estar expirado, ou eventos estao em calendario separado (Teams). Nao e possivel debugar remotamente — requer acesso manual ao N8N.
**Status:** Diagnosticado, aguardando intervencao manual no N8N.

### Problemas com Solucao Projetada (2/8)

#### P5: Correlacao de atividades com 0% de match
**Problema:** Tentativa inicial de correlacao no N8N (por Who_Id do Zoho) falhou porque Callbox usa campo "destino" (telefone) sem relacao com IDs do Zoho.
**Solucao Projetada:** Motor de correlacao no Vercel (`src/lib/correlate.ts`, 254 linhas) com:
- Indexacao dual-key de telefone (8 e 9 digitos brasileiros)
- Fallback por dominio de email corporativo
- Marcacao de leads deprecados
**Status:** Codigo pronto, aguardando integracao com `metrics.ts`.

#### P6: Nome da empresa aparecendo como "-" em todos os deals
**Problema:** `Account_Name` no Zoho retorna string vazia `""` em vez de `null`. Operador `||` do JavaScript nao trata string vazia como falsy para este caso.
**Solucao Projetada:** Usar `.trim().length > 0` check no Vercel em vez de depender do N8N.
**Status:** Fix trivial, sera aplicado junto com `metrics.ts`.

---

### Problemas V5.x — Data Quality

#### P9: Pipeline de emails parado (sem dados desde 30/03/2026)
**Problema:** Aba `emails` do Google Sheets nao recebe novos registros desde 30/03/2026 (~36 dias de gap). Cards de email exibem 0 para 7d e 30d — parece ausencia de atividade mas e bug de integracao.
**Diagnostico:** Node N8N/Callbox que escreve na aba `emails` provavelmente parou. Requer acesso manual ao N8N para investigar execucoes falhas.
**Mitigacao aceita (V5.4):** Indicador vermelho no DataHealthPanel com tooltip "Sem dados desde 30/03/2026 — verificar pipeline N8N". Cards de email exibem badge de indisponibilidade.
**Status:** Mitigacao visual implementada. Pipeline precisa de intervencao manual no N8N.

#### P10: 23 deals em ghost stages (invisíveis no pipeline)
**Problema:** Deals com stages `contato futuro` (19), `reunião técnica` (3), `em trial / poc` (1) nao estao mapeados em `PIPELINE_STAGES`. Ficam invisíveis tanto no pipeline quanto nas métricas de deals ativos (exibe 18, existem 41).
**Diagnostico:** Esses stages foram adicionados no Zoho CRM apos o mapeamento inicial em `src/lib/metrics.ts`.
**Mitigacao aceita (V5.4):** Documentado como limitacao conhecida. Fix planejado para V5.5: expandir `PIPELINE_STAGES` com os 3 novos stages.
**Status:** Diagnosticado, mitigacao na proxima sprint.

---

## Decisao Estrategica: Arquitetura Hibrida

### O Problema
O N8N (ferramenta de automacao) estava acumulando logica de negocio complexa (comissoes, win rate, correlacoes, metricas). Isso gerava:
- Dificuldade de debug (sem console.log, sem testes)
- Rate limits do Google Sheets (60 writes/min)
- Impossibilidade de filtros custom (qualquer date range)
- Fragilidade: uma mudanca no Zoho quebrava o Consolidar inteiro

### A Decisao
**N8N como ETL puro** (coleta dados raw) + **Vercel como motor de negocio** (computa metricas).

```
ANTES:
  Zoho/Apollo/Callbox → N8N (coleta + computa + escreve) → Sheets → Vercel (exibe)
  
DEPOIS:
  Zoho/Apollo/Callbox → N8N (coleta raw) → Sheets → Vercel (computa + exibe)
```

### Beneficios
| Aspecto | N8N (antes) | Vercel (depois) |
|---------|-------------|-----------------|
| Testabilidade | Zero (visual workflow) | Vitest + TDD |
| Debug | Execucoes manuais | Console, breakpoints, logs |
| Filtros | 5 periodos fixos | Qualquer date range |
| Rate limits | 60 writes/min Sheets | Sem limite (computa em memoria) |
| Deploy | Manual (ativar/desativar) | Git push → auto-deploy |

---

## Metricas do Projeto

| Metrica | Valor |
|---------|-------|
| Componentes React | 40+ |
| API Routes | 8 |
| Custom Hooks | 9 |
| Bibliotecas (src/lib) | 10 arquivos |
| Nos N8N | 42 |
| Abas Google Sheets | 7+ |
| Fontes de dados integradas | 5 (Zoho, Apollo, Callbox, Microsoft, Gemini) |
| Linhas TypeScript (src/) | ~5000+ |
| Commits significativos | 11 |

### Dados Reais Validados (03/04/2026)

| Metrica | Alltime | 30 dias |
|---------|---------|---------|
| Ligacoes | 2.000 | 1.535 |
| Apresentacoes | 37 | 28 |
| Propostas | 34 | 24 |
| Deals fechados | 17 | 3 |
| Receita fechada | R$ 279k | R$ 152k |
| Win Rate | 77% | 75% |
| Deals ativos | 43 | — |
| Valor pipeline | R$ 129k | — |
| Leads completos | 469 | — |
| Ligacoes raw | 3.885 | — |
| Emails raw | 2.963 | — |

---

## O que Falta para Demonstracao / Testes

### Bloqueadores (deve resolver antes do demo)

- [ ] **Criar `src/lib/metrics.ts`** — Modulo centralizado de calculo de metricas. Hoje a logica esta espalhada entre N8N (Consolidar) e API routes. Este modulo unifica tudo no Vercel, habilitando filtros custom e testabilidade. **Estimativa: ~2-3h.**
- [ ] **Adaptar `dashboard-sheets/route.ts`** — Ler dados raw das planilhas e computar via `metrics.ts` em vez de ler metricas pre-computadas. **Estimativa: ~1h.**
- [ ] **Verificar build** — `npm run build` deve compilar sem erros apos mudancas.

### Importantes (melhora significativamente a demo)

- [ ] **Resolver P4** — Verificar token Microsoft Calendar manualmente no N8N. Reunioes aparecendo = funil completo.
- [ ] **Verificar Cron N8N** — Confirmar que o workflow esta rodando 6am/18pm e dados estao frescos.
- [ ] **Fix empresa "-"** (P6) — Aplicar `.trim()` check no Vercel. Fix trivial junto com `metrics.ts`.

### Opcionais (bom ter)

- [ ] **Setup Vitest** — Framework de testes para `metrics.ts` e `correlate.ts`. Garante regressao zero.
- [ ] **Fix correlacao** (P5) — Ativar correlacao Vercel-side com dados raw. Enriquece timeline operacional.

### Estimativa Total para Demo-Ready

| Item | Tempo |
|------|-------|
| `metrics.ts` + adaptacao routes | 3-4h |
| P4 (Microsoft Calendar) | 15min manual no N8N |
| P6 (empresa fix) | Incluido no metrics.ts |
| Build verification | 15min |
| **Total** | **~4-5h de desenvolvimento** |

---

## Marco Atual: V5.4 — Concluido (2026-05-05)

**Objetivo:** Data Quality — auditoria completa dos cards, smoke test por periodos, DataHealthPanel com indicadores de fonte ausente.

**Entregaveis concluidos:**
1. `docs/AUDITORIA_CARDS_2026-05.md` — auditoria completa com dados raw das 4 abas
2. Smoke test validando comportamento hoje/7d/30d/alltime para todos os cards
3. DataHealthPanel com coverage condizente com estado real das fontes
4. P4, P9, P10 documentados com mitigacao aceita ou diagnostico claro

## Proximo Marco: V5.5

**Objetivo:** Robustez de dados — corrigir gaps identificados na auditoria.

**Entregaveis planejados:**
1. Expandir `PIPELINE_STAGES` com `contato futuro`, `reuniao tecnica`, `em trial / poc` (fix P10)
2. Investigar e reiniciar pipeline N8N/Callbox de emails (fix P9)
3. Corrigir 7 closing_dates placeholder no Zoho CRM (P0.2)
4. Badge "indisponivel" para Reunioes enquanto P4 nao e resolvido
