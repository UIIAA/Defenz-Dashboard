# Spec — Reuniões lidas do calendário, e a saída definitiva do Sheets

> **v1 — 29/08/2026.** Decisões do Marcos nesta data. Nada implementado.
> Depende de [`feature-migracao-neon-fase2.md`](feature-migracao-neon-fase2.md) (v3, aprovada em
> 18/08, não implementada) — esta spec **não reescreve** aquela: acrescenta a fonte que faltava e
> fixa a sequência de saída do Sheets.

## Objetivo

Duas coisas que o Marcos decidiu juntas em 29/08 porque uma destrava a outra:

1. **Reuniões passam a vir do calendário das pessoas**, lidas do Microsoft Graph — do dia e até
   **7 dias à frente**.
2. **O dashboard sai do Google Sheets completamente**, leitura e escrita.

A ordem importa e não é a intuitiva: **o Sheets é o que torna a cadência cara**. Enquanto ele
estiver no caminho de escrita, rodar de hora em hora triplica a reescrita da aba de leads. Sem
ele, escrever no Neon é upsert idempotente e a cadência deixa de ser uma decisão.

## O que ainda prende ao Sheets — inventário medido em 29/08

O dashboard lê **9 abas**. Todas já existem no Neon com dado atual, **menos uma**:

| aba | Neon | observação |
|---|---|---|
| deals, ligacoes, emails, leads, agenda, classificacao_ia, resumo_diario | ✅ | escrita dupla desde 01/08 |
| **reunioes** | ❌ | nunca ingerida — é o objeto desta spec |

Fora deste repositório, **nenhum código lê a planilha**: o id `1roirh1RRFg8…` foi procurado em
todos os projetos da Defenz e só aparece aqui. **Confirmado pelo Marcos em 29/08: nenhuma pessoa
abre a planilha.** Não há consumidor humano a preservar.

O bloqueio real, já documentado na Fase 2 §3, não é o dado: é **o contrato de tipo**. O gviz
devolve tudo como string; o Neon devolve `Date`, `boolean`, `number`. Trocar a fonte sem
adaptador não dá erro — dá número errado, em silêncio.

---

## Parte 1 — Reuniões do calendário

### O acesso já existe

Testado em 29/08 com a credencial que já está no n8n (`microsoftOutlookOAuth2Api`
`tuFzJdPvNnOt3TD3`): `GET /users/{upn}/calendarView` devolveu **HTTP 200** para a caixa de outra
pessoa. Nenhuma permissão nova é necessária.

```
GET https://graph.microsoft.com/v1.0/users/{upn}/calendarView
  ?startDateTime={inicio}&endDateTime={fim}
  &$select=iCalUId,subject,start,end,organizer,attendees,isCancelled,showAs,isAllDay
  &$top=100
```

Cabeçalho `Prefer: outlook.timezone="America/Sao_Paulo"` — sem ele o Graph devolve
`timeZone: "UTC"` no `start`/`end`, como foi observado na medição.

### Janela: passado curto, futuro de 7 dias

Decisão do Marcos: ler **o dia e até 7 dias inteiros à frente**.

```
inicio = hoje − 1 dia   (retrolook, mesma disciplina da coleta incremental)
fim    = hoje + 7 dias
```

Isso muda a natureza da tabela: ela deixa de ser só registro do que aconteceu e passa a conter
**compromisso futuro**. A métrica precisa separar os dois — ver §Estado.

### A convenção `<>` não cobre a realidade — medido

A regra documentada hoje é "o assunto tem que conter `<>`". Nos **5 primeiros eventos** da janela
24/08–05/09 na agenda do Gustavo Figueira:

| assunto | tem `<>`? | é reunião de cliente? |
|---|---|---|
| `Cancelado: Reunião Comercial e Alinhamento de POC \| Rebouças Supermercados` | não | **cancelada** |
| `Reunião Defenz <> Compwire Informática` | sim | sim |
| `Reunião Bitdefender \| Lauto` | **não** | **sim** |
| `Reunião Renovação e MDR Wintress <> Defenz - Bitdefender` | sim | sim |
| `Reunião setup Defenz - Bitdefender <> Plasduran` | sim | pós-venda, não comercial |

A convenção pega 3 de 5 e erra nos dois sentidos — exatamente o padrão já encontrado nas
propostas. **`<>` não pode ser a regra.**

