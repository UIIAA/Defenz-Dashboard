# Spec — Semáforo das oportunidades abertas (`/oportunidades`)

> **v2 — 2026-08-26.** Reescreve a v1 (mesmo dia) após revisão adversarial que refutou a premissa
> central da tela e 8 afirmações factuais.
>
> **Status: aprovada.** Decisões do Marcos em 26/08 marcadas ao longo do texto.

## 0. O que a v1 errou

| v1 dizia | evidência |
|---|---|
| "um Quente **parado há 45 dias** é o que a tela mostra que nada mais mostra" | **impossível.** 19 dos 30 abertos têm `modified_time` = 25/08; só 1 passa de 9 dias, e é o `TESTE MCP - ignorar` |
| (implícito) `Last_Activity_Time` resolveria | **não resolve.** 26/26 preenchidos, mas só **3 datas distintas** entre os 26 abertos |
| "a tela nasce com 26 bolinhas cinzas" | `DealRow.tsx:60` **já tem bolinha**, `bg-amber-400` para todo deal `active` → nasceria com 26 **amarelas**, a cor de "Morno" |
| "dias sem movimento, de `modified_time`" | `days_in_stage` **já existe** (`metrics.ts:367`) e é exatamente isso. O §4.4 da v1 separava dois números que são um só |
| "106 de 260 truncados (63% dos abertos)" | **125 de 260 (48%)** — 18 linhas têm 999 chars por trim. E dos abertos são **20 de 30 (67%)** |
| "backfill `{"full": true}`" | **desnecessário.** `Zoho Deals` não filtra por data e o `appendOrUpdate` reescreve as 260 linhas todo run. E o full releria o Callbox desde nov, queimando 19 das 20 páginas do teto |
| "a `check` no banco rejeita e reporta" | **aborta o lote inteiro de 500.** O contrato da Fase 1 (`erros: [{linha,campo,motivo}]`) mora em `schema.ts`, não no DDL |
| (omissão) | já existem **três** definições de "pipe" no produto (§2) |

## 1. Objetivo

Uma tela com os negócios **abertos**, cada um com o semáforo que o vendedor declarou no Zoho —
**bolinha ao lado do nome** e **filtro por quente/morno/frio** — para a conversa de pipe
acontecer sobre a tela.

**Aberto pro time inteiro** (decisão do Marcos), porque quem precisa preencher o semáforo é o
vendedor. Consequência obrigatória: **sem coluna de comissão** (§5.2).

## 2. As três definições de "pipe" que já coexistem

Isto tem que estar declarado, senão vira pergunta na reunião:

| definição | onde | negócios | valor |
|---|---|---:|---:|
| `PIPELINE_STAGES` (`metrics.ts:14`) | `valor_pipeline` do Executivo | 14 | R$ 45.520 |
| `isActive` (`metrics.ts:29`) | `/api/operational` | 78 | R$ 1.329.891 |
| **esta tela** | `/oportunidades` | **30** | **R$ 136.968** |

`isActive` inclui os 48 `Contato Futuro` (a geladeira) — por isso R$ 1,3 mi. `PIPELINE_STAGES`
só conta 2 estágios.

**Definição desta tela, por DENYLIST e não allowlist:** aberto = **não** é `Fechado *` e **não**
é `Contato Futuro`. A v1 usava uma lista de 6 strings — e um estágio novo ou renomeado sumiria
da tela **em silêncio**, que é literalmente como `Grandes Contas` (existe no picklist, 0 deals)
sumiu da v1.

`Fechado perdido para a concorrência` já está coberto: `CLOSED_LOST_STAGES` (`metrics.ts:8`) tem
a grafia com e sem cedilha.

**Não unifico as três nesta feature.** Unificar muda número em tela existente e é spec própria.
Aqui só declaro.

## 3. O campo no Zoho — já existe

Medido em 26/08 via `/crm/v2/settings/fields?module=Deals`:

| API name | tipo | valores |
|---|---|---|
| **`Temperatura`** | picklist | `Quente` · `Morno` · `Frio` |

Escolhido em vez de `Classificacao_IA` (`QUENTE`/`MORNO`/`FRIO`/`NAO_CONECTADO`), que pertence ao
ramo de IA desligado em 12/08 — dois campos de temperatura seriam dois donos da mesma verdade.

**Preenchimento hoje: 1 de 259 negócios; 0 dos 26 abertos.** A tela nasce sem nenhuma cor. Isso
não é motivo para não fazê-la — ela é o que dá utilidade a preencher — mas define o §5.3.

