# Manual — Resumo Diário (feature-016)

**Data:** 2026-06-09 · **Versão:** V5.8.0 · **Status:** Entregue (aguardando revisão + commit)

> Documento de handoff para alimentar o **Kanban Defenz**. Cada "Card" abaixo vira um cartão; os "Subtasks" viram checklist; "Est." é a estimativa de horas para registro de tempo. Tudo já **feito** salvo onde marcado 🔜 (próximos cards).

---

## 1. O que é (resumo de 1 parágrafo)

Nova página **`/diario` ("Resumo Diário")** no dashboard, com tema escuro igual ao relatório diário do Teams, que mostra os indicadores do dia (ligações, e-mails, WhatsApp, LinkedIn, apresentações, propostas, POCs, base instalada e destaques operacionais) e permite **navegar qualquer dia até 120 dias atrás**. É alimentada por um **novo fluxo N8N "Snapshot Diário"** que roda automático às **17h50** e grava 1 linha/dia numa planilha — formando o histórico sozinho. **Nada do que já funcionava foi alterado.**

---

## 2. Fluxo de dados (referência rápida)

```
Equipe posta no grupo "Operações" (Teams)  ──┐
[17h45] Coletor Chat (fluxo já existente) → Gemini → planilha Metricas (privada)
Callbox (telefonia) ──────────────────────────┤
Zoho CRM (POCs, base instalada) ──────────────┤
[17h50] NOVO "Snapshot Diário" lê tudo ────────┘→ grava 1 linha/dia na aba `resumo_diario` (pública)
                                                  → Dashboard /diario lê e exibe
```

| Métrica | Fonte |
|---|---|
| Ligações (+ por vendedor) | Callbox ao vivo (17h50) / aba `ligacoes` (dias passados) |
| E-mail, WhatsApp, LinkedIn, apres/prop por vendedor, Destaques | Grupo "Operações" (Teams) → Metricas |
| POCs ativas, Clientes Ativos, Licenças | Zoho CRM (só dia atual; dias passados = "—") |

---

## 3. Cards ENTREGUES (para registro retroativo de horas)

### EPIC A — Investigação & Especificação · **Est. 9h**
- **Card A1 — Mapear fluxos N8N existentes** · Est. 3h
  - Auditar os 9 fluxos "Defenz Chief" + "Coleta Métricas v2"; entender o relatório diário das 18h e o coletor de chat das 17h45.
- **Card A2 — Auditar planilhas e achar métricas quebradas** · Est. 2h
  - Verificar colunas reais via gviz; identificar: e-mails parados (P9), deals sem owner/licenças, gotcha gviz "aba inexistente → planilha 0".
- **Card A3 — Escrever SPEC + avaliação adversarial** · Est. 4h
  - `docs/features/feature-016-resumo-diario.md` + revisão por 5 perspectivas (dados, N8N, frontend, LGPD, backfill); incorporar correções.

### EPIC B — Backend (API + bibliotecas) · **Est. 7,5h**
- **Card B1 — Hardening `sheets.ts`** · Est. 2h
  - `parseGviz` tratando `Date(y,m,d,h,m,s)`; novo `fetchTabStrict` (assinatura de coluna); **corrigir bug do card de reuniões** (lia a aba errada).
- **Card B2 — Tipos `ResumoDiario`** · Est. 1h — semântica null ≠ 0 (não-capturado vira "—", não zero falso).
- **Card B3 — `lib/resumo-diario.ts`** · Est. 2h — datas em fuso BRT, parsing, dedupe por data, série do gráfico, clamp 120 dias.
- **Card B4 — Rota `GET /api/resumo-diario`** · Est. 2h — auth de sessão, cache 30min, default BRT, clamp.
- **Card B5 — `extractEventDatesAnchored`** · Est. 0,5h — corrige ano no backfill.

### EPIC C — Frontend `/diario` (tema escuro) · **Est. 10h**
- **Card C1 — `DiarioCard` + `DayNavigator`** · Est. 3h — cards escuros; navegador de dia (Hoje/Ontem/-2d/Semana + calendário, piso 120 dias).
- **Card C2 — `ResumoDiarioDashboard`** · Est. 5h — 8 cards + tabela "Por Canal/Responsável" + gráfico Tração Diária + Destaques + estados (loading/vazio/parcial) + badges de cobertura.
- **Card C3 — Página + navegação** · Est. 1h — rota `(dashboard)/diario`, link no navbar, esconder filtro de range só nessa página.
- **Card C4 — Hook `useResumoDiario`** · Est. 1h — fetch + cache por data.

