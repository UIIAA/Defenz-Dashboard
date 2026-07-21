-- feature-auth-individual — Fase 1. Schema de autenticação (Neon/Postgres).
-- Idempotente (create if not exists) para poder reaplicar sem quebrar.
-- Aplicar: psql "$DATABASE_URL_UNPOOLED" -f db/migrations/0001_auth.sql
--     ou: node scripts/users.mjs migrate

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,        -- sempre gravado/consultado em lower-case
  name          text not null,
  password_hash text not null,               -- scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
  role          text not null default 'member' check (role in ('admin','member')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists access_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references users(id) on delete set null,
  email       text not null,                 -- e-mail TENTADO (gravado mesmo em falha)
  event       text not null check (event in ('login_ok','login_fail','logout')),
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists access_log_created_idx on access_log (created_at desc);
create index if not exists access_log_email_idx   on access_log (email);
