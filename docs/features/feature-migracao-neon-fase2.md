# Spec — Fase 2: virar a leitura para o Neon

> **v3 — 2026-08-18.** Reescreve a v2 (do mesmo dia) depois de uma revisão adversarial que
> refutou oito afirmações factuais da v2 e encontrou um erro de R$ 19.962 em produção.
> Continuação de [`feature-migracao-neon.md`](feature-migracao-neon.md) (Fase 1: escrita dupla,
> em produção desde 01/08).
>
> **Status: aprovada em 18/08/2026** quanto ao rumo. As mudanças da v3 sobre a v2 estão em §0.

## Objetivo

O dashboard passa a **ler exclusivamente do Neon**. O n8n **continua gravando nos dois** — o
Sheets sai do caminho de leitura, não do de escrita.

Sucesso não é "migrou": é **ninguém abrir o dashboard e notar diferença** — exceto onde o número
de hoje está errado, e aí a diferença é o ponto.

---

## 0. O que mudou da v2 para a v3

A v2 foi submetida a uma revisão adversarial com acesso ao repo, ao Neon e ao gviz. Oito
afirmações factuais dela foram refutadas com evidência. As correções estão incorporadas; as
principais:

| v2 dizia | a evidência diz |
|---|---|
| "as 11 rotas trocam uma linha cada" | são **28 call sites**, e `/api/resumo-diario` depende do `null` do `fetchTabStrict` |
| "`deals` 249=249, idêntico" | **3 deals divergem em `lead_source` — R$ 19.962 de comissão** (§1) |
| "portão verde por 7 dias é critério suficiente" | o portão compara 4 agregados e está **verde carregando os R$ 19.962** (§5) |
| "o risco é `toISOString()` deslocar −3h" | o risco é o objeto `Date` reprovar o regex e **zerar todo filtro de período** (§3) |
| "`correlateLeads` sobrescreve com o mesmo lead_id" | indexa **pelo telefone da linha**; a conclusão estava certa por sorte, o mecanismo não (§4.2) |
| "nenhuma métrica conta `leads.length`" | `excel-builder.ts:154` e `:600` contam (§4.2) |
| "`resumo_diario`: 6 colunas de vendedor, 2 destaques" | são **5 e 4** |
| "2 classes de divergência de conteúdo" | são **9** (§4) |

Mudanças de desenho: canário trocado de `emails` para `resumo_diario`; `reunioes` trazido para o
escopo; `leitura_cache` do §8 abandonado por algo mais barato; o teste do §7 partido em teste
hermético + script de verificação.

---

## 1. O achado que reposiciona a fase inteira: o Sheets perde escrita em silêncio

Este não é um detalhe da migração. É a justificativa dela.

### O fato

Três deals **Fechado Ganho de agosto** têm `lead_source` diferente entre a planilha e o Neon,
gravados **pela mesma execução do cron** (18/08 21:01), com `valor`, `stage`, `licencas` e
`modified_time` idênticos:

| deal | aba | Neon |
|---|---|---|
| OPEN DATACENTER BRASIL | `Cold Call ( Prospecção )` → 58% → R$ 14.935 | `Parceiro SS ( SecuriSoft)` → 5% → R$ 1.288 |
| CELSUS METALURGICA | `Cold Call ( Prospecção )` → R$ 5.041 | `Parceiro SS ( SecuriSoft)` → R$ 435 |
| CONCRETO AMOROSO | `Cold Call ( Prospecção )` → R$ 1.870 | `Parceiro SS ( SecuriSoft)` → R$ 161 |

**R$ 21.846 × R$ 1.884 — o dashboard superfatura a comissão de agosto em R$ 19.962 (91%).**

**Confirmado pelo Marcos em 18/08: as três vendas entraram por SecuriSoft. O Neon está certo.**

### A causa raiz, com evidência no grafo do n8n

```
Format Deals Raw  →  Sheets Deals  →  Lote → Neon: deals  →  Ingest → Neon: deals
```

`Lote → Neon: deals` faz `$input.all()` — lê a **saída** do nó `Sheets Deals`. O mesmo payload,
com `lead_source: "Parceiro SS ( SecuriSoft)"`, passou pelo nó do Sheets (que deveria gravá-lo)
e seguiu para o Neon, que o gravou. A planilha continua mostrando `Cold Call`.

