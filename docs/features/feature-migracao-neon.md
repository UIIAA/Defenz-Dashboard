# Spec — Migração dos dados do Google Sheets para o Neon (Fase 1: escrita dupla)

> **Prioridade nº 1** (decidido pelo Marcos, 28/07/2026). Substitui a proposta genérica em
> [`PLANO-migracao-sheets-para-neon.md`](../PLANO-migracao-sheets-para-neon.md), que fica como
> contexto/motivação. Evidência que motivou: [`ATESTADO_CONSISTENCIA_2026-07-28.md`](../ATESTADO_CONSISTENCIA_2026-07-28.md).

## Objetivo

Passar a gravar **todos os dados de negócio também no Neon**, mantendo o **Google Sheets como
fonte da verdade**. Nesta fase **nada é lido do Neon** e **nada no dashboard muda de comportamento**.
A fase seguinte (spec própria) decide, com dado na mão, se a leitura migra e se o Sheets é desligado.

## Decisões travadas com o Marcos (28/07/2026)

1. **Escrita dupla**: n8n grava no Sheets **e** no Neon. Sheets continua canônico.
2. **Caminho da escrita**: o n8n **não** fala com o Postgres direto — faz `POST` numa rota da
   Vercel, e o código TypeScript valida e grava. Motivo: o mapeamento de colunas na UI do n8n já
   falhou **em silêncio** duas vezes (coluna `licencas` descartada; aba `reunioes` lendo a sheet-0).
   Em código, campo faltando é erro de teste/compilação, não número errado.
3. **Schema normalizado** (não espelho plano).
4. **Todas as 7 abas** na primeira onda.
5. **Não desligar nada** nesta fase. Nenhum nó `Sheets *` é removido ou desabilitado.

## Princípio de modelagem: normalizar onde paga

Normalizar tudo por princípio criaria trabalho sem retorno. A regra adotada:

| Tipo | Tratamento | Por quê |
|---|---|---|
| **Dimensões** (empresa, pessoa) | **Normalizadas** | Hoje `empresa` é string solta em 3 abas — a base instalada agrupa por texto em maiúscula. Vira FK real. |
| **Fatos / eventos** (ligações, e-mails) | **Planos** (append-only) | São log de evento imutável. Normalizar não compra nada; só encarece a escrita. |
| **Agregados do snapshot** | **`jsonb`** | Colunas como `ligacoes_por_vendedor`, `base_top_contas`, `destaque_*` já são estruturas serializadas — `jsonb` dá consulta de verdade sem inventar 20 tabelas. |

## Modelo de dados

### Dimensões

```
empresas
  id            bigserial pk
  nome_norm     text unique not null   -- chave de dedupe (upper + trim + colapso de espaço)
  nome_exibicao text not null
  criado_em     timestamptz not null default now()

pessoas                                 -- agentes de ligação, owners, senders
  id            bigserial pk
  nome_norm     text unique not null
  nome_exibicao text not null
```

> `empresas.nome_norm` resolve um problema atual: `deals`, `leads` e `agenda` guardam o nome da
> empresa como texto independente, e a base instalada agrupa por string. Com FK, "INFRACOMMERCE" e
> "Infracommerce Ltda" deixam de ser dois clientes — **mas isso muda contagem**, então ver §Riscos.

### Entidades

```
deals
  id              text pk               -- id do Zoho (natural key, já é único hoje)
  empresa_id      bigint fk -> empresas
  nome            text not null
  stage           text not null
  valor           numeric(14,2) not null default 0
  lead_source     text
  categoria       text check (categoria in ('direto','parceiro','securisoft'))
  comissao_valor  numeric(14,2) not null default 0
  licencas        integer not null default 0
  created_time    date
  modified_time   date
  closing_date    date
  resultados      text
  ingerido_em     timestamptz not null default now()

deal_tags                                -- hoje é string separada por vírgula
  deal_id  text fk -> deals on delete cascade
  tag      text
  primary key (deal_id, tag)

leads
  lead_id       text pk
  empresa_id    bigint fk -> empresas
  owner_id      bigint fk -> pessoas
  nome, lead_source, lead_status, telefone, email, resultados  text
  created_time, modified_time  date

classificacoes_ia                        -- append-only, preserva histórico
  id                   bigserial pk
  lead_id              text fk -> leads
  data_classificacao   timestamptz not null
  nivel_maximo, resultado_principal, concorrente, cargo_estimado,
  pessoa_contactada, resumo, renovacao_concorrente, resultados_snapshot  text
  passou_secretaria    boolean
  toques_estimados     integer
  unique (lead_id, data_classificacao)

agenda_tarefas
  task_id     text pk
  lead_id     text fk -> leads
  owner_id    bigint fk -> pessoas
  subject, status, description, lead_status  text
  due_date    date
  is_overdue  boolean
```

