# LEARNINGS.md

Conhecimento acumulado de tasks anteriores. Não substituir — apenas adicionar.

---

## 2026-05-05 — Reuniões fallback + fetchFromSheetsNullable

**Task:** cmosjzu1h000daput58fue7g1

- `fetchFromSheets` não consegue distinguir "aba não encontrada" de "aba existe mas está vazia" porque ambas retornam `[]`. Solução: `fetchFromSheetsNullable` retorna `null` quando `json.status === 'error'` (tab inexistente) e `[]` quando a aba existe mas está vazia. Lógica de parsing extraída para `parseGvizRows()`.
- `computeMetrics` agora aceita 6º parâmetro opcional `reunioesRaw?: RawReuniao[] | null`. `null` → usa proxy `[REUNIAO]` nos campos `resultados` dos deals. Array (mesmo vazio) → usa dados da planilha.
- `coverage.reunioes.source` expõe a origem para observabilidade futura (`'sheet'` | `'resultados-proxy'` | `'unavailable'`). O campo `source` foi adicionado como opcional em `CoverageSourceStats` para não quebrar as 4 fontes existentes (deals/calls/emails/classificacoes não definem source).
- A tag de busca nos `resultados` é `'REUNIAO'` (sem acento, sem cedilha), consistente com `'APRESENTA'` e `'PROPOSTA'` — `extractEventDates` faz substring match case-sensitive.
- Build TypeScript passou sem erros com as 3 mudanças simultâneas (types.ts + sheets.ts + metrics.ts + route.ts).

---

## 2026-05-05 — Fallback de empresa e ultimo_cliente (task cmosjzu1j000eaputza5jyte9)

- **`resolveEmpresa` cascade**: definida no módulo `dashboard-sheets/route.ts` (não em metrics.ts, pois depende da aba leads que só é fetchada nesta rota). Cascade: `deal.empresa` → `split(deal.nome, ' - ')[0]` → lookup em `leadsByNome` map → `'(sem empresa)'`.
- **Formato do deal.nome no Zoho**: parece ser "Empresa - Contato", então `split(' - ')[0]` retorna a empresa. Quando não há ' - ', o nome completo é usado como chave para o lookup na aba leads.
- **Leads lookup map**: `lead.nome.toLowerCase() → lead.empresa`. Construído em O(n) antes do mapeamento dos deals. Chave lowercase para case-insensitive match.
- **`empresa_source`** é campo extra nos objetos de resposta (`any`) — não foi necessário alterar a interface `Deal` em types.ts, evitando impacto em consumidores downstream.
- **`getLastClosedClient` nome fallback**: mudança mínima em metrics.ts — `last.nome || last.empresa || 'N/A'` para evitar 'N/A' quando deal.nome está vazio mas empresa existe.
- Build TypeScript passou sem erros com todas as mudanças simultâneas.

---

## 2026-05-05 — Coverage diagnostics em metrics.ts

**Task:** cmosjzu1f000caputzof0ve6i

- `dateInRange` estava fazendo `String(dateStr).slice(0, 10)` sem validar se o resultado é realmente `YYYY-MM-DD`. Strings vazias, ISO completos com timezone e strings não-data passavam silenciosamente para comparação lexicográfica. Solução: `DATE_RE = /^\d{4}-\d{2}-\d{2}$/` antes de comparar.
- `buildCoverageStats` recebe `(string | undefined)[]` e não `RawDeal[]` — isso separa a preocupação de "qual campo de data usar" do "como contar". Para deals usamos `closing_date || modified_time || created_time` (ordem de confiabilidade).
- `ComputedMetrics.coverage` não quebra nenhum consumidor existente porque é campo adicional (TypeScript struct compatibility). Verificado via build completo.
- Deal coverage usa o campo `closing_date || modified_time || created_time` — não existe um único campo canônico para deals (fechamentos usam `closing_date`, novos deals usam `created_time`, pipeline usa snapshot). A coverage de deals representa "o deal tem alguma data no range?".

---

## 2026-05-05 — DataHealthPanel + health dots nos cards (task cmosjzu1q000faput19tj0d5f)