O nó `Sheets Deals` tem **`continueOnFail: true`**. A escrita não persistiu e ninguém foi
avisado.

### A consequência para esta spec

O Neon **não é uma alternativa equivalente ao Sheets**. É a mesma origem com **um passo de
escrita lossy a menos** — e o passo que ele elimina é o que está perdendo dado hoje.

Isso muda a pergunta de risco da fase. Não é mais "vale a pena trocar de fonte?". É "quanto tempo
a mais o time vai olhar números de uma fonte que perde escrita sem avisar?".

### O que fazer com isso — separado desta spec

Os R$ 19.962 são **bug vivo, independente da migração**. Tratamento em três frentes,
nesta ordem:

1. **Imediato:** corrigir as 3 linhas na aba `deals` à mão (ou reexecutar o workflow e conferir
   que persistiu). O relatório de agosto não pode sair com R$ 21.846.
2. **Curto prazo:** tirar o `continueOnFail: true` do `Sheets Deals`, ou mantê-lo e ligar um
   ramo de erro que avise. Engolir falha de escrita da fonte da verdade é a causa raiz, não o
   sintoma.
3. **Investigação própria:** por que essas 3 linhas falharam e não as outras 246. Não bloqueia
   a Fase 2 — o Neon já tem o valor certo — mas bloqueia confiar na planilha para qualquer coisa.

Item 1 e 2 **não esperam a Fase 2**. Spec própria ou tarefa avulsa.

---

## 2. Estado medido em produção — 2026-08-18

Escrita dupla saudável e fresca (cron das 18h de 18/08 gravou nas 7 tabelas):

| tabela | Neon | Planilha | veredito |
|---|---:|---:|---|
| `deals` | 249 | 249 | ⚠️ contagem bate, **3 linhas divergem em conteúdo** (§1) |
| `ligacoes` | 16.633 | 16.633 | ⚠️ contagem bate, **16.170 divergem em `destino`** (§4.1) |
| `emails` | 4.102 | 4.102 | ⚠️ contagem bate, **392 divergem em `assunto`** (§4.1) |
| `agenda` | 280 | 280 | ⚠️ contagem bate, **146 `lead_id` nulos** (§4.3) |
| `resumo_diario` | 62 | 62 | ✅ **limpo** — 0 divergência semântica em 62 dias |
| `leads` | 1.586 | 1.754 | ⚠️ −168 = lead_id duplicado na aba (§4.2) |
| `classificacao_ia` | 2.514 | 1.464 | ⚠️ +1.050 = histórico append-only (§4.4) |

**A lição da tabela: contagem igual não é conteúdo igual em nenhuma linha dela, exceto
`resumo_diario`.** A v2 leu esta mesma tabela e concluiu "5 de 7 idênticas". Estava errada.

---

## 3. O contrato de coerção de tipo — o trabalho real do adaptador

A v2 tratou isto como um parágrafo sobre fuso horário. É o miolo da fase, e o modo de falha
descrito na v2 era o errado.

### O modo de falha real

O driver Neon devolve tipos do Postgres, não strings:

```
created_time  object  Date("2025-12-26T03:00:00.000Z")
hora          string  "16:53:42"
valor         string  "5000.00"          ← numeric vem como STRING
licencas      number  0
is_overdue    boolean true               ← na aba é o texto "sim"
```

Três quebras concretas, todas silenciosas:

| campo | o que quebra | onde |
|---|---|---|
| qualquer data | `dateInRange` faz `String(x).slice(0,10)` contra `/^\d{4}-\d{2}-\d{2}$/`. Um `Date` vira `"Mon Dec 26"` → reprova → **todo filtro de período volta vazio** e `coverage.dropped_invalid_date` conta 100% | `metrics.ts:51-57` |
| `agenda.is_overdue` | a rota testa `=== 'sim'`; `String(true)` = `"true"` → **toda tarefa vira não-atrasada**, contador de atrasadas zera | `agenda/route.ts:44` |
| `classificacao.passou_secretaria` | idem | `esforco/route.ts:58`, `correlate.ts:214` |
| `agenda.due_date` | comparação de string `d >= hoje && d <= in7Days` contra um `Date` | `agenda/route.ts:51-53` |

Nenhuma delas dá erro. Todas dão **número errado ou zero**.

### O contrato

