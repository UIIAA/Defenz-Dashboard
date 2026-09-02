# feature-041 — Fonte única do pipe: matar o fantasma, o fuso e as quatro definições

**Spec** · v1 · 02/09/2026
**Nasce de:** `feature-039-item-03-conciliacao-farol_v1.md`, o diagnóstico do item 3.
**Executa em:** repo `Defenz_Dashboard` (código) + n8n `QjnzGicZHIPBNN1g` (coletor).
**Status:** aguardando aprovação. Nada implementado.
**Escrita pela sessão Chief** e entregue aqui, porque o conserto é código deste repo.

> **Não confundir com a `feature-040-farol-grandes-contas.md` deste mesmo repo.** Aquela é do
> pedido 1, 2 e 4 do Fernando (último dia com dado, Grandes Contas, o Francisco). Esta é a
> resposta ao **pedido 3**, o R3.3 dela: o diagnóstico apontou para o Dashboard, e aqui está o
> que precisa mudar. As duas convivem e não se sobrepõem, com uma exceção marcada em §3.2.

> **Contexto que manda no desenho:** a leitura do dashboard vai virar para o **Neon**
> (`feature-migracao-neon-fase2.md`, rumo aprovado em 18/08). Esta spec **não constrói nada que
> morra na virada**. Tudo que ela põe de pé ou já é do Neon, ou é uma coluna e um filtro que a
> Fase 2 leva junto sem deixar dívida.

---

## 1. Os três defeitos, e por que os três são o mesmo defeito

Em 02/09 o Fernando via um pipe de R$ 114.200,86 na tela executiva. **R$ 62.935,95 daquilo não
existia.** Os três defeitos abaixo têm a mesma raiz: **a tela responde uma pergunta diferente da
que o CRM responde, e ninguém consegue ver qual.**

| # | Defeito | Onde | O que custou |
|---|---|---|---|
| D1 | O coletor nunca apaga | nó `Sheets Deals`, `appendOrUpdate` | 3 fantasmas, R$ 62.935,95, 55% do valor da tela |
| D2 | O dia é UTC, e "7 dias" são 8 | `getDateRange` em `src/app/api/dashboard-sheets/route.ts` | o dashboard vira o dia às 21h de Brasília; `/` e `/diario` mostram semanas diferentes com o mesmo rótulo |
| D3 | Quatro definições de "pipe" | `metrics.ts`, `oportunidades.ts`, nó `Filtrar Pipe` | 10, 64, 109 e 25 negócios, todos chamados de pipe |

**D1 volta sozinho.** O merge de 02/09 no Zoho não foi um evento raro: é operação normal de CRM.
O próximo gera fantasma novo. A limpeza manual daquele dia foi curativo, e curativo não vira
processo.

---

## 2. O princípio: parar de apagar, começar a filtrar

A tentação é ensinar o coletor a apagar. **Não.** Apagar é irreversível, exige saber a linha
certa, e uma coleta parcial vira destruição de dados.

**O registro nunca sai. O que muda é ele deixar de ser visto.**

Cada linha passa a carregar **quando foi vista pela última vez** na origem. A conta só olha o que
foi visto na última colheita íntegra. O fantasma não é apagado: ele para de aparecer, sozinho, na
coleta seguinte, e continua ali como prova de que existiu.

Isso tem três consequências boas: é reversível, é auditável, e é exatamente a semântica que a
Fase 2 leva para o Neon sem reescrever nada.

---

## 3. Escopo

### 3.1 · Anti-fantasma: `visto_em` mais a trava de colheita íntegra

**Origem.** O coletor `QjnzGicZHIPBNN1g` passa a carimbar cada linha com `visto_em`, o instante
da execução (um só valor para o lote inteiro, não um por linha).

- **Neon:** migration `0012_visto_em.sql` — `alter table deals add column visto_em timestamptz`.
  O upsert de `src/lib/ingest/repo.ts` grava sempre, inclusive no `on conflict do update`.
- **Sheets (ponte até a Fase 2):** uma coluna `visto_em` na aba `deals`. O nó `Sheets Deals` já
  mapeia por nome, então é somar a coluna ao `columns.value` e ao `schema`. **Uma coluna, zero
  lógica nova.**
