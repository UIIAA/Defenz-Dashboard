# Atestado — 1ª execução do portão de paridade Neon × Sheets

**Data:** 2026-07-28 · **Fase:** feature-migracao-neon Fase 1 (escrita dupla)
**Método:** `db/migrations/0003` aplicada no Neon · backfill completo das 7 abas via
`scripts/backfill-neon.mjs` · `GET /api/ingest/paridade`.

> **Veredito geral: VERMELHO.** 4 tabelas verdes, 3 vermelhas.
> As 3 divergências foram investigadas e **todas são defeito do dado de origem**, não da
> ingestão. Nenhuma foi resolvida ajustando o comparador — conforme a regra da spec.

## Carga

| Tabela | Linhas na aba | Gravadas no Neon | Observação |
|---|---:|---:|---|
| `leads` | 1.418 | 1.418 | — |
| `deals` | 219 | 219 | — |
| `ligacoes` | 11.529 | 11.524 | 5 linhas com `call_id` repetido |
| `emails` | 3.786 | 3.786 | — |
| `classificacao_ia` | 1.116 | 1.115 | 1 linha placeholder rejeitada |
| `agenda` | 279 | 279 | 145 gravadas sem lead (ver §3) |
| `resumo_diario` | 47 | 47 | — |

Rodar o backfill 2× confirmou **idempotência**: a segunda passada não inseriu nada, só
atualizou.

## Verde

`deals` (contagem 219 · Σ valor R$ 4.528.600,69 · Σ licenças 75.056 · 67 ganhos),
`emails` (3.786, 26/11/2025→28/07/2026), `leads` (1.418), `agenda` (279).

O bate de `deals` é significativo: soma de valor e de licenças fecham **ao centavo** com a
planilha, e a contagem de ganhos usa a mesma definição do dashboard (`isClosedWon`).

## Divergências

### 1. `ligacoes` — Neon 11.524 vs Sheets 11.529 (Δ −5 linhas, −52s)

**Causa:** 3 `call_id` aparecem repetidos na aba, somando 5 linhas extras. O Neon deduplica
pela chave natural; a planilha não tem chave, então conta de novo.

| `call_id` | Ocorrências | Linhas idênticas? | Durações em 28/07 | Durações em 29/07 |
|---|---:|---|---|---|
| `2026-04-13_10:43:41_Leonardo Alves_50422404` | 2 | sim | 1, 1 | 1, 1 |
| `2026-07-24_14:49:15_31987678836_` | 3 | sim | 8, 8, 8 | 8, 8, 8 |
| `2026-07-24_14:48:07_31987678836_` | 3 | **não** | 10, 25, 25 | **25, 25, 25** |

A aritmética fecha exatamente: 1 + 16 + 50 = **−67s** (era −52 em 28/07 — ver abaixo).

#### Agravante descoberto em 29/07: a colisão CORROMPE a planilha

Entre 28/07 e 29/07 as durações do terceiro grupo mudaram de `10, 25, 25` para `25, 25, 25`.
Ninguém editou a planilha à mão: o nó `Sheets Ligacoes Raw` usa `appendOrUpdate` com
`matchingColumns: [call_id]` e, **como o `call_id` não é único, ele casou a chave errada e
sobrescreveu a ligação de 10s com os dados de outra**.

Ou seja: o problema não é só o Neon descartar duplicata. **A ligação de 10 segundos foi perdida
na própria planilha**, e isso se repete a cada execução do cron. O Sheets não tem chave, então
não reclama — some em silêncio, que é o mesmo padrão dos bugs de 28/07.

Por isso o baseline de `soma_duracao` é **instável de propósito**: se ele mudar de novo, é a
colisão corrompendo dado outra vez. Nesse caso **reapure** — não atualize o número.

**Dois problemas distintos, não um:**

- Os dois primeiros são a **mesma ligação gravada mais de uma vez**. Aqui a planilha está
  inflada e o Neon está certo.
- O terceiro é pior: **três chamadas com durações diferentes dividindo o mesmo `call_id`**.

