# Spec — Coleta incremental e atualização de hora em hora

> **v2 — 2026-08-26.** Reescreve a v1 (mesmo dia) após revisão adversarial que **inverteu o caso
> de negócio** da v1 e encontrou um caminho de corrupção de dado.
> Workflows `QjnzGicZHIPBNN1g` (Coleta Métricas v2) e `aMhvdTP5aAi0Z1sf` (Snapshot Diário).
>
> **Status: proposta.** Pedido do Marcos: *"quero que as atualizações do Dashboard diário sejam
> realizadas (as que forem possível) de hora em hora"*.

## 0. O que a v1 errou

| v1 dizia | evidência |
|---|---|
| "a coleta perde dado em silêncio em 28 dias" | o Callbox devolve **DESC** — as páginas 1–20 são sempre as 20.000 mais recentes. **Dado novo nunca se perde**; o que congela é a reescrita da cauda. E a folga é de **7,4 dias**, não 28: usei a média desde nov/2025 (61,9/dia) em vez do ritmo atual (**233,9/dia**) |
| "16 × 760 = 12 mil escritas, redução de 4×" | as dimensões continuam full refresh e dominam o volume. O real é **25.865 linhas/execução**, e de hora em hora dá **~69 mil/dia contra 51,7 mil hoje — aumento de 33%** |
| "só Callbox e Apollo usam a janela" | **`Microsoft Reunioes` também usa** (`data_inicio_iso`/`data_fim_iso`), está ativo e alimenta `Format Deals Raw` |
| "Zoho Leads: 1.587 leads, 8 páginas" | **16 requisições, 3.034 linhas** por execução; a aba tem 1.756 linhas para 1.587 ids |
| "Zoho Tasks: 280 tarefas, 2 páginas" | **sem paginação**, trunca em `per_page=200`, e executa **16×** por fan-out — 15 respostas idênticas descartadas |
| "12 requisições Zoho por execução" | **34** (2 deals + 16 leads + 16 tasks) → 576/dia no regime horário, não 192 |
| "janela de dias inteiros nunca parte grupo de `call_id`" | verdadeiro hoje, **mas por um motivo diferente e com um furo** — ver §3.3 |
| "Snapshot: cron 17h50, 1×/dia" | a expressão real é `50 17 * * 1-5` — **só dias úteis**. Ir para `* * *` cria linha de fim de semana, mudança de comportamento não declarada |

## 1. Por que fazer, agora que a razão da v1 caiu

A justificativa não é perda de dado. É esta:

1. **Custo e latência.** Reler 295 dias a cada execução para reescrever idêntico. Sem isso, "de
   hora em hora" é inviável — e é o que o Marcos pediu.
2. **O teto do Callbox chega em ~7 dias** (18.270 de 20.000, a 233,9/dia). Não perde dado novo,
   mas a partir dali **o full refresh vira parcial de qualquer jeito** — a arquitetura muda
   sozinha, com ou sem esta spec. Melhor mudar de propósito.
3. **`continueOnFail: true`** está em `Sheets Deals`, `Sheets Ligacoes Raw` e `Sheets Leads
   Completo` — é o defeito que produziu os R$ 19.962 de comissão errada. Passar de 2 para 16
   execuções/dia **multiplica por 8 a exposição**. Ver §6: isso vira pré-requisito, não sequela.

## 2. O que depende da janela — mapa corrigido

| nó | usa a janela? | por execução |
|---|---|---|
| `Callbox Fetch All Pages` | **sim** | 19 páginas, 18.270 registros |
| `Apollo Emails` | **sim** | 4.102 e-mails |
| `Microsoft Reunioes` | **sim** (`_iso`) | 1 página (**não pagina** — já trunca hoje) |
| `Zoho Deals` | não | 2 req, 259 linhas |
| `Zoho Leads` | não | **16 req, 3.034 linhas** |
| `Zoho Tasks` | não | **16 req** (fan-out), 200 linhas, trunca em `per_page` |

**Linhas escritas no Sheets por execução: 25.865** (18.270 + 4.102 + 3.034 + 259 + 200).

## 3. Desenho

### 3.1 Duas cadências, não uma — é isto que salva o caso de negócio

A v1 punha tudo de hora em hora e a escrita subia 33%. A correção: **cadência por entidade**.

