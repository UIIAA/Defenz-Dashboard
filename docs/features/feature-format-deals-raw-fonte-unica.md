# Spec — `Format Deals Raw`: uma fonte da verdade para as duas cópias

> **Status: IMPLEMENTADO em 27/08/2026** (unificação + D1 + D2). Decisões do Marcos: D1 matar a
> sentinela, D2 fazer junto, D4 owner em commit separado, D3 **não fazer** — a planilha vai ser
> extinta (§11), então o rewiring do `continueOnFail` seria trabalho jogado fora.
>
> Sub-workflow criado: `Defenz - Dashboard - Sub - Format Deals Raw` = `pDwyWZau5DwJm6L3`.
> Verificação em §6.1. Workflows envolvidos:
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

**O snapshot desta spec é posterior à f-038.** Baixei os nós às 17:39; a edição da f-038
(`vencimento_licenca`) entrou ~17:30. As duas cópias no meu snapshot **já têm**
`vencimento_licenca`, inclusive na sentinela da coleta, e `Vencimeno_da_licen_a` já está no
`fields` dos dois nós `Zoho Deals`. Nada da f-038 se perde aqui.

**~~O `Sheets Deals` repassa os itens inteiros.~~ ERRADO — corrigido em §13.** A execução
`95958` não continha o caso discriminante (todo campo emitido pelo formatador estava também no
mapeamento do nó). A execução `96102` mostrou a regra real: o nó do Google Sheets emite **as
colunas do MAPEAMENTO DO NÓ**, não o item inteiro. Ver §13 — isso escondia um campo da f-038
chegando vazio ao Neon pelo cron.

**O cron está rodando.** As últimas execuções programadas — 09:00Z, 15:00Z, 21:00Z = 6h/12h/18h
BRT — estão todas `success`. Isso fecha a pendência registrada no handoff da coleta incremental
("nenhuma execução programada foi verificada ainda").

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

> **RESTRIÇÃO QUE MANDA NO DESENHO: o nó de saída precisa continuar se chamando
> `Format Deals Raw` no `WlTnk2bHWYhibwyG`.** Dois nós do refresh referenciam esse nome:
>
> - `Lote → Neon: deals` → `const linhas = $('Format Deals Raw').all()`
> - `Respond` → também referencia `$('Format Deals Raw')`
>
> Renomear ou remover o nó quebra a ingestão do Neon e a resposta do botão de refresh — em
> tempo de execução, não em validação. Varri os 91 workflows da instância: essas são as duas
> únicas referências por nome, e as duas estão no refresh.

Portanto: **o nó `executeWorkflow` herda o nome `Format Deals Raw`** (a saída dele é a lista
formatada, exatamente o que os dois referenciadores esperam), e o adaptador ganha nome novo.

| # | onde | operação |
|---|---|---|
| 1 | novo workflow | criar `Sub - Format Deals Raw`, inativo, com trigger + code |
| 2 | `WlTnk2bHWYhibwyG` | inserir `Deals: entrada` (adaptador, `__sentinela: false`) entre `Zoho Deals` e o formatador |
| 3 | `WlTnk2bHWYhibwyG` | `Format Deals Raw` deixa de ser `code` e vira `executeWorkflow` (`mode: once`, `waitForSubWorkflow: true`) — **mesmo nome** |
| 4 | `QjnzGicZHIPBNN1g` | inserir `Deals: entrada` (adaptador, `__sentinela: true`, `$('Zoho Deals').all()`) entre `Microsoft Reunioes` e o formatador |
| 5 | `QjnzGicZHIPBNN1g` | idem 3 (mesmo nome, por simetria — ali ninguém referencia, mas divergir os nomes é o começo do próximo bug) |

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
- **D4 — o dono do negócio (§9).** A sessão paralela pediu para a versão unificada emitir
  `owner_id`/`owner_nome`. O lado do Dashboard já está commitado esperando. Entra neste lote ou
  fica separado? Recomendo **entrar junto** — é o mesmo nó, e fazer depois é reabrir o paciente.
- **D3 — fora de escopo, mas está do lado.** O `Sheets Deals` da coleta segue com
  `continueOnFail: true` — o defeito que produziu os R$ 19.962 de comissão errada em agosto.
  Encosto nele neste lote ou fica para o seu próprio?

## 9. Pedido da sessão paralela: o dono do negócio

A sessão que abriu esta tarefa pediu que a versão unificada emita também o dono, que hoje é
pedido ao Zoho (`Owner` já está no `fields` dos dois nós, conferido) e **jogado fora** no
formatador.

