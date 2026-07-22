# Spec — /metas v2: Faturamento completo + Esforço→Vendas + regra de cor + seletor de período

> **Spec 1 de 4** do lote "Dashboard – ajustes de julho" (brainstorm 2026-07-21 com o Marcos).
> As outras: (2) Meta em "Receita por Canal", (3) Drill-down da base instalada, (4) Indicador
> "clientes ganhos 100% taggeados". Esta spec cobre **só** a página `/metas`.
>
> Mockups (companion visual): `.superpowers/brainstorm/*/content/` — `metas-layout.html`,
> `esforco-vendas.html`, `regra-cor.html`, `metas-full.html`. **Refino de UI/UX** aplicado com
> consultoria do Fable (2026-07-21) — ver §Padrões visuais e §Mudanças vs mockup aprovado.

## Onde estamos (o que já está no ar nesta branch)

Branch `feat/auth-individual` (`afb66bd`), **não deployada**. O `/metas` hoje
(`MetasDashboard.tsx`) já tem: Farol Semana+Mês (defenz-only, particionado por `fonteVenda`),
Consolidado do intervalo, um **gráfico único** combinado (barras Defenz+Repasse empilhadas + linha
meta + linha esforço), o bloco **"Por que bati / não bati"** (`PorqueBloco`, com `diagnostico`), e o
`DateRangePicker` (1 mês, seleção 2 cliques). O Repasse SS aparece só como nota "+X fora da meta".
Base de cálculo: `computeMetas()` em `src/lib/metas.ts` (meta = R$6.000/semana, só **Venda Defenz**;
Repasse SS informativo). Ver [`feature-farol-metas.md`], [`feature-metas-fonte-receita.md`],
[`feature-metas-robo-semana.md`].

## Decisões travadas com o Marcos (2026-07-21)

1. **Layout:** tudo na tela (scroll) — evolui o atual, sem abas. (mockup `metas-layout.html`, Direção A)
2. **Faturamento completo** é o número que responde "faturamento do mês". O **~43k = TOTAL
   (Defenz + Repasse SS)**, não "só Defenz". A meta continua **Defenz-only** de propósito.
3. **Esforço→Vendas** = **linha do tempo (dual-axis)** + **índices de eficiência**. (mockup `esforco-vendas.html`, opções 1+3)
4. **Regra de cor:** dado = neutro/grafite; status = verde/âmbar/vermelho, **vermelho só p/ problema
   real**. (mockup `regra-cor.html`, "Depois"). Mesma regra vale p/ a Spec 2.
5. **Seletor de período:** presets rápidos + calendário de **2 meses**. (resolve "8 semanas só puxa o mês")
6. Sem mudar a classificação `fonteVenda`. Nota de higiene (ortogonal): taggear "Venda Defenz" no
   Zoho quando a venda for nossa.

## Achado da validação (43k) — evidência da planilha real

Deals `fechado ganho`, `valor` = Montante Zoho, classificação = `fonteVenda` atual
(planilha pública `1roirh1…`, lida em 2026-07-21):

| Mês | Venda Defenz | Repasse SS | **Total** |
|---|---|---|---|
| Julho/26 | R$ 11.033 (1) | R$ 11.603 (7) | **R$ 22.636** |
| Junho/26 | R$ 22.307 (2) | R$ 23.949 (6) | **R$ 46.256** |
| Maio/26 | R$ 1.664 (1) | R$ 32.652 (6) | **R$ 34.316** |
| Últimas 8 sem (01/06–26/07) | R$ 33.340 (3) | R$ 32.052 (12) | **R$ 65.392** |

**Conclusão:** o "~43k só vendas nossas" bate com o **Total de junho (R$46k)**. "Venda Defenz"
sozinha lê baixo porque a maioria dos ganhos é `securisoft` sem tag "Venda Defenz" → Repasse por
default conservador. **Não é bug de código** — o novo card de Total expõe o número. Disciplina de
tag no Zoho segue como recomendação (não bloqueia esta spec).

