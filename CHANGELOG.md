# Changelog — Defenz Dashboard

Formato: [Semver](https://semver.org/lang/pt-BR/) + Keep a Changelog.

## [5.8.0] - 2026-06-09 — Resumo Diário

### Added
- Página `/diario` "Resumo Diário" (tema escuro navy+verde) replicando o relatório diário do Chief, com navegador de data (Hoje/Ontem/-2d/Semana passada + calendário) até **120 dias**.
- `GET /api/resumo-diario` + tipos `ResumoDiario` com semântica **null ≠ 0** (campos não-históricos/não-capturados renderizam "—").
- N8N workflow **"Defenz - Dashboard - Snapshot Diário"** (`aMhvdTP5aAi0Z1sf`, aditivo, isolado; cron 18h20 desabilitado até OK) → aba nova `resumo_diario` no doc público (upsert por `data`, idempotente).
- Aba `base_baseline` editável; **base instalada agora dinâmica de Zoho Fechado Ganho** (46 clientes / 5.109 licenças — era baseline fixo 22/3.896).
- `src/lib/sheets.ts`: `parseGviz` trata `Date(y,m,d,h,m,s)`; novo `fetchTabStrict` (assinatura de coluna) resolve o gotcha gviz "aba inexistente → planilha 0".
- `src/lib/metrics.ts`: `extractEventDatesAnchored` (ano correto no backfill).
- Spec `docs/features/feature-016-resumo-diario.md` + CSV de referência `docs/assets/`.

### Fixed
- **Bug latente:** `fetchFromSheetsNullable('reunioes')` lia a aba `ligacoes` (gviz sheet-0) como reuniões → agora `fetchTabStrict` com assinatura.

### Notes
- Avaliação adversarial (5 revisores, *approve-with-changes*) — todas as mudanças incorporadas.
- Snapshot LIVE de 08/06 bateu **exatamente** com o relatório do Teams (96/46/48%, e-mails 14, WhatsApp 15/5, LinkedIn 75, etc.).
- **GATED (aguardando OK):** backfill 120 dias + ativação do cron 18h20.
- Pendente (tarefa separada): ingestão de e-mails Apollo parada desde 30/03 (P9).

## [5.4.0] - 2026-05-05

### Added
- `docs/AUDITORIA_CARDS_2026-05.md` — auditoria completa de qualidade dos cards com dados raw das 4 abas do Google Sheets (ligacoes, deals, emails, classificacao_ia)
- Smoke test manual documentado validando comportamento dos cards para periodos hoje/7d/30d/alltime
- DataHealthPanel: cobertura documentada condizente com estado real das fontes de dados
- Seção §5 na AUDITORIA com resultados do smoke test pós-fix

### Changed
- `docs/STATUS_REPORT.md` atualizado para V5.4 — Data Quality
  - Evolução do projeto atualizada com V5.0–V5.4
  - Novos problemas P9 e P10 documentados com mitigação aceita
  - Próximo marco atualizado de V4.1 para V5.5

### Fixed (documentação / diagnóstico)
- **P4 (Reuniões = 0):** Status atualizado — mitigação aceita como badge "indisponível"
- **P9 (Emails sem dados):** Identificado como pipeline N8N parado desde 30/03/2026. Mitigação: indicador vermelho no DataHealthPanel
- **P10 (23 ghost stages):** Deals em `contato futuro`, `reunião técnica`, `em trial / poc` identificados como invisíveis. Fix planejado para V5.5

### Known Issues
- 7 deals com `closing_date` placeholder (2026-12-31) distorcem métricas de 7d/30d para fechados
- 23 deals em stages não mapeados — fix em V5.5
- Pipeline de emails parado — requer intervenção manual no N8N

---

## [4.0.0] - 2026-04-03

### Added
- Funil de vendas SVG hero horizontal com 5 estágios drill-down
- Consolidar V4.0 no N8N: win rate fix, snapshot apresentações, CLOSED_LOST expandido
- Node "Clear Deals Ativos" no N8N

---

## [3.0.0] - 2026-02-07

### Added
- Multi-page: Executivo + Operacional
- Decomposição do monolito em 15+ módulos
- Pipeline aging, stale alerts, activity timeline, 4 charts operacionais

---

## [2.0.0] - 2026-02-06

### Added
- Workflow N8N com 5 períodos, filtro reuniões, paginação

---

## [1.0.0] - 2026-02-04

### Added
- Arquitetura base: Google Sheets + cache + fallback N8N → Mock
