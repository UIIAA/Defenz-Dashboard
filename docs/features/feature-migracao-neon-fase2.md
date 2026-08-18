# Spec — Fase 2: virar a leitura para o Neon

> **v2 — 2026-08-18.** Reescreve a v1 (proposta de 29/07) com o estado medido em produção.
> Continuação de [`feature-migracao-neon.md`](feature-migracao-neon.md) (Fase 1: escrita dupla,
> **em produção desde 01/08**).
>
> **Status: aprovada em 18/08/2026.** Aprovação do Marcos cobre §3.1 (soltar a FK da agenda),
> §5 (ordem invertida: `deals` e `ligacoes` por último) e §2.3 (alerta no chat da Operação).

## Objetivo

O dashboard passa a **ler exclusivamente do Neon**. O n8n **continua gravando nos dois** — o
Sheets sai do caminho de leitura, não do de escrita.

Sucesso não é "migrou": é **ninguém abrir o dashboard e notar diferença** — nem número, nem
lentidão, nem tela quebrada.

## Estado medido em produção — 2026-08-18

A escrita dupla está saudável e fresca (cron das 18h de 18/08 gravou nas 7 tabelas):

| tabela | Neon | Planilha | veredito |
|---|---:|---:|---|
| `deals` | 249 | 249 | ✅ idêntico |
| `ligacoes` | 16.633 | 16.633 | ✅ idêntico — o `call_id` fechou (Etapa B′) |
| `emails` | 4.102 | 4.102 | ✅ idêntico |
| `agenda` | 280 | 280 | ⚠️ contagem bate, **conteúdo não** (§3.1) |
| `resumo_diario` | 62 | 62 | ✅ idêntico |
| `leads` | 1.586 | 1.754 | ⚠️ −168 = **lead_id duplicado na aba** (§3.2) |
| `classificacao_ia` | 2.514 | 1.464 | ⚠️ +1.050 = **histórico append-only** (§3.3) |

Nenhuma das três ⚠️ é defeito da escrita dupla. Duas são diferença de modelo (o Neon é
normalizado, a aba é plana) e uma é qualidade de dado que o Neon já corrige. Mas **as três
mudam o resultado de um `SELECT *` ingênuo**, e é isso que esta spec resolve.

---

## 1. O adaptador — o que faz ninguém sentir

O contrato de dados **não muda**. As rotas hoje leem `RawDeal[]`, `RawCall[]`, `RawEmail[]`… e
entregam para `computeMetrics`, `computeFarol`, `aggregateBaseInstalada`. Se o Neon devolver
exatamente esses mesmos tipos, **nada acima da leitura precisa saber de onde veio**.

```
hoje:      route → fetchFromSheets('deals') → RawDeal[] → computeMetrics
fase 2:    route → lerDeals()               → RawDeal[] → computeMetrics
                     ├─ neon    (quando a flag ligar)
                     └─ sheets  (fallback, §2.2)
```

Módulo novo `src/lib/fonte.ts`, uma função por tabela:

| função | tipo de retorno | substitui |
|---|---|---|
| `lerDeals()` | `RawDeal[]` | `fetchFromSheets("deals")` |
| `lerLigacoes()` | `RawCall[]` | `fetchFromSheets("ligacoes")` |
| `lerEmails()` | `RawEmail[]` | `fetchFromSheets("emails")` |
| `lerLeads()` | `RawLead[]` | `fetchFromSheets("leads")` |
| `lerClassificacoes()` | `RawClassificacao[]` | `fetchFromSheets("classificacao_ia")` |
| `lerAgenda()` | `RawAgenda[]` *(tipo novo, §3.1)* | `fetchFromSheets("agenda")` |
| `lerResumoDiario()` | `RawResumoDiario[]` | `fetchTabStrict("resumo_diario", …)` |

As 11 rotas de API trocam a chamada por `lerX()` — **uma linha cada**. Nenhum componente,
nenhum hook, nenhum cálculo é tocado. É por isso que a virada não é sentida: **não existe
"versão Neon" da tela**.