- `_coverage` foi adicionado à resposta de `/api/dashboard-sheets` como campo extra (sem alterar `N8nData` interface — mantém compatibilidade). O hook `useDashboardData` extrai `_coverage` do payload da resposta sheets e armazena em estado separado (`coverage: CoverageReport | null`).
- `getHealth()` é exportada de `DataHealthPanel.tsx` (não em lib/metrics) porque é lógica de apresentação que depende de thresholds UI (>10% = red). Regra: `in_range === 0` → empty (red); `dropped/total > 10%` → empty (red); `dropped > 0` → partial (yellow); resto → ok (green).
- `StatCard.tooltip` foi alterado de `string` para `ReactNode` (compatível com strings existentes, sem breaking change). Isso permite passar `<CoverageTooltip>` com info estruturada de fonte + cobertura.
- `CoverageTooltip` é um componente inline no `ExecutiveDashboard.tsx` (não exportado) — evita criar arquivo só para um componente de 10 linhas usado em contexto único.
- Reuniões e Apresentações/Propostas/Fechados mapeiam para fontes diferentes: calls → `coverage.calls`, reunioes → `coverage.reunioes`, cards de deals → `coverage.deals`. O painel DataHealthPanel mostra todas as 5 fontes simultaneamente.
- Build TypeScript passou sem erros após todas as mudanças simultâneas.

---

## 2026-05-08 — Série diária de ligações: endpoint /api/ligacoes-serie (task cmow5iucg0004qphktpca29au)

- Endpoint `GET /api/ligacoes-serie?periodo=<value>` retorna: `serie` (DailyCallPoint[]), `meses` (MesSummary[]), totais e taxa_media.
- `aggregateByDay` filtra por range exato (start/end); `aggregateByMonth` agrega TODOS os dados disponíveis (para navegação de meses sem refetch).
- Suporta todos os períodos canônicos (`today`, `7d`, `15d`, `30d`, `month`, `alltime`, `custom:YYYY-MM-DD:YYYY-MM-DD`) mais `mes:YYYY-MM` para visualizar um mês específico pelo calendário.
- `MesSummary.media_diaria` é baseado em dias COM dados (não dias no mês), para não penalizar meses parcialmente preenchidos.
- Cache em memória 30 min (mesmo padrão das outras rotas). Não compartilha cache com `dashboard-sheets` — chaves distintas (`ligacoes_serie_<periodo>`).
- Tipos `DailyCallPoint`, `MesSummary`, `LigacoesSerieResponse` adicionados a `src/lib/types.ts`.

---

## 2026-05-07 — Schema POC + WeeklyBucket (task cmow5iuci0005qphkuspxy820)

- **`WeeklyBucket`** estava sendo importado por `metrics.ts` mas não definido em `types.ts` — bug pré-existente no working tree (não no git HEAD). Adicionado como parte desta task para deixar o build limpo.
- **Schema `pocs`**: 13 colunas, `poc_id` como matchingColumns para upsert idempotente no N8N. `deal_id` pode ser vazio (POC pré-deal), então a FK é opcional.
- **`status` armazenado como TEXT** na planilha (não enum) — validação feita no parse TypeScript via narrowing `['ativa','convertida','perdida'].includes(raw.status)`.
- **`dias_em_poc` calculado em runtime** (não persistido) — igual ao padrão de `days_in_stage` em deals operacionais. Evita stale data na planilha.
- **`PocMetrics.taxa_conversao`** exclui POCs ativas do denominador (mesmo conceito de win rate: fechados / (fechados + perdidos)). Documentado explicitamente para evitar confusão futura.
- **Correlação via `deal_id` Map** é O(n) e segue o padrão já usado em `enrichDealsWithActivities`. Um deal pode ter 0 ou 1 POC associada (mesma semântica de relacionamento 1:1).

---

## 2026-05-08 — Weekly Bucketizer semanal (task cmow5iuc80003qphkr8c77jkd) — 2ª tentativa

