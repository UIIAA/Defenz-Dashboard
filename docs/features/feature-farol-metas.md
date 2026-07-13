# Spec (aterrissada) — Farol de Metas (Defenz Dashboard)

> **Origem:** brainstorm do Marcos ("Spec Farol de Metas + Zoho"), reescrita **contra o código real** deste repo.
> **Achado que muda tudo:** o Farol NÃO precisa de Zoho direto, COQL, OAuth nem Neon. Os deals fechados
> (com `valor` e `closing_date`) **já chegam via Sheets** e já existem os helpers `isClosedWon()` / `dateInRange()`
> em `src/lib/metrics.ts`. O Farol é uma **função pura nova + um card**, reusando os dados já carregados.

## 1. Objetivo
Responder de bate-pronto: **"Tô batendo os R$6k desta semana? E o mês?"** com número absoluto (% da meta) e cor de ritmo (pace).

## 2. Decisões de negócio (do brainstorm, mantidas)
| # | Regra | Valor |
|---|---|---|
| Atribuição da semana | por `closing_date`, semana Seg 00:00 → Dom 23:59 (Monday-based) | 1 deal ↔ 1 semana |
| Meta semanal | fixa | **R$ 6.000** |
| Meta mensal | R$6.000 × nº de semanas cuja **segunda** cai no mês | Jul/2026 = 4 → R$24k; Ago/2026 = 5 → R$30k |
| Régua de pace | rampa Seg 8h → Sex 23:59 (100% até sexta). Sáb/Dom = overtime (pace = 1, ainda somam) | — |
| Cor | verde ≥ esperado (ou %abs ≥ 1) · amarelo ≥ 0.8×esperado · vermelho abaixo | thresholds configuráveis |
| Fuso | `America/Sao_Paulo` em todas as janelas | — |

## 3. Realidade do código (o que reusar, NÃO reescrever)
Fonte: `src/lib/metrics.ts` + `src/lib/types.ts` (`RawDeal`).

| Preciso de… | Já existe | Onde |
|---|---|---|
| Deals fechados com valor e data | `RawDeal { stage, valor, closing_date, ... }`, carregados do Sheets | `types.ts:53`, pipeline atual |
| "É ganho?" | `isClosedWon(stage)` | `metrics.ts:14` |
| Filtro por janela de data | `dateInRange(closing_date, start, end)` (hoje **não exportada** → exportar) | `metrics.ts:51` |
| Receita mensal p/ reconciliar | agregação de faturamento existente | `api/faturamento-mensal`, `metrics.ts` |

> ⚠️ **Decisão a validar (item aberto):** `isClosedWon()` considera ganho **`fechado ganho` E `contrato enviado`** (`metrics.ts:5`). A spec original contava só "Fechado Ganho". Para o Farol **reconciliar** com o resto do dashboard, recomendo reusar `isClosedWon()` como está. Se o Marcos quiser Farol estrito (só `fechado ganho`), é um flag.

## 4. Lógica (pseudocódigo, tudo determinístico — "JS calcula")
```
// entrada: deals já carregados (mesma fonte do dashboard), hoje (America/Sao_Paulo)
weekStart   = segunda da semana de hoje
weekWon     = deals.filter(d => isClosedWon(d.stage) && dateInRange(d.closing_date, weekStart, weekStart+6d))
revenueWeek = Σ Number(d.valor)
goalWeek    = 6000
pctAbs      = revenueWeek / goalWeek

elapsed  = fração de (Seg 8h → Sex 23:59); 0 antes de seg 8h; 1 após sex; Sáb/Dom = 1
expected = goalWeek * elapsed
cor      = revenueWeek >= expected || pctAbs >= 1 ? 'verde'
         : revenueWeek >= 0.8*expected           ? 'amarelo' : 'vermelho'

// mês: weeksInMonth = semanas cuja segunda cai no mês; goalMonth = 6000*weeksInMonth
//      revenueMonth = Σ valor dos ganhos nas semanas do mês; pace mensal análogo
```
Edge documentado: deal de Sáb 01/08 → semana começa 27/07 → conta em Julho (consequência de "mês = soma das semanas"). Flag opcional `MONTH_MODE=calendar` p/ mês-calendário estrito.

## 5. Arquitetura (mínima)
- **Sem fetch novo.** `src/lib/farol.ts` (função pura) recebe `RawDeal[]` já carregados + `now` → devolve `{ semana:{revenue,goal,pctAbs,expected,cor,label}, mes:{...} }`.
- **UI:** um card "Farol" no dashboard (reusa `components/dashboard` + `components/ui`). Labels: `batido / no ritmo / atrás / fora do ritmo`.
- **Sem Neon, sem COQL, sem OAuth Zoho.** Se algum dia o `valor`/`closing_date` faltar no Sheet, o ajuste é no export do n8n, não aqui.

## 6. Tipos
```ts
type FarolBucket = {
  revenue: number; goal: number; pctAbs: number;
  expected: number; cor: 'verde'|'amarelo'|'vermelho';
  label: 'batido'|'no ritmo'|'atrás'|'fora do ritmo';
}
type Farol = { semana: FarolBucket; mes: FarolBucket; generatedAt: string }
```