Rotas afetadas: `dashboard-sheets`, `operational`, `esforco`, `agenda`, `metas`,
`base-instalada`, `ligacoes-serie`, `relatorio-mensal`, `faturamento-mensal`, `resumo-diario`,
`export/excel`.

**`ingest/paridade` NÃO muda.** Ela compara Neon × Sheets e precisa continuar lendo o gviz
direto, senão o portão passa a comparar o Neon com ele mesmo e vira sempre verde.

---

## 2. Flag, fallback e alerta

### 2.1 Flag por tabela, guardada no banco

Migration `0005_config.sql` — tabela `config (chave text primary key, valor text, atualizado_em
timestamptz)`. Chave `neon_read`, valor = lista separada por vírgula: `emails,leads`.

**Por que no banco e não em env var:** env var na Vercel exige redeploy pra voltar atrás. Um
`update` no `config` volta em segundos, e quem precisa reverter às 19h de uma sexta não deveria
depender de build.

Cache da flag: **60 s em memória**. Reverter leva no máximo 1 minuto, zero redeploy.

**O cache das rotas passa a ser chaveado por fonte** (`deals:neon` × `deals:sheets`). Sem isso
você vira a flag e continua servindo o dado antigo por até 30 min, e conclui errado que a
virada não funcionou.

### 2.2 Fallback — decisão explícita e temporária

Falha na leitura do Neon (erro, timeout > 8 s, resultado vazio numa tabela que nunca é vazia)
→ `lerX()` cai pro Sheets, devolve o dado e sinaliza.

Isto é **andaime, não arquitetura.** A condição de remoção está em §8. O fallback existe porque
durante a Fase 2 o Sheets continua escrito e vivo — então ele é grátis. No dia em que a Fase 3
desligar a escrita, o fallback deixa de ser possível **e deixa de ser necessário** pelo mesmo
motivo. §8 descreve o que ocupa o lugar dele.

### 2.3 Alerta ativo

Ao cair no fallback, `POST $ALERTA_WEBHOOK_URL` (env var nova) → webhook novo no n8n → chat da
Operação no Teams. Payload: tabela, mensagem do erro, horário, rota que pediu.

**Deduplicação de 1 h por tabela**, senão um Neon instável vira 200 mensagens no chat e o time
aprende a ignorar o alerta — que é o pior resultado possível.

Badge de fonte no cabeçalho reaproveita o padrão que já existe (Azul=Cache, Verde=Planilha,
Amarelo=N8N, Cinza=Mock) e ganha **Roxo=Neon**. Com a flag ligada, ver "Planilha" na tela
significa que o fallback disparou — é o alerta visual, redundante com o do Teams de propósito.

---

## 3. As armadilhas de forma — onde um `SELECT *` mente

Este é o miolo da revisão. O Neon **não é uma cópia da aba**: é um modelo normalizado, e três
tabelas exigem conserto **antes** de poderem ser lidas.

### 3.1 `agenda` — BLOQUEANTE, e o conserto é na ingestão

**Medido em 18/08: 146 das 280 tarefas (52%) estão no Neon com `lead_id` nulo.** A FK
`agenda_tarefas.lead_id → leads(lead_id)` com `on delete set null` descarta o lead_id de toda
tarefa cujo lead não está na tabela `leads`. A aba tem esse lead_id.

Pior: `agenda_tarefas` **não tem** as colunas `lead_name` e `empresa`, que a rota
`/api/agenda` lê e exibe. Hoje elas viriam de um JOIN — que para 52% das linhas devolveria nulo.

Ler agenda do Neon hoje devolveria **metade das tarefas sem lead, sem nome e sem empresa**.
Isso é sentido na hora.

**Conserto (aprovado):**

```sql
-- 0006_agenda_fidelidade.sql
alter table agenda_tarefas drop constraint if exists agenda_tarefas_lead_id_fkey;
alter table agenda_tarefas add column if not exists lead_nome   text;
alter table agenda_tarefas add column if not exists empresa_nome text;
```

`lead_id` vira texto puro sem FK. A restrição do banco estava apagando dado que a origem tem —
uma garantia que custa mais do que entrega. `lead_nome` e `empresa_nome` passam a ser gravados
denormalizados, como a aba já faz.

