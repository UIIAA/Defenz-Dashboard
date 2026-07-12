# Spec (aterrissada) — Seletor de Intervalo Reusável + Resultados Consolidados do Período

> **Origem:** pedido do Marcos ("o calendário passa a aceitar um intervalo de datas e trazer os resultados agrupados — vale pro raio-x de Deals/oportunidades e também pro Resumo Diário").
> **Escrita contra o código real** deste repo (12/07/2026).
> **Achado que muda o escopo:** o intervalo **já existe no Resumo Diário** (commit `f7c14c8`, branch `feat/resumo-diario`, **não** deployado — prod está no `e3e9d85`). E **existe uma 2ª implementação** de range no `DateFilter` (Executivo/Operacional). São **duas cópias** da mesma lógica de seleção. Esta spec **unifica** num componente só e formaliza o comportamento, sem reinventar a agregação (que já existe pro Diário).

## 0. Contexto / relações
- **Formaliza** a feature #1 do Resumo Diário (modo intervalo já implementado em `f7c14c8`) por baixo de um componente compartilhado.
- **É o bloco de entrada** do "Overview por período" da `feature-timeline-cliente.md` §7 (o raio-x por Deal/cliente que o Marcos chamou de "Leads/oportunidades"). Esta spec entrega o **seletor + o contrato de consolidação**; o **conteúdo** da timeline continua na spec dela.
- **NÃO** é o Farol Fase 2 (comparação semanal "por que bati/não bati") — isso segue na `feature-farol-metas.md` §7-2.

## 1. Objetivo
Um **único** seletor de datas que aceita **1 dia OU um intervalo**, e cada tela **consolida os resultados do período** (totais somados). Hoje isso está duplicado e só metade está no ar. Depois desta spec: 1 componente, comportamento consistente, pronto pro raio-x de Deals.

## 2. Decisões (do Marcos, 12/07/2026)
| # | Decisão | Valor |
|---|---|---|
| Consolidação do período | **Somar/consolidar** o intervalo inteiro num conjunto de totais | igual ao Resumo Diário hoje (`aggregateRange`) |
| Componente | **Unificar** as 2 implementações num `DateRangePicker` reusável | 1 fonte de verdade |
| Alvos | Resumo Diário (agora) · Exec/Operacional (migração) · raio-x de Deals (quando a timeline vier) | — |
| Fuso | `America/Sao_Paulo`, string-compare `YYYY-MM-DD` | mantém o padrão do repo |

## 3. Realidade do código (reusar, NÃO reescrever)
| Peça | O que é | Onde |
|---|---|---|
| Calendário + range do Diário | `DiarioView = {kind:'dia',data} \| {kind:'periodo',from,to}`; 1 clique = dia, 2 = intervalo; presets Hoje/Ontem/7d/30d/Este mês; clamp `floor`/`today` | `src/components/diario/DayNavigator.tsx` |
| Calendário + range do Exec/Operacional | codifica `custom:YYYY-MM-DD:YYYY-MM-DD`; presets `today/7d/15d/30d/month/alltime`; **mesma** lógica de 2 cliques; cap 366 dias | `src/components/ui/DateFilter.tsx` |
| Estado global de período | `dateRange: string` (period key ou `custom:from:to`) | `src/providers/DateRangeProvider.tsx` |
| Consolidação do Diário | soma capturados, merge de mapas por-vendedor, POCs/destaques → `null` (são por-dia), base = atual, taxa recalculada → 1 `ResumoDiario` do intervalo | `aggregateRange()` em `src/lib/resumo-diario.ts` |
| API do Diário aceita intervalo | `GET /api/resumo-diario?from=&to=` → `aggregateRange` | `src/app/api/resumo-diario/route.ts` |
| API Exec/Operacional aceita range | `getDateRange(periodo)` decodifica `custom:from:to` e presets | `src/app/api/dashboard-sheets/route.ts`, `.../operational/route.ts` |
| Helpers de data BRT | `addDays`, `todayBRT`, `clampData`, `spanDays`, `daysInRange` | `src/lib/resumo-diario.ts` |

> **Duplicação a matar:** `handleDayClick` (2 fases idle→from) e a montagem de presets estão **quase idênticas** em `DayNavigator` e `DateFilter`.

## 4. Arquitetura (mínima, aditiva)
Separar **UI compartilhada** de **agregação por-tela** (a agregação é de domínio, fica em cada surface).