- `WeeklyBucket` interface definida em `src/lib/types.ts`. `bucketizeByWeek(deals, calls, emails, dateRange, reunioesRaw?)` exportada de `src/lib/metrics.ts`.
- Semanas por dia-do-mês: S1=1-7, S2=8-14, S3=15-21, S4=22-28, S5=29+. Agrupa por `YYYY-MM` (suporta ranges multi-mês).
- Reuniões seguem o mesmo fallback de `computeMetrics`: `reunioesRaw != null` → conta da aba `reunioes`; `null` → extrai via `[REUNIAO]` em `deals.resultados`.
- Exposto em `GET /api/dashboard-sheets` como `_weekly_buckets: WeeklyBucket[]` e em `GET /api/relatorio-mensal` como `weekly_buckets`. Sem fetch extra — reutiliza dados já carregados.
- A key `"YYYY-MM-Sx"` ordena corretamente via `localeCompare` lexicográfico, sem Date parsing.
- **Hook completado (2ª tentativa):** `useDashboardData` extrai `_weekly_buckets` do payload da rota sheets e armazena em `weeklyBuckets: WeeklyBucket[]` (inicialmente `[]`). Mesmo padrão de `coverage`. Campos extras do servidor nunca passam por `validateN8nData()`, precisam ser extraídos manualmente antes da chamada.
- Tarefa foi rejeitada na 1ª tentativa possivelmente porque o hook não expunha `_weekly_buckets`, tornando os dados inacessíveis para componentes frontend.

---

## 2026-05-08 — Clientes ativos + delta mensal por canal (task cmow5iucq0006qphk7uiu18hw)

- `computeClientesAtivos(deals)` exportada de `src/lib/metrics.ts`. Não recebe `dateRange` — o total (base instalada) é todos os `isClosedWon`, e mes_atual/mes_anterior são meses de calendário fixos (não o período selecionado no dashboard).
- `delta` = `mes_atual.total - mes_anterior.total` (pode ser negativo). `delta_split` quebra o delta por canal.
- O campo `closing_date.slice(0, 7)` retorna `YYYY-MM` para comparar com o mês atual — não usar `modified_time` como fallback aqui seria ruim, pois modified_time pode mudar por qualquer motivo. No entanto, deals sem `closing_date` usam `modified_time` como fallback para não cair no buraco de "mês desconhecido".
- Exposto em `/api/dashboard-sheets` como `_clientes_ativos: ClientesAtivosMetrics`. Campo extra (não no schema `N8nData`), mantém compatibilidade.
- Ao adicionar campo obrigatório em `N8nData`, lembrar de atualizar **também** `src/lib/mock-data.ts` e `src/lib/validation.ts` — ambos constroem/validam objetos do tipo `N8nData`. O build aponta esses erros sequencialmente, não todos de uma vez.

---

## 2026-05-08 — Pipeline bucket classifier (task cmow5iucx0009qphkshelamfh)

- `classifyPipelineBucket(stage)` exportada de `src/lib/metrics.ts`. Retorna `PipelineBucketType`: `PIPELINE | POC | FOLLOW-UP | OPORTUNIDADE`. Precedência: POC_KEYWORDS → FOLLOW_UP_KEYWORDS → PIPELINE_STAGES → default `OPORTUNIDADE`.
- `computePipelineBuckets(deals)` retorna `PipelineBucketsMetrics` com os 4 buckets sempre presentes (count=0 se vazio), preservando a ordem fixa `OPORTUNIDADE | FOLLOW-UP | POC | PIPELINE` (funil crescente).
- Classificação usa `isActive()` como filtro — exclui fechados ganhos e perdidos. Deals sem stage mapeado vão para OPORTUNIDADE (catch-all correto para leads novos).
- `PipelineBucketType`, `PipelineBucketDeal`, `PipelineBucket`, `PipelineBucketsMetrics` adicionados a `src/lib/types.ts`.
- Exposto em `/api/dashboard-sheets` como `_pipeline_buckets`. Mesmo padrão dos outros campos extras — campo fora do schema `N8nData`, sem breaking change nos consumidores existentes.
- Build TypeScript passou sem erros.

---

## 2026-05-08 — Renovações vencidas: computeRenovacoesVencidas() (task cmow5iucu0008qphk5455omr7)