```js
    owner_id:   toStr(d.Owner && d.Owner.id),
    owner_nome: toStr(d.Owner && d.Owner.name),
```

Os dois acessos explícitos são necessários, e o alerta dela está certo: o `toStr` que já existe
faz `String(v.name || v.full_name || '')` quando recebe objeto, então `toStr(d.Owner)` sozinho
devolveria o **nome** no lugar do id. Na sentinela, `owner_id: '', owner_nome: ''`.

**Conferi o lado do Dashboard antes de aceitar** (está tudo no lugar, commit `978cf56`):

| alegação | verificado |
|---|---|
| `db/migrations/0010_dono_deals.sql` | existe, `add column if not exists owner_id/owner_nome` + índice parcial |
| ingest aceita | `schema.ts:234-235` e `repo.ts:90-91`, os dois como `texto`/`txt` |
| tela mapeia o id | `src/lib/donos.ts`, com fallback para o nome cru quando o id é desconhecido |
| `deals` **não** declara `owner` como dimensão | `repo.ts`: `dimensoes: [{ prefixo: 'empresa', … }]` apenas — então owner é coluna simples, **não** gera órfão nem exige linha em `pessoas` (ao contrário de `leads` e `agenda`, que declaram a dimensão `pessoas`) |

Esse último ponto é o que torna o pedido seguro: em `deals` o owner é texto puro, então um id
novo não é rejeitado nem vira órfão na ingestão.

E o §0 já mostra que campo sem coluna na aba chega ao Neon do mesmo jeito (é o que acontece com
`temperatura` hoje), então os dois campos vão chegar pelos **dois** caminhos — cron e refresh.

**Um detalhe que o pedido não cobre:** com a unificação, esses dois campos entram **uma vez só**
no corpo compartilhado. Sem a unificação, entram duas vezes à mão — que é exatamente o problema
que esta spec existe para acabar. Por isso a recomendação de fazer D4 dentro deste lote, e não
antes dele.

## 10. Coordenação com a sessão paralela

Combinado para não escrever no mesmo nó ao mesmo tempo: **eu faço os dois passos** (unificação
+ `owner`), depois que o Marcos aprovar esta spec. A sessão paralela não toca nos nós
`Format Deals Raw` até lá. Se o Marcos preferir o `owner` já, antes da unificação, o caminho é
ela fazer e eu rebasear a spec — mas aí são duas edições duplas em vez de uma unificada.

## 6.1. O que foi verificado de fato

| # | verificação | resultado |
|---|---|---|
| 1 | equivalência contra **299 negócios reais** (páginas cruas do Zoho da execução `95958`) | **0 diferenças** nos 16 campos; comissão total R$ 2.208.877, 230 CNPJs válidos, 67 com temperatura |
| 2 | suíte de testes | **309 passando** (24 novos), lint limpo nos arquivos novos |
| 3 | `--check` acusa divergência de verdade | alterei `taxa: 0.43 → 0.44` só no repo: saiu `EXIT=1` apontando a linha 33 |
| 4 | refresh sob demanda ponta a ponta | `{ok:true, deals:299, com_temperatura:68}` em **7,8s** (antes ~8s) |
| 5 | ingestão no Neon pelo refresh | `recebidos 299, atualizados 299, rejeitados 0, órfãos 0, erros []` |
| 6 | **diff do retrato da aba `deals`** antes × depois | **0 campos alterados**, 300 negócios, 15 colunas — critério de aceite |
| 7 | adaptador da coleta na posição assimétrica | workflow descartável com os nós REAIS: 2 páginas, **299 linhas** |
| 8 | o adaptador roda uma vez só, não por item | o stand-in do `Microsoft Reunioes` emitiu **3 itens** e a saída foi 299, não 897 |

**O que NÃO foi verificado:** a coleta não foi executada de ponta a ponta. O webhook dela usa
uma credencial (`Defenz Webhook Auth - dashboard-metricas`) que eu não tenho, e o cron das 18h
já tinha rodado quando a mudança entrou. O item 7 cobre a parte nova (adaptador + chamada do
sub) usando os nós reais, e o item 4 cobre o mesmo sub-workflow em produção — mas a primeira
execução programada da coleta é a das **6h**. Ver §12.

## 11. A planilha vai ser extinta — e isso mata o D3

Decisão do Marcos em 27/08: quando a refatoração fechar, a próxima spec **extingue a planilha e
grava direto no Neon**.

