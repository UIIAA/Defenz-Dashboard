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