**Método de verificação reproduzível** (a v1 mandava usar um webhook que não expõe o campo):
apontar o `TMP Deals Pull` (`8s3guZD6aaIljG9h`) para `/crm/v2/Deals` com
`fields=id,Deal_Name,Stage,Amount,Temperatura` e **restaurar depois**. Foi assim que se mediu.

## 4. O último toque — o miolo da feature

`modified_time` e `Last_Activity_Time` estão **mortos como sinal**: alguma automação toca todos
os negócios diariamente (há ≥11 workflows n8n escrevendo no mesmo Zoho). Nenhum dos dois separa
"trabalhado ontem" de "editado em lote ontem".

**O único sinal real de ação humana é a última entrada datada do `resultados`** — o vendedor
escreve `DD/MM - o que aconteceu`. Por isso o conserto do truncamento deixa de ser conserto de
lado e vira a peça central.

### 4.1 O truncamento, e por que o corte ingênuo produz data ERRADA

`Format Deals Raw` faz `resultados.slice(0, 1000)` — guarda os **mais antigos** e descarta os
recentes. **125 de 260 truncados; 20 de 30 abertos (67%).** Histórico invisível: média 33 dias,
pior caso 142 (LACEL: texto para em 30/03, negócio tocado em 19/08).

Isso **já erra números hoje**: `computeMetrics` deriva reuniões, apresentações e propostas deste
campo (`metrics.ts:168,179,185`).

**Cortar a cauda no char 4000 quebra o parser.** `extractEventDatesAnchored` (`metrics.ts:93`)
trabalha por linha e pega o **primeiro** `\d{2}/\d{2}` da linha. O formato real é
`DD/MM - texto … [PROPOSTA]`: a data abre a linha, a tag fecha. Cortar no meio **decapita a data
e preserva a tag**. Simulado sobre os 260 reais: **63 fragmentos** carregam tag após o corte —
59 somem calados e **4 emitem data pescada de outro número da linha**.

```js
// cortar na QUEBRA DE LINHA seguinte, nunca no char
const r = toStr(d.Resultados);
const LIM = 4000;
resultados: r.length > LIM ? r.slice(r.indexOf('\n', r.length - LIM) + 1) : r
```

Sem `'…'` concatenado: a v1 colava o reticências sem `\n`, então o fragmento continuava sendo
uma linha para o parser.

**Sem backfill.** O `Zoho Deals` não filtra por data e o `appendOrUpdate` reescreve as 260 linhas
todo run — o conserto se propaga no próximo cron.

**Guarda de regressão:** comparar **eventos por mês inferido, ano a ano**, antes e depois. A v1
propunha "antes/depois do mês corrente", que é cego por construção para eventos remarcados em
meses anteriores. E só `[PROPOSTA]` (112 deals) tem massa; `[REUNIAO]` (3) e `[APRESENTA]` (5)
medem ruído.

*Risco conhecido e hoje inofensivo:* `extractEventDatesAnchored:112` infere ano numa janela de 12
meses ancorada em `new Date()`. Destruncar estende a cauda pra trás. Hoje não estoura —
`min(created_time) = 2025-12-26`, nenhum deal com mais de 12 meses — mas vira problema quando
houver.

### 4.2 Extração do último toque

`src/lib/ultimo-toque.ts` (novo): dado o `resultados`, devolve a **última** data `DD/MM` que
aparece no texto, com o mesmo ano inferido do parser existente, e os dias desde então.

Reusa a inferência de `extractEventDatesAnchored` em vez de recriar — se a regra de ano mudar,
muda num lugar só.

## 5. A tela

Rota **`/oportunidades`**. O item de menu "Atividade" vira "Oportunidades" e
`src/app/(dashboard)/atividade/page.tsx` é **apagado** — deixá-lo vivo o mantém alcançável por URL.

**Sem guard de super_admin** (decisão do Marcos): a tela é do time.

### 5.1 Linha

**Não reusa `DealRow` como está.** O componente recebe `Deal` (não `RawDeal`), tem a bolinha
âmbar em `:60`, e renderiza `comissao_valor`. Componente novo `OportunidadeRow`, enxuto:

- **bolinha do semáforo à esquerda do nome** — 🔴 quente · 🟡 morno · 🔵 frio · ⚪ vazada;
- nome, estágio, licenças;
- **último toque** (`§4.2`): "14/08 · 12d";
- valor.

Sem comissão, sem `days_in_stage`, sem `last_activity_*` (este último é `'none'` hardcoded em
`metrics.ts:402` — o ramo que o consome nunca executa).

### 5.2 Comissão fora

`Format Deals Raw` calcula `comissao_valor` para todo deal. Com a tela aberta ao time, exibi-la
mostraria a margem da Defenz por negócio a Gustavo, Fernando e Francisco. **A rota não envia o
campo** — não basta esconder no componente.