- `data_renovacao` adicionado como campo opcional `string | undefined` em `RawDeal` — sem breaking change (campo ausente = string vazia = ignorado pelo DATE_RE guard).
- `computeRenovacoesVencidas(deals)` filtra: (1) `isClosedWon(stage)`, (2) `classifyOrigin(lead_source).categoria === 'securisoft'`, (3) `data_renovacao` válida e < hoje. Ordena por `dias_vencido` decrescente (mais vencido primeiro).
- Resultado exposto em `GET /api/dashboard-sheets` como `_renovacoes_vencidas: RenovacoesVencidasMetrics`. Padrão `_` (campo extra) — sem alterar `N8nData` interface, sem breaking change nos consumidores existentes.
- Se a aba `deals` do Google Sheets não tiver coluna `data_renovacao`, todos os deals terão `data_renovacao = undefined` e `_renovacoes_vencidas.total = 0`. O N8N precisa gravar o campo Zoho `Renewal_Date` (ou equivalente) na planilha.
- `dias_vencido` calculado por diferença de datas em ms / 86400000 com `Math.max(0, ...)` para evitar negativo em edge cases de timezone.

---

## 2026-05-08 — total_licencas_ativas (task cmow5iucs0007qphk9yh1nyyo)

- `licencas` adicionado como campo opcional (`number | string | undefined`) em `RawDeal` — sem breaking change (campo vazio retorna 0 via `Number(d.licencas) || 0`).
- `total_licencas_ativas` computado em `computeMetrics()` como snapshot (não filtrado por dateRange) — faz sentido porque o total de licenças ativas é o estado atual da base instalada, não dependente do período selecionado no dashboard.
- `total_licencas_ativas` adicionado a `ComputedMetrics`, `N8nData` (types.ts), exposto na resposta de `GET /api/dashboard-sheets`, e incluído em `validateN8nData()` e `mock-data.ts` para manter a cadeia de tipos consistente.
- Quando a aba `deals` no Google Sheets não tiver a coluna `licencas`, todos os deals retornarão `licencas = undefined`, e `total_licencas_ativas = 0`. O N8N workflow precisa ser atualizado para escrever `licencas` na aba deals (campo Zoho CRM correspondente).

---

## 2026-05-08 — MRR/ARR com fallback automático (task cmow5iud4000cqphkgjqqvecl)

- `RawDeal.recurring` é campo opcional `string | undefined` — lido da coluna `recurring` na aba `deals` do Sheets. Aceita: `'true'`, `'sim'`, `'1'`, `'yes'`, `'recorrente'` (case-insensitive).
- `computeMrrArr(deals)` retorna `MrrArrMetrics`. Se NENHUM deal tiver a flag `recurring`, usa todos os `closedWon` como fallback (`source = 'fallback'`). Intencional: enquanto o N8N não gravar a coluna, o dashboard não fica em branco.
- ARR = soma dos valores dos deals recorrentes (trata cada deal como contrato anual). MRR = ARR / 12.
- Exposto em `/api/dashboard-sheets` como `_mrr_arr: MrrArrMetrics` (campo extra `_`, sem alterar `N8nData`).
- Para popular explicitamente: N8N precisa gravar o campo Zoho (ex: "Tipo_Contrato") como `recurring = 'sim'` na aba `deals`.
- Build TypeScript passou sem erros.

---

## 2026-05-08 — Receita por canal: computeReceitaPorCanal() (task cmow5iud9000eqphkx8wimg2g)

- `computeReceitaPorCanal(deals, dateRange)` exportada de `src/lib/metrics.ts`. Filtra `isClosedWon` pelo dateRange (usa `closing_date || modified_time`) e agrupa por `classifyOrigin().categoria` (direto/parceiro/securisoft).
- Ordem fixa das categorias: `['direto', 'parceiro', 'securisoft']` — garante consistência visual independente de quais canais têm deals.
- `percentual` é calculado como `Math.round((valor / total) * 100)` — soma pode diferir de 100 por arredondamento; aceitável para exibição.
- Tipos `ReceitaCanalItem` e `ReceitaPorCanalMetrics` adicionados a `src/lib/types.ts`.
- Exposto em `GET /api/dashboard-sheets` como `_receita_por_canal` (campo extra `_`, sem alterar `N8nData`).
- `useDashboardData` extrai `_receita_por_canal` e expõe como `receitaPorCanal: ReceitaPorCanalMetrics | null`.
- UI em `ExecutiveDashboard.tsx`: barra de proporção horizontal + 3 cards (um por canal) + linha de totais. Seção condicional: só renderiza quando `total_valor > 0`.
- `ReceitaPorCanalSection` é componente local no arquivo (não exportado) — evita criar arquivo para componente usado em contexto único.
- Build TypeScript e Next.js passaram sem erros.