### A regra: participante externo, não texto no assunto

```
é reunião de cliente quando:
    isCancelled = false
AND isAllDay    = false
AND showAs NOT IN ('free')
AND existe participante fora de @defenz.com.br e fora de domínio de parceiro
```

O sinal é **quem está na sala**, não como alguém escreveu o título. É o mesmo princípio que
resolveu as propostas: o ato, não o relato.

`showAs = 'free'` sai porque bloqueio de agenda marcado como livre não é compromisso.
Domínio de parceiro (securisoft.com.br) sai da definição de "externo" pelo mesmo motivo das
propostas: o Miller participa de reunião interna e não é cliente.

### Identidade: `iCalUId`, nunca `id`

**Este é o ponto que quebra a implementação ingênua.** A mesma reunião aparece no calendário de
todos os participantes. Lendo 4 caixas, ela chega 4 vezes — e o campo `id` é **por caixa**, então
deduplicar por `id` não deduplica nada: geraria 4 linhas para uma reunião.

`iCalUId` é estável entre caixas. É a chave natural da tabela.

Consequência que precisa ser decidida junto: **quem "fez" a reunião**. A spec adota o
`organizer`, não a caixa onde a linha foi lida. Os participantes internos ficam guardados para
atribuição de esforço, do mesmo jeito que `por_remetente` nas propostas.

### Estado: agendada × realizada

| estado | condição |
|---|---|
| `agendada` | `start` no futuro |
| `realizada` | `start` no passado e não cancelada |
| `cancelada` | `isCancelled = true` |

Cancelada **é gravada**, não descartada — sumir com ela impede responder "quantas reuniões
caíram esta semana", que é um sinal de saúde do pipe. Só não conta na métrica.

⚠️ **Uma reunião muda de estado sozinha com o tempo.** `realizada` não é um fato coletado, é
`start < agora` avaliado na leitura. Não gravar o estado como coluna congelada — derivar sempre.

### Tabela

```sql
create table if not exists reunioes (
  ical_uid          text primary key,
  assunto           text,
  inicio            timestamptz not null,
  fim               timestamptz,
  organizador       text not null,
  participantes_internos text[] not null default '{}',
  participantes_externos text[] not null default '{}',
  dominios_cliente  text[] not null default '{}',
  cancelada         boolean not null default false,
  dia_inteiro       boolean not null default false,
  mostrar_como      text,
  eh_reuniao_cliente boolean not null default false,
  motivo_revisao    text,
  ingerido_em       timestamptz not null default now()
);

create index if not exists reunioes_inicio_idx on reunioes (inicio desc);
create index if not exists reunioes_cliente_idx on reunioes (inicio desc) where eh_reuniao_cliente;
```

Upsert por `ical_uid`. Reunião remarcada reescreve a mesma linha — é a mesma reunião.

### Falha ruidosa

Mesma disciplina das propostas, porque o modo de falha deste projeto é perder dado em silêncio:

1. **Quase-reunião** — evento com participante externo que a regra descartou (por `showAs`, por
   `isAllDay`) fica com `motivo_revisao` preenchido. É assim que a próxima mudança de hábito
   aparece antes de virar buraco.
2. **Coleta zerada** — calendário que devolve zero evento em dia útil é alerta, não silêncio.

### O que acontece com a aba `reunioes`

Ela **não é recriada**. A fonte nova nasce direto no Neon — é a primeira tabela que nunca passa
pelo Sheets, e o portão de paridade a ignora de propósito (mesmo tratamento já dado a
`emails_enviados`).

O fallback atual em `computeMetrics` (derivar reunião de `[REUNIAO]` em `deals.resultados`)
**continua existindo** até a Fase 2 virar a leitura. A tag teve **4 ocorrências no mês inteiro** —
é um fallback ruim, e o calendário existe justamente para aposentá-lo.

---

## Parte 2 — A sequência de saída do Sheets (aprovada em 29/08)

| passo | o que é | estado |
|---|---|---|
| **1** | Adaptador de tipo (Fase 2 §3) + tabela `reunioes` | **é o único trabalho de verdade** |
| **2** | Dashboard lê do Neon; Sheets continua sendo escrito em paralelo | rede de segurança |
| **3** | Uma semana comparando; se fechar, desliga a escrita no Sheets | portão |
| **4** | Cron de hora em hora, run único, sem separar ramos | de graça a essa altura |