- **Leitura:** linha cujo `visto_em` seja anterior à última colheita íntegra **não entra em conta
  nenhuma**. Vale para as duas fontes enquanto as duas existirem.

**A trava, que é a parte que impede o desastre.** Carimbar sem trava é pior que o problema: uma
colheita parcial (Zoho fora do ar, token vencido, teto de paginação) faria **o pipe inteiro virar
fantasma de uma vez**. Então o marcador de "última colheita íntegra" só avança quando as duas
condições valem:

1. a última página do Zoho voltou com `more_records: false`, ou seja a paginação terminou por
   fim de dados e não por teto; **e**
2. o total colhido é **>= 90% do total da colheita anterior**.

Falhou qualquer uma: as linhas são gravadas normalmente, o marcador **não avança**, a tela segue
mostrando a última foto boa, e sai um aviso. Colheita parcial vira alarme, nunca sumiço.

**De quebra isso conserta o teto silencioso.** O `Zoho Deals` está em `per_page: 200` com
`maxRequests: 10`, ou seja teto de 2.000. Hoje são 306 e sobra folga, mas no dia em que passar de
2.000 o corte seria mudo. A condição 1 transforma esse dia num alarme.

**Também sai:** o `continueOnFail: true` do nó `Sheets Deals`. Falha de escrita passando em
silêncio é o mesmo modo de falha que custou os R$ 19.962 de comissão em agosto.

### 3.2 · Fuso e janelas

- Novo `src/lib/brt.ts` com `hojeBRT()` e `ultimoDiaUtil(data)`. Fonte única, importada por
  todo mundo. A lógica de dia útil já existe em `farol.ts` (`isoDow`, `addDays`) e é reusada, não
  reescrita.
- `getDateRange` em `src/app/api/dashboard-sheets/route.ts` **para de usar
  `new Date().toISOString()`** e passa a usar `hojeBRT()`.
- O preset `'7d'` passa a ser `addDays(hoje, -6)`, sete datas de verdade, igual ao `/diario`.
  Mesma correção em `'15d'` e `'30d'`.
- Todo rótulo de período passa a **mostrar as datas** ("26/08 a 01/09"), não só "Últimos 7 dias".
  Rótulo que não mostra data é o que deixou duas janelas diferentes conviverem sem ninguém notar.
- **Fronteira com a f-040 deste repo:** a janela padrão do farol (abrir no último dia **com
  dado**, com escolha de data) é **dela**, pedido 1. Esta spec não mexe nisso. O que é meu aqui é
  só o **defeito de fuso e o preset de 7 dias**, que valem para o dashboard inteiro e não só para
  o farol. Se as duas saírem juntas, `brt.ts` nasce uma vez e serve às duas.

### 3.3 · Uma definição de pipe, com nome

- Novo `src/lib/pipe.ts`, **único lugar** onde estágio vira categoria. Exporta
  `ETAPAS_GANHAS`, `ETAPAS_PERDIDAS`, `GELADEIRA`, `isAberto()`, `isGrandeConta()`.
- **`isPipeline()` é aposentada.** Ela é allowlist de 4 nomes e **descarta Reunião Técnica e
  Proposta / Governo em silêncio**, 15 negócios reais hoje. Onde ela é usada, entra `isAberto()`
  com o filtro explícito que aquela tela quiser.
- **Denylist, sempre.** Estágio novo ou renomeado no Zoho tem que **aparecer**, não sumir. Foi
  assim que `Grandes Contas` nasceu invisível.
- O mesmo arquivo vai **copiado verbatim** para o Code node `Filtrar Pipe` do WF
  `609dj477lHEPBX6J`, no padrão já usado por `temperatura.ts` e `operacao-aggregator.ts`, com um
  teste que compara o texto dos dois e quebra se divergirem.
- **Cada número na tela ganha rótulo do que conta.** "Pipe" sozinho não é nome de nada.

---

## 4. O que esta spec NÃO faz, por causa da migração

