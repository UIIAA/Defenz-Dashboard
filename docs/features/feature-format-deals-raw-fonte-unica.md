# Spec — `Format Deals Raw`: uma fonte da verdade para as duas cópias

> **Status: proposta.** Nada foi alterado no n8n. Workflows envolvidos:
> `QjnzGicZHIPBNN1g` (Coleta Métricas v2) e `WlTnk2bHWYhibwyG` (Refresh Deals sob demanda).
>
> Motivo do pedido: em 27/08/2026 a f-038 precisou editar as duas cópias à mão de novo. Já são
> três campos que passaram por edição dupla (`licencas`, `temperatura`, `vencimento_licenca`).
> A unificação foi adiada de propósito quando o refresh nasceu — "para não reestruturar a coleta
> no mesmo dia de outras 4 mudanças". Esse motivo não vale mais.

## 0. O que a investigação achou (antes de propor qualquer coisa)

**As duas cópias ainda NÃO divergiram semanticamente.** Baixei os dois nós pela API do n8n,
tirei comentários e normalizei espaço. O diff inteiro é este:

| diferença | natureza |
|---|---|
| `classifyOrigin` com chaves (coleta) × `return` de uma linha (refresh) | **cosmética** — mesmas 4 regras, mesmas taxas |
| sentinela `id: 'none'` quando `formatted.length === 0` | **só na coleta** — intencional |
| `console.log('Refresh Deals: N deals, M com temperatura')` | **só no refresh** — intencional |

As ~60 linhas que carregam regra de negócio — `cnpjValido`, `cnpjCanonico`, `toStr`,
`caudaResultados` (`LIM_RESULTADOS = 4000`, corte na quebra de linha), `normalizaTemperatura`,
e o `map` inteiro com os 17 campos — são **idênticas caractere a caractere** depois da
normalização.

Consequência para esta spec: **isto é refatoração pura.** Não há divergência para reconciliar,
não há decisão de "qual das duas está certa". Se fosse feito daqui a três campos, provavelmente
haveria. É o melhor momento possível para fazer.

Os dois nós `Zoho Deals` também são idênticos: mesma URL, mesmos 18 campos em `fields`,
`per_page=200`, mesma paginação (`maxRequests: 10`). Ou seja, o insumo é o mesmo nos dois lados.

## 1. O bloqueio real: `$('Zoho Deals')` não existe dentro de um sub-workflow

As duas cópias começam com a mesma linha:

```js
const dealsInput = $('Zoho Deals').all();
```

Isso é uma **busca por nome, não a entrada do nó**. E aqui está o detalhe que decide o desenho:

| workflow | quem liga em `Format Deals Raw` | o que o nó lê de fato |
|---|---|---|
| `WlTnk2bHWYhibwyG` (refresh) | **`Zoho Deals`** | a própria entrada |
| `QjnzGicZHIPBNN1g` (coleta) | **`Microsoft Reunioes`** | `Zoho Deals`, ignorando a entrada |

Na coleta, a aresta que chega em `Format Deals Raw` vem do **calendário da Microsoft** — ela
serve só para sequenciar, os dados entram pela porta dos fundos. (`Microsoft Reunioes` também
alimenta `Consolidar`, que está desativado; hoje o `Format Deals Raw` é o único consumidor vivo
dela.)

Um sub-workflow **não enxerga** `$('Zoho Deals')` do chamador. Então a unificação obriga a
trocar o contrato de "puxa do nó chamado X" para "consome o que recebe" — e, como as duas
entradas são diferentes, **cada chamador precisa de um adaptador próprio**. Não dá para trocar
o `Format Deals Raw` da coleta por uma chamada de sub-workflow e pronto: ele receberia eventos
de calendário no lugar de deals.

Isso é bom, não ruim: o adaptador tem **3 linhas** e é a única coisa que legitimamente difere
entre os dois. As ~90 linhas de regra ficam em um lugar só.

## 2. A sentinela não pode viajar dentro dos itens de dado

Reflexo natural: passar `sentinela: true/false` como campo dos itens. **Não funciona** — a
sentinela dispara exatamente quando não há item para carregar a flag.

Solução: o adaptador **sempre emite pelo menos um item**, mesmo quando o Zoho não devolveu
página nenhuma, e carimba a flag nele. Aí a flag chega mesmo no caso vazio.

