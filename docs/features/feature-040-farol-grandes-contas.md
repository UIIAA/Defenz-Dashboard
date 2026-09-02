# feature-040 — Farol: último dia com dado, Grandes Contas separadas, e o Francisco

> **v1 — 02/09/2026.** Spec-first: nada implementado.
> **Origem:** reunião de gestão de 31/08 (4 pedidos do Fernando) + pedido do Marcos de 02/09,
> encaminhados pela sessão Chief em [`docs/pedidos/2026-09-02-farol-e-grandes-contas.md`](../pedidos/2026-09-02-farol-e-grandes-contas.md).
> **Decisões do Marcos** tomadas em 01–02/09 estão marcadas como `[D-n]` e registradas no fim.

---

## O que foi medido antes de escrever

Todo número abaixo foi lido do Neon e do n8n em 02/09, não herdado do pedido. **Duas afirmações
do documento de origem não sobreviveram à medição.**

### ❌ "Os 39 cartões de Grandes Contas não têm temperatura automática hoje"

Falso. **Todos os 39 têm temperatura:**

| temperatura | n |
|---|---:|
| frio | 30 |
| quente | 6 |
| morno | 3 |
| *(sem classificação)* | **0** |

A **causa** que o Chief apontou está certa: confirmei no workflow `609dj477lHEPBX6J`
(`Defenz Temperatura Deals`, ativo) que o nó `Filtrar Pipe` lista só cinco estágios —
`Em negociação`, `Em Trial / POC`, `Reunião Técnica`, `Proposta Enviada`, `Proposta / Governo`.
**`Grandes Contas` não está lá.**

Mas a **conclusão** se inverte. O Chief sugeriu mostrar explicitamente que eles não têm
classificação, "em vez de deixar o cinza parecer que ninguém classificou". Não há cinza: há
**bolinha colorida congelada**. A temperatura veio junto na carga de 27/08 e **nenhuma rotina
volta nela**.

Isso é pior que a ausência. Cinza é honesto — diz "ninguém olhou". Trinta cartões marcados
"frio" por uma carga de lista, sem rotina por trás, **afundam no fim da ordenação para sempre**
e parecem uma leitura viva do negócio. **A tela tem que declarar a procedência dessa
temperatura.** É o requisito R2.4.

### ❌ "68 em tratativa, dos quais cerca de 30 são Grandes Contas"

| recorte | pedido | medido 02/09 |
|---|---:|---:|
| pipe aberto (o que `/oportunidades` mostra) | 68 | **67** |
| Grandes Contas | ~30 | **39** |
| demais — o recorte que o Fernando quer limpo | ~38 | **28** |

Os 67 saem da denylist do [`isAberto`](../../src/lib/oportunidades.ts) (não-fechado e não
`Contato Futuro`). O `68` da reunião era de 31/08; um negócio saiu desde então.

**Concordância útil:** os cinco estágios do farol do Chief somam **28** — exatamente o
"aberto menos Grandes Contas". Os dois lados da casa conciliam neste corte.

### ⚠️ O "53" do pedido 3 não foi reproduzido

Testei seis recortes contra o Neon. Nenhum dá 53:

| recorte | n |
|---|---:|
| aberto + `Contato Futuro` | 111 |
| aberto (`/oportunidades`) | 67 |
| `vendor 2` aberto | 46 |
| 5 estágios do farol · aberto sem Grandes Contas | 28 |
| aberto com `valor > 0` | 25 |

O diagnóstico do pedido 3 é do Chief (sai da f-037). Esta spec **entrega os números acima como
insumo** e não altera contagem nenhuma até o diagnóstico apontar o lado errado. Ver R3.

---

## Pedido 1 · A tela abre no último dia **com dado** `[D-1]`

**Hoje:** [`ResumoDiarioDashboard`](../../src/components/diario/ResumoDiarioDashboard.tsx) abre em
`{ kind: 'dia', data: todayBRT() }` — sempre o dia corrente.

**O que o Fernando pediu:** o padrão ser o último dia útil, com possibilidade de escolher a data.

**Por que a regra literal está errada agora.** A reclamação nasceu de abrir a tela e ver o dia
vazio — o `Snapshot Diário` só rodava às **17h50**. Em 31/08 subimos duas execuções novas,
**11h00 e 14h00** (nó `Cron 11h e 14h BRT` no workflow `aMhvdTP5aAi0Z1sf`). A partir das 11h de
um dia útil, **hoje tem dado**.

