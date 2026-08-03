# Spec — `/metas` com período de calendário puro

> **v2 — 03/08/2026, pós-crítica adversarial.** A v1 tinha 6 bloqueadores. Os três que mudam o
> desenho: (a) **"1 clique = 1 semana" viraria "1 dia"**; (b) **os presets "8 sem"/"12 sem" SÃO
> range**, então "sem range nada muda" era falso; (c) o `expected` da semana em curso passaria a
> descontar o tempo decorrido **duas vezes**.
> **Status: aguardando aprovação.**

## O problema

`weekStartsFor` (`src/lib/metas.ts:163`) converte o intervalo em **semanas inteiras**:
`mondayOf(from)` até `mondayOf(to)`. O filtro 01–31/07 vira **29/06 a 02/08**, e cada semana é
somada inteira — 29–30/06 e 01–02/08 entram no total.

## A evidência: o recorte de calendário reproduz o fechamento

Medido sobre `resumo_diario` e `deals`, Seg–Sex:

| | janela atual (29/06–02/08) | **calendário (01–31/07)** | apurado do Marcos |
|---|---|---|---|
| ligações | 4.061 | **3.965** | **3.965** ✓ |
| e-mails | 643 | **520** | **520** ✓ |
| propostas | 22 | **19** | **19** ✓ |
| reuniões | 13 | **10** | **10** ✓ |
| apresentações | 60 | 59 | 18 ✗ |
| receita total | 122.149,68 | **98.510,85** | 99.790,85 |

**4 das 5 métricas de esforço batem exatamente.** (Dias úteis — 23 — também bate, mas é
definicional, não medição: julho/2026 tem 23 por construção do calendário. Não conta como
evidência.)

As duas que não batem têm causa conhecida, e **nenhuma é código**:

- **Apresentações 59 × 18** — erro de lançamento de 06/07 (45 lançadas, 4 reais), corrigido no
  relatório e **não na origem**. `59 − 45 + 4 = 18`, exato.
- **Receita, R$ 1.280** — a **AMGS**, com `Closing_Date` 30/06 no Zoho e NF de 16/07. Corrigir
  a data no CRM fecha ao centavo. O código não deve inferir data de NF.

## O que esta mudança NÃO faz

**Não muda a Venda Defenz.** São R$ 12.076 (2 negócios) nas duas janelas — os outros negócios
de julho são Repasse SS, que está fora da meta por desenho. Toda a diferença de receita
(R$ 23.638,83) sai do **Repasse**.

O `pctAbs` da meta se move só porque o **goal** cai: `12.076/30.000 = 40%` → `12.076/27.600 =
44%`. Quem bate com o apurado é o card **Faturamento completo**, não o Farol da meta.

---

## A mudança

### 1. Recortar a semana ao intervalo

```
janelaEfetiva = [ max(weekStart, from') , min(weekEnd, to') ]   // from' <= to' normalizados
```

Vale para receita (`weekRevenue`) e esforço (`weeklyEsforco`).

**Duas travas que a v1 não tinha:**

- **`from === to` expande para a semana ISO inteira ANTES do recorte.** `rangeSel` colapsa
  `from===to` em `{kind:'dia'}` (`date-range.ts:20`) e a UI promete "1 clique = 1 semana"
  (`MetasDashboard.tsx:530`), comportamento coberto por teste (`metas.test.ts:419-424`). Sem
  isso, um clique numa quarta viraria janela de 1 dia com meta de R$ 1.200.
- **Normalizar `from > to`** no recorte. `weekStartsFor` já normaliza (`metas.ts:169`), mas a
  interseção usaria os valores crus e devolveria zeros sem erro. `/api/metas` valida só o
  formato, nunca `from <= to` (`route.ts:24`) — diferente de `/api/dashboard`.

### 2. Meta proporcional aos dias úteis

```
goalSemana      = GOAL_WEEK × (diasUteisNoRecorte / 5)
goalConsolidado = Σ goalSemana        // NÃO (23/5)×6000, que dá 27.599,999…
```

Julho: `3 + 5 + 5 + 5 + 5 = 23` dias úteis → **R$ 27.600** (hoje a tela usa R$ 30.000).

### 3. `expected` — um mecanismo, não dois

Hoje a semana em curso já tem `expected = GOAL_WEEK × elapsedCurrent`, a rampa Seg 08h→Sex
23:59 (`metas.ts:265`, `farol.ts:71`). Aplicar **também** o fator de dias úteis desconta o
mesmo tempo duas vezes: numa segunda 10h daria `6.000 × 0,019 × 0,2 ≈ R$ 22` contra meta de
R$ 1.200, e qualquer venda pintaria verde.