`src/lib/neon-reads.ts` aplica, sem exceção, antes de devolver:

| tipo Postgres | vira | como |
|---|---|---|
| `date` | `'YYYY-MM-DD'` | formatação por componente (`getFullYear`/`getMonth`/`getDate`), **nunca `toISOString()`** |
| `time` | `'HH:MM:SS'` | já vem string; validar formato |
| `timestamptz` | `'YYYY-MM-DDTHH:MM:SSZ'` | só onde a aba tem timestamp (`atualizado_em`, `data_classificacao`) |
| `numeric` | `number` | `Number()`, com teste de que `"5000.00"` → `5000` |
| `boolean` | `'sim'` / `'nao'` | a aba é texto; o consumidor testa string |
| `null` | `null`, **nunca `0` nem `''`** | no `resumo_diario` a distinção é a UI mostrar "—" |
| `jsonb` | string JSON | onde a aba guarda JSON em célula (`por_vendedor`, `coverage`) |

Este contrato é testável sem rede e sem banco (§7), e é o que teria pego `is_overdue`.

---

## 4. As divergências medidas — 9 classes, todas declaradas

A revisão comparou **campo a campo, todas as linhas** (não amostra) de deals, ligações e e-mails.

### 4.1 Divergências de serialização — inócuas, mas precisam ser declaradas

| classe | volume | causa | ação |
|---|---:|---|---|
| `ligacoes.destino` sem zero à esquerda | **16.170** | célula numérica do gviz come o `0`: aba `31987678836` × Neon `"031987678836"` | **o Neon está certo**; declarar como exceção esperada |
| `emails.assunto` com espaço à esquerda | **392** | `.trim()` do coercer `texto` (`schema.ts:59`) | Neon certo; declarar |
| `deals.resultados` com espaço à direita | 17 | idem | declarar |
| `resumo_diario` ordem de chaves no jsonb | 242 | irrelevante para `toEqual` | declarar |

### 4.2 `leads` — o Neon está certo, e o Excel muda

Os 168 são **lead_id duplicado na aba** (1.754 linhas, 1.586 ids distintos, zero vazio). O Neon
tem PK e colapsa.

**Correção do mecanismo que a v2 alegou:** `correlate.ts:57-63` indexa `phone9ToLeadId` **pelo
telefone daquela linha** — duas linhas do mesmo lead com telefones diferentes criam **duas
chaves**, não uma sobrescrita. Medido: dos 168, **3 têm telefones diferentes**, e num deles as
chaves normalizadas são genuinamente distintas. A linha que o upsert do Neon manteve é a que
casa com as 3 ligações reais — ou seja, **a conclusão "não muda nada" vale, mas por sorte, não
por construção**.

**E muda uma coisa que a v2 negou:** `excel-builder.ts:154` e `:600` fazem `leads.length`. O
Excel exportado cai de 1.754 para 1.586 linhas e o KPI "total" muda junto. É correção, e entra no
atestado de virada — não é surpresa aceitável no dia.

### 4.3 `agenda` — BLOQUEANTE, e o conserto é na ingestão

**146 das 280 tarefas (52%) estão no Neon com `lead_id` nulo.** A FK
`agenda_tarefas.lead_id → leads(lead_id)` com `on delete set null` descarta o lead_id de toda
tarefa cujo lead não está em `leads`. A aba tem esse lead_id.

A tabela também **não tem** `lead_name` nem `empresa`, que `/api/agenda` lê e exibe.

Ler agenda do Neon hoje devolveria metade das tarefas sem lead, sem nome e sem empresa.

```sql
-- 0006_agenda_fidelidade.sql
alter table agenda_tarefas drop constraint if exists agenda_tarefas_lead_id_fkey;
alter table agenda_tarefas add column if not exists lead_nome    text;
alter table agenda_tarefas add column if not exists empresa_nome text;

alter table classificacoes_ia drop constraint if exists classificacoes_ia_lead_id_fkey;
alter table classificacoes_ia add column if not exists lead_nome text;
```

`lead_id` vira texto sem FK. A restrição estava apagando dado que a origem tem. Exige mexer em
`src/lib/ingest/schema.ts` e `repo.ts` e **rerodar o backfill** de agenda e classificação.

**A Fase 2 não é só leitura.** Reconhecer isso é metade da spec.