---

## Padrões visuais (regra de cor + tipografia + acessibilidade)

Consolidado aqui pra toda a página reusar (e a Spec 2 herdar). Corrige 4 violações que existem hoje
no mockup/código.

### Cor de DADO (barras/linhas) — nunca vermelho por padrão
- **Receita Defenz vs Meta (gráfico A):** grafite `#334155` (bateu, `pctAbs ≥ 1`) · cinza médio
  `#94a3b8` (quase, `0.8 ≤ pctAbs < 1`) · cinza claro `#cbd5e1` (abaixo, `< 0.8`).
- **Repasse SS (gráfico B):** `#cbd5e1` (o `#e2e8f0` do mockup some no branco).
- **Esforço→Vendas (gráfico C):** barras de receita num **único neutro** `#64748b` (sem gradação por
  meta aqui — a comparação com meta vive no A). Linha de esforço `#0284c7` (sky-600), `strokeWidth 2`,
  dots `r=3` com stroke branco.

### Cor de STATUS (farol/badges) — 3 estados, vermelho reservado
- `NO RITMO` — verde (`revenue ≥ expected`).
- `META BATIDA` — verde, mesmo dot, label especial quando `pctAbs ≥ 1` (motiva o time no telão;
  diferencia "no ritmo" de "já ganhou").
- `ATENÇÃO` — âmbar (abaixo do esperado, não crítico).
- `CRÍTICO` — vermelho, **reservado a problema real**: proposta (tunável) `pctAbs < 0.5` **e** bucket
  fechado (semana/mês encerrado bem abaixo). Senão, âmbar.
- **Eliminar o status "QUASE" com dot cinza** do mockup — cinza é paleta de *dado*, não de status.

### Tipografia / acessibilidade (WCAG AA)
- Texto de status: `text-amber-700` (#b45309) e `text-emerald-700` (#047857) — os tons 600 reprovam
  AA em 12px. Dots/barras podem seguir `amber-500`/`emerald-500`.
- **`DeltaBadge` de queda: `text-amber-700`, não `text-red-500`** (queda de esforço = atenção, não
  incêndio). Vale pro `PorqueBloco` e pros tiles de eficiência.
- Piso de legendas/eixos: **11px** (os 8–9px do mockup eram só de preview).
- Marcador de "ritmo esperado": engrossar p/ `w-[2px] bg-slate-600`.

### "Poucos pontos" (N≈8 barras, semanas zeradas frequentes com 1–3 deals)
- **Rótulo direto no topo das barras** (`<LabelList>` formatado em `k`) — telão não tem hover, então
  rótulo > tooltip.
- `minPointSize={3}` p/ semana R$0 ainda aparecer (não "faltar dente" na linha do tempo).
- Teto do eixo Y do A com folga (`domain={[0, max => Math.max(max, 8000)]}`) p/ a linha de meta 6k não
  colar no topo. `maxBarSize={48}`, `tickFormatter` em `k` (remover o hack `left:-16`).
- **Semana em curso** no gráfico A: `<Cell fillOpacity={0.45}>` + nota "última barra = semana em
  curso" (ou excluí-la do A, já que vive no farol). Evita "acusar" toda segunda uma semana que mal começou.

---

## 1. Card "Faturamento completo" (hero, topo)

Card de destaque abaixo do header, **antes** dos faróis. Três números para o **período selecionado**
(default = últimas 8 semanas):

- **Ordem:** Venda Defenz | Repasse SS | **Total** (leitura "a + b = total").
- **Hierarquia:** Total domina — `text-4xl font-semibold text-slate-900`, separado por
  `border-l border-slate-200 pl-6`. Defenz `text-2xl text-slate-700`; Repasse SS `text-2xl text-slate-500`.
- **Sem vermelho/rosado no card** (o mockup violava a §Padrões). Card padrão `bg-white/70
  border-slate-200/60`; se quiser marca, `border-t-2 border-t-red-600` (fio no topo). Rótulo da seção
  em `text-red-600 uppercase tracking-widest text-sm font-bold` (padrão da página).
- **Valores exatos em BRL, sem centavos** (`R$ 65.392`, não `R$ 65,4k`) — o hero existe pra *validar*
  o número; abreviar gera desconfiança. Abreviação `k` fica só em gráficos/faróis.
- **Sub-linhas:** Defenz `"3 vendas · ticket R$ 11,1k"`; Repasse `"12 repasses"`; Total
  `"faturamento do período"`. Primeiro "Repasse SS" da página com `<Tooltip>` "SS = SecuriSoft (revenda)".

Fonte: `MetasConsolidado` já tem `revenue`, `revenueRepasse`, `revenueTotal`; no default (sem range) o
consolidado cobre as 8 semanas. **Novo:** contagem de deals por fonte (`dealsDefenz`, `dealsRepasse`)
p/ os sub-textos e o ticket.

## 2. Faróis Semana + Mês (ao vivo)

Mantêm `res.farol.semana` / `res.farol.mes` (defenz-only, ao vivo) + nota "+R$X repasse SS (fora da
meta)" + marcador de ritmo esperado. Aplicar §Padrões (cor de status 3 estados + `META BATIDA`; sem
"QUASE" cinza). Segunda de manhã com semana zerada e `expected ≈ 0` → label neutro `SEMANA
COMEÇANDO` (slate), não âmbar.