**Isto exige mexer em `src/lib/ingest/schema.ts` e `repo.ts`** (a agenda passa a consumir 2
campos a mais) e **rodar o backfill de agenda** para preencher as 280 linhas existentes.
A Fase 2 não é só leitura — reconhecer isso é metade da spec.

### 3.2 `leads` — não é bug, e não muda nada na tela

Os 168 são **lead_id duplicado na aba** (1.754 linhas, 1.586 ids distintos, **zero vazio** —
medido). O Neon tem PK e colapsa. **O Neon está certo.**

Verificado que isso não aparece em lugar nenhum: `correlateLeads` (`src/lib/correlate.ts:41`)
indexa lead por telefone e e-mail em `Map`s com semântica last-wins — linha duplicada
sobrescreve a chave com o **mesmo** lead_id. Nenhuma métrica conta `leads.length`.

**Decisão: nada a fazer.** Registrar no atestado de virada que a contagem cai de 1.754 para
1.586 e que isso é correção, não perda.

### 3.3 `classificacao_ia` — append-only de propósito

O Neon guarda o histórico de reclassificação do mesmo lead (`unique (lead_id,
data_classificacao)`); a aba guarda só a última. Ler direto **inflaria o esforço IA em 72%**.

```sql
select distinct on (c.lead_id)
       c.lead_id, l.nome as lead_name, c.data_classificacao, c.nivel_maximo, …
  from classificacoes_ia c
  left join leads l on l.lead_id = c.lead_id
 order by c.lead_id, c.data_classificacao desc
```

O `left join leads` recompõe `lead_name`, que a tabela de classificação não guarda.

**Perda residual medida: 1.295 leads distintos no Neon × 1.297 na aba** — 2 leads cujas
classificações foram rejeitadas na ingestão pela FK `classificacoes_ia.lead_id → leads`, mesma
causa da agenda. É 0,15% e não bloqueia, mas **entra no mesmo conserto da §3.1**: soltar a FK
e passar a gravar `lead_nome` denormalizado. Corrigir os dois juntos custa uma migration só.

### 3.4 `deals` e `ligacoes` — dimensões viraram FK

`deals.empresa` → `empresa_id`, `ligacoes.agente` → `agente_id`. Os SELECTs usam
`left join empresas` / `left join pessoas` devolvendo `nome_exibicao`.

`deals.empresa` está vazio em 100% dos deals (`Account_Name` nunca preenchido no Zoho) — então
o join devolve vazio, que é **exatamente o que a aba devolve hoje**. Fidelidade preservada por
acidente feliz. O `cnpj` (217 de 249 deals preenchidos) está na coluna própria desde a
migration `0004`.

Datas: o Postgres devolve `date`/`time`; os tipos `Raw*` esperam string `YYYY-MM-DD` e `HH:MM:SS`.
O adaptador serializa explicitamente — **nunca** via `toISOString()`, que aplica UTC e desloca
o dia em -3h. Este é o modo de falha mais provável da fase inteira.

### 3.5 `resumo_diario` — jsonb desdobrado

Seis colunas `*_por_vendedor` da aba foram colapsadas no jsonb `por_vendedor`
(`{ligacoes:{…}, emails:{…}, apresentacoes:{…}, propostas:{…}, reuniao:{…}}`) e os dois
`destaque_*` no jsonb `destaques`. O fold é lossless (verificado em `sql.integration.test.ts:186`),
então desdobrar é determinístico.

Cuidado com os escalares: no resumo diário `0` = capturado e é zero, `null` = **não capturado**
(a UI mostra "—"). O adaptador não pode coagir `null` para `0` — destruiria a distinção.

### 3.6 `reunioes` — fora de escopo, e não é omissão

A aba `reunioes` **não existe**. O gviz devolve a aba 0 (`ligacoes`) disfarçada para qualquer
nome inexistente — por isso `fetchTabStrict` existe. O caminho vivo hoje é o fallback
`[REUNIAO]` em `deals.resultados`, que não passa por esta migração e não muda.

---

## 4. Critério de virada, por tabela

Uma tabela só vira quando, **ao mesmo tempo**:

