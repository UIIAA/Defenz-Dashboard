# Spec — `call_id` único: parar de descartar o identificador do Callbox

> **v2 — pós-crítica adversarial (01/08/2026).** A v1 recomendava reconstruir a aba e foi
> reprovada: continha 4 bloqueadores, um deles pior que o problema original. Esta versão
> inverte a recomendação. **Status: aguardando aprovação.**
>
> Origem: achado do portão de paridade — [`ATESTADO_PARIDADE_NEON_2026-07-28.md`](../ATESTADO_PARIDADE_NEON_2026-07-28.md).

## Problema

O nó `Format Ligacoes Raw` (workflow `QjnzGicZHIPBNN1g`) **sintetiza** a chave da ligação:

```js
call_id: `${isoDate}_${timePart}_${agentName}_${(c.destiny||'').replace(/\D/g,'').slice(-8)}`
```

### Causa-raiz (corrigida na v2)

A v1 dizia "quando `destiny` vem nulo". **Está errado** — uma das 5 chaves colididas tem
agente e destino preenchidos:

```
2026-04-13_10:43:41_Leonardo Alves_50422404   x2   durs 1,1      ← destino preenchido
2026-07-24_14:49:15_31987678836_              x3   durs 8,8,8
2026-07-24_14:48:07_31987678836_              x3   durs 25,25,25
2026-07-30_10:09:11_8534661111_               x2   durs 7,7
2026-07-31_14:58:56_89999360100_              x2   durs 9,9
```

A causa real: **a chave não tem identidade por perna de chamada.** Quaisquer duas pernas com
(data, segundo, agente, últimos-8-do-destino) iguais colidem. Destino vazio só torna isso
muito provável — não é a condição.

### Não é duplicata: é perda de dado

O par de 30/07 tinha **status diferentes** (`Atendida`/ANSWERED e `Nao Atendida`/NO ANSWER):
duas pernas reais de uma discagem que tocou dois ramais. Só uma sobrevive.

Pior: `Sheets Ligacoes Raw` usa `appendOrUpdate` com `matchingColumns: [call_id]`. Com a chave
colidida ele **casa a linha errada e sobrescreve uma chamada com os dados de outra**, dentro da
planilha. Medido em três dias no grupo das 14:48: `10,25,25` → `25,25,25` → `25,25,25`.
A ligação de 10 segundos deixou de existir na planilha.

> Hoje **todos os 5 grupos têm durações idênticas dentro do grupo** — a corrupção já achatou
> tudo. Isso importa para a conferência: não dá mais para distinguir "a chave separou as pernas"
> de "a origem mandou a mesma perna 2×" olhando a aba. Só o payload cru resolve.

### Ritmo

Casos novos em 30/07 e 31/07 — um a cada 1–2 dias. Enquanto durar, `ligacoes` **nunca fecha
7 dias verdes**, porque o baseline quebra sozinho antes.

## A chave que já existe

O Callbox retorna `uniqueid` (Asterisk `epoch.sequencial`) e o nó descarta:

```jsonc
{ "origin": "Leonardo Alves <100>", "date": "31-07-2026 16:44:44",
  "destiny": "08221234389", "duration": "59",
  "uniqueid": "1785527084.37399" }
```

## ⚠️ A armadilha que reprovou a v1

`uniqueid` **não pode ser usado cru**. O nó grava com semântica `USER_ENTERED`, e a evidência
está na própria aba: `destino` é emitido como string e volta do gviz como
`{"type":"number","v":3.1987678836E10}`. `"1785527084.37399"` é numérico.

| Consequência | Efeito |
|---|---|
| Zeros à direita somem | `…37400`, `…3740` e `…374` viram a mesma célula — **colisão nova** |
| Sheets guarda ~15 dígitos | `epoch(10)+seq(5)` = 15, no limite; sequencial de 6 dígitos arredonda |
| `appendOrUpdate` compara string emitida × número lido | **nunca casa → +12.560 linhas por run, 2× ao dia** |

**Regra inegociável: a chave tem que ser texto.** Prefixo `cb_` resolve.

## Recomendação (invertida na v2): fazer em duas etapas

### Etapa A — estancar agora (1 linha, sem migração)

Desempatar **apenas** quando a chave base repetir dentro do lote:

```js
// dentro do map, após montar a base:
const base = `${isoDate}_${timePart}_${agentName}_${dest8}`;
// 2ª+ ocorrência da mesma base ganha sufixo textual estável
const call_id = vistos.has(base) ? `${base}#cb_${c.uniqueid}` : base;
```

- Chave continua **texto** — imune à armadilha acima.
- Ids históricos preservados → **nenhuma migração**, nenhuma janela sem aba, nenhum truncate.
- Custo: salto único de ~+12 linhas no primeiro run (as pernas re-chaveadas são anexadas sem
  apagar as antigas). Delta fixo, conhecido, e é exatamente o que o BASELINE sabe representar.
- **Estanca a corrupção em até 12h.**

### Etapa B — chave definitiva (`cb_${uniqueid}`), com janela combinada

Só depois da Etapa A estabilizada, e com todos os cuidados abaixo — que a v1 não tinha.

## Cuidados obrigatórios da Etapa B (achados da crítica)

| # | Cuidado | Por quê |
|---|---|---|
| 1 | **Pausar** `QjnzGicZHIPBNN1g` antes de tudo | 3 gatilhos ativos, incluindo o **webhook que o `/api/dashboard` dispara** — um usuário clicando atualizar inicia run concorrente. Dois runs contra aba vazia = 25k linhas |
| 2 | **Desabilitar `Ingest → Neon: ligacoes`** durante a migração | o ingest faz upsert e **nunca delete**: durante os passos, o Neon acumularia chave velha + nova ≈ 25k linhas, e o portão ficaria vermelho por desenho — treinando o operador a ignorar vermelho |
| 3 | Criar a aba nova **à mão, com os 8 cabeçalhos exatos** | `appendOrUpdate` **não cria aba nem cabeçalho**, e o nó tem `continueOnFail: true` → falharia em silêncio com a execução "verde" |
| 4 | Sequência do rename: renomear old → renomear v2 → **editar o nó** → reativar | o `sheetName` é por **nome**; renomear sem editar o nó o deixa apontando para aba inexistente, e o `continueOnFail` engole o erro |
| 5 | Renames em segundos, fora de 6h/18h/17h50 | sem aba `ligacoes`, o gviz devolve **sheet 0 com HTTP 200**. Hoje passa por sorte (sheet 0 *é* `ligacoes`); depois de apagar a antiga, deixa de passar |
| 6 | Antes de apagar `ligacoes_old`: trocar os 5 `fetchFromSheets("ligacoes")` por `fetchTabStrict('ligacoes', ['call_id','data'])` | `dashboard-sheets`, `operational`, `export/excel`, `ligacoes-serie`, `relatorio-mensal` leem **sem assinatura** — é o padrão exato do bug "11,5k ligações viraram reunião" |
| 7 | Pré-condição no fetch: exigir `all.length === Number(total)` e `reportedPages <= 20`, e **falhar** | `Callbox Fetch All Pages` engole erro de página (`catch { console.log }`) e tem teto de 20 páginas. Hoje é inofensivo porque a aba acumula; **numa aba reconstruída, uma página perdida vira buraco permanente** |
| 8 | Descartar chamada **sem `uniqueid`** antes de escrever | `call_id` vazio no `appendOrUpdate` casa contra células vazias e colapsa escritas numa linha |
| 9 | Tratar o placeholder `call_id: 'none'` | com `allCalls.length === 0`, o nó grava `none` como primeira linha da aba nova |
| 10 | Manter o header da coluna como **`call_id`** | `schema.ts`, `repo.ts` (coluna de conflito), `backfill-neon.mjs:33` e a assinatura da paridade dependem do nome |

## Conferência (critério corrigido)

A v1 esperava `linhas(v2) == linhas + 7`. **Errado**: as 7 linhas extras **já existem
fisicamente** — a corrupção sobrescreveu valores, não apagou linhas. Re-chavear não cria
linhas, só faz 12.560 linhas terem 12.560 chaves.

Critério correto, medido no **payload cru** (não na aba, que já está contaminada):

- `linhas(v2) == new Set(allCalls.map(c => c.uniqueid)).size`
- `all.length === Number(first.data.total)` (nenhuma página perdida)
- Σ duração deve **cair** ou ficar igual, nunca subir (hoje 619.507s, com valores achatados)
- gviz da aba nova: `cols[0].type === "string"` — prova que a chave não virou número

## Riscos

1. **`uniqueid` pode repetir.** O modo real de colisão de CDR no Asterisk **não** é reuso de
   epoch (como a v1 supunha): é **mais de um CDR por canal** — transferência, `forkcdr`,
   CDR residual — que compartilham `uniqueid` **e data**. Logo o fallback `uniqueid + date`
   da v1 **não resolveria**. Medir no payload cru antes, e definir o desempate então.
   `userfield` não serve: é nulo quando não houve gravação.
2. **`Parse Ligacoes` do Snapshot Diário** filtra `digcount(destiny) >= 8` no caminho live e
   **não filtra** no caminho da aba — justamente as linhas de destino vazio (**275** hoje,
   2,2%). Os dois caminhos já divergem e vão divergir mais.
3. **A corrupção passada não se recupera pela aba** — mas o Callbox ainda tem o registro, então
   a Etapa B recupera o que a planilha destruiu.

## Baseline

Remover as duas entradas de `ligacoes` de `paridade.ts` **só depois do primeiro verde
pós-migração** — enquanto o delta não zerar, remover antes transforma resíduo em `divergente`.
Com o baseline presente e delta 0, a rota já grita `baseline_obsoleto` sozinha.

No mesmo commit, corrigir o `motivo` do baseline e o atestado, que hoje repetem a causa-raiz
errada ("agente vazio").

## Fora de escopo

`Definir periodo` e o tamanho da janela. O duplicado de `leads` (`Wintress`) é de outra
natureza — linha repetida na aba, sem colisão de chave.