```
┌ src/lib/date-range.ts (NOVO — modelo + helpers puros, testável) ────────────┐
│  RangeSelection = {kind:'dia',data} | {kind:'periodo',from,to}              │
│  clampSelection(sel, floor, ceil) · presetRanges(today, floor) ·           │
│  reduceTwoClicks(prev, clicked) (1 clique=dia / 2=intervalo, ordena)       │
│  encode/decode  ↔  string do DateRangeProvider ('today'|'7d'|custom:a:b)   │
│  reusa addDays/todayBRT já existentes                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                     │ (UI só conhece RangeSelection)
┌ src/components/ui/DateRangePicker.tsx (NOVO — 1 componente) ─────────────────┐
│  props: { value:RangeSelection, floor, today, onChange(sel),               │
│           presets?, showNav?, disabled? }                                   │
│  calendário react-day-picker mode=range + presets + setas ‹ › + Aplicar    │
│  a11y (teclado, aria) · popover Radix (reusa components/ui/popover)         │
└─────────────────────────────────────────────────────────────────────────────┘
        │ Diário                     │ Exec/Operacional            │ Timeline (futuro)
        ▼                            ▼                             ▼
  DayNavigator vira casca      DateFilter vira casca         Overview por período
  (mantém aggregateRange)      (mantém contrato string)      (novo reducer §5)
```

**Regra de ouro:** o `DateRangePicker` é **UI pura** (não sabe de métricas). A **consolidação** ("somar o período") é um **reducer por tela**: o Diário já tem (`aggregateRange`); a Timeline terá o seu (§5). Isso evita acoplar o componente a um domínio.

## 5. Contrato de consolidação por tela (Q2 = somar/consolidar)
| Tela | Reducer | Entrada → Saída | Status |
|---|---|---|---|
| Resumo Diário | `aggregateRange(rows, from, to, baseAtual)` | linhas `resumo_diario` → 1 `ResumoDiario` (totais somados; POCs/destaques `null`; base atual) | **já existe** |
| Exec/Operacional | `getDateRange` + `computeMetrics` | deals/ligações/emails no range → `ComputedMetrics` | **já existe** (via period string) |
| Raio-x de Deals (Overview) | `aggregateClientsInRange(deals, from, to)` **(novo, na feature-timeline)** | `RawDeal[]` → por cliente: nº negócios · Σ ganho · Σ aberto · último `result_log` no período | **fora desta spec** (definido aqui como interface; implementado na `feature-timeline-cliente.md`) |

`null ≠ 0` mantém-se: campos por-dia (POCs/destaques) não são somáveis → `null` no período (UI mostra "—"), regra já vigente no Diário.

## 6. Tipos (`src/lib/date-range.ts`)
```ts
export type RangeSelection =
  | { kind: 'dia'; data: string }                 // YYYY-MM-DD
  | { kind: 'periodo'; from: string; to: string } // YYYY-MM-DD, from <= to

export interface RangePreset { label: string; sel: RangeSelection }

export function clampSelection(sel: RangeSelection, floor: string, ceil: string): RangeSelection
export function reduceTwoClicks(prev: 'idle' | 'from', clicked: string, anchor?: string):
  { sel: RangeSelection; next: 'idle' | 'from' }          // 1 clique = dia; 2 = intervalo ordenado
export function presetRanges(today: string, floor: string): RangePreset[]  // Hoje/Ontem/7d/30d/Este mês
export function encodeRange(sel: RangeSelection): string   // 'YYYY-MM-DD' | 'custom:from:to' (compat DateRangeProvider)
export function decodeRange(s: string, today: string): RangeSelection
```
O `DiarioView` do Diário passa a ser um **alias** de `RangeSelection` (mesmos campos), sem quebrar `ResumoDiarioDashboard`.

## 7. Comportamento
1. **1 clique** no calendário = dia único → `{kind:'dia'}`. **2 cliques** = intervalo `{kind:'periodo'}` (ordena from/to; clicar o mesmo dia 2× volta a dia único).
2. **Presets** configuráveis por tela (Diário: Hoje/Ontem/7d/30d/Este mês; Exec: today/7d/15d/30d/month/alltime). Vêm de `presetRanges` + extras da tela.
3. **Clamp** `floor` (piso navegável, ex. hoje-120 no Diário) e `ceil`=hoje. Dias fora → desabilitados no calendário **e** no `clampSelection` (server-side também, como já é).
4. **Setas ‹ ›** (prev/next dia) só em modo dia (comportamento atual do `DayNavigator`).
5. **Aplicar/Cancelar** no popover; Cancelar descarta seleção parcial.
6. **A11y:** calendário e presets operáveis por teclado; `aria-label` nas setas; contraste ok.

