-- feature-semaforo-oportunidades — semáforo manual declarado no Zoho (campo `Temperatura`,
-- picklist Quente/Morno/Frio) chega ao Neon.
--
-- POR QUE NO NEON E NÃO SÓ NA PLANILHA (mudança em relação à spec v2, que adiava isto):
-- a coluna na aba `deals` precisa ser criada à mão no cabeçalho, e o nó `Sheets Deals` tem
-- `continueOnFail: true` — coluna ausente é DESCARTADA EM SILÊNCIO, sem erro. Lendo do Neon,
-- o caminho não depende de passo manual nem do modo de falha que já custou R$ 19.962.
--
-- SEM CHECK CONSTRAINT de propósito: o ingest é transacional por lote de até 500 linhas, e
-- uma violação de CHECK abortaria o LOTE INTEIRO — o oposto do contrato da Fase 1, que é
-- rejeitar e reportar linha a linha (`erros: [{linha, campo, motivo}]`). A validação do valor
-- mora em src/lib/ingest/schema.ts, e o `Format Deals Raw` já normaliza na origem
-- (desconhecido → '' → cinza na tela).

alter table deals add column if not exists temperatura text;

create index if not exists deals_temperatura_idx on deals (temperatura)
  where temperatura is not null and temperatura <> '';