```js
// adaptador da COLETA — mantém o `$('Zoho Deals')` no chamador, onde ele é legal
const pages = $('Zoho Deals').all();
const marca = p => ({ json: { ...(p ? p.json : {}), __sentinela: true } });
return pages.length ? pages.map(marca) : [marca(null)];
```

O `pages.length ? ... : [marca(null)]` preserva um caso de borda de hoje: se `Zoho Deals`
produzir zero itens, `$('Zoho Deals').all()` devolve `[]`, `formatted` fica vazio e a coleta
emite a sentinela. Sem essa guarda, o sub-workflow receberia zero itens, poderia nem executar,
e a sentinela sumiria calada.

**Observação de campo (não é proposta de mudança):** consultei a aba `deals` — **300 linhas,
nenhuma com `id = 'none'`**. A sentinela nunca disparou em produção. Ela está mantida nesta
spec porque foi pedido que a diferença sobrevivesse; se quiser matá-la, o desenho fica ainda
mais simples (ver D1).

## 3. Desenho proposto

Novo workflow **`Defenz - Dashboard - Sub - Format Deals Raw`** (inativo, só chamado):

```
When Executed by Another Workflow   (executeWorkflowTrigger tv 1.1, inputSource: passthrough)
        ↓
Format Deals Raw                    (code tv 2, runOnceForAllItems) ← A FONTE ÚNICA
```

O `inputSource: "passthrough"` é o padrão já usado em cinco sub-workflows desta instância
(`Sub - Securisoft Loader`, `Sub - Tracker Fontes`, `Sub - Lead Enrichment Pipeline`,
`Sub - Relatório Diário`, `ATRIO — Teams`), então não é terreno novo.

Nos dois chamadores, o nó `Format Deals Raw` vira **dois nós**, na mesma posição do grafo:

```
… → Deals: entrada  (code, 3 linhas, adaptador)  →  Format Deals  (executeWorkflow tv 1.2) → Sheets Deals → …
```

Topologia preservada: na coleta a aresta continua saindo de `Microsoft Reunioes`; no refresh,
de `Zoho Deals`. **Nenhuma ordem de execução muda.**

Corpo da fonte única (só o que muda em relação a hoje):

```js
// FONTE ÚNICA do formato do deal. Chamado por QjnzGicZHIPBNN1g e WlTnk2bHWYhibwyG.
// Recebe as PÁGINAS cruas do `Zoho Deals` (item = corpo da resposta HTTP).
// NÃO editar cópia nenhuma: o corpo vive em `n8n/format-deals-raw.js` no repo (§5).
const pages = $input.all();
const sentinela = pages.length > 0 && pages[0].json.__sentinela === true;
const deals = pages.flatMap(page => (page.json && page.json.data) || []);

/* … cnpjValido, cnpjCanonico, toStr, caudaResultados, normalizaTemperatura, map … */
/*     inalterados, byte a byte, em relação ao que está no ar hoje                  */

console.log(`Format Deals Raw: ${formatted.length} deals, ${formatted.filter(d => d.temperatura).length} com temperatura`);

if (sentinela && formatted.length === 0) {
  return [{ json: { id: 'none', nome: 'Sem dados', /* …os 17 campos… */ } }];
}
return formatted.map(d => ({ json: d }));
```

O `console.log` passa a valer para os dois — hoje só o refresh tem, e não há razão para a
coleta ser cega.

## 4. Mudanças nó a nó

| # | onde | operação |
|---|---|---|
| 1 | novo workflow | criar `Sub - Format Deals Raw`, inativo, com trigger + code |
| 2 | `WlTnk2bHWYhibwyG` | `Format Deals Raw` (code) → vira `Deals: entrada` (adaptador, `__sentinela: false`) |
| 3 | `WlTnk2bHWYhibwyG` | inserir `Format Deals` (executeWorkflow, `mode: once`, `waitForSubWorkflow: true`) entre o adaptador e `Sheets Deals` |
| 4 | `QjnzGicZHIPBNN1g` | idem 2, com `__sentinela: true` e `$('Zoho Deals').all()` |
| 5 | `QjnzGicZHIPBNN1g` | idem 3 |

O adaptador **precisa** ficar em `runOnceForAllItems` (default do code tv2). Se rodar por item,
na coleta ele multiplicaria pelo número de eventos do calendário.

## 5. A metade que o sub-workflow sozinho não resolve

