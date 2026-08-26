// Último toque real de um negócio — feature-semaforo-oportunidades §4.2.
//
// POR QUE ISTO EXISTE, e não `modified_time`:
// Medido em 26/08/2026 nos 30 negócios abertos —
//   `modified_time`      → 19 dos 30 no MESMO dia (25/08); só 1 passa de 9 dias
//   `Last_Activity_Time` → 26/26 preenchidos, mas só 3 DATAS DISTINTAS entre os 26
// Alguma automação toca todos os negócios diariamente (há ≥11 workflows n8n escrevendo no
// mesmo Zoho). Nenhum dos dois separa "trabalhado ontem" de "editado em lote ontem".
//
// O único sinal de ação HUMANA é o que o vendedor escreve no campo `resultados`, no formato
// `DD/MM - o que aconteceu`. A última data que aparece ali é o último toque de verdade.
//
// DEPENDE do conserto do truncamento (§4.1): o campo guardava os 1000 chars mais ANTIGOS,
// então a "última data" era de meses atrás em 20 dos 30 abertos.

/** Dia/mês crus, na ordem em que aparecem no texto. */
function paresDDMM(texto: string): Array<{ dia: string; mes: number }> {
  const out: Array<{ dia: string; mes: number }> = [];
  // `m` global: queremos TODAS as linhas, não só as que têm tag de evento.
  for (const linha of String(texto || '').split('\n')) {
    const m = linha.match(/(\d{2})\/(\d{2})/);
    if (!m) continue;
    const mes = parseInt(m[2], 10);
    if (mes < 1 || mes > 12) continue;
    out.push({ dia: m[1], mes });
  }
  return out;
}

export interface UltimoToque {
  /** YYYY-MM-DD do último registro datado, ou null se o texto não tem data. */
  data: string | null;
  /** Dias corridos desde `data` até `referencia`. null quando não há data. */
  dias: number | null;
  /**
   * O texto do último andamento — da última data até o fim do campo.
   * Medido nos 29 abertos: mediana 176 chars, p90 419, máx 597.
   * É o que o vendedor escreveu por último, literal. Sem resumo, sem IA.
   */
  texto: string | null;
}

/**
 * Último registro datado do `resultados`.
 *
 * A inferência de ano é a MESMA de `extractEventDatesAnchored` (`metrics.ts:112`): mês maior
 * que o mês de referência ⇒ ano anterior. Repetimos a regra em vez de importar porque aquela
 * função filtra por tag de evento e aqui queremos qualquer linha datada — mas se a regra de
 * ano mudar lá, tem que mudar aqui. Há teste cobrindo as duas.
 *
 * Janela de 12 meses: um texto que atravesse 13+ meses joga entrada velha no ano corrente.
 * Hoje não estoura (nenhum deal tem mais de 12 meses), mas é limite conhecido.
 */
export function ultimoToque(resultados: string, referencia: string): UltimoToque {
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(referencia)
    ? referencia
    : new Date().toISOString().slice(0, 10);
  const refAno = parseInt(ref.slice(0, 4), 10);
  const refMes = parseInt(ref.slice(5, 7), 10);

  const pares = paresDDMM(resultados);
  if (pares.length === 0) return { data: null, dias: null, texto: null };

  const ultimo = pares[pares.length - 1];
  const ano = ultimo.mes > refMes ? refAno - 1 : refAno;
  const data = `${ano}-${String(ultimo.mes).padStart(2, '0')}-${ultimo.dia}`;

  // UTC dos dois lados: comparar datas puras, sem fuso entrar na conta.
  const ms = Date.parse(`${data}T00:00:00Z`);
  if (Number.isNaN(ms)) return { data: null, dias: null, texto: null };
  const dias = Math.max(0, Math.round((Date.parse(`${ref}T00:00:00Z`) - ms) / 86400000));

  return { data, dias, texto: textoDoUltimo(resultados) };
}

/**
 * Texto do último andamento: da última linha que ABRE com data até o fim.
 *
 * Ancora em início de linha (não em qualquer DD/MM) porque números no meio da frase são
 * comuns — "as 30/40 licenças", "ligar no ramal 6240". Pegar o último par solto cortaria o
 * andamento no meio de uma frase.
 */
function textoDoUltimo(resultados: string): string | null {
  const t = String(resultados || '');
  const marcas = [...t.matchAll(/(?:^|\n)\s*\d{2}\/\d{2}/g)];
  if (marcas.length === 0) return null;
  const corte = marcas[marcas.length - 1].index ?? 0;
  const texto = t.slice(corte).trim();
  return texto.length > 0 ? texto : null;
}