### Fatos (planos, append-only)

```
ligacoes
  call_id     text pk
  data        date not null
  hora        time
  agente_id   bigint fk -> pessoas
  destino     text
  duracao_seg integer not null default 0
  status, disposicao  text
  index (data), index (agente_id, data)

emails
  email_id    text pk
  data        date not null
  hora        time
  destinatario, destinatario_nome, assunto, status, sequencia  text
  index (data)
```

### Snapshot

```
resumo_diario
  data                date pk
  atualizado_em       timestamptz
  mode, coverage      text
  -- escalares
  ligacoes_total, ligacoes_atendidas, emails_total, apresentacoes_total,
  propostas_total, reuniao_tecnica_total, whatsapp_msgs, whatsapp_convs,
  linkedin_page, linkedin_perfis, pocs_ativas, base_total_licencas,
  base_clientes_ativos, base_demais_count, base_demais_licencas, total_tracao  integer
  ligacoes_taxa       numeric(5,2)
  -- estruturas
  por_vendedor        jsonb   -- ligacoes/emails/apresentacoes/propostas/reuniao por pessoa
  pocs_lista          jsonb
  base_top_contas     jsonb
  destaques           jsonb   -- comercial/marketing/execucao/atencao
```

## Rota de ingestão

`POST /api/ingest`

```jsonc
{
  "tabela": "deals",          // deals|ligacoes|emails|leads|classificacao_ia|agenda|resumo_diario
  "execucao": "<id da execução do n8n>",  // para rastrear no log
  "linhas": [ { /* linha no MESMO formato que hoje vai pro Sheets */ } ]
}
```

- **Auth**: header `X-Ingest-Token` comparado em tempo constante com `INGEST_TOKEN` (env nova).
  Não usa sessão de usuário — é máquina-para-máquina.
- **Contrato de entrada = o que o n8n já produz.** Os nós `Format * Raw` não mudam de forma;
  a rota recebe o objeto plano e faz a normalização (upsert de `empresas`/`pessoas`, resolução
  de FK, split de `tags`) **no servidor**, em código testado.
- **Idempotente**: upsert pela chave natural (`deals.id`, `ligacoes.call_id`, …). Rodar duas vezes
  não duplica. `classificacoes_ia` usa `(lead_id, data_classificacao)` para preservar histórico.
- **Transacional por lote**: um lote grava inteiro ou não grava.
- **Lotes**: máximo **500 linhas por requisição** (`ligacoes` tem 11,5k → o n8n itera).
- **Resposta**: `{ recebidos, inseridos, atualizados, rejeitados, erros: [{linha, campo, motivo}] }`.
  Linha inválida é **rejeitada e reportada**, nunca coagida em silêncio — é exatamente o oposto do
  comportamento do Sheets que gerou os bugs de 28/07.

`GET /api/ingest/paridade?tabela=…` — compara Neon × Sheets (contagem, somas de controle, intervalo
de datas) e devolve o veredito. É o atestado de consistência **automatizado**.

## Mudanças no n8n

> **Correção apurada na implementação (28/07):** são **2 workflows, não 1**. O
> `QjnzGicZHIPBNN1g` grava 6 das 7 abas; `resumo_diario` é do workflow `aMhvdTP5aAi0Z1sf`
> ("Snapshot Diário", cron 17h50). E são **2 nós por tabela**, não 1: o nó HTTP dispara uma
> requisição por item, então um `Code` antes agrupa em lotes de 500 (11,5k ligações seriam 11,5k
> requisições). Patch pronto, com o JSON exato e o mapa nó-a-nó, em
> [`feature-migracao-neon-n8n.md`](feature-migracao-neon-n8n.md).

Para cada uma das 7 tabelas, **adicionar** (nunca substituir) um nó HTTP após o nó `Sheets *`
correspondente, apontando para `/api/ingest`.

- **`onError: continueRegularOutput` em todos eles.** Se a ingestão no Neon falhar, o Sheets — que
  é a fonte da verdade — **não pode ser afetado**. Falha de Neon nesta fase é ruído, não incidente.