## 7. Faseamento
1. **Farol semana + mês (ao vivo)** ← esta fase. `farol.ts` + card. TDD: casos de pace (antes seg 8h, meio de semana, sáb, batido, zerado) e weeks-in-month (4 vs 5 semanas).
2. `weekly_snapshot` + tela de comparação "por que bati / não bati" (cruza atividades já coletadas). **Não-MVP.**
3. (Timeline por cliente = spec separada, `feature-timeline-cliente.md`.)

## 8. Reality-check vs spec original
- ❌ COQL `SELECT … FROM Deals` → **não existe Zoho direto aqui**; dado vem do Sheets. Removido.
- ❌ Neon `deals_won` / `weekly_snapshot` → **não há banco** (`CLAUDE.md`: "There is no database"). Snapshot vira Fase 2 e, se preciso, uma aba de Sheets.
- ❌ "OAuth mesmo refresh token do farol" → não se aplica.
- ✅ Regras de meta/pace/semana → mantidas (são de negócio).
- ⚠️ Ganho = inclui `contrato enviado` (ver §3).

## 9. Itens abertos p/ a sessão de implementação
- [ ] Confirmar que a aba `deals` do Sheet traz `valor` e `closing_date` **preenchidos** (o `RawDeal` tem footgun em 4 colunas — `licencas/data_renovacao/recurring/owner` — mas `valor`/`closing_date`/`stage` são usados no dashboard todo, logo confiáveis).
- [ ] Decidir `isClosedWon` (inclui `contrato enviado`) vs Farol estrito.
- [ ] Meta em mês de 5 semanas: manter `6000×semanas` (Ago=30k) ou teto fixo 24k?
- [ ] Confirmar thresholds de cor (default 0.8).

---

## Fase 2 — Landed (aterrissada, aprovada 13/07/2026)
**Tela "por que bati / não bati" da semana, em `/metas`, reusando o `resumo_diario` — SEM banco/aba nova.**

### Decisões (do Marcos)
- Vive na rota **`/metas`** (hoje stub) — ativar o link no navbar.
- Fonte = **aba `resumo_diario`** (já persiste 1 linha/dia: `ligacoes_total`, `emails_total`, `apresentacoes_total`, `propostas_total`, `reuniao_tecnica_total`, `whatsapp_msgs`, `linkedin_*`) **agregada por semana ISO (Seg–Dom)** + `deals` (receita ganha por semana via `closing_date`, mesma lógica do Farol).
- Tudo determinístico (JS calcula), tema Lux.

### Peças
- **`src/lib/metas.ts`** (puro, TDD):
  - Reusar helpers de semana. **Extrair** `isoDow`/`mondayOf`/`addDays` hoje privados em `farol.ts` para um ponto compartilhado (evitar duplicar), e uma função `weekRevenue(deals, weekStart, weekEnd)` a partir do `sumWon` do Farol.
  - `weeklyEsforco(resumoRows, weekStart, weekEnd)` → soma os campos de esforço dos dias da semana.
  - `computeMetas(deals, resumoRows, now, nWeeks=8)` → `{ semanas: WeekMetric[] }`, mais recente primeiro. `WeekMetric = { weekStart, weekEnd, revenue, goal:6000, pctAbs, cor, label (reusar grade()/FarolBucket), esforco:{ligacoes,emails,apresentacoes,propostas,reunioes}, delta:{<campo>: revenue/esforço vs semana anterior} }`.
  - **Diagnóstico "por que bati/não bati"** (heurístico, determinístico): pra a semana corrente, se `pctAbs<1`, apontar os 1–2 campos de esforço com **maior queda %** vs a semana anterior ("Propostas caíram 60%"); se bateu, apontar o que puxou. Sem LLM.
- **`src/lib/metas.test.ts`** — bucketização por semana ISO, `weekRevenue`, classificação bati/não-bati, deltas, diagnóstico.
- **`GET /api/metas`** — `verifySession`; lê `resumo_diario` (`fetchTabStrict`) + `deals` (`fetchFromSheets`); `computeMetas`; cache 30min. Tipos em `types.ts` (`WeekMetric`, `MetasResponse`).
- **Página `/metas`** — substitui o stub: `MetasDashboard`:
  - Header semana atual: meta vs realizado + cor/label (reusar visual do `FarolBucket`/`FarolCard`).
  - Bloco **"Por que bati / não bati"**: receita vs meta + breakdown de esforço da semana com deltas ↑↓ vs semana anterior + a frase-diagnóstico.
  - **Comparativo N semanas** (chart Recharts: receita × meta por semana + linha de esforço total).
  - Ativar o link `/metas` no `AppNavbar` (hoje translúcido/não-clicável).

### Reuso obrigatório (não reescrever)
`farol.ts` (grade/cor/label, sumWon, helpers de semana), `resumo-diario.ts` (`addDays`, dedupe, parse), `DateRangePicker` se quiser navegação de semanas, padrão de card/tema.

### Aceite
- [ ] `metas.ts` com testes verdes (bucket semanal, receita, diagnóstico); `build` verde.
- [ ] `/metas` mostra semana atual (meta/realizado/cor) + "por que bati/não bati" + comparativo N semanas.
- [ ] Link `/metas` ativo no navbar; `/diario` e Farol Fase 1 sem regressão.
- [ ] Reconcilia com o Farol Fase 1 (mesma receita/semana).