## 3. "Por que bati / não bati" (reintegrado) + separação semanal/mensal/composto

- **Reintegrar o `PorqueBloco`** entre os faróis e o gráfico A (posição 3.5), no modo padrão, com o
  `diagnostico` da última semana fechada. É o único conteúdo de coaching em texto — o que o Marcos
  cola no grupo; o v2 o tinha perdido, mas o subtítulo promete "por que bati / não bati".
- **Composto (Σ):** ao customizar um intervalo, o `PorqueBloco` dá lugar ao `ConsolidadoCard`
  (comportamento atual). **Enxugar o Consolidado**: só barra de atingimento vs `6k × N semanas` +
  tiles de esforço somado. **Remover** dele o número grande de receita e a nota de repasse — o **hero
  (§1) é o dono** desses números (senão vira dupla fonte de verdade).
- Semana e Mês (os dois faróis) já entregam a separação semanal/mensal; composto = o consolidado.

## 4. Três gráficos independentes (quebrar o gráfico único de hoje)

Hoje é **um** `ComposedChart` empilhando tudo. Quebrar em três cards, aplicando §Padrões:

- **A · Receita Defenz vs Meta** — barras (cor por atingimento) + linha da meta (6k) + rótulo direto +
  semana em curso com opacidade.
- **B · Repasse SS** — barras `#cbd5e1`, altura menor. Nota: `"Informativo — não conta na meta
  semanal."` (cortar a explicação de design do mockup).
- **C · Esforço → Vendas** — ver §5.
- **[NICE] Desktop:** A + B lado a lado `grid xl:grid-cols-3` (A = `col-span-2` ~300px; B = 1 col
  ~180px) — tamanho relativo comunica "A = alvo, B = contexto".

## 5. Esforço → Vendas — linha do tempo + índices de eficiência

**5a. Linha do tempo (dual-axis)** — barras = receita da semana (`#64748b`), linha = esforço total
(Σ ligações+emails+apresentações+propostas+reuniões). **Rotular e colorir os eixos:** esquerdo
"R$" (ticks `#64748b`), direito "ações" (ticks `#0284c7`). Legenda: `"barras = receita · linha =
esforço (qtde de ações)"`. Micro-nota no rodapé: `"Esforço vende com atraso — compare tendências, não
a mesma semana."` (evita a leitura errada "liguei muito e não vendi *nesta* semana").

**5b. Índices de eficiência** — grid de 4 tiles sobre o **período selecionado**:

| Índice | Cálculo |
|---|---|
| **Ticket médio** | receita Defenz ÷ nº vendas |
| R$ / proposta | receita Defenz ÷ propostas |
| Propostas / 100 ligações | propostas ÷ ligações × 100 |
| Reunião → proposta | propostas ÷ reuniões (%) |

- **Trocado R$/ligação → Ticket médio** (Fable): com 1–3 deals, R$/ligação pula ±300% por um único
  deal — só ruído.
- Divisão por zero → `"—"` (nunca `NaN`/`Infinity`).
- **Guarda de amostra:** se qualquer denominador do período `< 3`, **suprimir o delta** → `"—
  amostra pequena"` (`text-slate-400`).
- Sub-linha de cada tile com a **fração crua** (`R$ 33,3k ÷ 3 vendas`, `14 propostas ÷ 62 reuniões`) —
  transparência que vira pauta de coaching.
- **Delta = vs período anterior de mesmo tamanho** (menos ruído com dados esparsos), com caption
  dinâmico (`"vs 8 semanas anteriores"` / `"vs junho"`). Cor do delta pela §Padrões (verde=melhorou,
  âmbar=piorou), nunca vermelho.

## 6. Seletor de período (conserta "8 semanas só puxa o mês")

**Causa-raiz (com evidência):** não é dado — a planilha `deals` tem ganhos desde nov/2025. É UX do
`DateRangePicker`: calendário de **1 mês** + seleção 2 cliques → na prática só se seleciona dentro de
um mês.

**Conserto:**
- **Presets** como **segmented control** (não 6 pílulas soltas competindo com o H1): container
  `bg-white/80 border border-slate-200/60 rounded-full p-1 shadow-sm` (linguagem do DateRangePicker
  atual), chips `rounded-full px-3 py-1 text-xs font-semibold`, ativo `bg-red-600 text-white`,
  inativos `text-slate-600 hover:text-red-600`, `focus-visible:ring-2 ring-red-500/40`. Em `lg-`,
  **linha própria abaixo do título** (`flex-col gap-3 lg:flex-row lg:items-end`), nunca espremido ao
  lado do H1.
- Presets: `8 sem · 12 sem · Este mês · Mês passado · Trimestre` + `📅 intervalo`. *(Fable sugere
  cortar "12 sem" ≈ "Trimestre"; decisão do Marcos — ver §Itens abertos.)* Intervalo custom aparece
  como chip ativo + X de limpar (padrão atual).
- **Calendário de 2 meses** (`numberOfMonths={2}`) → intervalo cruzando meses em 2 cliques sem navegar.
- Presets viram `RangeSelection` (`periodo`) e passam pelo mesmo `?from=&to=` da API. **Sem mudança no
  backend** (`computeMetas` com `range` já resolve N semanas).

## 7. Header / microcopy

- **Subtítulo calmo, sem grito:** trocar `META SEMANAL R$ 6.000 · POR QUE BATI / NÃO BATI` (caps,
  vermelho, bold) por `"Meta semanal: R$ 6.000 · só Venda Defenz — Repasse SS é informativo"`
  (`text-sm text-slate-500`, com `R$ 6.000` em `font-semibold text-slate-700`). É a regra de negócio
  mais mal-entendida (por que a meta é "menor" que o faturamento) — merece frase permanente e calma.
  Vermelho de marca fica no H1/nav/chip ativo.
