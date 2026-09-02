-- feature-040 §pedido 4 — a carteira de Grandes Contas do Francisco.
--
-- POR QUE UMA COLUNA E NÃO UMA LEITURA DO `stage`:
-- a regra ingênua ("stage = 'Grandes Contas' → é grande conta") quebra no momento em que o
-- negócio avança. A VIVO esquenta, vai para `Reunião Técnica`, e no mesmo instante sairia do
-- filtro e trocaria de dono sozinha — justo quando mais importa (decisão D-4 do Marcos).
--
-- A marca é STICKY: `src/lib/ingest/repo.ts` gera
--   grande_conta = deals.grande_conta or excluded.grande_conta
-- então nenhuma coleta futura desmarca. Entrou uma vez, é Grande Conta para sempre.
--
-- SAÍDA PARA ERRO (f-041 §crítica): basta uma execução do cron com o negócio no estágio errado
-- para marcá-lo permanentemente, e o cron roda 3x ao dia. Desfazer no Zoho NÃO desmarca aqui.
-- O conserto é manual e é este:
--   update deals set grande_conta = false where id = '<id do negócio>';

alter table deals add column if not exists grande_conta boolean not null default false;

-- Semeadura: quem está no estágio hoje nasce marcado, sem esperar o próximo cron.
update deals set grande_conta = true where stage = 'Grandes Contas';

-- O filtro da tela é "só elas" / "sem elas" sobre o pipe aberto — índice parcial serve os dois.
create index if not exists deals_grande_conta_idx on deals (grande_conta) where grande_conta;
