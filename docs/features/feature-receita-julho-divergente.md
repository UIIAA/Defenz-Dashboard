# Spec — receita divergente no `/metas`: data de atribuição e deals fantasma

> **v2 — 03/08/2026, pós-crítica adversarial.** A v1 tinha 7 bloqueadores. Os três que mudam
> o desenho: (a) a janela do `/metas` **não é o mês-calendário**, então a reconciliação e os
> critérios de aceite estavam sobre o conjunto errado; (b) "Farol e consolidado passam a
> concordar" é **estruturalmente falso**; (c) a exclusão de fantasma como especificada
> **quebra o portão de paridade** e não sobrevive a execução concorrente.
> **Status: aguardando aprovação.**

## Modelo validado contra a tela

Reproduzido com o parser idêntico ao de `src/lib/sheets.ts` (`cell.v` + conversão `Date(...)`),
sobre a janela real do `/metas`:

```
janela do filtro 01–31/07  →  semanas 29/06 a 02/08 (5 semanas)
regra de hoje (closing_date)   Defenz  12.076,00 (2)  Repasse 39.427,09 (12)  Total  51.503,09
a TELA mostra                  Defenz  12.076    (2)  Repasse 39.427    (12)  Total  51.503
```

Bate ao centavo. O diagnóstico abaixo parte de um modelo que reproduz o número errado.

## Correção de um achado anterior — NÃO existe `Amount` vazio

Uma análise anterior desta sessão relatou "49 ganhos com valor 0, 7 deles em julho".
**Estava errado**: o script de diagnóstico lia o campo `f` (formatado, `"13.542,9"`) em vez do
`v` (bruto) — `Number("13.542,9")` é `NaN` → 0. O código de produção sempre leu `v`
(`sheets.ts:69`).

Medido certo: **0 de 80 ganhos têm valor zero.**

Portanto: **não é preciso preencher Montante no Zoho**, e o fallback para
`Expected_Revenue`/`Valor estimado` **não entra** — trocaria a fonte-da-verdade do valor
(`CLAUDE.md` §Valor do Deal desaconselha) para resolver um problema inexistente.

**O campo que realmente falta no CRM é `Closing_Date`** — 13 dos 80 ganhos não têm.

---

## Defeito 2 — `metas.ts` atribui receita só por `closing_date`

`src/lib/metas.ts:49` (o comentário que promete "mesma regra do Farol" está na linha 41):

```ts
if (!isClosedWon(String(d.stage || '')) || !dateInRange(d.closing_date, weekStart, weekEnd)) continue;
```

A promessa deixou de valer no commit `b8c2375` (03/08), quando `farol.ts` passou a usar
`dataAtribuicao()` e `metas.ts` não acompanhou. `metrics.ts` já usava o fallback em **13
ocorrências / 12 linhas**.

Efeito: **11 dos 13 negócios Defenz da janela não têm `closing_date`** e simplesmente não
contam. Defenz aparece como R$ 12.076 quando é R$ 88.407,20.

### A regra de atribuição — `created_time`, não `modified_time`

A v1 propunha `closing_date || modified_time`, copiando o que o Farol recebeu ontem. **A
crítica derrubou**: no `/metas`, que é tela histórica, `modified_time` reescreve o passado.
Marcar a tag "Venda Defenz" — justamente o campo que `fonteVenda` lê — bumpa o
`Modified_Time` e move a venda para a semana em que foi *classificada*. Uma semana já pintada
como "batida" pode despintar sozinha.

Medido nos 13 ganhos sem `closing_date`:

| | |
|---|---|
| `created_time` e `modified_time` na **mesma semana** | **11** |
| semanas diferentes | 2 (Líder Gases, Bialer) |

`created_time` dá praticamente o mesmo resultado, é **imutável** e nunca reescreve histórico.
Todos os 13 foram criados em julho — não há caso de negócio antigo ganho tarde.

**Regra adotada: `closing_date || created_time`**, num único helper usado por `farol.ts` e
`metas.ts`. Isso também **corrige o `farol.ts`**, que ontem ficou com `modified_time`.

---

## Defeito 3 — deal deletado no Zoho nunca sai da planilha

`Sheets Deals` usa `appendOrUpdate`: atualiza e insere, **nunca apaga**. O Estaleiro de
R$ 7.540 (id `7067822000007476001`), deletado no Zoho em 02/08, **continua na aba e no Neon**
e é somado como receita Defenz.

Confirmado: a aba tem **234 linhas e 234 ids distintos** — não é linha duplicada, é registro
que sobreviveu à deleção na origem.

### Esta fase NÃO apaga. Só detecta e reporta.

A v1 propunha varredura de exclusão com 5 travas. A crítica encontrou três buracos que nenhuma
delas fecha:

1. **Execução concorrente.** O workflow tem 3 gatilhos e o webhook é disparado **pela própria
   aplicação** (`src/app/api/dashboard/route.ts`). Dois runs calculam índices sobre o mesmo
   estado; o segundo apaga linha deslocada pelo primeiro.
2. **Índice x identidade.** `deleteDimension` é por posição. Ninguém confere que a linha N
   ainda contém o `id` esperado — um humano reordenando a aba no meio faz o passo apagar
   negócio vivo, em silêncio.
3. **O portão de paridade.** Apagar no Sheets sem apagar no Neon deixa `deals` **divergente em
   até 4 checagens** → vermelho → mata a contagem de 7 dias verdes que começou hoje. E o
   `/api/ingest` **não tem como** inferir deleção: o lote chega fatiado em 500 linhas, sem
   noção do conjunto completo.

Deletar antes de resolver os três é trocar um erro visível por um invisível.

### O que entra agora

Um passo no n8n que **compara e reporta**, sem escrever: ids na aba que não existem mais no
Zoho, gravados no log da execução. Custo próximo de zero, e dá a medição que falta para
decidir a exclusão com dado — o mesmo método que na spec do `call_id` refutou a premissa
inteira antes de mexer em produção.

Pré-condições para o relatório valer (abortar e não reportar nada se falharem):

| # | Trava | Por quê |
|---|---|---|
| 1 | paginação completa (`more_records` falso **e** total de páginas < teto de 10) | fetch truncado faz todo deal não trazido parecer deletado |
| 2 | **contagem de deals > 0** — não confiar em `more_records` | Zoho devolve `204 No Content` sem `info`, e `!info.more_records` avalia *true*: pareceria "paginação completa com 0 registros" |
| 3 | ordenação por campo imutável (`Created_Time desc`, como está hoje) | com `Modified_Time`, registros migram de página durante a paginação e viram falsos candidatos |

A exclusão de fato — no Sheets e no Neon, no mesmo run, com releitura do `id` antes de cada
delete e com serialização entre execuções — fica para a spec seguinte, informada por esses logs.

---

## Fora de escopo (nomeado, não omitido)

- **Fallback de `Amount`** — o problema não existe.
- **`leads` e `agenda`** — têm a mesma mecânica append-only e a mesma classe de fantasma
  (lead convertido, tarefa deletada). Adiado junto com a exclusão, não esquecido.
- **`ligacoes`/`emails`** — log de evento, não há deleção na origem.
- **AMGS com `Closing_Date` 30/06** — é dado no CRM. E note: 30/06 **já cai dentro** da janela
  29/06–02/08, então corrigir para 16/07 **não muda** o total da tela. A v1 dizia que mudaria.
- **Farol × consolidado concordarem** — não é alcançável e foi removido dos critérios. São
  janelas diferentes por desenho (o Farol do mês soma as semanas cuja segunda cai no mês;
  o consolidado usa o range) e `computeFarol` recebe sempre `now`, ignorando o filtro.
  Se incomodar, é spec própria.

## Conferência

Sobre a janela real (29/06–02/08), com o fantasma ainda presente:

| | Defenz | Repasse | Total |
|---|---|---|---|
| hoje | 12.076,00 (2) | 39.427,09 (12) | 51.503,09 |
| **depois** | **88.407,20 (13)** | 41.282,48 (14) | **129.689,68** |
| depois, sem o fantasma | 80.867,20 (12) | 41.282,48 (14) | 122.149,68 |

- O `/api/metas` tem **cache em memória de 30 min por range**: a tela não muda até o TTL
  expirar ou a instância reciclar. Não é implementação falhada.
- Testes: `metas.test.ts:29-56` (describe "atribuição por `closing_date`") precisa ser
  reescrito. Cobrir precedência (`closing_date` vence `created_time`) e ganho sem
  `closing_date` entrando pela semana da criação.
- `weekRevenue` tem 2 chamadores, ambos em `computeMetas` (`:257` e `:312`). O `:312` é a
  janela de comparação — ticket médio, R$/proposta e seus deltas mudam junto. Conferir que os
  deltas não ficam absurdos com a base maior.

## Pendência que esta spec não resolve

O comentário de `src/lib/base-instalada.ts:18-19` (commit `b8c2375`, hoje) cita como evidência
"Estaleiro com **duas vendas reais** de 200 endpoints" — e o teste afirma 1 cliente / 400
licenças. Mas o relatório de fechamento de julho diz que o deal de R$ 7.540 **não era venda**:
era o custo (NF SS 106885), gerado em duplicidade pelo robô de onboarding, e foi deletado.
Se for isso, o comentário e o teste estão ancorados no fantasma, e a base instalada conta
200 licenças a mais para esse cliente. **Precisa de decisão sua antes de eu mexer.**
