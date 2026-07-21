// Cliente Neon (Postgres serverless, driver HTTP) — feature-auth-individual.
// FUNDAÇÃO REUSÁVEL: quando a migração "banco no centro" acontecer (spec futura),
// os SELECTs de dados do dashboard passam por aqui também. Ver feature-auth-individual §15.
//
// REGRA: este módulo (e quem depende dele — src/lib/users.ts) só pode ser importado
// por SERVER ACTIONS / ROUTE HANDLERS. NUNCA pelo middleware — o middleware valida só
// a assinatura do cookie (Web Crypto), sem tocar o banco.
//
// Lazy: a connection string só é lida na 1ª query (não quebra build sem env).

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function db(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL não definida — auth individual precisa do Neon (ver .env.local)."
      );
    }
    _sql = neon(url);
  }
  return _sql;
}