1. `GET /api/ingest/paridade?tabela=X` verde por **7 dias corridos**;
2. o teste de equivalência (§7) passa para aquela tabela;
3. a query do Neon responde **mais rápido** que o gviz equivalente, medido no mesmo dia.
   Se for mais lenta, o time sente — e isso é motivo de não virar, não de virar e otimizar depois.

---

## 5. Ordem de virada

Uma por dia útil, de manhã (nunca sexta à tarde).

1. **`emails`** — a mais simples, sem FK, sem dimensão, sem armadilha. É o teste do adaptador.
2. **`leads`** — verde, alimenta a correlação; a diferença de contagem é conhecida e inócua (§3.2).
3. **`agenda`** — só depois do conserto da §3.1 aplicado e do backfill rodado.
4. **`resumo_diario`** — exercita o desdobramento de jsonb (§3.5).
5. **`deals`** — receita, farol, base instalada. Vira sozinha, sem nenhuma outra mudança no dia.
6. **`ligacoes`** — maior volume (16,6 mil); é aqui que o Neon ganha do gviz de verdade.
7. **`classificacao_ia`** — por último: é a que tem o SELECT mais diferente da aba (§3.3).

**Inversão consciente em relação à v1**, que colocava `deals` em 3º. `deals` e `ligacoes` são a
receita e o volume: viram depois que quatro tabelas já provaram o adaptador em produção.

---

## 6. O que NÃO entra nesta fase

- **Desligar ou reduzir a escrita no Sheets** — Fase 3, spec própria (§8).
- **Reescrever cálculo em SQL.** `computeMetrics`, `computeFarol` e `aggregateBaseInstalada`
  continuam em TypeScript. O Neon substitui a **origem das linhas**, nada mais. Mover dado e
  conta na mesma virada é perder a chance de saber qual dos dois quebrou.
- **Rechavear a dimensão `empresas` por CNPJ.** Faz sentido, é outra spec.
- **Qualquer mudança na planilha ou no layout das abas.**

---

## 7. Teste — um só, e é o que sustenta a fase inteira

**A mesma linha, lida das duas fontes, produz o mesmo objeto.**

```ts
// src/lib/fonte.test.ts
it.each(TABELAS)('%s: neon e sheets produzem o mesmo objeto', async (tabela) => {
  const doSheets = await lerVia('sheets', tabela);
  const doNeon   = await lerVia('neon',   tabela);
  expect(ordenar(doNeon)).toEqual(ordenar(doSheets));
});
```

Com as exceções da §3 declaradas explicitamente no teste (leads deduplicado, classificação
última-por-lead) — **declaradas, não silenciadas**: cada exceção é uma linha nomeada no teste
com o motivo, igual ao baseline da paridade. Divergência fora dessas exceções é falha.

Se isso vale para as 7 tabelas, a virada é segura por construção.

Complementos: teste de serialização de data/hora (§3.4) com fixture em fuso -03:00; teste de
`null` × `0` no `resumo_diario` (§3.5); teste de que o fallback dispara o alerta uma vez por
hora, não uma vez por request.

---

## 8. A saída do fallback — a solução definitiva

O fallback ao Sheets é **andaime com prazo**. Manter duas fontes de leitura para sempre é
carregar dois modelos de dado, dois modos de falha e a dúvida permanente de qual número está
na tela. Isso não é o destino.

### O destino

```
hoje:        Neon → (falhou) → Sheets → (falhou) → erro
definitivo:  Neon → (falhou) → último snapshot bom, carimbado → (falhou) → erro
```

A resiliência deixa de vir de **uma segunda fonte** e passa a vir do **último dado bom**. Em vez
de responder com um número que veio de outro lugar sem avisar, o dashboard responde com o número
que ele tinha às 06:00, dizendo na tela que é das 06:00. Isso é honesto, não depende do Sheets, e
sobrevive à Fase 3 — enquanto o fallback ao Sheets, por construção, não sobrevive.

Implementação: tabela `leitura_cache (tabela text primary key, payload jsonb, capturado_em
timestamptz)`, gravada a cada leitura bem-sucedida. Serve como `stale-while-error` com badge
"dado de HH:MM" no cabeçalho. Cabe em uma sessão.