Isso muda o que fazer com o `continueOnFail: true` do `Sheets Deals`. Eu tinha proposto
rependurar o ramo do Neon direto no formatador, para poder deixar a planilha falhar alto sem
derrubar a ingestão. **Com a planilha saindo do caminho, esse rewiring vira trabalho jogado
fora** — o problema (Neon pendurado depois da planilha) desaparece sozinho.

Então D3 não é "fazer depois": é **não fazer**. O que fica na fila é a spec da extinção, que já
tem meio caminho andado em `feature-migracao-neon-fase2.md` (ler do Neon, v3 aprovada em 18/08).
Ler do Neon e parar de escrever no Sheets são as duas metades do mesmo movimento.

## 12. Pendência única

A coleta roda às **6h/12h/18h**. A primeira execução programada depois desta mudança fecha o
lote. Conferir: execução `success`, `Format Deals Raw` com ~299 itens, e o retrato da aba sem
diferença. Se algo der errado, o rollback é recolocar o code node antigo — o corpo está em
`.n8n-backup/QjnzGicZHIPBNN1g.<stamp>.json` e o comportamento está descrito em §0.

## 13. Correção: o `Sheets Deals` NÃO repassa o item inteiro

Eu afirmei no §0, a partir da execução `95958`, que o nó do Google Sheets repassava o item
inteiro e que por isso "campo novo no formatador chega ao Neon pelos dois caminhos". **Estava
errado**, e a afirmação foi usada por outra sessão para transformar uma premissa da f-038 em
"fato medido" (commit `9d7cf49`) — então ela precisa ser desfeita lá também.

**Por que me enganei:** na `95958` todo campo que o formatador emitia (16) também estava no
mapeamento do nó (16). Entrada e saída batiam, e eu li isso como passagem transparente. O caso
que separava as duas hipóteses não existia naquela execução. O que me deu falsa confiança foi a
`temperatura` — ela sobrevive **não** por o nó ser transparente, mas por estar no *mapeamento*,
apesar de não existir como coluna na aba.

**A regra real,** medida na execução `96102`, onde o formatador emitia 19 campos:

| ponto | chaves |
|---|---|
| `Format Deals Raw` (saída) | 19, com `owner_id`, `owner_nome`, `vencimento_licenca` |
| `Sheets Deals` (saída) | **16** — os três acima sumiram |
| mapeamento do nó `Sheets Deals` | exatamente esses 16 |

**O que isso escondia em produção:** o `Lote → Neon: deals` da coleta lia `$input.all()`, que é
a saída do Sheets. Logo, `vencimento_licenca` — o campo que a f-038 adicionou hoje 16:42 —
**chegava vazio ao Neon pelo cron**, e só chegava certo pelo refresh (que sempre leu do
formatador). Ninguém tinha visto porque nenhum cron rodou depois da f-038.

**Conserto aplicado:** o `Lote → Neon: deals` da coleta passou a ler `$('Format Deals Raw')`,
igual ao refresh. Isso desacopla o Neon do mapeamento da planilha — campo novo passa a chegar
sem precisar lembrar de mexer em dois lugares — e apaga a assimetria entre os dois workflows.

## 14. D4 (dono) está pronto no n8n e BLOQUEADO no deploy

O lado n8n do dono está feito e verificado: o formatador emite `owner_id`/`owner_nome`, e a
execução `96102` mostra as 299 linhas do lote com o dono preenchido.

**Mas o dono não aparece no Neon, e não é culpa do n8n.** A branch `feat/auth-individual` está
**6 commits à frente do `origin`**, e nenhum commit da f-038 foi publicado. O `/api/ingest` que
roda em `defenz-dashboard.vercel.app` é anterior a esses campos e **ignora campo desconhecido em
silêncio** — responde `recebidos 299, atualizados 299, rejeitados 0` e descarta.

Medido no Neon (as migrations 0009/0010 **já foram aplicadas** — o banco está à frente do app):

| campo | entrou | preenchido no Neon |
|---|---|---|
| `temperatura` | 26/08, **deployado** | **68** |
| `vencimento_licenca` | 27/08 16:42 | 0 |
| `owner_id` / `owner_nome` | 27/08 17:41 | 0 |
| `estado_negocio` | 27/08 (f-038) | 0 |

Ou seja: **toda a f-038 está fora do ar**, não só o dono. O destravamento é um deploy do
dashboard — decisão do Marcos, não minha. Depois do deploy, o próximo refresh (ou o cron das 6h)
preenche as colunas sem mais nenhuma mudança de código.
