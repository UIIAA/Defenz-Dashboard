-- feature-038 (estado do negócio e ficha do ambiente) — os campos que a rotina do Chief
-- grava no Zoho chegam ao Neon e alimentam /oportunidades.
--
-- Spec: Defenz_Chief/docs/features/feature-038-estado-do-negocio.md, seção 12.3.
--
-- TRÊS COLUNAS, DUAS ORIGENS DIFERENTES:
--   `vencimento_licenca` vem de `Vencimeno_da_licen_a` (o typo É o api_name real no Zoho),
--     que JÁ EXISTE e é do tipo `date`. Nunca dependeu da f-038: só não estava na lista
--     `fields` do nó `Zoho Deals`. Preenchido em 11 dos 29 cards do pipe em 27/08.
--   `estado_negocio` e `antivirus_atual` vêm de campos NOVOS, criados à mão no Zoho, que a
--     rotina da f-038 preenche. Nascem nulos em todos os cards.
--
-- SEM CHECK CONSTRAINT em `estado_negocio`, pelo mesmo motivo da 0008: o ingest é
-- transacional por lote de 500 e um CHECK violado abortaria o LOTE INTEIRO, contra o
-- contrato de rejeitar e reportar linha a linha. Estado desconhecido vira '' na tela.
--
-- `vencimento_licenca` é `date` e NÃO texto, de propósito. A spec v1 previa texto livre
-- ("nov/2026", "2027") porque a fonte seria a prosa do `Resultados`; com o campo do Zoho
-- como fonte, o dado nasce estruturado e a janela dos 90 dias vira comparação de data, não
-- interpretação de string.

alter table deals add column if not exists vencimento_licenca date;
alter table deals add column if not exists estado_negocio      text;
alter table deals add column if not exists antivirus_atual     text;

-- A janela dos 90 dias é a leitura mais cara da tela: varre o pipe aberto inteiro por data.
create index if not exists deals_vencimento_idx on deals (vencimento_licenca)
  where vencimento_licenca is not null;

create index if not exists deals_estado_idx on deals (estado_negocio)
  where estado_negocio is not null and estado_negocio <> '';
