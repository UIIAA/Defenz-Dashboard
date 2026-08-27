-- feature-038 (continuação) — o DONO do negócio chega ao Neon e à tela.
--
-- O `Owner` já era pedido ao Zoho pelo nó `Zoho Deals` e era JOGADO FORA no `Format Deals
-- Raw`, que nunca o emitiu. Nenhuma tela mostrava de quem era o negócio.
--
-- DUAS COLUNAS, e não uma: `owner_id` é a chave estável (o mapa de exibição em
-- src/lib/donos.ts amarra nele) e `owner_nome` é o que o Zoho chama a pessoa hoje. Guardar o
-- nome cru também é o que faz um vendedor novo aparecer na tela antes de alguém cadastrar o
-- id no mapa.
--
-- Medido em 27/08/2026: só existem dois donos nos 299 negócios.
--   7067822000000576001 "vendor 2"         suporte@defenz.com.br  → Leonardo
--   7067822000000743027 "Gustavo Figueira" gustavo@defenz.com.br  → Gustavo F

alter table deals add column if not exists owner_id   text;
alter table deals add column if not exists owner_nome text;

create index if not exists deals_owner_idx on deals (owner_id)
  where owner_id is not null and owner_id <> '';
