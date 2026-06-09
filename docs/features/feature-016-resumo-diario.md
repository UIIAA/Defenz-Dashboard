# Feature: Resumo Diário — Dashboard estilo Relatório Diário Defenz (histórico até 120 dias)

**Status:** Approved
**Priority:** P1
**Date:** 2026-06-08
**Revisão:** v2 — incorpora avaliação adversarial (5 revisores, veredito *approve-with-changes*) + decisões do stakeholder.

> Leia `CONTEXT.md`/`MEMORY.md` para histórico profundo. Cobre a frente N8N (aditiva) **e** a frente Vercel (nova página). Avaliação completa: ver `docs/features/feature-016-EVAL.md` (resumo no fim deste doc).

## Objective
Nova página `/diario` ("Resumo Diário") que replica o relatório diário do Defenz Chief (CSV/imagem de referência), alimentada por um **snapshot diário persistido** numa aba com chave de data, permitindo navegar qualquer dia até **120 dias atrás** — sem alterar nenhum fluxo N8N que já funciona.

## Decisões do stakeholder (2026-06-08)
1. **Nova página `/diario`** — dashboard executivo atual permanece intacto.
2. **Paridade total** com o CSV (Tração+por vendedor, Canais digitais, Base Instalada, Destaques+POCs).
3. **Tema ESCURO navy+verde**, fiel à imagem (cards escuros próprios para `/diario`; resto do app continua "Defenz Lux" branco).
4. **Tudo no doc público** `1roir…` (números + destaques). Trade-off LGPD aceito conscientemente; mitigações de defesa-em-profundidade abaixo (regex CPF/CNPJ + etapa de revisão no backfill de destaques).
5. **Backfill máximo possível**, com regra rígida: campos **reconstruíveis** preenchidos; campos **não-históricos/não-capturados** = `null` (nunca `0`).
6. **E-mails**: fonte = chat (Metricas `email_envios`) com flag `emails_source`, pois a ingestão Apollo→aba `emails` está parada desde 2026-03-30 (P9). Tarefa separada conserta a ingestão.

## Contexto descoberto (evidência verificada)

### Fluxos N8N (nenhum será modificado)
- `eL97o6zOl63uoRbr` (**Chief**): `6pm Trigger`→`Executar Relatorio Diario`→Teams.
- `WdMgn8tSwzQo1cOc` (**Sub - Relatório Diário**): calcula **ao vivo só HOJE**, **não persiste**. Fontes: Callbox (por vendedor via `origin`), Apollo (por sender via `user.name`), Zoho Deals (propostas/apresentações por owner; POCs; **Base Instalada HARD-CODED 3896/22** + deals com `Data_setup`→`N_de_Endpoints`), Graph (reuniões `<>`), e Google Sheet **privado** `1Len6…` aba `Metricas` (LinkedIn/WhatsApp/e-mail-por-pessoa/atividades).
- `Pep9gmY1fb0MUwmP` (**Coletor Chat**, Cron 17h45 seg-sex): chat Teams "Operação"→Gemini→append na aba `Metricas` (cols: `timestamp,data,autor,categoria,chave,valor,raw_msg,parse_status`).
- `QjnzGicZHIPBNN1g` (**Coleta Métricas v2**, Cron 6am/18pm): escreve as abas RAW (`ligacoes,emails,deals,leads,classificacao_ia,agenda`) no doc público `1roir…`.

### Colunas reais (verificadas via gviz)
| Aba | Colunas | Frescor |
|---|---|---|
| `ligacoes` | call_id, data, hora, **agente**, destino, duracao_seg, status, disposicao | **fresca** (até hoje) |
| `emails` | email_id, data, hora, destinatario, destinatario_nome, assunto, status, sequencia | **PARADA em 2026-03-30 (P9)** — sem coluna de remetente |
| `deals` | id, nome, empresa, stage, valor, lead_source, categoria, comissao_valor, created_time, modified_time, resultados, closing_date | fresca; **sem owner/licencas/data_renovacao/recurring** |

### Root causes de "métricas que não funcionam"
- `deals` sem `owner/licencas/data_renovacao` → `computeComissaoOwnerCanal`, `computeRenovacoesVencidas`, `total_licencas_ativas` produzem vazio/0 silenciosamente.
- `emails` sem remetente → e-mail por pessoa não reconstruível das abas raw.
- Doc `1Len6…` privado (401) → dashboard (gviz público) não lê chat/destaques.
- **Gotcha gviz CRÍTICO (verificado ao vivo):** pedir aba inexistente → gviz devolve **planilha 0 (`ligacoes`)** com HTTP 200, **não erro**. `fetchFromSheetsNullable` retorna linhas de `ligacoes` achando que é a aba pedida. **Já afeta** `fetchFromSheetsNullable('reunioes')` hoje.
- **`parseGvizRows` só trata `Date(y,m,d)`** (3 args); datas com hora `Date(y,m,d,h,m,s)` viram string crua e são descartadas por `DATE_RE` (relacionado a P9).