Unificar em sub-workflow acaba com a edição dupla, mas o código continua morando **só dentro do
n8n**: fora do git, fora de code review, e sem teste local. O `scripts/teste-nos-n8n.mjs` já
carrega esse débito escrito no próprio cabeçalho:

> "ESTE ARQUIVO ESPELHA CÓDIGO QUE VIVE NO n8n, NÃO NO REPO. Ele NÃO garante que o nó em
> produção esteja assim — só que a LÓGICA está certa. Se você mudar o nó no n8n, mude aqui
> junto, senão isto vira falsa confiança."

Proposta, no mesmo lote:

- **`n8n/format-deals-raw.js`** — o corpo versionado. O n8n não aceita `export`, então o
  arquivo termina com um bloco delimitado (`/* --- só para teste local --- */`) que exporta as
  funções; o script de sync corta esse bloco antes de subir, e o teste importa o arquivo
  inteiro. O corte é determinístico e o `--check` compara já sem o bloco.
- **`scripts/sync-n8n-code.mjs`** — `--push` sobe o corpo para o nó do sub-workflow;
  `--check` compara e sai com código ≠ 0 se o nó em produção divergir do repo. O `--check` é o
  que transforma "lembrar de mudar junto" em erro detectável.
- **`scripts/teste-nos-n8n.mjs`** — passa a importar `n8n/format-deals-raw.js` em vez de
  reimplementar à mão, e ganha casos para `caudaResultados`, `cnpjCanonico`,
  `normalizaTemperatura` e `classifyOrigin` (as 4 taxas).

Isso é o que fecha o buraco de verdade: a regra de comissão da Defenz hoje é invisível ao
`git log`.

## 6. Verificação

1. **Antes:** salvar retrato dos 300 deals da aba `deals` e do `deals` no Neon (id, valor,
   categoria, comissao_valor, cnpj, resultados, licencas, temperatura, vencimento_licenca).
2. `node scripts/teste-nos-n8n.mjs` — verde, agora cobrindo o formatador.
3. `node scripts/sync-n8n-code.mjs --check` — verde.
4. Disparar o **refresh sob demanda** e comparar o retrato depois: **diff vazio** é o critério.
   Medir também o tempo de resposta (hoje ~8s) para confirmar que o salto de sub-workflow não
   estourou o orçamento do botão.
5. Rodar a **coleta manualmente** (execução manual roda incremental de propósito) e repetir o
   diff.
6. Conferir uma execução programada do cron (6h/12h/18h) antes de considerar fechado — o
   handoff da coleta incremental registra que nenhuma execução programada foi verificada ainda.

Critério de aceite: passos 4 e 5 com diff vazio nas duas fontes, e a execução do cron do passo 6
sem erro.

## 7. Riscos e rollback

| risco | mitigação |
|---|---|
| sub-workflow adiciona uma execução por rodada (ruído no histórico do n8n) | aceito; é o custo da fonte única |
| latência extra no botão de refresh (~8s hoje) | medida obrigatória no passo 4 |
| falha do sub derruba o chamador | é o comportamento de hoje — o nó code falhando já derruba o ramo |
| adaptador rodando por item na coleta | fixado em `runOnceForAllItems` e conferido no passo 5 |
| o sub-workflow precisa estar visível ao projeto dos chamadores | conferir na criação |

**Rollback:** guardar o JSON dos dois workflows antes de mexer (já baixados). Reverter é
recolocar o code node original e apagar os dois nós novos.

## 8. Decisões que preciso do Marcos

- **D1 — a sentinela.** Ela nunca disparou (0 de 300 linhas com `id = 'none'`), e o autor do
  refresh a removeu de propósito porque "uma linha-lixo iria pra aba e pro Neon e teria que ser
  limpa a mão". Mantenho parametrizada como pedido, ou **mato de vez** e o sub-workflow fica sem
  parâmetro nenhum? Matar simplifica; manter é o conservador.
- **D2 — escopo do lote.** Faz só o sub-workflow (§3–4), ou entra junto a fonte no repo com
  `--check` (§5)? Recomendo junto: sozinho, o sub-workflow resolve a edição dupla mas deixa a
  regra de comissão fora do git.
- **D3 — fora de escopo, mas está do lado.** O `Sheets Deals` da coleta segue com
  `continueOnFail: true` — o defeito que produziu os R$ 19.962 de comissão errada em agosto.
  Encosto nele neste lote ou fica para o seu próprio?