Com isso, "último dia útil" e "último dia com dado" divergem, e a regra literal passa a
**esconder o dia corrente** — justo o oposto do que o telão de acompanhamento precisa.

**Regra adotada:** a tela abre no **último dia que tem linha em `resumo_diario`**, que é:

- segunda 08h → **sexta** (é o que o Fernando pediu, pelo caminho certo)
- terça 12h → **terça**, parcial, com o carimbo de atualização à vista
- feriado ou fim de semana → o último dia útil com linha

O `floor` e a lista de dias disponíveis **já existem** na resposta de `/api/resumo-diario`
(`response.floor`, e `availableDates` em [`resumo-diario.ts`](../../src/lib/resumo-diario.ts)).
A mudança é de **seleção inicial**, não de dado: trocar `data: today` pelo maior dia disponível.

**Não muda:** o `DayNavigator`, os presets (`Hoje`, `Ontem`, `7 dias`, `30 dias`, `Este mês`) e a
escolha manual de data continuam iguais. O pedido de "possibilidade de escolher a data" já está
atendido hoje.

**R1.1** — a tela abre no maior dia presente em `resumo_diario`, nunca num dia sem linha.
**R1.2** — quando o dia aberto é o corrente e a linha está parcial (`coverage.partial_tracao`),
a tela mostra o horário de `atualizado_em`. Sem isso, um total menor lido de longe vira
"o time produziu pouco hoje".

---

## Pedido 2 · Grandes Contas: isolar **e** excluir `[D-2]`

**O que foi pedido, e são dois modos, não um:**

- Fernando: ver só o quente e o morno **comuns**, para tratar igual, sem Grandes Contas no meio.
- Marcos (02/09): poder filtrar **apenas por elas** e também **separá-las das demais**.

**Controle:** um segmentado de três estados, ao lado dos chips de temperatura que já existem.

```
[ Todas ]   [ Só Grandes Contas ]   [ Sem Grandes Contas ]
```

**Por que não mais um chip.** Os chips de hoje (`quente`, `morno`, `frio`, `vazio`) são **uma
dimensão só, com OU entre eles** — `filtros.has(...)` sobre um `Set`. Um chip "grandes contas" ali
faria `quente + grandes contas` significar *"quente **OU** grande conta"*, que não é o que
ninguém quer. Dimensão diferente pede controle diferente.

**R2.1** — os três estados compõem com os chips por **E**. "Só Grandes Contas" + "quente" = as
6 quentes do Francisco.
**R2.2** — `Só` + `Sem` somam exatamente `Todas`. Com os números de hoje: **39 + 28 = 67**.
**R2.3** — o agrupamento por posse que já existe (f-038) **não muda**. Não se aninha um segundo
nível de grupo; o segmentado filtra, os grupos continuam sendo a espinha da lista.
**R2.4** — no recorte "Só Grandes Contas", a tela declara a procedência da temperatura:
*"temperatura da carga de 27/08 — a rotina automática não cobre este estágio"*. Requisito que
nasce da medição acima, não do pedido.
**R2.5** — o cabeçalho do recorte **não estampa R$ 0**. Ver abaixo.

### O R$ 0 que vai parecer defeito

Os 39 têm **`valor = 0`**, todos. Pela regra canônica do repo, `valor` vem do `Amount` do Zoho —
então isso é **`Amount` vazio na origem**, não erro da tela.

Filtrar "Só Grandes Contas" hoje mostraria **R$ 0** como total e pareceria a tela quebrada.

**R2.5** — quando todos os itens visíveis têm `valor = 0`, o cabeçalho mostra a **contagem em
destaque** e, no lugar do total, **"valor não informado"**. Não se inventa valor, e não se
estampa um zero que mente sobre a natureza do problema.

O conserto de verdade é preencher o `Amount` no Zoho. **Fora do escopo desta spec** — é decisão
comercial de quanto vale cada uma dessas 39 contas.

---

## Pedido 3 · Conciliar o número com as outras telas

**Divisão de trabalho, como o Chief propôs:** o diagnóstico é dele (f-037); a correção fica em
quem estiver errado.

**R3.1** — esta spec **não altera nenhuma contagem** antes do diagnóstico. Mexer na conta sem
saber qual lado está errado é trocar um número errado por outro.
**R3.2** — os seis recortes medidos acima vão para o Chief como insumo.
**R3.3** — se o diagnóstico apontar para o Dashboard, a correção entra como **v2 desta spec**,
com o número certo e o motivo. Se apontar para o Chief, ele corrige lá.
**R3.4** — se os dois números forem legitimamente diferentes (recortes diferentes), a tela ganha
**uma linha dizendo por quê** — que é o critério de aceite que o próprio pedido admite.