## Arquitetura (100% aditiva)

```
┌─ N8N: NOVO workflow "Defenz - Dashboard - Snapshot Diário" (inativo até OK) ─┐
│  triggers: Cron 18h20 BRT  +  Manual  +  executeWorkflowTrigger(backfill)    │
│  modo LIVE (hoje):  lê abas raw (ligacoes) + Metricas(hoje) + Zoho(base/POCs) │
│  modo BACKFILL:     loop sequencial dia a dia, SEM Zoho (base/POCs = null)    │
│  freshness guard:   max(data em ligacoes)==alvo? senão coverage flag         │
│  escreve: doc público 1roir…, NOVA aba `resumo_diario`                        │
│           appendOrUpdate matchingColumns=['data'] (idempotente, 1 linha/dia)  │
│  ZERO edição nos 4 fluxos protegidos.                                         │
└──────────────────────────────────────────────────────────────────────────────┘
                         │ gviz público (sem OAuth)
                         ▼
┌─ Vercel ───────────────────────────────────────────────────────────────────────┐
│  GET /api/resumo-diario?data=YYYY-MM-DD  (default = HOJE em America/Sao_Paulo)  │
│   • verifySession (auth de rota — NÃO é controle de confidencialidade do dado)  │
│   • fetchTabStrict('resumo_diario', sig=['data','atualizado_em']) → null se aba │
│     ausente/sheet-0 → empty state                                              │
│   • clamp data em [hoje-120, hoje] (BRT); dedupe por data (maior atualizado_em) │
│   • retorna ResumoDiario (campos null-aware) + datas_disponiveis + serie 30d    │
│  Página /diario (route group dashboard): ResumoDiarioDashboard (TEMA ESCURO)    │
│   • DayNavigator (1 dia, piso hoje-120, setas prev/next, presets)              │
│   • cards linha1/2 + tabela Por Canal/Responsável + chart Tração + Destaques    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Referência de layout (CSV "Resumo Diário", 05/06/2026)
> Fonte: `docs/assets/resumo_diario_referencia.csv` (commitar). Paridade é checável contra este artefato.

- **Linha 1 (4 cards):** LIGAÇÕES (`106` / `52 atendidas (49%)`) · APRESENTAÇÕES (`0` / `0/dia`) · PROPOSTAS (`0` / `0/dia`) · POCS ATIVAS (`1` / `Wine Tecnologia`).
- **Linha 2 (4 cards):** EMAILS (`3` / `Leonardo: 3 · Gustavo/Marcos: 0`) · WHATSAPP (`6/2` / `msgs. / conversas`) · LINKEDIN (`57` / `16 Page · 41 perfis`) · CLIENTES ATIVOS (`43` / `Base instalada`).
- **Tabela "Por Canal / Responsável":** colunas fixas `Indicador | Total | Atend./Conv. | Gustavo | Leonardo | Marcos/Suporte | Obs.`; linhas `Telefonia, E-mail, WhatsApp, LinkedIn, Apresentações, Propostas, Reunião técnica`; rodapé `TOTAL TRAÇÃO` (=172 no exemplo = soma da coluna Total). Célula vazia de vendedor (canal capturado) = `0`; canal **não-capturado** = `—`.
- **"Tração Diária":** gráfico de barras de volume por indicador (no app: barras de `total_tracao` por dia).
- **"Destaques Operacionais":** `Comercial`, `Marketing`, `Execução`, `Ponto de atenção`.
- **Rodapé:** nota LGPD ("Uso interno…").

## Data Contract

### Aba `resumo_diario` (doc público `1roir…`) — 1 linha/dia, upsert por `data`
**Semântica null vs 0 (regra dura):** `0` = valor real capturado e é zero. `null`/célula vazia = **não capturado / não-histórico** → UI renderiza `—`. Backfill NUNCA escreve `0` em campo sem fonte para aquele dia.

| Coluna | Tipo | Histórico? | Origem |
|---|---|---|---|
| `data` | TEXT `YYYY-MM-DD` (BRT, forçar string) | chave | — |
| `atualizado_em` | TEXT ISO | — | runtime |
| `mode` | TEXT `live`\|`backfill` | — | flag |
| `coverage` | JSON `{ligacoes_fresh:bool, emails_source, manual_source, base_source}` | — | diagnóstico |
| `ligacoes_total` | int | ✅ | aba ligacoes (data=dia) |
| `ligacoes_atendidas` | int | ✅ | ligacoes status="Atendida" |
| `ligacoes_taxa` | int % | ✅ | derivado |
| `ligacoes_por_vendedor` | JSON `{canon:{realizadas,atendidas}}` | ✅ | ligacoes `agente` + mapa normalização |
| `emails_total` | int\|null | parcial | **Metricas `email_envios`** (P9); raw só p/ cross-check |
| `emails_por_sender` | JSON\|null | só-chat | Metricas (null se sem linha) |
| `apresentacoes_total` | int\|null | aproximado | chat se houver; senão deals `[APRESENTACAO]` via **extractEventDatesAnchored(refDate)** (marca `aproximado`) |
| `apresentacoes_por_vendedor` | JSON\|null | só-chat | Metricas |
| `propostas_total` | int\|null | aproximado | idem apresentações (`[PROPOSTA]`/Stage) |
| `propostas_por_vendedor` | JSON\|null | só-chat | Metricas |
| `reuniao_tecnica_total` | int\|null | só-chat | Metricas (Graph é só-hoje; não reconstruído) |
| `reuniao_por_vendedor` | JSON\|null | só-chat | Metricas |
| `whatsapp_msgs` | int\|null | só-chat | Metricas |
| `whatsapp_convs` | int\|null | só-chat | Metricas |
| `linkedin_page` | int\|null | só-chat | Metricas |
| `linkedin_perfis` | int\|null | só-chat | Metricas |
| `pocs_ativas` | int\|null | **só-hoje** | Zoho (live). **Backfill → null** |
| `pocs_lista` | JSON\|null | **só-hoje** | Zoho (live). Backfill → null |
| `base_total_licencas` | int\|null | **só-hoje** | base_baseline + Zoho(Data_setup). Backfill → null |
| `base_clientes_ativos` | int\|null | **só-hoje** | idem. Backfill → null |
| `base_top_contas` | JSON\|null | **só-hoje** | idem |
| `base_demais_count` | int\|null | só-hoje | derivado |
| `base_demais_licencas` | int\|null | só-hoje | derivado |
| `total_tracao` | int\|null | parcial | ver precedência abaixo |
| `destaque_comercial` | TEXT\|null | só-chat | Metricas `atividade_*` cat=comercial (sanitizado) |
| `destaque_marketing` | TEXT\|null | só-chat | Metricas marketing |
| `destaque_execucao` | TEXT\|null | só-chat | Metricas execucao |
| `destaque_atencao` | TEXT\|null | só-chat | Metricas ponto de atenção |

**Ordem das colunas obrigatória** = a ordem da tabela acima. Criar a linha de cabeçalho **antes** de configurar o node Sheets.

### Precedência por canal de `total_tracao` (replica o report)
| Canal | Fonte primária | Override | Tie-break |
|---|---|---|---|
| ligacoes | raw `ligacoes_total` | — | raw |
| emails | Metricas `email_envios` | raw (cross-check) | chat (P9) |
| whatsapp/linkedin | Metricas | — | chat |
| apresentacoes/propostas | **chat override** | raw `extractEventDatesAnchored` | chat vence |
| reuniao_tecnica | Metricas | — | chat |

`total_tracao` = soma **apenas dos canais com valor não-null**. Em dias de backfill com canais null, `total_tracao` é **parcial** → flag `coverage.partial_tracao=true` e a UI mostra "(parcial)". A linha `TOTAL TRAÇÃO` da tabela = mesma soma (headline e tabela reconciliados — não podem divergir).

### Aba `base_baseline` (doc público, editável pelo Marcos)
`vigente_desde(DATE) | total_licencas(int) | clientes_ativos(int) | top_contas(JSON) | demais_count(int) | demais_licencas(int)`. Snapshot LIVE seleciona a linha com maior `vigente_desde <= data` e soma deals com `Data_setup<=data`. Linha inicial = 3896/22/top7 atual, `vigente_desde=2026-06-08`.

### Tipos Vercel (`src/lib/types.ts`)
```ts
type Captured<T> = T | null; // null = não capturado/não-histórico → render "—"
interface ResumoDiario {
  data: string; atualizado_em: string; mode: 'live'|'backfill';
  coverage: { ligacoes_fresh: boolean; emails_source: 'chat'|'raw-fresh'|'raw-stale'; manual_source: 'chat'|'none'; base_source: 'live'|'none'; partial_tracao: boolean };
  ligacoes: { total: number; atendidas: number; taxa: number; por_vendedor: Record<string,{realizadas:number;atendidas:number}> };
  emails: { total: Captured<number>; por_sender: Captured<Record<string,number>> };
  apresentacoes: { total: Captured<number>; aproximado: boolean; por_vendedor: Captured<Record<string,number>> };
  propostas: { total: Captured<number>; aproximado: boolean; por_vendedor: Captured<Record<string,number>> };
  reuniao_tecnica: { total: Captured<number>; por_vendedor: Captured<Record<string,number>> };
  whatsapp: { msgs: Captured<number>; convs: Captured<number> };
  linkedin: { page: Captured<number>; perfis: Captured<number> };
  pocs: Captured<{ ativas: number; lista: string[] }>;
  base_instalada: Captured<{ total_licencas: number; clientes_ativos: number; top_contas: {name:string;licencas:number}[]; demais_count: number; demais_licencas: number }>;
  destaques: { comercial: Captured<string>; marketing: Captured<string>; execucao: Captured<string>; atencao: Captured<string> };
  total_tracao: Captured<number>;
}
interface ResumoDiarioResponse { resumo: ResumoDiario | null; datas_disponiveis: string[]; serie: { data:string; total_tracao:number|null; ligacoes:number; emails:number|null }[]; floor: string; _cached?: boolean }
```

## Behavior
1. **Cron 18h20 (live):** lê raw+Metricas+Zoho → monta linha `mode=live` (todos os campos, incl. POCs/base) → upsert por `data`.
2. **Backfill (manual, 1×):** loop **sequencial** (batchSize 1, ~1,5s entre dias) sobre `[hoje-120 … hoje]` (BRT), **clampado** a `max(hoje-120, menor data em ligacoes ≈ 2025-11-04)`. **Pula Zoho** (POCs/base = null). Metricas lido **1 vez** (aba inteira) e bucketizado por data em Code node. `continueOnFail` no write por dia + log dos dias que falharam (re-rodar = resume idempotente).
3. **Vercel:** `/diario` chama `/api/resumo-diario?data=…`. Sem `data` → hoje (BRT). DayNavigator: Hoje/Ontem/-2d/Semana passada + calendário (piso hoje-120; dias < piso e > hoje desabilitados). Floor também validado server-side.
4. **Render:** layout do CSV, tema escuro. Campos null → `—` + nota; `aproximado` → badge "~"; `coverage` → DataHealthBadge.
5. **Estados:** loading (skeletons), stale (`atualizado_em` + badge se `_cached` ou snapshot anterior ao fim do dia), partial (totais raw ok mas Metricas null → "sem dados de chat"), empty (`resumo:null` → "Sem snapshot para DD/MM" + navegação por `datas_disponiveis`).

## Business Rules
- Normalização de vendedor = **mesmo mapa** do `WdMgn8tSwzQo1cOc` (`marcos cruz`→Marcos, etc.), aplicado ao `agente`; bucket "Outros" para não-mapeados (nunca dropar do total).
- `ligacoes_taxa = round(atendidas/total*100)`; 0 se total=0.
- POCs e base instalada: **somente `mode=live`**. Backfill grava `null`.
- `apresentacoes/propostas`: chat vence; raw (anchored) só como aproximação → `aproximado=true` fora do mês corrente.
- Upsert idempotente por `data` (rodar 2× sobrescreve). Vercel também dedupe por `data` (maior `atualizado_em`).

## Edge Cases
- **gviz aba inexistente → sheet 0:** `fetchTabStrict` exige colunas-assinatura (`data`+`atualizado_em`); senão `null`→empty. **Corrigir também** `fetchFromSheetsNullable('reunioes')` em `dashboard-sheets/route.ts`.
- **`parseGvizRows`:** estender regex p/ `Date(y,m,d[,h,m,s])` truncando p/ `YYYY-MM-DD`; contador de descartes (coverage).
- **Timezone:** default `data` via `Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'})`; **não** usar `toISOString()`. Tudo é string-compare em data BRT.
- **Snapshot escreve `data`/`atualizado_em` como TEXT** (apóstrofo/força string) p/ não voltar como `Date()`.
- **Fontes indisponíveis:** `continueOnFail` por fonte; campo vira null, linha nunca quebra.
- **Fim de semana / sem chat:** manuais = null (não 0).
- **PII/LGPD (doc público):** regex remove e-mails/telefones **+ CPF/CNPJ** dos destaques. Backfill de destaques históricos passa por **aba de staging** revisável antes de publicar (não publicar 120 dias de chat de uma vez). Doc: `verifySession` protege a rota, **não** o dado (gviz é público; a barreira real é o sharing da planilha).
- **Cron 18h20** dá folga sobre 18h00 (Coleta v2) e 17h45 (chat); freshness guard sinaliza se as abas raw ainda não atualizaram.