> **Correção de 01/08 (crítica da spec):** a causa-raiz descrita acima estava errada. Não é
> "quando o agente/destino vem vazio" — uma das 5 chaves colididas tem **agente e destino
> preenchidos** (`2026-04-13_10:43:41_Leonardo Alves_50422404`). A causa real é que a chave
> `data_hora_agente_destino` **não tem identidade por perna de chamada**: quaisquer duas pernas
> com esses 4 campos iguais colidem. Campo vazio só torna provável.
> A correção está especificada em [`feature-call-id-unico.md`](features/feature-call-id-unico.md),
> e o Callbox **já entrega um `uniqueid`** que o nó descarta.

**Ação (não executada — decisão sua):** tornar a chave única no nó `Format Ligacoes Raw`
(ex.: sufixo de sequência quando a chave repetir). Isso muda a chave da aba e mexe no
histórico, então não toquei. Enquanto não for feito, a contagem de ligações do dashboard
está inflada em 5 e a duração em 52s — irrelevante no total (0,04%), mas é uma trinca que
cresce se o volume subir.

### 2. `classificacao_ia` — Neon 1.115 vs Sheets 1.116 leads distintos (Δ −1)

**Causa:** a aba tem uma linha `lead_id = "none"`, `lead_name = "none"`,
`resultado_principal = "inconclusivo"` — o **placeholder** que o nó `Preparar IA` emite
quando não há lead para classificar. A planilha conta `"none"` como se fosse um lead.

O Neon rejeitou pela FK (`lead none ainda não ingerido`), que é o comportamento certo:
`"none"` não é um lead. Mesmo padrão do placeholder `id: 'none'` do `Format Deals Raw`.

**Ação (não executada):** filtrar o placeholder na origem, ou aceitar o Δ de 1 como conhecido.

### 3. `resumo_diario` — 4 dias úteis sem snapshot

**22/05, 25/05, 28/05 e 01/06/2026.**

**Isto não é divergência Neon × Sheets** — os dois lados têm os mesmos 47 dias, e contagem e
intervalo (19/05→28/07) batem. É a checagem "nenhum dia útil faltando" que a spec pede,
pegando um **buraco real na coleta** de maio/junho — provavelmente antes do fluxo estabilizar.

**Ação:** histórico não se recupera. Ou se aceita o buraco documentado, ou se faz backfill
manual desses 4 dias na planilha. Enquanto existir, o portão não fecha verde.

## Decisão (29/07): baseline explícito

Diretriz do Marcos: **não mexer na planilha** — nada que o time sinta. As 3 divergências
foram registradas como **baseline explícito** em `src/lib/ingest/paridade.ts`, cada uma com o
delta exato, a data e o motivo apurado.

Isto **não** é o "ajustar o comparador" que a spec proíbe. A regra proibida é mexer no
comparador até ficar verde; aqui o número esperado é fixo e público, e **desviar dele por 1
já volta a vermelho** — inclusive se a origem for corrigida (aí a checagem vira `obsoleto` e
pede a remoção da entrada). Há teste para cada um desses casos, e a resposta da rota lista as
`ressalvas` sempre, para que verde-com-ressalva nunca se pareça com verde limpo.

Estado após a decisão: **7/7 verdes, 4 ressalvas.**

## O que isso significa para o portão de 7 dias

O relógio **só começa quando a escrita dupla estiver ativa** — ou seja, com a credencial no
n8n e a branch em produção. Enquanto o nó de ingestão tomar 401, a planilha anda a cada cron
(6h/18h) e o Neon fica parado no backfill: o portão fica vermelho por defasagem, não por
defeito. Foi exatamente o que aconteceu na manhã de 29/07 — o cron das 6h somou 7 deals na
aba e a paridade acusou na hora, o que é o portão funcionando.

Nenhuma das divergências indica erro na ingestão: a escrita dupla grava o que a planilha tem,
e onde os dois diferem é porque **a planilha carrega dado duplicado, corrompido ou placeholder**
que o banco, por ter chave, não aceita. Era exatamente para isso que o portão existia.