**Regra:** o fator de dias úteis escala o `goal`; o `elapsedCurrent` só se aplica quando a
semana **não** foi recortada à direita (`to >= weekEnd`). Se o recorte já termina antes do fim
da semana, ele próprio representa o decorrido — `expected = goalSemana`.

### 4. `goal = 0` não pode pintar verde

Período sem nenhum dia útil (Sáb–Dom): `grade(revenue, 0, 0)` cai em `revenue >= expected` com
`expected = 0` → **verde "no ritmo"** (`farol.ts:113`), ao lado de "0% da meta". E
`diagnosticar` escreve "Meta não batida" para uma meta que é zero.

Precisa de um estado **sem meta** (cinza, sem veredito), não de um guard só no `pctAbs`.

### 5. Rótulos — o cabeçalho continua mentindo se ninguém mexer

`consolidado.weekStart/weekEnd` vêm das bordas ISO (`metas.ts:198`) e o card imprime
`29/06–02/08 · 5 semanas` (`MetasDashboard.tsx:159`) — **literalmente a frase que abre esta
spec**. Passam a ser as bordas **recortadas**. Mesma coisa em `FaturamentoCompletoCard`
(`:128`) e `periodo.nWeeks` (`route.ts:59`).

Também ficam falsos com meta variável: `<Line name="Meta (R$6k)">` (`:287`),
`"meta R$ 6.000/semana"` (`:114`) e `"Meta semanal: R$ 6.000"` (`:489`).

`WeekMetric` (`types.ts:767`) ganha `parcial: boolean` e `diasUteis: number` — hoje não há onde
carregar isso. As barras parciais precisam se identificar; o eixo X tem 11px e até 12
categorias, então o marcador vai no tooltip e num traço visual, não em texto na categoria.

Decisão explícita: **`WeekMetric.weekStart/weekEnd` passam a ser as bordas recortadas.**

### 6. Delta e diagnóstico ficam mudos em semana parcial

O bucket 29/06 vira 01–03/07 (3 dias úteis) e é o `prev` de 06–12/07 (5 dias). Todo esforço
sobe ~67% por artefato de recorte, e `diagnosticar` (`metas.ts:132`) transforma isso em
afirmação causal: *"Meta batida — Ligações subiu 67%"*. Suprimir `delta` e `diagnostico`
quando `cur` ou `prev` for parcial.

### 7. Alinhar o default com o preset "8 sem"

`sel === null` (rotulado "Últimas 8 semanas") usa semanas inteiras; o preset `8sem` é
`{from: mondayOf(today)-49, to: today}` (`date-range.ts:67`). Cobrem as mesmas 8 semanas e
passariam a mostrar **metas diferentes**, porque só o preset recorta a semana em curso.
O default passa a emitir o mesmo range do preset.

## Fora de escopo — nomeado, com dívida registrada

O bloco **FAROL — ONDE ESTOU AGORA** continua "ao vivo" e ignora o filtro, por decisão já
registrada. Mas com julho selecionado ele mostra **R$ 0 com badge vermelho "fora do ritmo"**, e
o "ao vivo" é 11px cinza. Fica fora desta spec, e **entra na fila** como item próprio:
esconder ou demover o Farol quando `periodo.to < hoje`. Não é silêncio — é adiamento.

## Conferência

Critérios que **podem falhar** (a tabela de números acima é conferência manual de uma vez, não
critério — o próprio dado muda quando o Zoho for corrigido):

- deal em **30/06** não conta com `from=01/07`; deal em **01/08** não conta com `to=31/07`
- esforço de 29–30/06 e 01–02/08 excluído
- `goal(01–31/07) === 27600` **exato** (soma das semanais, sem float)
- range invertido (`from > to`) devolve o mesmo que o range normalizado
- range Sáb–Dom: meta 0, sem `NaN`, e cor **não** verde
- 1 clique (`from === to`) continua rendendo a semana ISO inteira — regressão de
  `metas.test.ts:419-424`
- `sel === null` e preset `8sem` produzem **o mesmo** consolidado

Não vale como teste: "consolidado é a soma das semanas". `buildConsolidado` reduz sobre o mesmo
array de onde `semanas` sai (`metas.ts:182`, `:280`) — não pode falhar.

## Risco operacional

O cache de 30 min do `/api/metas` é **in-process** (`route.ts:11`): um deploy novo já sobe com
cache frio. O que persiste de verdade é o cache do browser — o `fetch` do
`MetasDashboard.tsx:460` não manda `no-store`.