## Acceptance Criteria
- [ ] Workflow N8N "Snapshot Diário" criado **inativo**, validado; **nenhum** node dos 4 fluxos protegidos modificado.
- [ ] Abas `resumo_diario` + `base_baseline` criadas com cabeçalho na ordem da spec.
- [ ] `parseGvizRows` trata `Date(y,m,d,h,m,s)`; `fetchTabStrict` implementado; `fetchFromSheetsNullable('reunioes')` corrigido.
- [ ] `GET /api/resumo-diario` com aba ausente → empty state (NÃO payload shaped como ligacoes). Default-date em BRT. Clamp 120d. Auth de sessão.
- [ ] Snapshot LIVE de hoje bate com o relatório do Teams (tolerância documentada: emails via chat; apres/prop podem divergir por método).
- [ ] Backfill: dias passados com totais de ligações (+por vendedor) reconstruídos; POCs/base/manuais ausentes = **null** (renderizados `—`, não `0`).
- [ ] Página `/diario` (tema escuro) com 4 blocos + tabela + chart + destaques + DayNavigator (120d) + estados loading/stale/partial/empty.
- [ ] Dashboard executivo `/` intacto (sem regressão; build verde).
- [ ] Screenshot lado-a-lado `/diario` × CSV de referência para a mesma data, aprovado pelo stakeholder.
- [ ] CHANGELOG + STATUS_REPORT atualizados; status → Done.