---

## 2026-05-08 — Faturamento mensal: computeFaturamentoMensal() + /api/faturamento-mensal (task cmow5iud2000bqphk52up61r7)

- `computeFaturamentoMensal(deals, ano?)` exportada de `src/lib/metrics.ts`. Agrupa `isClosedWon` por `YYYY-MM` de `closing_date || modified_time`. Parâmetro `ano` opcional — filtra por ano específico sem segundo fetch.
- Calcula `comissao_fechado` por mês usando `classifyOrigin` (mesma lógica do `computeMetrics`). Valores arredondados com `Math.round` para evitar centavos flutuantes na API.
- `ticket_medio` por mês = `valor_fechado / deals_count`, zero se nenhum deal.
- Reutiliza `MONTH_ABBR` (já existente em metrics.ts) para gerar labels `"Jan 2026"` sem nova dependência de i18n.
- Exposto em `GET /api/faturamento-mensal?ano=<YYYY>` (sem `ano` = todos os meses). Cache 30 min, chave `faturamento_mensal_<ano|all>`.
- Também exposto como `_faturamento_mensal` em `GET /api/dashboard-sheets` — consumidores existentes não são afetados (campo extra).
- Tipos `FaturamentoMes` e `FaturamentoMensalMetrics` adicionados a `src/lib/types.ts`.
- Build TypeScript passou sem erros (`npx tsc --noEmit` + `npm run build`).

---

## 2026-05-08 — Endpoint /api/relatorio-mensal (task cmow5iucz000aqphkcntvruul)

- `GET /api/relatorio-mensal?ano=YYYY&mes=M` consolida TODOS os blocos do relatório em uma única chamada: `metrics` (KPIs), `weekly_buckets`, `daily_calls_serie`, `esforco_diario`, `deals_ativos`, `clientes_fechados`, `ultimo_cliente`, `clientes_ativos`, `renovacoes_vencidas`, `coverage`.
- Date range é calculado como primeiro e último dia do mês: `new Date(ano, mes, 0).getDate()` retorna o último dia do mês (day 0 do mês seguinte).
- `buildDailyCallSeries` (local no route) agrega ligações por dia — idêntica ao padrão de `ligacoes-serie/route.ts`. Mantida local para evitar acoplamento cross-route.
- `resolveEmpresa` (local) é duplicada de `dashboard-sheets/route.ts` — candidata a extração para `src/lib/formatters.ts` se surgir um 3º consumer.
- Cache key: `relatorio_mensal_${ano}_${mes}` — separado do cache de `dashboard-sheets` para não invalidar um pelo outro.
- Build Next.js passou sem erros. TypeScript passou sem erros (`npx tsc --noEmit`).

---

## 2026-05-08 — Comissão por owner + canal por mês (task cmow5iud6000dqphktk4h6tog)

- `owner?: string` adicionado a `RawDeal` (campo opcional — deals sem `owner` mapeiam para `'(sem owner)'` no agrupamento).
- `computeComissaoOwnerCanal(deals, ano?)` exportada de `src/lib/metrics.ts`. Agrupa `isClosedWon` por `YYYY-MM × owner × canal`, retorna `ComissaoOwnerCanalMetrics` com: `meses[]` (sorted), `total_comissao`, `owners[]` (sorted desc por comissão total).
- Chave de agrupamento: `"YYYY-MM|owner|canal"` — triple key concatenada com `|`. Simples e evita Map aninhado.
- `Math.round` aplicado ao `valor_fechado` e `comissao` de cada entrada (mesmo padrão de `computeFaturamentoMensal`).
- `owners[]` no resultado é sorted por `total_comissao` decrescente — tabela de ranking "quem gerou mais comissão".
- Exposto em `GET /api/dashboard-sheets` como `_comissao_owner_canal`. Campo extra `_`, sem alterar `N8nData` interface.
- N8N precisa gravar o campo `Deal_Owner` (ou equivalente Zoho) na aba `deals` como coluna `owner`; enquanto ausente, todos deals ficam em `(sem owner)`.
- Build TypeScript passou sem erros.
