-- feature-cnpj-identidade-empresa — CNPJ como identidade de empresa nos deals.
--
-- Contexto medido no Zoho em 2026-08-01 (231 deals, base completa):
--   Account_Name preenchido ...... 0    → a coluna `empresa`/`empresa_id` nunca preenche
--   CNPJ válido .................. 202  (87%)
--   entre os 78 ganhos ........... 77   → 76 empresas distintas
--
-- Guardamos só os 14 DÍGITOS: máscara é apresentação. O `Format Deals Raw` (n8n) já
-- entrega vazio quando nem `CNPJ` nem `CNPJ1` passam no dígito verificador — o campo do
-- Zoho é texto livre e chegou a trazer a palavra "Localizando".
--
-- A dimensão `empresas` (chaveada por `nome_norm`) fica como está DE PROPÓSITO: ela é
-- alimentada pela string `empresa`, que está vazia em 100% dos deals. Rechavear a dimensão
-- por CNPJ é mudança maior e não é necessária enquanto nada é lido do Neon (Fase 1).

alter table deals add column if not exists cnpj text;

-- 14 dígitos, sem máscara. Não valida dígito verificador aqui: isso é papel do coercer em
-- `src/lib/ingest/schema.ts`, que REJEITA e reporta a linha em vez de gravar torto.
alter table deals drop constraint if exists deals_cnpj_formato;
alter table deals add constraint deals_cnpj_formato
  check (cnpj is null or cnpj ~ '^[0-9]{14}$');

-- Agrupamento da base instalada é por CNPJ; NÃO é único: mais de um negócio para a mesma
-- empresa é normal (medido: Estaleiro Atlântico Sul com duas vendas reais de 200 endpoints).
create index if not exists deals_cnpj_idx on deals (cnpj) where cnpj is not null;