### 5.3 O vazio cobra

Não classificados **primeiro**, contador no topo ("30 de 30 sem classificação"), chip de filtro
próprio. Quando tudo estiver preenchido, o bloco some sozinho.

**Ressalva honesta:** o ciclo entre classificar no Zoho e a bolinha mudar é de **até ~12h**
(cron 6h/18h + 10 min de cache). Quem classificar durante a reunião não vê o efeito na reunião.
A cadência horária está especificada em `feature-coleta-incremental` e **não aplicada** — enquanto
não for, esta mitigação é mais fraca do que parece.

### 5.4 Filtro

Chips multi-seleção: `Quente` · `Morno` · `Frio` · `Sem classificação`. Estado só no cliente.
Total no topo recalcula com o filtro. Ordenação: não classificados primeiro, depois valor desc.

### 5.5 Acessibilidade

A bolinha não pode ser o **único** portador. Vermelho×âmbar é a colisão protan/deutan clássica —
viram o mesmo marrom. Cada bolinha leva `aria-label` e `title` com o nome da temperatura, e o
chip do filtro tem rótulo textual ao lado da cor.

## 6. Caminho do dado

| etapa | mudança |
|---|---|
| `Zoho Deals` (n8n) | `fields` += `Temperatura` |
| `Format Deals Raw` | emite `temperatura` normalizada + conserta o truncamento (§4.1) |
| `Sheets Deals` | coluna `temperatura` em `columns.value` **e** em `columns.schema` |
| `src/lib/types.ts` | `RawDeal.temperatura?: string` |
| `src/lib/ultimo-toque.ts` | novo (§4.2) |
| `src/app/api/oportunidades/route.ts` | novo — só os campos da tela, **sem comissão** |

Normalização no n8n, com o range de combining marks **escapado** (a v1 tinha os caracteres
literais no arquivo):

```js
const t = toStr(d.Temperatura).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
temperatura: ['quente','morno','frio'].includes(t) ? t : ''
```

Valor desconhecido vira vazio (cinza), nunca quebra a cor.

**Neon fica de fora.** Migration + `check` + coercer seriam escrita write-only: o dashboard lê do
Sheets e a Fase 2 está aprovada-e-não-implementada. `temperatura` entra no Neon **junto com a
Fase 2**, e aí a rejeição por linha vai em `schema.ts`, não no DDL.

**Rota nova, não reuso.** `/api/operational` usa `isActive` (78 deals) e baixa `ligacoes` 4,6 MB
+ `emails` 1,2 MB por cache miss — dado que esta tela não usa. `/api/dashboard-sheets` não traz
o que falta.

## 7. Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| Ninguém preencher `Temperatura` | **alta** | §5.3 — mas o ciclo de 12h enfraquece; a cadência horária é dependência real |
| Corte quebrar o parser de eventos | **alta se feito errado** | corte na quebra de linha (§4.1) + guarda mês-a-mês ano-a-ano |
| Ler a tela como "o pipe" e brigar com o Executivo | **alta** | §2 declarado; a tela leva o total e a definição visíveis |
| `Sheets Deals` tem `continueOnFail: true` | média | é a causa dos R$ 19.962; esta feature passa por ele uma coluna nova **e** payload ~3× maior de `resultados`. Não conserta aqui, mas registra |
| Cor como único portador | média | §5.5 |
| `TESTE MCP - ignorar` contando como oportunidade | baixa | apagar no Zoho; **não** criar exceção por nome em código |

## 8. Fora do escopo

- Unificar as três definições de pipe (§2).
- `Vencimeno_da_licen_a` (existe, 87/259 preenchidos; o `CLAUDE.md` registra que
  `computeRenovacoesVencidas` volta vazio por falta dele). Feature própria.
- `TMP Deals Pull` ativo com webhook público sem auth — risco assumido pelo Marcos em 26/08.
- Escrever no Zoho. A tela lê; classificar é no CRM.
- Neon (§6).

## 9. Verificação

1. Preencher `Temperatura` em **3 negócios**, um de cada cor; conferir aba → tela.
2. Um valor fora do picklist deve virar **cinza**, não quebrar.
3. Eventos por mês inferido, ano a ano, antes e depois do conserto do truncamento —
   `[PROPOSTA]` é a única com massa.
4. Conferir que nenhum `call_id`… (n/a) — conferir que **nenhum deal perdeu `resultados`** e que
   os 260 continuam 260.
5. Somar os chips selecionados contra o total do topo.
6. Confirmar que a resposta de `/api/oportunidades` **não contém** `comissao_valor`.