| Não faz | Por quê |
|---|---|
| Reescrever o caminho do Sheets | ele sai da leitura na Fase 2. `visto_em` lá é uma coluna e um filtro, e some junto |
| Ensinar o coletor a apagar linha | irreversível, e a filtragem resolve melhor |
| Criar tela nova de conciliação | o portão de paridade que já existe passa a cobrir isso (§5) |
| Mexer no farol da f-037 além do `pipe.ts` | o farol já lê o Zoho ao vivo, ou seja já está certo |

---

## 5. Testes, antes do código

TDD, regra do repo. Cada um falha primeiro.

| Teste | Prova |
|---|---|
| lote 2 sem um id do lote 1 → aquele id sai de todas as contas **e continua na tabela** | o anti-fantasma funciona sem apagar |
| colheita com 70% do total anterior → marcador não avança, nenhuma linha vira fantasma, alerta emitido | a trava impede o desastre |
| última página com `more_records: true` → marcador não avança | teto de paginação vira alarme |
| `hojeBRT()` às 23h30 de Brasília | o dia não vira antes da meia-noite |
| preset `'7d'` cobre exatamente 7 datas distintas | acabou a semana de 8 dias |
| `/` e `/diario` no mesmo preset devolvem o mesmo intervalo | os rótulos passam a significar a mesma coisa |
| estágio inventado ("Em Homologação") aparece em `isAberto` | denylist de verdade |
| texto de `pipe.ts` idêntico ao Code node do n8n | as duas cópias não divergem |
| portão de paridade passa a comparar **contagem de abertos**, não só agregados | o portão de 02/09 estava verde carregando 3 fantasmas |

O último é o mais importante: **o comparador Neon × Sheets estava verde no dia em que a tela
mostrava R$ 62.935,95 que não existiam.** Comparar só agregado não pega conjunto diferente com
contagem parecida.

---

## 6. Ordem de execução

| Onda | O que | Depende de |
|---|---|---|
| A | §3.2 fuso, janelas e o item 1 da f-039 | nada. Isolado, sai no mesmo dia |
| B | §3.3 `pipe.ts` e aposentar `isPipeline` | nada. Muda número em tela: **anunciar antes** |
| C | §3.1 `visto_em` no Neon, no coletor e na leitura, com a trava | migration + 1 coleta para semear |
| D | na Fase 2, o filtro migra para o Neon e a coluna do Sheets some | Fase 2 |

Começar pela **A**: é a mais barata, não muda número nenhum de negócio e já entrega o item 1 da
f-039 junto.

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Colheita parcial esvaziar o pipe | a trava dos 90% e do `more_records`. **É o risco número 1 desta spec** |
| Aposentar `isPipeline` mudar número histórico em tela | é o objetivo, mas avisar o Fernando antes, com o de-para |
| A coluna nova quebrar o `Sheets Deals` em silêncio | tirar o `continueOnFail: true` faz parte do escopo |
| Semear `visto_em` na primeira coleta | primeira passada carimba tudo; a partir da segunda o filtro vale |

---

## 8. Pronto quando

1. Mesclar um negócio de teste no Zoho e ele **sumir da tela na coleta seguinte**, sem ninguém
   apagar linha nenhuma.
2. Simular uma colheita de 70% e o pipe **não mudar**, com o alerta na mão.
3. Abrir o dashboard às 21h30 de Brasília e ver o dia certo.
4. "7 Dias" cobrir 7 datas, e o rótulo mostrar quais.
5. Os quatro números de pipe virarem **um**, com nome do que ele conta.
6. O portão de paridade reprovar de propósito quando um fantasma for injetado à mão.

---

## 9. Quem faz o quê

- **Sessão `Defenz - Dashboard`:** ondas A, B e C. É código de tela, de rota e do `repo.ts`.
- **Aqui (Chief):** a alteração no coletor `QjnzGicZHIPBNN1g` e no Code node do
  `609dj477lHEPBX6J`, porque os dois são n8n, e a cópia verbatim do `pipe.ts`.
- **Marcos:** aprovar a spec, e decidir se avisa o Fernando antes da onda B, que é a que muda
  número em tela.