### EPIC D — Pipeline N8N "Snapshot Diário" · **Est. 11h**
- **Card D1 — Criar abas `resumo_diario` + `base_baseline`** · Est. 1h — headers na ordem certa + linha baseline editável (via Sheets API).
- **Card D2 — Workflow Snapshot** · Est. 5h — ler raw/Metricas/Zoho, montar a linha larga (JSON nas quebras), upsert por data via Sheets API RAW, idempotente.
- **Card D3 — Callbox ao vivo** · Est. 2h — ligações frescas no run das 17h50 (login + fetch + por-vendedor), com fallback pra aba.
- **Card D4 — Base instalada dinâmica** · Est. 1h — contar Fechado Ganho do Zoho (**46 clientes / 5.109 licenças**) no lugar do baseline travado 22/3.896.
- **Card D5 — Validar + popular 5 dias + cron 17h50** · Est. 2h — validação, seed 03–09/06, habilitar cron diário.

### EPIC E — Verificação & Documentação · **Est. 3h**
- **Card E1 — Build/typecheck + regressão + screenshots** · Est. 1,5h — confirmar executivo intacto; conferir /diario contra o relatório do Teams (bateu exato 08/06).
- **Card E2 — CHANGELOG + memória + este manual** · Est. 1,5h.

> **Total entregue ≈ 40,5h** (8 epics, 18 cards).

---

## 4. Cards PENDENTES 🔜 (próximos no Kanban)

- **Card P1 — Revisar código + commit** · Est. 1h · *bloqueia deploy* — Marcos revisa os 10 arquivos; depois commit numa branch.
- **Card P2 — Consertar ingestão de e-mails Apollo (P9)** · Est. 3–5h — pipeline parado desde 30/03; hoje e-mail vem do chat com aviso. (Já há tarefa spawnada: `task_4cfb578a`.)
- **Card P3 — Backfill 120 dias** · Est. 1–2h — rodar para os dias passados (liga + chat existente). Revisar exposição de destaques antigos no doc público antes.
- **Card P4 — Backup off-site do histórico** · Est. 3h — job N8N semanal exportando `resumo_diario`/raw para Drive ou 2º doc restrito.
- **Card P5 — Mensagem-modelo no grupo Operações** · Est. 0,5h — template fixado pra equipe preencher no formato que o parser entende (garante WhatsApp/LinkedIn/e-mail/apres/prop todo dia).
- **Card P6 — Deploy na Vercel** · Est. variável — projeto não está na Vercel hoje (build minutes do free plan esgotados por outros projetos).
- **Card P7 (opcional) — Fase 2: owner/licenças/renovação nos deals** · Est. 4h — adicionar colunas ao export de deals → destrava comissão por owner + renovações vencidas no dashboard executivo.

---

## 5. Referências técnicas (para quem pegar o card)

| Item | Onde |
|---|---|
| Spec completa | `docs/features/feature-016-resumo-diario.md` |
| CSV de referência | `docs/assets/resumo_diario_referencia.csv` |
| Workflow N8N | `Defenz - Dashboard - Snapshot Diário` (id `aMhvdTP5aAi0Z1sf`) · webhook `snapshot-diario` · cron 17h50 |
| Coletor de chat (existente) | `Defenz Chief - Sub - Coletor Chat Operacao` (id `Pep9gmY1fb0MUwmP`) · cron 17h45 |
| Planilha pública (dashboard) | `1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ` · abas `resumo_diario`, `base_baseline`, `ligacoes`, … |
| Planilha privada (chat) | `1Len6mDHKDE0Zv4ue8aGyN9hnhR38fbl_GKIWQetszXQ` · aba `Metricas` |
| Rota / página | `/api/resumo-diario` · `/diario` |
| Disparo manual de um dia | POST no webhook `snapshot-diario` com `{"data":"AAAA-MM-DD"}` |
| Editar baseline | aba `base_baseline` (planilha pública) — fallback, hoje base vem do Zoho |
| Ver localmente | `localhost:3005` · senha `defenz123` · aba "Resumo Diário" |

---

## 6. Como manter no dia a dia (operacional)

1. A equipe **posta os números no grupo "Operações" (Teams) antes das 17h45**, no formato:
   - `E-mail: 14 envios (Gustavo: 10 | Leonardo: 4 | Marcos: 0)`
   - `LinkedIn: 7 seguidores Page | 68 perfis` · `WhatsApp: 15 mensagens | 5 conversas`
   - `Apresentações: 2 (Gustavo: 2)` · `Propostas: 1 (Gustavo: 1)`
   - linhas livres → viram Destaques
2. **17h45** o coletor lê o chat; **17h50** o snapshot grava o dia. Pronto — aparece no `/diario`.
3. Se faltar post num dia, os campos do chat ficam **"—"** (ligações continuam, pois vêm do Callbox).