### Por que o passo 4 fica barato

A proposta anterior era cadência por entidade — fatos de hora em hora, dimensões 2×/dia — para
não triplicar a escrita no Sheets (a aba de leads é reescrita inteira, 1.587 linhas, a cada
execução). **Sem Sheets, essa restrição não existe**: upsert por chave natural no Neon custa
menos de um segundo e reescrever dado idêntico não tem efeito.

**Decisão registrada: não implementar cadência por entidade.** Seria trabalho para contornar uma
restrição que o passo 3 remove.

### Cadência final

`0 10-12,14-18 * * 1-5` no fuso do n8n (UTC-3), mais a execução das 6h que já existe. Oito
execuções em dia útil, run único.

### O que a saída do Sheets conserta de brinde

- **`continueOnFail: true` no nó `Sheets Deals`** — a causa dos R$ 19.962 errados na comissão de
  agosto (Fase 2 §1). Some com o nó.
- Um caminho de escrita a menos onde o dado pode divergir de si mesmo.

### O que ela NÃO conserta

- **`appendOrUpdate` nunca apaga.** O negócio `TESTE MCP - ignorar` (id `7067822000006619001`)
  foi removido do Zoho e continua no Neon **e** na aba, no estágio `Proposta Enviada`, inflando
  "Cliente com proposta" de 11 para 12. O Neon herda o órfão. Precisa de uma varredura de
  reconciliação — **fora do escopo desta spec**, mas não pode ser esquecido.

---

## Riscos

| risco | probabilidade | impacto | mitigação |
|---|---|---|---|
| Deduplicar por `id` em vez de `iCalUId` | **alta** se ninguém ler esta spec | reunião contada 4× | chave primária é `ical_uid`; teste com evento multi-caixa |
| Adaptador de tipo incompleto | alta | número errado em silêncio | Fase 2 §3; teste hermético por tipo |
| Reunião interna contada como cliente | média | infla o funil | regra por participante externo + exclusão de parceiro |
| Evento futuro contado como realizado | **certa se o estado for gravado** | funil inflado | estado derivado na leitura, nunca coluna |
| Portão de paridade cego | conhecida | cutover com divergência invisível | Fase 2 §5 |

## Critério de pronto

**Passo 1** — a tabela `reunioes` tem 7 dias de coleta sem furo, e a lista de quase-reuniões é
explicável item a item.

**Passo 3** — uma semana com os dois números lado a lado e **cada** divergência com explicação.
Não "os totais batem": contagem igual ≠ conteúdo igual, e o portão atual já ficou verde
carregando R$ 19.962 de erro.

## Decisões registradas (Marcos, 29/08/2026)

- Sair do Sheets **completamente**, leitura e escrita.
- Ninguém abre a planilha na mão — não há consumidor humano a preservar.
- Reuniões vêm do **calendário das pessoas**, dia + 7 dias à frente.
- **Não** fazer cadência por entidade.
- Cron de hora em hora, 10–12 e 14–18, dias úteis.

---

# Crítica adversarial — 29/08/2026, com acesso às fontes

Rodada contra o Neon, o Microsoft Graph e o repositório, logo depois de escrever a spec acima.
**Seis afirmações da própria spec foram testadas. Duas caíram, uma foi confirmada, três viraram
achado novo.**

## ✅ CONFIRMADO — `iCalUId` é estável entre caixas

A afirmação central da spec. Testada com o mesmo evento em duas agendas:

```
Reunião Defenz <> Compwire Informática (26/08)
  agenda do Gustavo:  id = AAMkADhhYTcz...AADIXKwZAAA=
  agenda do Marcos:   id = AAMkADEwMDM0...AADnNSqMAAA=      ← id DIFERENTE
  ambos:           iCalUId = 040000...96600D82C532A24684A7FAD98963C17C   ← IGUAL
```

Deduplicar por `id` produziria 4 linhas para 1 reunião. `ical_uid` como chave primária está
correto.

## ❌ REFUTADO — "todas as abas já existem no Neon **com dado atual**"

Falso para **2 de 7**. Medido no Neon em 29/08:

| tabela | última ingestão | situação |
|---|---|---|
| deals, ligacoes, leads, agenda | 29/08 | ok |
| resumo_diario | 28/08 | ok |
| **emails (Apollo)** | 26/08, com dado mais recente de **18/08** | **11 dias sem linha nova** |
| **classificacoes_ia** | **13/08** | **16 dias parada** — o nó de ingest está desabilitado e o ramo de IA foi desligado em 12/08 |

Consequência séria: virar a leitura para o Neon hoje faz duas métricas passarem a ler tabela
congelada — **e nada avisa**. A spec precisa de uma decisão explícita para cada uma: reativar a
coleta, ou aposentar a métrica. Deixar como está é escolher o pior dos dois em silêncio.

## ❌ REFUTADO — "nenhum código lê a planilha"

A evidência era incompleta e eu apresentei como conclusiva. Eu procurei o id da planilha **nos
repositórios locais**. Mas **os workflows do n8n não estão em repositório nenhum** — e é
exatamente lá que vivem os nós `googleSheets`. O snapshot diário, o Chief e o Autopilot podem ler
a aba, e isso **não foi verificado**.

Esta é a afirmação que mais compromete o passo 3 (desligar a escrita). Desligar o Sheets com um
consumidor invisível quebra algo que ninguém vai relacionar à causa.

**Ação obrigatória antes do passo 3:** varrer todos os workflows ativos do n8n por nós
`n8n-nodes-base.googleSheets` apontando para `1roirh1RRFg8…`, e listar quem lê versus quem
escreve.

## ⚠️ ACHADO NOVO — a spec subtratou privacidade de calendário

A leitura de e-mail foi restrita a "só enviados, só metadado" justamente para não varrer coisa
pessoal. **O calendário não tem esse recorte.** Na agenda do Marcos, na janela testada,
aparecem `Almoço` e `Sheila` — compromissos pessoais, com título legível.

A spec manda gravar `assunto` de todo evento coletado. Isso põe agenda pessoal no banco.

**Correção necessária:** gravar `assunto` **apenas** quando houver participante externo. Evento
sem externo entra como linha anônima (data, duração, dono) ou não entra. O contador de "quase-
reunião" continua funcionando sem o título.

## ⚠️ ACHADO NOVO — série recorrente NÃO colapsa, mas remarcação duplica

Eu levantei o risco de o `iCalUId` ser o mesmo para todas as ocorrências de uma série — o que
faria 20 ocorrências virarem 1 linha. **Medido: o risco não existe.** As cinco ocorrências de
`Reunião Diária - Pipeline Review` (24 a 28/08) têm `iCalUId` distintos, diferindo em poucos
bytes que codificam a data:

```
24/08 ...07EA0818D24C4278E6FFDC01...
25/08 ...07EA0819D24C4278E6FFDC01...
26/08 ...07EA081AD24C4278E6FFDC01...
```

**Mas isso cria um risco menor e real:** como a data está dentro da chave, **mover uma ocorrência
para outro dia gera um `iCalUId` novo** — a linha antiga fica órfã e a reunião conta duas vezes.
Mitigação: para `type = 'occurrence'`, reconciliar por `seriesMasterId` + dia antes do upsert.

## ⚠️ ACHADO NOVO — a regra por participante externo tem um furo não medido

A spec troca `<>` por "tem participante externo" com confiança. Mas **não medi quantas reuniões
de cliente realmente convidam o cliente**. O vendedor que cria um bloco na própria agenda e liga
para o cliente não tem participante externo — e some da métrica.

Sinais de que isso acontece na base: o evento de 27/08 na agenda do Marcos com assunto
literalmente `"Reunião "` (sem cliente no título) e a `REUNIAO TECNICA - PHASR - TIME 4º Oficial`
sem `<>`.

**Medição que falta antes de implementar:** na janela de 30 dias, quantos eventos com "reuni" no
assunto têm participante externo? Se for menos de ~80%, a regra por participante precisa de um
segundo sinal, e volta a discussão que a spec deu por encerrada.

## 🔧 ERRO MENOR — a spec se contradiz na contagem de execuções

Diz "**oito** execuções em dia útil" e, na linha anterior, "`0 10-12,14-18` **mais a execução das
6h**". São **nove**. Corrigir para nove ou tirar a das 6h explicitamente.

---

## Veredito

A espinha da spec sobrevive: `iCalUId`, regra por participante e sequência de saída do Sheets
estão de pé. Mas ela **não está pronta para implementar** enquanto:

1. a varredura dos workflows do n8n não disser quem mais lê a planilha;
2. `emails` e `classificacoes_ia` não tiverem decisão explícita (reativar ou aposentar);
3. a medição de "quantas reuniões de cliente convidam o cliente" não existir;
4. a regra de privacidade do `assunto` não entrar no texto.

Os itens 1 e 2 são bloqueantes para o passo 3. O 3 e o 4 são bloqueantes para o passo 1.

---

# v2 — 29/08/2026, depois da crítica: decisões do Marcos e verificação executada

> Esta seção **responde** aos quatro bloqueantes do veredito acima. Dois foram decididos pelo
> Marcos, um foi medido contra as fontes, um continua aberto.

## Decisões novas do Marcos (29/08, segunda rodada)

### D1 — Desligar a planilha está autorizado

> "Pode desligar a planilha. Só nós estamos lendo mesmo. Mas os dados do Dashboard têm que estar
> todos vinculados a ela, que deve ter uma representação igual no Neon."

A autorização é condicionada: **paridade conferida antes de desligar**. A conferência está em
§Paridade abaixo.

### D2 — A convenção `<>` volta como sinal, não como regra única

> "Vou reforçar o uso obrigatório do `<>`. Vamos levar ele em consideração, e o título, como
> fallback."

A regra da v1 (só participante externo) passa a ser um **OU**:

```
eh_reuniao_cliente =
      isCancelled = false
  AND isAllDay    = false
  AND showAs     <> 'free'
  AND (   existe participante fora de @defenz.com.br e fora de domínio de parceiro
       OR assunto contém '<>' )
```

**Isto resolve o achado 3 da crítica.** A medição pendente era "quantas reuniões de cliente
realmente convidam o cliente?" — porque, abaixo de ~80%, a regra por participante precisaria de
um segundo sinal. O `<>` reforçado **é** esse segundo sinal, e cobre exatamente o furo medido:
o vendedor que cria bloco na própria agenda e liga para o cliente.

O que o `<>` **não** conserta, e continua valendo da v1:

- `Reunião setup Defenz - Bitdefender <> Plasduran` tem `<>` e é pós-venda. Falso positivo.
  Não se exclui pelo texto — entra com `motivo_revisao = 'possivel_pos_venda'` e aparece na
  lista de revisão. O ato manda; o relato só sinaliza.
- Convenção reforçada leva semanas para pegar. Até lá o participante externo é quem sustenta a
  métrica, e o `<>` é o complemento — não o contrário.

### D3 — Privacidade: o título é lido sempre, gravado quase nunca

D2 obriga a **ler** o assunto de todo evento (é onde o `<>` mora). O achado de privacidade da
crítica continua valendo para o que é **gravado**:

```
grava assunto  ⟺  tem participante externo  OU  assunto contém '<>'
```

`Almoço` e `Sheila` não têm nenhum dos dois → linha anônima (data, duração, dono), sem título.
Ler em memória para avaliar a regra não é o mesmo que persistir.

---

## Bloqueante 1 — RESOLVIDO: varredura dos 93 workflows do n8n

Varridos **93 workflows** (ativos e inativos) por nós `googleSheets` e por referência literal ao
id `1roirh1RRFg8…`. **53 nós encontrados; 8 tocam a planilha do dashboard.**

### Quem ESCREVE (esperado, é a escrita dupla)

| workflow | nós | aba |
|---|---|---|
| `Coleta Métricas v2` (`QjnzGicZHIPBNN1g`) | Sheets Deals, Ligacoes Raw, Emails Raw, Leads Completo, Agenda | deals, ligacoes, emails, leads, agenda |
| `Refresh Deals (sob demanda)` (`WlTnk2bHWYhibwyG`) | Sheets Deals | deals |
| `Coleta Métricas v2` | Sheets Classificacoes, Classificacoes Historico | **nós desabilitados** |

### 🔴 Quem LÊ — o consumidor invisível que a crítica previu

**`Defenz - Dashboard - Snapshot Diário` (`aMhvdTP5aAi0Z1sf`, ATIVO, cron 17h50 seg–sex).**
Não é um leitor qualquer: ele **lê, escreve e depois ingere**.