### 4.4 `classificacao_ia` — append-only, e o join não recompõe o nome

O Neon guarda o histórico (`unique (lead_id, data_classificacao)`); a aba guarda só a última.
Ler direto **inflaria o esforço IA em 72%**.

```sql
select distinct on (c.lead_id) c.lead_id, c.data_classificacao, c.nivel_maximo, …
  from classificacoes_ia c
 order by c.lead_id, c.data_classificacao desc
```

**A v2 dizia que `left join leads` recompõe `lead_name`. Não recompõe** — 13 divergências
medidas entre o `lead_name` da aba e o `leads.nome` do Neon (`"Nao identificado"` × `"Registro
de Títulos e Documentos"`, `"TRT da 13ª Região"` × `"TRT da 13ª Região - Paraíba"`). `/api/esforco`
lê `r.lead_name` (`route.ts:56`).

Por isso a migration `0006` adiciona `classificacoes_ia.lead_nome` denormalizado. O join sai.

Perda residual: 1.295 leads distintos no Neon × 1.297 na aba — 2 rejeitados pela FK, resolvidos
pela mesma migration.

### 4.5 `ligacoes.destino` — 285 linhas onde as duas escritas discordam

285 ligações têm `destino` **vazio na aba e `"Principal"` no Neon**. Diferente da classe do zero
à esquerda: aqui os dois destinos receberam payloads diferentes, o que contradiz a premissa da
Fase 1 de que "as linhas são exatamente o que já vai pro Sheets".

Funcionalmente inócuo (`normalizePhone("Principal")` → `''` → `continue`, igual ao `!call.destino`
de hoje). Mas é a **mesma família do achado do §1** e o portão nunca as viu. Declarar como
exceção e investigar junto com o §1.

### 4.6 `deals` e `ligacoes` — dimensões viraram FK

`deals.empresa` → `empresa_id`, `ligacoes.agente` → `agente_id`: `left join empresas` /
`left join pessoas` devolvendo `nome_exibicao`. `deals.empresa` está vazio em 100% dos deals, e
o join devolve vazio — que é o que a aba devolve hoje. O `cnpj` (217 de 249) está em coluna
própria desde a `0004`.

### 4.7 `resumo_diario` — limpo, e é o canário

São **5 colunas de vendedor** (4 `*_por_vendedor` + `emails_por_sender`) e **4 `destaque_*`**
(comercial, marketing, execucao, atencao) — a v2 dizia 6 e 2.

O fold em `por_vendedor`/`destaques` jsonb é lossless: verificado por deep-equal em **62 dias ×
5 grupos × 4 destaques × 10 escalares = 0 divergências semânticas**, incluindo a preservação de
`null` × `0` (`pocs_ativas` 13 nulls, `emails_total` 5, `whatsapp_msgs` 5, `linkedin_page` 5).

**É a única tabela limpa das sete. Por isso vira primeiro (§6).**

### 4.8 `reunioes` — agora no escopo, porque custa caro ficar fora

A aba `reunioes` não existe; o gviz devolve a aba 0 (`ligacoes`) disfarçada. Medido:

```
curl .../sheet=reunioes → 4.198.331 bytes em 1,268 s
```

`/api/dashboard-sheets` e `/api/relatorio-mensal` baixam **4,2 MB em 1,27 s** e jogam fora, a
cada cache miss. A v2 punha isso fora de escopo — o que tornava falsa a frase "o Sheets sai do
caminho de leitura" justamente nas duas rotas mais pesadas.

**Ação (uma linha):** `lerReunioes()` devolve `null` direto, sem tocar a rede, enquanto não
existir fonte. O fallback `[REUNIAO]` em `deals.resultados` já é o caminho vivo e não muda.
Ganho: −4,2 MB e −1,27 s nas duas rotas mais caras, de graça.

---

## 5. O portão de paridade precisa comparar conteúdo

O critério da v2 ("7 dias de portão verde") **não certifica nada**. `resumirSheets`/`resumirNeon`
(`paridade.ts:130-160`, `repo.ts:385-431`) comparam, para `deals`, apenas `contagem`,
`soma_valor`, `soma_licencas` e `ganhos` — os quatro batem (249/249, 4.662.927,83 nos dois,
76.964/76.964, 82/82) **enquanto carregam os R$ 19.962 do §1**. Para `leads` e `agenda`, só
contagem: 280=280 com 146 `lead_id` nulos.