- **[NICE] Período no header de cada card** (`text-[11px] text-slate-400`, à direita: "últimas 8
  semanas" / "01/06–26/07") — página longa + seletor no topo = no meio do scroll ninguém lembra o período.

---

## Arquivos afetados (mapa pro implementador)

| Arquivo | Mudança |
|---|---|
| `src/components/metas/MetasDashboard.tsx` | Hero faturamento completo (§1); reintegrar `PorqueBloco` + enxugar `ConsolidadoCard` (§3); quebrar 1 gráfico → 3 (§4); card Esforço→Vendas com timeline + índices (§5); presets segmented control (§6); microcopy (§7); aplicar §Padrões (cores/tipografia/poucos-pontos); corrigir `DeltaBadge` (linha ~49) |
| `src/components/ui/DateRangePicker.tsx` | `numberOfMonths={2}`; slot de presets |
| `src/components/ui/calendar.tsx` | suportar 2 meses |
| `src/lib/date-range.ts` | helpers de preset (8 sem / 12 sem / este mês / mês passado / trimestre → `RangeSelection`) |
| `src/lib/metas.ts` | índices de eficiência + delta (§5b); contagem de deals por fonte no consolidado (§1) |
| `src/lib/farol.ts` | `grade()` — 3 estados + `META BATIDA` + limiar de `CRÍTICO` (§Padrões) |
| `src/lib/types.ts` | tipos novos: índices de eficiência, contagem/ticket por fonte |
| `src/app/api/metas/route.ts` | expor índices/contagens se calculados no server |
| `src/lib/metas.test.ts`, `src/lib/farol.test.ts` | cobrir índices, guarda de amostra, limiares de cor, presets |

## Itens abertos (decidir na implementação/review)

- **Presets:** manter "12 sem" **e** "Trimestre" (redundantes) ou cortar um? (Fable: cortar 12 sem.)
- Limiar exato do `CRÍTICO` em `grade()` (proposta: `pctAbs < 0.5` + bucket fechado).
- Índices/cores calculados no server (`route.ts`) ou no client (`MetasDashboard.tsx`).
- **Resolvidos nesta revisão:** conjunto de índices (Ticket médio no lugar de R$/ligação); delta =
  período anterior de mesmo tamanho; `PorqueBloco` fica; hero é dono dos totais.

## Melhorias opcionais (NICE — fase 2 / se der tempo)

- Gráficos A+B lado a lado no desktop (§4).
- **Skeleton loading** replicando o layout (hero h-28, 2 faróis h-40, 3 cards) em vez do spinner
  central; spinner só no botão refresh.
- **Empty state por card** (ex.: "Nenhuma venda Defenz no período · Repasse SS: R$ X") em vez de 8
  stubs vazios.
- Período repetido no header de cada card (ou header sticky).
- **Modo telão:** auto-refresh silencioso a cada 10 min (+ `visibilitychange`) e count-up curto nos
  números (Framer, respeitando `useReducedMotion()`).

## Mudanças vs mockup aprovado (`metas-full.html`) — ciente, Marcos

O refino de UI/UX altera detalhes do mockup que você aprovou (todas melhoram a leitura, nenhuma muda o
layout scroll nem as decisões travadas):
1. **Hero neutro** (sem fundo rosado, sem valor vermelho) e **Total dominante** com valor exato.
2. **Reintegra "Por que bati / não bati"** (o mockup tinha removido; o subtítulo prometia).
3. **Ticket médio** no lugar de "R$/ligação" nos índices.
4. **Status em 3 cores** (+ "META BATIDA"); sai o "QUASE" cinza.
5. **Presets como segmented control** em linha própria (não 6 chips soltos no header).
6. **Subtítulo calmo** em vez do slogan em caps vermelho.

## Fora de escopo (outras specs do lote)

- Spec 2 — Meta em "Receita por Canal" (`/`) + aplicar §Padrões lá (SecuriSoft `red-500`).
- Spec 3 — Drill-down da base instalada (`/diario`: top 8 → todas ~64 por licença + segmento).
- Spec 4 — Indicador "clientes ganhos 100% taggeados".
- Grupo A — deploy + provisionamento prod (login/perfis). **Não sobe agora**; primeiro as
  alterações, depois `commit` + `push` na branch.

## Notas de segurança

Sem mudança no modelo de auth. `/api/metas` segue protegido por `verifySession`. Nenhum dado novo
sensível exposto (planilha `deals` já é gviz público, como as outras rotas).