| nó | o que faz |
|---|---|
| `GViz Ligacoes` | lê a aba `ligacoes` da planilha via gviz |
| `GViz Baseline` | lê a aba **`base_baseline`** via gviz |
| `Get Dates` | lê `resumo_diario!A:A` pela Sheets API v4 |
| `Write Row` | **escreve** a linha do dia em `resumo_diario` pela Sheets API v4 |
| `Ingest → Neon: resumo_diario` | só então manda para o Neon |

Ou seja: **`resumo_diario` no Neon é derivado da planilha, não paralelo a ela.** Desligar a
planilha sem mexer neste workflow não degrada o `/diario` — mata. E o sintoma apareceria às
17h50 de um dia útil, sem ninguém ligar à causa. Exatamente o modo de falha que a crítica
descreveu.

**Consequência para a sequência:** o passo 3 (desligar a escrita) ganha um pré-requisito que
não estava na v1 — **portar o `Snapshot Diário` para ler do Neon e escrever direto no Neon**,
eliminando os quatro nós acima. Isso é trabalho de verdade, não ajuste.

### 🔴 Achado novo: a aba `base_baseline` não existe no Neon

O inventário da v1 listou 8 abas e disse que só `reunioes` faltava. **Faltou uma nona.**

`base_baseline` existe na planilha (`vigente_desde | total_licencas | clientes_ativos |
top_contas | demais_count | demais_licencas`, snapshot vigente desde 2026-06-08) e **não tem
tabela correspondente no Neon**. É a fonte dos números de base instalada que chegam ao
`/diario` via `resumo_diario.base_*`.

Ela não aparece no `grep` do repositório porque **nenhum código do dashboard a lê** — quem lê é
o workflow. É o caso puro de dado que só existe na planilha.

**Ação obrigatória antes de desligar:** criar `base_baseline` no Neon (ou embutir o snapshot na
lógica do `Snapshot Diário`) e migrar a linha vigente.

### Fora do dashboard

Os outros 45 nós `googleSheets` apontam para **outras planilhas** (Chief/Onboarding, ATRIO,
SS Tracker, Métricas, Relatório Pronto, LP Cotações). **Nenhum é afetado** por desligar a
planilha do dashboard. O Chief e o Autopilot, especificamente, não a tocam.

---

## Paridade Sheets × Neon — conferida em 29/08 (pedido do Marcos em D1)

Contagem na aba via gviz × contagem no Neon, com deduplicação pela chave natural:

| aba | linhas na aba | chaves únicas | Neon | veredito |
|---|---:|---:|---:|---|
| `deals` | 301 | 301 | 301 | ✅ |
| `ligacoes` | 18.782 | 18.782 | 18.782 | ✅ |
| `agenda` | 280 | 280 | 280 | ✅ |
| `resumo_diario` | 70 | 70 | 70 | ✅ |
| `emails` | 4.103 | 4.103 | 4.102 | ✅ — ver nota |
| `leads` | **1.756** | **1.587** | 1.587 | ✅ — ver nota |
| `classificacao_ia` | 1.464 | 1.411 | **2.514** | ⚠️ Neon é superconjunto |
| `base_baseline` | 1 | — | **não existe** | 🔴 |
| `reunioes` | **não existe** | — | não existe | — objeto desta spec |

**A aba `reunioes` nunca foi criada.** O gviz devolve a planilha 0 (`ligacoes`, 18.782 linhas)
para o nome inexistente — é por isso que `dashboard-sheets/route.ts` usa `fetchTabStrict` com as
colunas `["data","assunto"]`. A guarda está funcionando: hoje a métrica cai no proxy
`[REUNIAO]` em `deals.resultados`.

### Nota `emails` — a linha faltante é uma sentinela, e o Neon está certo

A única linha da aba ausente no Neon:

```json
{"email_id":"none","data":null,"destinatario":null,"status":"sem_dados"}
```

É a **sentinela `id: 'none'`** — a mesma que foi removida do `Format Deals Raw` e que **continua
viva no `Format Emails Raw`**. O Neon rejeita porque não tem data. Paridade real: **4.102 =
4.102**. A sentinela é lixo que some junto com o Sheets.

### Nota `leads` — a aba tem 169 duplicatas; o Neon está certo

1.756 linhas, **1.587 `lead_id` distintos**. A diferença de 169 que parecia perda de dado é o
inverso: a aba duplica, o upsert por chave natural não. **O Neon é o número correto.**