| entidade | muda com que frequência? | cadência |
|---|---|---|
| ligações, e-mails, reuniões | o tempo todo, e são o "dia em andamento" | **de hora em hora, incremental** |
| deals | estágio muda ao longo do dia; é o que o Farol e o futuro semáforo mostram | **de hora em hora, full** (259 linhas — barato) |
| leads, agenda | mudam devagar; 3.034 + 200 linhas | **2×/dia**, como hoje |

Um nó `IF` antes do ramo de leads/tasks: segue só quando a hora for 6 ou 18. O ramo de fatos e
o de deals rodam sempre.

**Escrita resultante:** 16 × (700 + 30 + 259) ≈ **15.800/dia**, mais 2 × 3.234 = 6.468 →
**~22 mil/dia contra 51,7 mil hoje.** Redução de 2,3× **com** 8× mais frequência. Esse é o
número que sustenta a mudança; o da v1 não existia.

### 3.2 Janela por retrolook fixo

`Definir periodo`: cron → `hoje − 1 dia`; manual/webhook → `2025-11-01` (backfill).

**Retrolook de 1 dia, não 3.** Em regime horário, 1 dia já são 16 execuções de cobertura. A v1
escolheu 3 pensando em 2×/dia e nunca refez a conta. O que 3 dias comprariam é a segunda-feira
depois de um fim de semana inteiro fora do ar — cenário que deve ser tratado com full manual e
**ser notado**, não recuperado em silêncio.

**`hoje` passa a ser calculado em `America/Sao_Paulo`.** Hoje é `toISOString()` — UTC. Na
execução das 21h BRT (00:00Z) `hoje` já é amanhã. Inócuo com janela de 295 dias; com retrolook,
desloca a janela. O padrão certo já existe no Snapshot (`toLocaleDateString('en-CA', {timeZone})`).

### 3.3 A guarda do `call_id` — o único ponto onde o incremental corrompe dado

`Format Ligacoes Raw` desempata pernas repetidas com ordinal (`base#2`), agrupando **o payload
daquela execução**. Se uma janela trouxesse só parte de um grupo, o ordinal seria reatribuído e
o `appendOrUpdate` reescreveria a linha errada — o defeito original da `feature-call-id-unico`,
mais discreto.

Verificado no dado real: existem **5 grupos com sufixo (15 linhas)** e todos os membros de cada
grupo caem no mesmo dia. Mas o motivo não é o que a v1 alegou ("colidem no mesmo segundo"):
é que **`isoDate` é o primeiro campo da `base`** — membros do mesmo grupo têm a mesma data
*por construção*.

**O furo:** o nó gera `isoDate = ''` quando a data não parseia.

```js
const isoDate = (yyyy && mm && dd) ? `${yyyy}-${mm}-${dd}` : '';
const base = `${isoDate}_${timePart}_${agentName}_${destino8}`;
```

Com `isoDate=''` a base fica **sem data**, e duas ligações de dias diferentes com mesmo
horário/agente/destino formam um grupo que atravessa dias. Aí a janela parte o grupo e o dado
corrompe. Hoje não ocorre (`count(*) where left(call_id,1)='_'` → **0**), mas isso é sorte do
dado, não do desenho — e sob full refresh o dano seria invisível.

**Correção: guarda executável, não comentário.** Linha com `isoDate === ''` é descartada e
contada num `console.warn`. Comentário não impede a linha de existir.

Idem para a sentinela `{call_id:'none', status:'sem_dados'}` que o nó emite com payload vazio:
hoje nunca dispara porque a janela de 295 dias sempre traz dado; com janela de 1 dia e uma falha
de login do Callbox (`first.data?.result || []` engole o erro), vira caminho real e a sentinela
vai parar na aba e no Neon.

### 3.4 Piso de sanidade — senão trocamos um silêncio por outro

Hoje, Callbox vazio = 0 contra 18.270 esperados, anomalia gritante. Com retrolook, "0 ligações"
é indistinguível de sábado, feriado ou API caída — **16 vezes por dia**.

Regra: em dia útil, execução entre 9h e 21h com payload de ligações **vazio** é erro, não
resultado. O nó lança em vez de emitir sentinela.

### 3.5 Frequência e ordem