**Aviso herdado, e vale:** o `GET /Deals` do Zoho já mordeu por paginação antes. Checar isso
antes de mexer na conta.

---

## Pedido 4 · Grandes Contas aparecem com o nome do Francisco `[D-3]` `[D-4]`

### O problema, medido

Os 39 negócios de Grandes Contas pertencem **todos** ao `owner_id 7067822000000576001` — a conta
genérica `suporte@defenz.com.br`, cujo nome no Zoho é literalmente `vendor 2`.

Esse mesmo id tem **mais 84 negócios fora de Grandes Contas**, e [`donos.ts`](../../src/lib/donos.ts)
mapeia o id inteiro para **"Leonardo"**.

**Trocar o mapa do id para Francisco levaria junto os 84 negócios do Leonardo.** É por isso que
mapear por `owner_id` não resolve — o `owner_id` está certo (é a conta que criou), mas **é
compartilhado por duas pessoas**.

### A divergência de recomendação, registrada

O documento do Chief recomenda **arrumar o dono no Zoho** e deixar a regra de exibição só como
rede de segurança.

**O Marcos decidiu o contrário `[D-3]`:** Francisco e Leonardo **dividem** a conta
`suporte@defenz.com.br`, e não haverá reatribuição no Zoho. A regra de exibição é a solução, não
o paliativo.

Fica registrado que a alternativa foi considerada e recusada, para ninguém reabrir isso achando
que passou batido. **Consequência aceita:** qualquer consumidor que conte negócios por
`owner_id` — fora desta tela — continua somando 39 cartões do Francisco na conta do Leonardo.
Esta spec conserta a **tela**, não o CRM.

### A marca é durável, não derivada do estágio `[D-4]`

A regra ingênua seria "estágio = Grandes Contas → dono = Francisco". **Ela quebra no momento em
que o negócio avança:** a VIVO esquenta, vai para `Reunião Técnica`, e no mesmo instante
**sai do filtro e troca de dono sozinha** — justamente quando mais importa.

Decisão do Marcos: **continua Grande Conta do Francisco.** Logo a marca é um campo próprio,
não uma leitura do estágio.

```sql
alter table deals add column if not exists grande_conta boolean not null default false;
```

**Quem marca é o próprio upsert da ingestão**, não um workflow novo:

```sql
-- no on conflict de `deals`
grande_conta = deals.grande_conta or excluded.grande_conta
```

O `excluded.grande_conta` vem de `stage = 'Grandes Contas'` na normalização. A marca **gruda**:
entrou uma vez, é Grande Conta para sempre. Semeadura = os 39 de hoje, no próximo cron. Sem nó
novo no n8n, sem rotina de manutenção, sem passo manual.

**Por que no Neon e não numa coluna da aba:** o nó `Sheets Deals` tem `continueOnFail: true` e
**descarta coluna ausente em silêncio** — o modo de falha que já custou R$ 19.962 em comissão
errada. Mesmo caminho de `temperatura`, `estado_negocio` e `vencimento_licenca`.

**Saída para erro:** limpar a marca é um `update` manual, documentado. Não se constrói UI de
desmarcar — YAGNI.

### A regra de exibição

[`nomeDono()`](../../src/lib/donos.ts) passa a receber a marca:

| id | grande conta? | mostra |
|---|---|---|
| `7067822000000576001` | sim | **Francisco** |
| `7067822000000576001` | não | Leonardo *(como hoje)* |
| `7067822000000743027` | — | Gustavo F *(como hoje)* |
| qualquer outro | — | nome cru do Zoho *(como hoje)* |

**R4.1** — a condição de remoção fica escrita no arquivo: **no dia em que o Francisco tiver
usuário próprio no Zoho e os negócios forem reatribuídos, esta regra sai.** Sem isso ela vira
mentira permanente — dois nomes para o mesmo id, sem ninguém lembrando por quê.

---

## Modelo de dado — resumo

| campo | onde | origem | dura? |
|---|---|---|---|
| `grande_conta` | `deals` (Neon), boolean | `stage = 'Grandes Contas'` na ingestão | **sticky**, sobrevive à mudança de estágio |
| `temperatura` | `deals` (Neon) | f-037 nos 5 estágios; **carga de 27/08** nas Grandes Contas | congelada nas Grandes Contas |
| `dono` (exibição) | calculado | `owner_id` + `grande_conta` | — |

