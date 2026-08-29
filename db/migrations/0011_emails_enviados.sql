-- feature-proposta-email-exchange — e-mails ENVIADOS pelo time, lidos do Exchange via Graph.
-- Fato plano e append-only (dimensão normaliza, fato não — regra da migração Fase 1).
--
-- CHAVE: internet_message_id, NÃO o `id` do Graph. O `id` muda quando a mensagem é movida de
-- pasta, e a mesma mensagem reingerida viraria linha nova.
--
-- PRIVACIDADE: só metadado. Nunca corpo, nunca conteúdo de anexo — só o NOME do anexo.

create table if not exists emails_enviados (
  internet_message_id   text primary key,
  caixa                 text not null,
  remetente             text not null,
  destinatarios         text[] not null default '{}',
  destinatarios_cliente text[] not null default '{}',
  dominios_cliente      text[] not null default '{}',
  assunto               text,
  enviado_em            timestamptz not null,
  tem_anexo             boolean not null default false,
  anexos                text[] not null default '{}',
  eh_proposta           boolean not null default false,
  motivo_classificacao  text,
  proposta_ref          text,
  -- vínculo OPCIONAL: a proposta costuma sair ANTES do negócio existir no Zoho, então nulo
  -- aqui é o caso normal e NÃO gera pendência (decisão do Marcos, 27/08/2026).
  empresa_id            bigint references empresas(id),
  deal_id               text references deals(id),
  -- só para quase-proposta (PDF externo que não casou a regra); NÃO para falta de vínculo
  motivo_revisao        text,
  ingerido_em           timestamptz not null default now()
);

create index if not exists emails_enviados_enviado_em_idx
  on emails_enviados (enviado_em desc);
create index if not exists emails_enviados_deal_idx
  on emails_enviados (deal_id, enviado_em desc);
create index if not exists emails_enviados_proposta_idx
  on emails_enviados (enviado_em desc) where eh_proposta;
create index if not exists emails_enviados_revisao_idx
  on emails_enviados (enviado_em desc) where motivo_revisao is not null;