- **Não** mexer em nó `Sheets *` existente. **Não** reabilitar os nós desabilitados
  (`Consolidar`, `Split/Sheets Metricas`…) — ver `NOVA_ARQUITETURA_N8N.md` §7.4.

## Backfill

O histórico não vem de graça: o workflow reescreve `deals` inteiro a cada execução (auto-backfill),
mas `ligacoes`, `emails`, `classificacao_ia` e `resumo_diario` são acumulativos.

Script `scripts/backfill-neon.mjs` lê cada aba via gviz e faz `POST /api/ingest` em lotes de 500.
Idempotente (mesma chave natural) — pode rodar quantas vezes precisar.

## Validação — o portão

A fase só é considerada concluída quando, por **7 dias corridos**, `GET /api/ingest/paridade`
devolver verde em todas as 7 tabelas:

| Tabela | Checagens |
|---|---|
| `deals` | contagem · Σ `valor` · Σ `licencas` · nº de ganhos |
| `ligacoes` | contagem · Σ `duracao_seg` · min/max `data` |
| `emails` | contagem · min/max `data` |
| `leads` | contagem |
| `classificacao_ia` | contagem de `lead_id` distintos |
| `agenda` | contagem |
| `resumo_diario` | contagem de dias · nenhum dia útil faltando |

Divergência **não** é resolvida ajustando o comparador — é investigada. Foi assim que o bug das
reuniões apareceu.

## Segurança

- `INGEST_TOKEN` é segredo novo: `.env.local` + env da Vercel + credencial no n8n. **Nunca no git.**
- Comparação do token em tempo constante (reusar `constantTimeEqual` de `src/lib/auth.ts`).
- A rota **não** é coberta pelo middleware de sessão (é máquina-a-máquina) — precisa entrar na
  allowlist do `src/middleware.ts` explicitamente, com comentário do porquê.
- Rate limit próprio, e limite de tamanho de corpo (500 linhas).

## Arquivos afetados (mapa pro implementador)

| Arquivo | Mudança |
|---|---|
| `db/migrations/0003_dados_negocio.sql` | novo — todo o schema acima |
| `scripts/users.mjs` | aplicar a migration 0003 no `migrate()` |
| `src/lib/ingest/schema.ts` | novo — tipos + validação por tabela (fonte única da forma) |
| `src/lib/ingest/normalize.ts` | novo — `nome_norm`, upsert de `empresas`/`pessoas`, split de tags |
| `src/lib/ingest/repo.ts` | novo — upserts transacionais por tabela |
| `src/lib/ingest/paridade.ts` | novo — comparações Neon × Sheets |
| `src/app/api/ingest/route.ts` | novo — POST autenticado |
| `src/app/api/ingest/paridade/route.ts` | novo — GET veredito |
| `src/middleware.ts` | allowlist de `/api/ingest` |
| `scripts/backfill-neon.mjs` | novo — carga histórica em lotes |
| testes | validação (aceita/rejeita), normalização de nome, idempotência do upsert, split de tags, comparador de paridade |
| n8n `QjnzGicZHIPBNN1g` | + 7 nós HTTP com `onError: continue` |

## Riscos

1. **Dedupe de empresa muda contagem.** Se `nome_norm` unificar "INFRACOMMERCE" e "Infracommerce
   Ltda", o Neon terá **menos** clientes que o Sheets — e a paridade vai acusar. Isso é **achado, não
   erro**: hoje o dashboard provavelmente conta o mesmo cliente duas vezes. Tratamento: a paridade
   reporta os pares unificados para revisão manual antes de aceitar a diferença.
2. **Tipagem rejeita linha suja.** Data malformada ou número com lixo será rejeitada em vez de virar
   0. É o objetivo — mas exige olhar o relatório de rejeição nos primeiros dias.
3. **Volume.** 11,5k ligações em lotes de 500 = 24 requisições por execução. Aceitável; se pesar,
   passar a enviar só o delta por data.
4. **Escopo.** Normalizar + 7 tabelas de uma vez é maior que o caminho incremental recomendado.
   Mitigação: nada é lido do Neon nesta fase, então **o pior caso é retrabalho, não incidente**.

## Fora de escopo (fase 2, spec própria)

- Migrar a **leitura** do dashboard para SQL.
- Desligar ou reduzir a escrita no Sheets.
- Reescrever a ingestão para fora do n8n (aquilo é o outro eixo — ver plano `project_future_no_n8n`).
- Papel `owner` (spec independente, segue na fila).
