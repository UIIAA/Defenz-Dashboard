-- feature-migracao-neon (Fase 1) — dados de negócio no Neon (escrita dupla).
-- O Google Sheets CONTINUA sendo a fonte da verdade: nada aqui é lido pelo dashboard
-- nesta fase. Ver docs/features/feature-migracao-neon.md.
--
-- Idempotente (create if not exists) — pode reaplicar sem quebrar.
-- Aplicar: node scripts/users.mjs migrate
--     ou: psql "$DATABASE_URL_UNPOOLED" -f db/migrations/0003_dados_negocio.sql
--
-- MODELAGEM (spec §normalizar onde paga):
--   dimensões (empresa, pessoa) → normalizadas, viram FK real
--   fatos (ligações, e-mails)   → planos, append-only
--   agregados do snapshot       → jsonb

-- ============================ dimensões ============================

create table if not exists empresas (
  id            bigserial primary key,
  nome_norm     text unique not null,
  nome_exibicao text not null,
  criado_em     timestamptz not null default now()
);

create table if not exists pessoas (
  id            bigserial primary key,
  nome_norm     text unique not null,
  nome_exibicao text not null,
  criado_em     timestamptz not null default now()
);

-- ============================ entidades ============================

create table if not exists deals (
  id             text primary key,
  empresa_id     bigint references empresas(id),
  nome           text not null,
  stage          text not null,
  valor          numeric(14,2) not null default 0,
  lead_source    text,
  categoria      text check (categoria in ('direto','parceiro','securisoft')),
  comissao_valor numeric(14,2) not null default 0,
  licencas       integer not null default 0,
  created_time   date,
  modified_time  date,
  closing_date   date,
  resultados     text,
  ingerido_em    timestamptz not null default now()
);

create index if not exists deals_empresa_idx on deals (empresa_id);
create index if not exists deals_closing_idx on deals (closing_date);
create index if not exists deals_stage_idx on deals (stage);

create table if not exists deal_tags (
  deal_id text not null references deals(id) on delete cascade,
  tag     text not null,
  primary key (deal_id, tag)
);

create table if not exists leads (
  lead_id       text primary key,
  empresa_id    bigint references empresas(id),
  owner_id      bigint references pessoas(id),
  nome          text,
  lead_source   text,
  lead_status   text,
  telefone      text,
  email         text,
  resultados    text,
  created_time  date,
  modified_time date,
  ingerido_em   timestamptz not null default now()
);

create index if not exists leads_empresa_idx on leads (empresa_id);
create index if not exists leads_owner_idx on leads (owner_id);

-- append-only: a UNIQUE inclui a data pra preservar o histórico de classificação
-- do MESMO lead (reclassificar não sobrescreve o que a IA disse antes).
create table if not exists classificacoes_ia (
  id                    bigserial primary key,
  lead_id               text not null references leads(lead_id) on delete cascade,
  data_classificacao    timestamptz not null,
  nivel_maximo          text,
  resultado_principal   text,
  concorrente           text,
  renovacao_concorrente text,
  cargo_estimado        text,
  pessoa_contactada     text,
  resumo                text,
  resultados_snapshot   text,
  passou_secretaria     boolean,
  toques_estimados      integer,
  ingerido_em           timestamptz not null default now(),
  unique (lead_id, data_classificacao)
);

create table if not exists agenda_tarefas (
  task_id     text primary key,
  lead_id     text references leads(lead_id) on delete set null,
  owner_id    bigint references pessoas(id),
  subject     text,
  status      text,
  description text,
  lead_status text,
  due_date    date,
  is_overdue  boolean,
  ingerido_em timestamptz not null default now()
);

create index if not exists agenda_due_idx on agenda_tarefas (due_date);

-- ====================== fatos (planos, append-only) ======================

create table if not exists ligacoes (
  call_id     text primary key,
  data        date not null,
  hora        time,
  agente_id   bigint references pessoas(id),
  destino     text,
  duracao_seg integer not null default 0,
  status      text,
  disposicao  text,
  ingerido_em timestamptz not null default now()
);

create index if not exists ligacoes_data_idx on ligacoes (data);
create index if not exists ligacoes_agente_data_idx on ligacoes (agente_id, data);

create table if not exists emails (
  email_id          text primary key,
  data              date not null,
  hora              time,
  destinatario      text,
  destinatario_nome text,
  assunto           text,
  status            text,
  sequencia         text,
  ingerido_em       timestamptz not null default now()
);

create index if not exists emails_data_idx on emails (data);

-- ============================ snapshot diário ============================
-- Escalares NULLABLE de propósito: no resumo diário `0` = capturado e é zero,
-- `null` = NÃO capturado (types.ts §Captured). Colapsar os dois destruiria a
-- distinção que a UI usa pra mostrar "—".

create table if not exists resumo_diario (
  data                  date primary key,
  atualizado_em         timestamptz,
  mode                  text,
  coverage              text,
  ligacoes_total        integer,
  ligacoes_atendidas    integer,
  ligacoes_taxa         numeric(5,2),
  emails_total          integer,
  apresentacoes_total   integer,
  propostas_total       integer,
  reuniao_tecnica_total integer,
  whatsapp_msgs         integer,
  whatsapp_convs        integer,
  linkedin_page         integer,
  linkedin_perfis       integer,
  pocs_ativas           integer,
  base_total_licencas   integer,
  base_clientes_ativos  integer,
  base_demais_count     integer,
  base_demais_licencas  integer,
  total_tracao          integer,
  por_vendedor          jsonb,
  pocs_lista            jsonb,
  base_top_contas       jsonb,
  destaques             jsonb,
  ingerido_em           timestamptz not null default now()
);