| workflow | hoje | proposto |
|---|---|---|
| Coleta | `0 6,18 * * *` | `0 6-21 * * *` |
| Snapshot | `50 17 * * 1-5` | `10 6-21 * * 1-5` |

O Snapshot **mantém `1-5`**: ir para todos os dias criaria linha de `resumo_diario` de sábado e
domingo, mudança de comportamento que ninguém pediu.

Defasagem de 10 min entre os dois. **A v1 justificou como "3× a duração medida (3 min)" ao mesmo
tempo que previa a coleta cair para <40 s** — os dois argumentos não podem valer juntos. O
correto: 10 min é folga contra a duração **atual**, e permanece válida se a coleta acelerar.

### 3.6 O objetivo não é atingido só com n8n

**As rotas têm cache de 30 min em memória e o cliente mais 30 min em `sessionStorage`.** Pior
caso, o usuário vê dado com ~60 min de atraso mesmo com coleta horária — e concluiria que não
funcionou.

Entram no escopo: TTL das rotas que alimentam o `/diario` e `src/lib/cache.ts` para **10 min**.
Não zero: o gviz de `ligacoes` custa 4,6 MB por leitura.

## 4. Fora do escopo (mas nomeado)

- **`Decide Range`/`Get Dates` do Snapshot.** `Get Dates` tem `onError: continueRegularOutput`
  **e** `neverError: true`; um 429 do Sheets faz `values=[]` → `row=2` → o dia de hoje sobrescreve
  `2026-06-09`, sem erro. Hoje é 1 sorteio/dia; a spec transformaria em 16. **É pré-requisito da
  mudança de frequência do Snapshot** — se não for consertado, o Snapshot fica em 1×/dia.
- `GViz Ligacoes` baixa **4,6 MB** e no caminho `live` joga fora. Tornar condicional: −74 MB/dia.
- `Callbox Hoje` manda `page: "1"` fixo — com 628 ligações/dia já observadas, trunca ao passar
  de 1.000.
- Credencial do `Callbox Login` está **hardcoded** no `jsonBody` em vez de credencial do n8n.
- Duplicatas de `leads` na aba (169) — o portão de paridade **já está vermelho** por isso
  (delta −169 contra baseline −1). Registrar antes, para não ser lido como regressão desta spec.

## 5. Riscos

| Risco | Prob. | Mitigação |
|---|---|---|
| `isoDate` vazio partir grupo de `call_id` | baixa hoje, **corrompe se ocorrer** | guarda executável §3.3 |
| Falha do Callbox virar silêncio | **alta sem mitigação** | piso de sanidade §3.4 |
| `continueOnFail` × 8 execuções | **alta** | §6: vira pré-requisito |
| Cota Zoho com 576 req/dia | **não verificado** | há ≥11 outros workflows batendo no mesmo Zoho; conferir o painel antes |
| Snapshot sobrescrever linha errada | média | §4, pré-requisito da frequência do Snapshot |
| Usuário não perceber diferença | **alta sem §3.6** | TTL para 10 min |

## 6. Ordem de execução

1. **Tirar `continueOnFail` das 3 abas** (ou ligar ramo de erro). Pré-requisito — a frequência
   multiplica o defeito por 8.
2. Guarda do `isoDate` + piso de sanidade (§3.3, §3.4). Só código de nó, sem mudar cadência.
3. `Definir periodo`: retrolook + fuso. Rodar **uma vez em modo incremental** e conferir §7.
4. `IF` de cadência para leads/agenda (§3.1).
5. Trocar o cron da Coleta para `0 6-21 * * *`.
6. TTLs para 10 min (§3.6).
7. Snapshot: só depois de consertar `Get Dates`/`Decide Range`.

## 7. Verificação

1. **Antes:** anotar `count(*)`, `max(data)` e `count(*) where call_id like '%#%'` de `ligacoes`.
2. Uma execução incremental. Conferir: nenhuma linha perdida; `call_id` das linhas antigas
   **inalterado** (a prova do §3.3); os 5 grupos com sufixo intactos.
3. `GET /api/ingest/paridade` — mesmo estado, **com `leads` já vermelho antes** (§4).
4. Só então trocar o cron.
5. Após 24h: `ligacoes` cresceu ~230/dia sem saltos nem zeros; `resumo_diario` de hoje com
   `atualizado_em` recente.