### Condição de remoção do fallback ao Sheets

As três, juntas:

1. as 7 tabelas viradas há **30 dias corridos**;
2. **zero disparo** de alerta de fallback nesses 30 dias (o contador é o próprio log do §2.3);
3. `leitura_cache` implementado e exercitado ao menos uma vez em produção (derrubar o Neon de
   propósito numa janela combinada, ver o carimbo aparecer).

Cumpridas as três, `lerX()` perde o ramo do Sheets e `src/lib/sheets.ts` fica usado só pela
`/api/ingest/paridade`. **Aí a Fase 3 (desligar a escrita no Sheets) passa a ser uma decisão de
custo, não de risco** — que é exatamente onde ela deve ser tomada.

### O que fica para trás de propósito

A `/api/ingest/paridade` **continua lendo o gviz** enquanto o n8n escrever no Sheets. Ela é o
portão, não o caminho de leitura. Quando a Fase 3 desligar a escrita, a paridade perde a função
e sai junto — é o último uso do gviz a morrer.

---

## 9. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/fonte.ts` | **novo** — as 7 funções `lerX()`, leitura da flag, fallback, alerta |
| `src/lib/fonte.test.ts` | **novo** — o teste de equivalência (§7) |
| `src/lib/neon-reads.ts` | **novo** — os SELECTs que devolvem `RawDeal[]` etc. (separado de `fonte.ts` para o teste conseguir ler uma fonte só) |
| `db/migrations/0005_config.sql` | **novo** — tabela `config` |
| `db/migrations/0006_agenda_fidelidade.sql` | **novo** — solta a FK, adiciona `lead_nome`/`empresa_nome` (§3.1) |
| `src/lib/ingest/schema.ts`, `repo.ts` | agenda e classificação passam a consumir os campos denormalizados |
| `scripts/backfill-neon.mjs` | rerodar agenda + classificacao_ia depois da `0006` |
| 11 rotas de API | trocam `fetchFromSheets('x')` por `lerX()` — uma linha cada |
| `src/lib/types.ts` | + `RawAgenda` (hoje a rota tipa `any`) |
| `next.config.ts` / Vercel | + `ALERTA_WEBHOOK_URL` |
| n8n | + 1 webhook novo → chat da Operação no Teams |

---

## 10. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Data deslocada em -3h por `toISOString()` | **alta** — é o erro mais comum desta classe | serialização explícita + teste com fixture em -03:00 (§3.4) |
| Agenda virada antes do conserto da §3.1 | média | a ordem (§5) põe agenda em 3º, depois da migration; o teste de equivalência falha se tentar antes |
| Query do Neon mais lenta que o gviz numa tabela grande | média | critério 3 do §4 bloqueia a virada; índices já existem em `ligacoes(data)` e `deals(closing_date)` |
| Cache de 30 min mascarar a virada | média | cache chaveado por fonte (§2.1) |
| Alerta virar ruído e ser ignorado | média | dedup de 1 h por tabela (§2.3) |
| Fallback silencioso esconder Neon quebrado por semanas | **é o motivo do §2.3 existir** | alerta ativo + badge Roxo/Verde + condição de remoção com contador (§8) |
| `classificacao_ia` sem `distinct on` inflar o esforço IA em 72% | alta se esquecido | é a última a virar e tem teste de contagem próprio |

---

## 11. Pendências herdadas da Fase 1 — status em 18/08

| Pendência da v1 | Status |
|---|---|
| credencial `Defenz Ingest Token` no n8n | ✅ resolvida (id `rlG7M3kzpO7S5OTE`) |
| deploy da branch com `/api/ingest` | ✅ em produção desde 01/08 |
| `call_id` colidindo e sobrescrevendo ligações | ✅ resolvido pela Etapa B′ — 16.633 = 16.633 |
| `empresa` vazia em 100% dos deals | ✅ contornado pelo CNPJ (migration `0004`, 217/249) |
| 145 tarefas de agenda órfãs | ❌ **agora é bloqueante** e virou §3.1 (medido: 146) |
