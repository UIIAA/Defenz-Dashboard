# Spec — `call_id` único: chave com identidade por perna de chamada

> **v3 — pós-execução da Etapa A (01/08/2026, 21:38, execução n8n `90899`).** A Etapa A rodou e
> foi medida. O resultado **refuta a premissa central das v1 e v2**: `uniqueid` não serve como
> chave. A Etapa B está **cancelada** e substituída pela Etapa B′ abaixo, que é menor, não exige
> migração e não tem nenhum dos 10 cuidados de risco da versão anterior.
> **Status: Etapa B′ IMPLEMENTADA em 01/08/2026 23:15** — `Format Ligacoes Raw` já usa base +
> ordinal derivado do conteúdo. Falta a limpeza manual das linhas órfãs (§Limpeza).
>
> Histórico: v1 (reconstruir a aba com `call_id = uniqueid`) reprovada por 4 bloqueadores.
> v2 dividiu em Etapa A (estancar) + Etapa B (chave definitiva `cb_${uniqueid}`).
> Origem: portão de paridade — [`ATESTADO_PARIDADE_NEON_2026-07-28.md`](../ATESTADO_PARIDADE_NEON_2026-07-28.md).

## Estado atual (medido, não suposto)

A Etapa A está no grafo **publicado** de `QjnzGicZHIPBNN1g` (versão 7, 01/08 20:41) e executou:

```js
const call_id = (vistos.has(base) && c.uniqueid) ? `${base}#cb_${c.uniqueid}` : base;
```

Aba `ligacoes` antes → depois: **12.560 → 12.567 linhas**, 7 chaves com sufixo `#cb_`,
`cols[0].type === "string"` (a armadilha do número não se materializou). Único escritor da aba
— o Snapshot Diário (`aMhvdTP5aAi0Z1sf`) só lê.

**Mas as chaves repetidas subiram de 5 para 7, e as linhas extras de 7 para 9**: duas das sete
chaves novas nasceram duplicadas.

## A premissa que caiu

> «O Callbox retorna `uniqueid` e o nó descarta.» — verdade. **Mas descartar não era o defeito.**

Medido no payload cru da execução `90899` (janela 24/07 14:40 → 31/07 16:44, **1.413 registros**):

| chave candidata | valores distintos | colisões |
|---|---:|---:|
| `uniqueid` | 1.180 | **233** |
| `uniqueid` + `date` | 1.407 | 6 |
| `uniqueid` + `interface` + `event` | 1.397 | 16 |
| **chave atual** `data_hora_agente_destino` | 1.407 | 6 |
| base + `interface`/`event`/`duração`/`disposição` | 1.409 | 4 |
| **registro inteiro (todos os 12 campos)** | 1.409 | **4** |

Três leituras, todas contra-intuitivas:

1. **`uniqueid` é pior que a chave que já existe** — 233 colisões contra 6. Ele identifica o
   *canal*, não a perna. Uma entrante para o ring group `ToquegeralVenda` gera 5 registros com
   o mesmo `uniqueid`, distintos em `interface` (PJSIP/Local), `event` (Atendimento/Falha),
   `status`, hora (14:49:23 × 14:49:15) e `duration` (11 × 8). `userfield` é **idêntico** entre
   elas (mesma gravação) — também não desempata. Adotar `cb_${uniqueid}` como chave definitiva
   colapsaria ~19% das ligações.
2. **A chave atual quase não erra** — 6 em 1.413 (0,4%). O problema nunca foi a fórmula da
   chave; foi não ter nada para desempatar os poucos empates.
3. **Nenhum conteúdo separa tudo.** O teto é 1.409: **4 registros são byte-idênticos** nos 12
   campos. Não existe chave natural possível para eles. Exemplo real:
   `31987678836 · 24-07 14:49:15 · NO ANSWER · Atendimento · dur 8` **×3**.

## Etapa B′ — chave definitiva (substitui a Etapa B)

Manter a chave base e desempatar por **ordinal derivado do conteúdo**:

```js
// 1) agrupa por chave base (a de hoje — ids históricos preservados)
// 2) dentro do grupo, ordena por (interface, event, duracao, disposicao) — ordem vem do
//    CONTEÚDO, não da ordem em que o Callbox devolveu: estável entre runs
// 3) 1ª ocorrência fica com a base crua; 2ª+ ganham "#2", "#3", ...
const call_id = i === 0 ? base : `${base}#${i + 1}`;
```

Medido no mesmo payload: **1.413 chaves para 1.413 registros — zero colisões**, por construção.
**6 ids mudam** (0,4%); os outros 1.407 ficam byte-idênticos aos de hoje.

Por que isso é melhor que a Etapa B cancelada:

| | Etapa B (cancelada) | Etapa B′ |
|---|---|---|
| Reconstruir a aba | sim | **não** |
| Pausar o workflow / janela combinada | sim | **não** |
| Desabilitar o ingest do Neon | sim | **não** |
| Criar aba à mão, renomear, apagar a antiga | sim | **não** |
| Ids históricos | todos mudam | **99,6% preservados** |
| Colisões residuais | ~19% | **0** |
| Cuidados obrigatórios | 10 | 2 (abaixo) |

Some quase inteiro o risco da v2: os 10 cuidados existiam porque a aba seria reconstruída.
Sem reconstrução, 8 deles deixam de existir.

### Os 2 cuidados que permanecem

1. **A chave continua texto.** `#2` garante isso sozinho — mas se alguém trocar o sufixo por
   número puro, a armadilha do `USER_ENTERED` volta (`cols[0].type` deixa de ser `string` e o
   `appendOrUpdate` nunca mais casa). Conferir `cols[0].type === "string"` no gviz após o run.
2. **A estabilidade do ordinal depende de ordenar pelo conteúdo, não pela ordem do payload.**
   Ordenar pela ordem de chegada faz duas pernas trocarem de sufixo entre runs, e o
   `appendOrUpdate` reescreve uma linha com os dados da outra — de volta ao defeito original,
   de forma mais discreta. Para os 4 registros byte-idênticos a troca é inócua (são
   indistinguíveis); para os demais, não.

## Limpeza de uma vez só (fora do código)

A Etapa B′ **não apaga nada sozinha**. Medido na aba depois do primeiro run com a B′
(execução `90920`, 01/08 23:16 — 12.574 linhas): **14 linhas a remover**, todas identificáveis
por busca exata:

1. **7 linhas com `#cb_` no `call_id`** — escritas pela Etapa A. Com a B′ no ar essas chaves
   nunca mais são emitidas: são órfãs permanentes.
2. **7 cópias excedentes das 5 chaves-base antigas** — o rastro da corrupção original. Agora só
   a 1ª perna reivindica a chave-base; as outras migraram para `#2`/`#3` e as linhas velhas
   ficaram para trás.

12.574 − 14 = **12.560**, que é o nº de registros do payload. É esse o alvo.

Enquanto elas existirem, o `contagem` de `ligacoes` no portão **não chega a zero**. A remoção é
o que fecha o baseline — não há como reapurar para verde sem ela.

## Conferência

Medir sempre no **payload cru**, nunca na aba (que ainda carrega o rastro):

- `new Set(chaves).size === registros.length` no lote inteiro → 0 colisões
- `linhas(aba) === registros distintos do payload` depois da limpeza
- gviz: `cols[0].type === "string"`
- Σ duração não pode **subir** sem que o nº de linhas suba junto
- `all.length === Number(first.data.total)` (nenhuma página perdida) — segue valendo, o
  `Callbox Fetch All Pages` ainda engole erro de página com `catch { console.log }`

## Pendências antes de implementar

1. **A medição é de uma amostra: 1.413 dos ~12.560 registros** (a janela mais recente,
   24/07→31/07 — o corpo da execução foi truncado na leitura). Repetir a contagem sobre o lote
   inteiro antes de aprovar. A expectativa é que a proporção se mantenha, não que os números se
   repitam.
2. **Verificar o run das 06:00 de 02/08**: se a aba passar de 12.567 linhas, a Etapa A está
   anexando a cada run — as 2 chaves sufixadas duplicadas casariam a mesma linha. Seria modo de
   falha novo, e antecipa a Etapa B′ de "melhoria" para "correção urgente".

## Baseline do portão

Os dois registros de `ligacoes` em `src/lib/ingest/paridade.ts` (`contagem −7`,
`soma_duracao −83`) estão **desatualizados desde a Etapa A** — hoje são 9 linhas extras.
Reapurar após a limpeza, e só remover as entradas depois do primeiro verde com delta 0.
`ligacoes` segue sem condição de fechar 7 dias verdes até lá.

## Fora de escopo

`Definir periodo` e o tamanho da janela. O duplicado de `leads` (`Wintress`) é outra natureza —
linha repetida na aba, sem colisão de chave. O filtro `digcount(destiny) >= 8` divergente entre
os dois caminhos do `Parse Ligacoes` (Snapshot Diário) continua aberto, agora como item próprio.