### Nota `classificacao_ia` — Neon é superconjunto, ambos congelados

Neon 2.514 > aba 1.464 porque a aba é janela e o Neon acumula histórico. Não é divergência de
conteúdo. **Mas as duas pararam em 13/08** — ver bloqueante 2.

### Veredito da paridade

Das 7 abas com par no Neon, **7 conferem**. Duas divergências aparentes (`emails`, `leads`)
eram, medidas, **defeitos da planilha que o Neon já corrige**. Isso é evidência a favor de D1,
não contra.

O que impede desligar **não é paridade de dado** — são as duas coisas que a planilha carrega e o
Neon não tem: `base_baseline` e o caminho de escrita do `Snapshot Diário`.

---

## Bloqueante 2 — ABERTO: `emails` e `classificacoes_ia`

Único ponto que ainda depende de decisão do Marcos.

### `emails` (Apollo) — a fonte secou, não quebrou

Medido na execução 96504 (29/08 15h00, **status success**), o nó `Apollo Emails` devolve:

```json
{ "emailer_messages": [] }
```

Sem erro, sem timeout, sem credencial expirada. A API responde — **não há mensagem no período**.
A curva na própria aba mostra onde parou:

| dia | e-mails |
|---|---:|
| 06/08 | 23 |
| 07/08 | 35 |
| 10/08 | 29 |
| **11/08** | **2** |
| 12/08 | 10 |
| 13/08 | 2 |
| 17/08 | 2 |
| **18/08** | **1** — última linha |

Queda de ~30/dia para ~2 em 11/08, zero desde 18/08. Isso é **sequência de Apollo pausada ou
esgotada**, não falha técnica. A decisão é de negócio, não de engenharia:

- **reativar** — religar as sequências no Apollo; o pipeline inteiro já funciona e volta sozinho;
- **aposentar** — tirar o card de e-mails do funil e o ramo do workflow. Com propostas por
  e-mail (Exchange) em produção desde 29/08, a cobertura de e-mail hoje vem de outra fonte.

### `classificacoes_ia` — desligada de propósito, em 8 nós

Não é falha: o ramo inteiro de IA está desabilitado no `Coleta Métricas v2`.

```
OFF  Preparar IA            OFF  IA Classificar        OFF  Google Gemini Chat Model
OFF  Salvar Classificacoes  OFF  Sheets Classificacoes OFF  Sheets Classificacoes Historico
OFF  Lote → Neon: classificacao_ia               OFF  Ingest → Neon: classificacao_ia
```

Último dado: 13/08. Alimenta o funil de esforço (`/esforco`, `EsforcoSection`) e a aba
`classificacao_ia` do export Excel.

- **reativar** — religar os 8 nós; volta a custar Gemini por lead;
- **aposentar** — remover a seção de esforço e a aba do export. Hoje elas mostram dado de 13/08
  **sem qualquer aviso de que está congelado** — que é o pior dos dois mundos e o estado atual.

---

## Estado dos quatro bloqueantes do veredito

| # | bloqueante | estado |
|---|---|---|
| 1 | varredura dos workflows do n8n | ✅ **feita** — 1 consumidor ativo achado (`Snapshot Diário`) + aba `base_baseline` órfã |
| 2 | decisão sobre `emails` e `classificacoes_ia` | 🔴 **aberto** — única coisa que depende do Marcos |
| 3 | medição "quantas reuniões convidam o cliente" | ✅ **dispensada por D2** — o `<>` reforçado é o segundo sinal que a medição procurava |
| 4 | regra de privacidade do `assunto` | ✅ **escrita** — D3 |

## Sequência de saída do Sheets — revisada

| passo | o que é | mudança em relação à v1 |
|---|---|---|
| 1 | Adaptador de tipo + tabela `reunioes` | igual |
| **1b** | **`base_baseline` no Neon + portar `Snapshot Diário` para ler/escrever no Neon** | **novo — pré-requisito do passo 3** |
| 2 | Dashboard lê do Neon, Sheets escrito em paralelo | igual |
| 3 | Uma semana comparando; se fechar, desliga a escrita | destravado por D1, condicionado a 1b |
| 4 | Cron de hora em hora, run único | igual |

## Correção do erro menor apontado na crítica

`0 10-12,14-18 * * 1-5` mais a execução das 6h são **nove** execuções em dia útil, não oito.