## Technical Decisions
- Workflow **novo** (não branch no `QjnzGicZHIPBNN1g`) → isolamento total.
- Leitura das abas raw como fonte primária (consistência + backfill); Zoho só p/ base/POCs (live).
- Linha larga com colunas JSON; `appendOrUpdate matchingColumns=['data']`, **defineBelow** (não autoMap), cabeçalho criado antes.
- Baseline em planilha (`base_baseline`) em vez de hard-code.
- Reuso de credenciais existentes (Google Sheets "Marcos", Zoho, Apollo, Microsoft).
- Tema escuro: novos componentes `DiarioCard`/wrapper dark só em `/diario`; StatCard/MagicCard do app não mudam.

## Frontend — Visual Design (tema escuro)
- Página `/diario` com wrapper próprio `bg-[#0a1628]` (navy) + acento verde-lima `#a3d65c` (header/linha), texto branco/slate. Não usa o branco global (a shared layout é `bg-transparent`; aplicar dark no wrapper da página).
- `DiarioCard`: card escuro (`bg-[#13233d]`, borda sutil, título uppercase, valor grande, subtítulo). Loading = skeleton. Health/stale dot com aria-label.
- `DayNavigator`: setas ‹ ›, label data, presets, calendário react-day-picker com `disabled={{before: subDays(hoje,120), after: hoje}}`; navbar `DateFilter` **oculto** em `/diario` (sem colisão de estado global).
- Tabela "Por Canal/Responsável": `<table>` com `<caption>` e `scope`; ordem de colunas fixa; canal não-capturado = `—`.
- "Tração Diária": Recharts **BarChart** de `total_tracao` nos últimos **30 dias**; barra do dia selecionado destacada; clique na barra → `?data`; tooltip com data+breakdown; série vazia tratada.
- Responsivo: grid `grid-cols-2 lg:grid-cols-4` p/ os cards; tabela com `overflow-x-auto` no mobile.
- Acessibilidade: contraste verde-on-navy ≥ 4.5:1; setas/calendário operáveis por teclado; chart com alternativa textual (a própria tabela).

## Dependencies
- Depende de: abas `ligacoes/deals` (Coleta v2) e aba `Metricas` (Coletor Chat) populadas.
- **Tarefa paralela:** consertar ingestão de e-mails Apollo→aba `emails` (P9) — não bloqueia (emails via chat).
- Relacionado: `[[feature-poc-schema]]`. Fora de escopo: corrigir owner/licenças/renovação do dashboard **executivo** (Fase 2: adicionar colunas ao export de deals).

## Out of scope (V1)
- Corrigir métricas de owner/renovação/licenças do executivo (Fase 2).
- Report do Teams ler de `resumo_diario` (futuro).
- Split-surface LGPD (stakeholder optou por doc público).