O portão é cego para exatamente a classe de defeito que a Fase 2 introduz.

**Mudança:** `resumirX` passa a devolver também um **hash de conteúdo por linha** (md5 dos campos
consumidos, ordenado pela chave natural) e a comparação reporta **quantas linhas divergem e
quais** — não só agregados. Com as 9 classes do §4 declaradas como exceção nomeada, igual ao
`BASELINE` de hoje.

**Reapurar os baselines de `leads` (−168) e `classificacao_ia` (−2).** Hoje o `BASELINE`
(`paridade.ts:60-88`) registra −1 para as duas, e as duas estão **vermelhas** com o veredito
"DESVIOU do baseline". Sem reapurar, o critério de virada é insatisfazível para duas das sete
tabelas.

### Critério de virada, por tabela (revisado)

1. portão **de conteúdo** verde por 7 dias corridos, com as exceções do §4 declaradas;
2. o teste de mappers (§7a) passa para aquela tabela;
3. o script de verificação (§7b) roda no dia e não mostra classe de divergência nova.

O critério de latência da v2 sai como portão recorrente: já está respondido para todas
(Neon 341–460 ms × gviz 1.117 ms na maior tabela) e não vai mudar. Vira medição única.

---

## 6. Ordem de virada

1. **`resumo_diario`** — a única limpa (§4.7), 2 rotas, tela isolada. **É o canário.**
   *(A v2 escolhia `emails`, que alimenta 4 rotas e tem 392 divergências — se quebrasse,
   quebraria em quatro telas ao mesmo tempo.)*
2. **`emails`** — sem FK, sem dimensão; a divergência é de `trim`, conhecida.
3. **`leads`** — depois de reapurar o baseline; o Excel muda de tamanho (§4.2).
4. **`agenda`** — só depois da `0006` aplicada e do backfill rodado.
5. **`classificacao_ia`** — junto da `0006` (`lead_nome` denormalizado).
6. **`deals`** — **depois de o §1 estar resolvido**, não antes.
7. **`ligacoes`** — maior volume; é onde o Neon ganha do gviz de verdade.

`emails`, `leads` e `resumo_diario` podem ir **juntas** se as três passarem no portão de
conteúdo no mesmo dia — não têm risco de adaptador além dos tipos. Uma por dia útil só a partir
da `agenda`.

---

## 7. Teste — partido em duas coisas, porque eram duas

A v2 chamava de "teste" algo que exige rede (gviz) e `DATABASE_URL` de produção, e que compara o
que a produção tiver naquele minuto. Não existe CI no repo e `test:sql` já é pulado por padrão.
Era script de verificação vestido de teste.

### 7a. Teste hermético dos mappers — roda sempre, sem rede

`src/lib/neon-reads.test.ts`. Fixtures com os tipos que o driver realmente devolve: objeto
`Date`, `time` string, `numeric` string, `boolean`, `null`. Assere o contrato do §3 campo a campo.

**É o teste que teria pego o `is_overdue` e o objeto `Date`.** É o único que roda em CI.

### 7b. Script de verificação — roda no dia da virada, manual

`npm run verificar:fonte -- --tabela deals`. Lê das duas fontes, compara linha a linha e
**relata diffs agrupados por classe**, com contagem e 3 exemplos de cada. Não afirma igualdade:
mostra o que difere e deixa a pessoa decidir.

As 9 classes do §4 entram como exceções **nomeadas** — declaradas, não silenciadas. Classe nova
que aparecer é motivo de não virar naquele dia.

---

## 8. Fallback, flag e alerta

### 8.1 Flag por tabela, no banco — e o que fazer quando o banco está fora

Migration `0005_config.sql`: `config (chave text primary key, valor text, atualizado_em timestamptz)`.
Chave `neon_read` = lista: `resumo_diario,emails`. Cache de 60 s em memória.

**A dependência circular que a v2 não resolvia:** a flag mora no Neon, e é ela que decide se cai
pro Sheets quando o Neon falha. Regra explícita:

- erro ao ler a flag → **serve o último valor cacheado, mesmo vencido**;
- sem valor cacheado (instância fria) → **default `""` = tudo no Sheets**.