`grande_conta` entra em `Oportunidade` e viaja até a tela pelo caminho que
[`oportunidades-fonte.ts`](../../src/lib/oportunidades-fonte.ts) já usa para os campos do Neon.

---

## Critérios de aceite

| # | critério |
|---|---|
| A1 | Abrir `/diario` numa segunda de manhã mostra **sexta**; numa terça às 12h mostra **terça**, com `atualizado_em` visível |
| A2 | `Só Grandes Contas` = 39 · `Sem Grandes Contas` = 28 · `Todas` = 67, e **39 + 28 = 67** |
| A3 | `Só Grandes Contas` + chip `quente` = **6** cartões |
| A4 | Os cartões de Grandes Contas mostram **Francisco**; a contagem do Leonardo cai em 39 |
| A5 | Um negócio movido de `Grandes Contas` para `Reunião Técnica` **continua** em `Só Grandes Contas` e **continua** com Francisco |
| A6 | O recorte `Só Grandes Contas` exibe a procedência da temperatura (R2.4) e **não estampa R$ 0** (R2.5) |
| A7 | Nenhuma contagem existente muda antes do diagnóstico do pedido 3 |

A5 é o critério que separa esta spec da versão ingênua. **Testar movendo um negócio de verdade.**

---

## Riscos

| risco | prob. | impacto | mitigação |
|---|---|---|---|
| Implementar a marca por estágio em vez de sticky | **alta** se A5 não for testado | negócio troca de dono ao avançar | A5 é critério de aceite explícito |
| Temperatura congelada passar por viva | **certa** hoje | 30 cartões afundam para sempre | R2.4 |
| R$ 0 lido como defeito da tela | alta | descrédito da tela | R2.5 |
| Regra do Francisco sobreviver à reatribuição no Zoho | média | dois donos para o mesmo negócio | R4.1 |
| Mexer na contagem antes do diagnóstico do p3 | média | troca um número errado por outro | R3.1 |
| Abrir sempre no "último dia útil" e esconder o dia corrente | alta se a regra literal for seguida | telão mostra ontem | D-1 |

---

## Fora de escopo, de propósito

- Preencher o `Amount` das 39 no Zoho — decisão comercial.
- Reatribuir dono no Zoho — recusado em `[D-3]`.
- Desmarcar Grande Conta pela UI, ou marcar sem passar pelo estágio.
- Agrupar a lista por carteira além da posse.
- Estender a f-037 para cobrir `Grandes Contas` — é workflow do Chief; **se for o desejado,
  pedir a ele** em vez de duplicar a leitura.

---

## Decisões registradas

| id | decisão | quem, quando |
|---|---|---|
| **D-1** | A tela abre no **último dia com dado**, não no último dia útil — a regra literal esconderia o dia corrente depois das leituras de 11h/14h | Marcos, 02/09 (tela) + derivação desta spec |
| **D-2** | Filtro de Grandes Contas em **três estados** (isolar / excluir / todas), não um chip | Marcos, 02/09 |
| **D-3** | Francisco e Leonardo **dividem** `suporte@defenz.com.br`. **Não** haverá reatribuição no Zoho — contra a recomendação do Chief, que fica registrada | Marcos, 02/09 |
| **D-4** | A marca de Grande Conta é **durável**: o negócio continua do Francisco e continua no filtro depois de avançar de estágio | Marcos, 02/09 |

---

# Crítica adversarial — 02/09/2026, com acesso às fontes

Rodada contra o Neon, o gviz da planilha e o n8n, logo depois de escrever a spec acima.
**Uma afirmação da própria spec caiu, uma foi confirmada por um caminho que eu não tinha
verificado, e apareceram três achados novos.**

## ✅ CONFIRMADO — os números batem, e nas duas fontes

Eu escrevi `67 / 39 / 28` **medindo só o Neon**. Mas `/oportunidades` **não lê o Neon para os
deals** — [`oportunidades-fonte.ts`](../../src/lib/oportunidades-fonte.ts) faz
`fetchFromSheets('deals')` e só busca no Neon os campos extras. **A evidência estava no lugar
errado quando eu escrevi.**

Medido agora na aba, aplicando a mesma regra do `isAberto`:

| recorte | aba | Neon |
|---|---:|---:|
| linhas | 309 | 309 |
| aberto | **67** | **67** |
| Grandes Contas | **39** | **39** |
| demais | **28** | **28** |
| Grandes Contas com `valor > 0` | **0** | **0** |

A conclusão sobrevive — mas por sorte, não por método. Fica a correção: **para esta tela, a
fonte a medir é a aba.**

## ❌ REFUTADO — "a mudança é de seleção inicial, não de dado"

Escrevi isso no pedido 1 e está errado. **Não dá para escolher o último dia com dado antes da
primeira resposta.**

O componente monta com `useState({ kind: 'dia', data: today })` e dispara
`useResumoDiario('data=' + today)`. A lista `datas_disponiveis` **existe** na resposta — mas
só chega **depois** do fetch que já foi feito com a data errada.

Trocar `data: today` pelo maior dia disponível é impossível no primeiro render. As saídas reais:

| opção | custo |
|---|---|
| **(a)** fetch com `today`, e ao ver `resumo === null` pular para `max(datas_disponiveis)` | dois fetches e **piscada de tela vazia** — exatamente o sintoma que o Fernando reclamou |
| **(b)** a rota aceitar `data=ultimo` e devolver o dia mais recente com linha | um fetch, sem piscada; muda a rota, não só o componente |

**Recomendação: (b).** É mais trabalho do que a spec dizia e precisa entrar no plano como tal.
R1.1 fica reescrito assim.

## ⚠️ ACHADO — os números se moveram entre duas medições no mesmo dia

Medi `deals` duas vezes hoje com algumas horas de diferença:

| | manhã | agora |
|---|---:|---:|
| linhas | 301 | **309** |
| `Proposta Enviada` | 12 | 10 |
| `Em negociação` | 1 | 3 |
| `Em Trial / POC` | 1 | **sumiu** |
| `E-Mail de Aceite Enviado` | 1 | **sumiu** |

Não é erro: é o cron sincronizando o Zoho. Mas **invalida critério de aceite escrito com número
fixo**. `39 / 28 / 67` é foto, não invariante.

**A2 fica valendo pela igualdade, não pelos números:** `Só + Sem = Todas`, sempre. Os três
números concretos servem para conferir no dia da implementação e nada além disso.

## ⚠️ ACHADO — a marca sticky não tem como errar para trás

`grande_conta = deals.grande_conta or excluded.grande_conta` é elegante e tem um custo que a
spec não declarou: **basta uma execução do cron com o negócio no estágio errado para marcá-lo
para sempre.** Alguém arrasta um negócio para `Grandes Contas` no Zoho por engano às 10h; o cron
das 12h marca; desfazer no Zoho **não desmarca**.

A spec já previa "limpar é `update` manual documentado" — mas tratava isso como saída de
exceção. Com o cron de 3× ao dia, a janela para o engano virar permanente é de no máximo
4 horas. **Não muda a decisão** (a alternativa, derivar do estágio, quebra o A5, que é o ponto
da feature), mas o `update` de correção precisa estar **escrito no plano de implementação**,
com o SQL pronto, não descrito como possibilidade.

## ⚠️ ACHADO — o `WHERE` do join vai engolir a marca

[`camposPorId()`](../../src/lib/oportunidades-fonte.ts) traz do Neon só as linhas que casam com:

```sql
where temperatura is not null and temperatura <> ''
   or estado_negocio is not null and estado_negocio <> ''
   or antivirus_atual is not null and antivirus_atual <> ''
   or vencimento_licenca is not null
   or owner_id is not null and owner_id <> ''
```

`grande_conta` **não está nessa lista**. Hoje isso não quebraria por acidente — todo deal tem
`owner_id` — mas é o mesmo padrão de falha silenciosa que já mordeu este projeto duas vezes
(coluna ausente descartada pelo `Sheets Deals`; campo fora do MAPEAMENTO chegando vazio ao Neon).

**Acrescentar `or grande_conta` ao `WHERE` faz parte da implementação**, não é detalhe.

## Veredito

A espinha da spec fica de pé: os três estados do filtro, a marca durável, a regra do Francisco
e a declaração de procedência da temperatura.

**O que muda no plano de implementação:**

1. R1.1 exige **mudança na rota** (`data=ultimo`), não só no componente.
2. A2 vira invariante, não número.
3. O SQL de correção da marca entra pronto no plano.
4. O `WHERE` do `camposPorId()` ganha `grande_conta`.
