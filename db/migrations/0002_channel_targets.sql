-- feature-metas-canal — Spec 2. Metas mensais de receita por canal (Neon/Postgres).
-- Idempotente (create if not exists + on conflict do nothing) para poder reaplicar sem quebrar.
-- Aplicar: psql "$DATABASE_URL_UNPOOLED" -f db/migrations/0002_channel_targets.sql
--     ou: node scripts/users.mjs migrate

create table if not exists channel_targets (
  categoria    text primary key check (categoria in ('direto','parceiro','securisoft')),
  valor_mensal numeric not null default 0,
  updated_at   timestamptz not null default now(),
  updated_by   text
);
insert into channel_targets (categoria) values ('direto'),('parceiro'),('securisoft')
  on conflict (categoria) do nothing;