## 8. Faseamento
1. **Extrair + adotar no Diário (esta fase).** `date-range.ts` (helpers puros, **TDD**) + `DateRangePicker`; `DayNavigator` vira casca fina que usa o componente e mantém `aggregateRange`. **Entrega o intervalo do Diário em produção** (hoje só está na branch). Menor risco, maior valor.
2. **Migrar Exec/Operacional.** `DateFilter` reescrito sobre o `DateRangePicker`, **preservando** o contrato `custom:from:to`/period-key que o `DateRangeProvider` e as APIs já consomem. Telas hoje dormentes → migração guardada por regressão.
3. **Raio-x de Deals.** O "Overview por período" (`feature-timeline-cliente.md` §7) consome o `DateRangePicker` + implementa `aggregateClientsInRange`. Fora desta spec.

## 9. Edge cases
- `from > to` → ordena (swap). `from == to` → colapsa pra `{kind:'dia'}`.
- Cap de intervalo: manter o **366 dias** do `DateFilter`; no Diário o piso já é hoje-120.
- Período **sem dados** (fim de semana, sem snapshot) → estado vazio já tratado no Diário; o reducer devolve `null`/vazio, nunca quebra.
- **Compat de estado:** `encode/decode` tem que reproduzir exatamente as strings atuais (`'today'`, `'7d'`, `custom:a:b`) pra não quebrar `DateRangeProvider`/APIs.
- Fuso: tudo `YYYY-MM-DD` BRT via helpers existentes; **não** usar `toISOString()` pra data local.

## 10. Acceptance Criteria
- [ ] `src/lib/date-range.ts` criado com **testes (vitest)**: `clampSelection`, `presetRanges`, `reduceTwoClicks` (1 vs 2 cliques, ordenação, mesmo-dia), `encode/decode` round-trip com as strings legadas.
- [ ] `DateRangePicker` único; `DayNavigator` reduzido a casca usando-o; **Resumo Diário sem regressão** (dia, intervalo, presets, setas, floor/ceil, estados loading/empty).
- [ ] Intervalo do Diário **funciona igual ao `f7c14c8`** (totais somados; POCs/destaques "—"; base atual) — agora via componente compartilhado.
- [ ] Duplicação de `handleDayClick`/presets **eliminada** (Fase 1 no Diário; Fase 2 remove a do `DateFilter`).
- [ ] `npm run build` verde + `npm run test` verde.
- [ ] (Fase 2) `DateFilter` migrado sem quebrar `DateRangeProvider`/APIs (`custom:from:to` idêntico).
- [ ] Screenshot do Diário (dia + intervalo) aprovado.

## 11. Reality-check vs pedido
- ✅ "calendário aceita intervalo" → **já existe no Diário** (f7c14c8, undeployed) e no `DateFilter`; esta spec **unifica** e **entrega em prod**.
- ✅ "resultados agrupados" = **somar/consolidar o período** (Q2). Reducer por tela; Diário já tem.
- ✅ "vale pro raio-x de Deals/oportunidades" → o componente é o input do **Overview por período** da `feature-timeline-cliente.md` §7 (spec separada pro conteúdo).
- ⚠️ Migração do `DateFilter` (Exec/Operacional) é **Fase 2** — essas telas estão dormentes (menus translúcidos, só o Diário ativo); migrar já traria risco sem ganho visível agora.
- ❌ Nada de Zoho direto/Neon/COQL — só reuso do que já vem do Sheets.

## 12. Itens abertos p/ a sessão de implementação
- [ ] Confirmar se o `DateFilter` (Exec/Operacional) deve mesmo migrar na Fase 2 ou ficar como está até essas telas voltarem.
- [ ] Presets do Diário vs Exec divergem (Ontem/Este mês vs 15d/alltime) — manter por-tela (via prop `presets`) ou padronizar um set único?
- [ ] Definir onde mora `aggregateClientsInRange` (na `feature-timeline-cliente.md`) — só a **assinatura** fica aqui.