Falhar fechado no Sheets é seguro **enquanto** a escrita dupla existir. Quando a Fase 3 desligar
a escrita, a flag sai junto — não há mais o que escolher.

### 8.2 Fallback

Falha de leitura do Neon (erro, timeout > 8 s) → `lerX()` cai pro Sheets, devolve o dado e
sinaliza.

Cuidado que a v2 não tinha: **`fetchFromSheets` já devolve `[]` em falha** (`sheets.ts:92-107`).
Sem limiar, o fallback do fallback é um dashboard vazio e silencioso. Cada tabela declara um
mínimo esperado (ex.: `deals >= 1`); abaixo disso é erro, não resultado.

### 8.3 Alerta, e o contador que a condição de saída exige

`POST $ALERTA_WEBHOOK_URL` → webhook novo no n8n → chat da Operação no Teams. Dedup de 1 h por
tabela.

**A v2 dizia que o contador de "30 dias sem fallback" seria "o próprio log". Não é auditável** —
não há log drain configurado e o log de runtime da Vercel não é um contador de 30 dias. O
contador vira **linha em tabela**: `config` ganha `fallback_ultimo_em` por tabela, escrito no
fallback. A condição do §9 passa a ser uma query.

Badge no cabeçalho ganha **Roxo=Neon** (`ExecutiveDashboard.tsx:52` e `:323`). Com a flag ligada,
ver "Planilha" na tela significa fallback.

### 8.4 Cache — o que chavear por fonte não resolve

Chavear o cache de servidor por fonte é necessário e insuficiente:

- cada rota tem seu `Map` de módulo, **por instância serverless**. Com N instâncias e TTL de 60 s
  na flag, duas instâncias servem fontes diferentes por até ~60 s. É aceitável e precisa estar
  escrito, não descoberto no dia.
- o cache **do cliente** (`cache.ts`, sessionStorage, 30 min) **não tem chave de fonte nem
  invalidação a partir do servidor**. "Reverter em 1 minuto" é falso para uma aba já aberta:
  aquele usuário fica até 30 min com o número antigo. Ação: incluir a fonte na chave do
  sessionStorage e derrubar o TTL do cliente para 5 min durante a fase.

### 8.5 Leitura no meio do cron

A ingestão é transacional **por lote de 500** — 16.633 ligações = **34 transações**. Um usuário
abrindo o dashboard às 06:01 vê tabela parcialmente atualizada. Hoje é invisível porque a leitura
vem do Sheets.

Saída barata: `lerX()` filtra `ingerido_em <= (select max(...) from execucao_completa)`, ou o
`Ingest` grava uma marca de execução fechada e a leitura só enxerga execuções fechadas. Uma
coluna e um predicado.

### 8.6 Volume

Medido: gviz `ligacoes` = 4,00 MB / 1.117 ms; Neon com join = 460 ms (fria) / 341 ms (quente).
O JSON das 16.633 ligações são **3,07 MB** de objetos vivos na função — e `/api/dashboard-sheets`
lê 6 tabelas na mesma request.

`lerLigacoes()` e `lerEmails()` **aceitam janela de data**, porque todo consumidor filtra por
período (`metrics.ts:139`). Full-table permanente é escolher descobrir o teto em produção.
*Não verificado: o limite de resposta da Vercel Function e a latência real da região.*

---

## 9. A saída do fallback — a solução definitiva

O fallback ao Sheets é **andaime com prazo**. Duas fontes de leitura para sempre é carregar dois
modelos, dois modos de falha e a dúvida permanente de qual número está na tela — e o §1 mostra
que uma das duas mente.

### O destino

```
hoje:        Neon → (falhou) → Sheets → (falhou) → erro
definitivo:  Neon → (falhou) → último dado bom, CARIMBADO na tela → (falhou) → erro
```

A resiliência deixa de vir de **uma segunda fonte** e passa a vir do **último dado bom**. Se o
Neon cair, o dashboard mostra o número que tinha às 06:00 **dizendo que é das 06:00**, em vez de
servir calado um número de outra procedência.

**Simplificação sobre a v2:** a v2 propunha uma tabela `leitura_cache` com payload jsonb. São
3,07 MB reescritos pelo driver HTTP a cada leitura bem-sucedida, na rota de leitura — o gargalo
que a fase veio evitar, e uma terceira camada de cache ao lado das duas que já existem. Fora.

