// feature-migracao-neon (Fase 1) — normalização das dimensões.
//
// `empresa` hoje é string solta em `deals`, `leads` e `agenda`, e a base instalada
// agrupa clientes por texto em maiúscula. Aqui a string vira chave de dedupe
// (`nome_norm`) que no Neon é UNIQUE — é o que transforma empresa/pessoa em FK real.
//
// ATENÇÃO (spec §Riscos 1): isso MUDA CONTAGEM. "INFRACOMMERCE" e "Infracommerce Ltda"
// continuam distintos aqui (só caixa/espaço são normalizados) — dedupe semântico é
// decisão de negócio, não de código.

export interface DimensaoRef {
  nome_norm: string;
  nome_exibicao: string;
}

/** upper + trim + colapso de espaço interno. Vazio → null (não vira empresa fantasma). */
export function nomeNorm(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') return null;
  const norm = valor.trim().replace(/\s+/g, ' ').toUpperCase();
  return norm.length ? norm : null;
}

/** `tags` chega do Zoho unida por ", ". Deduplica: a PK (deal_id, tag) rejeitaria repetida. */
export function splitTags(valor: string | null | undefined): string[] {
  if (typeof valor !== 'string') return [];
  const out: string[] = [];
  for (const parte of valor.split(',')) {
    const tag = parte.trim();
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/** Coleta os pares únicos de uma dimensão (empresa/pessoa) presentes no lote. */
export function coletarDimensao(
  linhas: Record<string, unknown>[],
  campo: string
): DimensaoRef[] {
  const vistos = new Map<string, DimensaoRef>();
  for (const linha of linhas) {
    const bruto = linha[campo];
    if (typeof bruto !== 'string') continue;
    const norm = nomeNorm(bruto);
    if (!norm || vistos.has(norm)) continue;
    vistos.set(norm, { nome_norm: norm, nome_exibicao: bruto.trim().replace(/\s+/g, ' ') });
  }
  return [...vistos.values()];
}