**No lugar:** carimbar o cache in-memory de 30 min que já existe. Cada entrada guarda
`capturado_em`; em falha do Neon, serve a entrada vencida com o carimbo e o badge muda. Zero
tabela nova, zero escrita nova.

### Condição de remoção do fallback ao Sheets

As três, juntas:

1. as 7 tabelas viradas há **30 dias corridos**;
2. `config.fallback_ultimo_em` **nulo ou anterior a 30 dias** para todas as 7 (§8.3 — query, não log);
3. o carimbo exercitado ao menos uma vez em produção (derrubar o Neon numa janela combinada e
   ver o carimbo aparecer).

Cumpridas as três, `lerX()` perde o ramo do Sheets. **Aí a Fase 3 vira decisão de custo, não de
risco** — que é onde ela deve ser tomada.

A `/api/ingest/paridade` continua lendo o gviz enquanto o n8n escrever no Sheets: ela é o portão,
não o caminho de leitura. É o último uso do gviz a morrer.

---

## 10. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/fonte.ts` | **novo** — as 8 `lerX()`, flag, fallback, alerta, carimbo |
| `src/lib/neon-reads.ts` | **novo** — SELECTs + **contrato de coerção do §3** |
| `src/lib/neon-reads.test.ts` | **novo** — teste hermético dos mappers (§7a) |
| `scripts/verificar-fonte.mjs` | **novo** — script de verificação (§7b) |
| `db/migrations/0005_config.sql` | **novo** — `config` + `fallback_ultimo_em` |
| `db/migrations/0006_agenda_fidelidade.sql` | **novo** — solta 2 FKs, +3 colunas denormalizadas (§4.3) |
| `src/lib/ingest/schema.ts`, `repo.ts` | agenda e classificação passam a gravar os campos novos |
| `src/lib/ingest/paridade.ts` | **hash de conteúdo por linha** (§5) + reapurar baselines de `leads` e `classificacao_ia` |
| `scripts/backfill-neon.mjs` | rerodar agenda + classificacao_ia depois da `0006` |
| **28 call sites** em 11 rotas | `fetchFromSheets('x')` → `lerX()`; `/api/resumo-diario` precisa da variante que devolve `null` |
| `src/lib/types.ts` | + `RawAgenda` (hoje a rota tipa `any`) |
| `src/lib/cache.ts` + `useDashboardData/useAgendaData/useEsforcoData` | chave por fonte, TTL do cliente para 5 min (§8.4) |
| `src/components/dashboard/ExecutiveDashboard.tsx` | badge Roxo=Neon (`:52`, `:323`) |
| `src/app/api/ingest/route.ts` | agenda ganha 2 campos |
| Vercel + n8n | `ALERTA_WEBHOOK_URL` + 1 webhook novo |

**Fora do escopo desta spec, mas antes dela:** corrigir os 3 deals e o `continueOnFail` (§1).

---

## 11. Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| Coerção de tipo errada zerando filtro/contador em silêncio | **alta** | é o §3 inteiro; teste hermético (§7a) é a defesa |
| Virar `deals` antes de resolver o §1 | alta se esquecido | `deals` é o 6º da ordem, com o §1 como pré-condição escrita |
| Portão verde certificando conteúdo errado | **já aconteceu** (§1) | hash por linha (§5) |
| Baseline de `leads`/`classificacao_ia` não reapurado travando a virada | alta | item explícito do §10 |
| Cache do cliente segurando número antigo por 30 min | média | §8.4 |
| Estado parcial no meio do cron | média | §8.5 |
| Volume de `ligacoes` estourando a função | **não verificado** | janela de data em `lerLigacoes()` (§8.6) |
| Alerta virar ruído | média | dedup de 1 h |

---

## 12. O que NÃO entra

- **Desligar a escrita no Sheets** — Fase 3, depois do §9.
- **Reescrever cálculo em SQL.** `computeMetrics`, `computeFarol` e `aggregateBaseInstalada`
  continuam em TypeScript. Mover dado e conta na mesma virada é perder a chance de saber qual
  dos dois quebrou.
- **Rechavear a dimensão `empresas` por CNPJ.** Faz sentido; é outra spec.
- **Corrigir os 3 deals e o `continueOnFail`** — precisa acontecer *antes*, e não como parte
  desta fase (§1).
