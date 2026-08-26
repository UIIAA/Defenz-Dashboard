// feature-migracao-neon (Fase 1) — fonte única da FORMA dos dados que entram no Neon.
//
// POR QUE ISSO EXISTE EM CÓDIGO E NÃO NA UI DO n8n (spec §Decisões 2): o mapeamento de
// colunas dentro do n8n já falhou EM SILÊNCIO duas vezes (a coluna `licencas` era
// descartada; a aba `reunioes` lia a sheet-0 e 11,5k ligações viravam reunião). Aqui,
// campo faltando/torto é ERRO REPORTADO na resposta — nunca um número errado.
//
// REGRA (spec §Riscos 2): ausência vira o default da coluna; LIXO é rejeitado.
//   valor: null/''  → 0        (o default de `valor numeric not null default 0`)
//   valor: 'R$ 12,5'→ rejeita  (não é zero: é uma linha que ninguém revisou)
// No `resumo_diario` a distinção null-vs-0 é semântica (types.ts §Captured: 0 = capturado
// e é zero; null = NÃO capturado) — por isso lá os escalares usam os coercers *Nulo.

import { nomeNorm, splitTags } from './normalize';
import { cnpjValido, somenteDigitos } from '../cnpj';

export const TABELAS = [
  'deals',
  'ligacoes',
  'emails',
  'leads',
  'classificacao_ia',
  'agenda',
  'resumo_diario',
] as const;

export type Tabela = (typeof TABELAS)[number];

export function isTabela(v: unknown): v is Tabela {
  return typeof v === 'string' && (TABELAS as readonly string[]).includes(v);
}

export interface ErroLinha {
  linha: number;
  campo: string;
  motivo: string;
}

export type LinhaValidada = Record<string, unknown>;

export interface ResultadoValidacao {
  validas: LinhaValidada[];
  erros: ErroLinha[];
  duplicados: number;
}

// --- coercers -------------------------------------------------------------
// Cada um devolve o valor coagido OU o motivo da rejeição. Nunca lança.

type Coercao = { ok: true; v: unknown } | { ok: false; motivo: string };
type Coercer = (v: unknown) => Coercao;

const ok = (v: unknown): Coercao => ({ ok: true, v });
const nok = (motivo: string): Coercao => ({ ok: false, motivo });

const vazio = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim());

const texto: Coercer = (v) => {
  if (vazio(v)) return ok(null);
  if (typeof v === 'number') return Number.isFinite(v) ? ok(String(v)) : nok('número inválido');
  if (typeof v === 'boolean') return ok(String(v));
  if (typeof v !== 'string') return nok('esperado texto');
  return ok(v.trim());
};

/** Envolve um coercer tornando o campo obrigatório (null vira rejeição). */
const obrig = (c: Coercer): Coercer => (v) => {
  const r = c(v);
  if (!r.ok) return r;
  return r.v === null ? nok('obrigatório') : r;
};

const NUM_RE = /^-?\d+(\.\d+)?$/;

/** Ausente → 0 (default da coluna). Lixo → rejeita. */
const numero: Coercer = (v) => {
  if (vazio(v)) return ok(0);
  if (typeof v === 'number') return Number.isFinite(v) ? ok(v) : nok('número inválido');
  if (typeof v !== 'string') return nok('número inválido');
  const t = v.trim();
  return NUM_RE.test(t) ? ok(Number(t)) : nok('número inválido');
};

const inteiro: Coercer = (v) => {
  const r = numero(v);
  if (!r.ok) return r;
  return Number.isInteger(r.v) ? r : nok('esperado inteiro');
};

/** Ausente → null (preserva a distinção "não capturado" do resumo diário). */
const numeroNulo: Coercer = (v) => (vazio(v) ? ok(null) : numero(v));
const inteiroNulo: Coercer = (v) => (vazio(v) ? ok(null) : inteiro(v));

const DATA_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;

const data: Coercer = (v) => {
  if (vazio(v)) return ok(null);
  if (typeof v !== 'string') return nok('data inválida (esperado YYYY-MM-DD)');
  const m = v.trim().match(DATA_RE);
  if (!m) return nok('data inválida (esperado YYYY-MM-DD)');
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  // roundtrip pega 2026-02-30, que o Date "conserta" pra 2026-03-02 em silêncio
  if (Number.isNaN(d.getTime()) || !d.toISOString().startsWith(iso)) {
    return nok('data inválida (esperado YYYY-MM-DD)');
  }
  return ok(iso);
};

const HORA_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const hora: Coercer = (v) => {
  if (vazio(v)) return ok(null);
  if (typeof v !== 'string') return nok('hora inválida (esperado HH:MM[:SS])');
  const m = v.trim().match(HORA_RE);
  if (!m) return nok('hora inválida (esperado HH:MM[:SS])');
  const [h, min, seg] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (h > 23 || min > 59 || seg > 59) return nok('hora inválida (esperado HH:MM[:SS])');
  const p = (n: number) => String(n).padStart(2, '0');
  return ok(`${p(h)}:${p(min)}:${p(seg)}`);
};

const timestamp: Coercer = (v) => {
  if (vazio(v)) return ok(null);
  if (typeof v !== 'string') return nok('timestamp inválido (esperado ISO 8601)');
  const t = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return nok('timestamp inválido (esperado ISO 8601)');
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return nok('timestamp inválido (esperado ISO 8601)');
  return ok(new Date(ms).toISOString());
};

const VERDADE = new Set(['sim', 'true', '1', 'yes', 'verdadeiro', 's']);
const FALSIDADE = new Set(['nao', 'não', 'false', '0', 'no', 'n']);

const booleano: Coercer = (v) => {
  if (vazio(v)) return ok(null);
  if (typeof v === 'boolean') return ok(v);
  if (typeof v === 'number') {
    if (v === 1) return ok(true);
    if (v === 0) return ok(false);
    return nok('booleano inválido');
  }
  if (typeof v !== 'string') return nok('booleano inválido');
  const t = v.trim().toLowerCase();
  if (VERDADE.has(t)) return ok(true);
  if (FALSIDADE.has(t)) return ok(false);
  return nok('booleano inválido');
};

/** Coluna JSON serializada do Sheets → estrutura (vai pra coluna jsonb). */
const json: Coercer = (v) => {
  if (vazio(v)) return ok(null);
  if (typeof v === 'object') return ok(v);
  if (typeof v !== 'string') return nok('JSON inválido');
  try {
    return ok(JSON.parse(v));
  } catch {
    return nok('JSON inválido');
  }
};

/**
 * CNPJ (feature-cnpj-identidade-empresa). Guarda só os 14 dígitos — a máscara é
 * apresentação. O `Format Deals Raw` já entrega vazio quando nenhum dos dois campos do
 * Zoho passa no dígito verificador, então CNPJ inválido chegando aqui é bug upstream:
 * REJEITA e reporta, não guarda torto (mesma regra de `valor: 'R$ 12,5'`).
 */
const cnpj: Coercer = (v) => {
  const r = texto(v);
  if (!r.ok || r.v === null) return r;
  const digitos = somenteDigitos(r.v);
  if (!cnpjValido(digitos)) return nok('CNPJ inválido (dígito verificador)');
  return ok(digitos);
};

const CATEGORIAS = ['direto', 'parceiro', 'securisoft'];

const categoria: Coercer = (v) => {
  const r = texto(v);
  if (!r.ok || r.v === null) return r;
  const t = String(r.v).toLowerCase();
  return CATEGORIAS.includes(t) ? ok(t) : nok(`fora de (${CATEGORIAS.join('|')})`);
};

// --- definição das tabelas -----------------------------------------------
// campos: [coluna de destino, coluna de origem (como vem do n8n/Sheets), coercer]

type Campo = [destino: string, origem: string, coercer: Coercer];

interface DefTabela {
  campos: Campo[];
  /** dimensões: origem → prefixo (gera `<prefixo>_norm` e `<prefixo>_exibicao`) */
  dimensoes?: Record<string, string>;
  /** chave natural — usada pra deduplicar dentro do lote (a PK do Postgres não perdoa) */
  chave: string[];
  /** campos produzidos por `pos` (não têm coluna de origem 1:1) */
  extras?: string[];
  /** colunas de ORIGEM lidas por `pos` (não aparecem em `campos`) */
  origensExtras?: string[];
  /** ajustes que dependem de mais de um campo (tags, agrupamentos jsonb) */
  pos?: (bruta: Record<string, unknown>, saida: LinhaValidada, erros: (campo: string, motivo: string) => void) => void;
}

const DEFS: Record<Tabela, DefTabela> = {
  deals: {
    chave: ['id'],
    extras: ['tags'],
    dimensoes: { empresa: 'empresa' },
    campos: [
      ['id', 'id', obrig(texto)],
      ['nome', 'nome', obrig(texto)],
      ['cnpj', 'cnpj', cnpj],
      ['stage', 'stage', obrig(texto)],
      ['valor', 'valor', numero],
      ['lead_source', 'lead_source', texto],
      ['categoria', 'categoria', categoria],
      ['comissao_valor', 'comissao_valor', numero],
      ['licencas', 'licencas', inteiro],
      ['created_time', 'created_time', data],
      ['modified_time', 'modified_time', data],
      ['closing_date', 'closing_date', data],
      ['resultados', 'resultados', texto],
      // feature-semaforo-oportunidades — normalizado na origem pelo `Format Deals Raw`
      // ('quente'|'morno'|'frio'|''). Aqui é só texto: valor torto vira '' antes de chegar.
      ['temperatura', 'temperatura', texto],
    ],
    pos: (bruta, saida) => {
      saida.tags = splitTags(typeof bruta.tags === 'string' ? bruta.tags : null);
    },
  },

  ligacoes: {
    chave: ['call_id'],
    dimensoes: { agente: 'agente' },
    campos: [
      ['call_id', 'call_id', obrig(texto)],
      ['data', 'data', obrig(data)],
      ['hora', 'hora', hora],
      ['destino', 'destino', texto],
      ['duracao_seg', 'duracao_seg', inteiro],
      ['status', 'status', texto],
      ['disposicao', 'disposicao', texto],
    ],
  },

  emails: {
    chave: ['email_id'],
    campos: [
      ['email_id', 'email_id', obrig(texto)],
      ['data', 'data', obrig(data)],
      ['hora', 'hora', hora],
      ['destinatario', 'destinatario', texto],
      ['destinatario_nome', 'destinatario_nome', texto],
      ['assunto', 'assunto', texto],
      ['status', 'status', texto],
      ['sequencia', 'sequencia', texto],
    ],
  },

  leads: {
    chave: ['lead_id'],
    dimensoes: { empresa: 'empresa', owner: 'owner' },
    campos: [
      ['lead_id', 'lead_id', obrig(texto)],
      ['nome', 'nome', texto],
      ['lead_source', 'lead_source', texto],
      ['lead_status', 'lead_status', texto],
      ['telefone', 'telefone', texto],
      ['email', 'email', texto],
      ['resultados', 'resultados', texto],
      ['created_time', 'created_time', data],
      ['modified_time', 'modified_time', data],
    ],
  },

  classificacao_ia: {
    // append-only: a chave inclui a data pra preservar o histórico do mesmo lead
    chave: ['lead_id', 'data_classificacao'],
    campos: [
      ['lead_id', 'lead_id', obrig(texto)],
      ['data_classificacao', 'data_classificacao', obrig(timestamp)],
      ['nivel_maximo', 'nivel_maximo', texto],
      ['resultado_principal', 'resultado_principal', texto],
      ['concorrente', 'concorrente', texto],
      ['renovacao_concorrente', 'renovacao_concorrente', texto],
      ['cargo_estimado', 'cargo_estimado', texto],
      ['pessoa_contactada', 'pessoa_contactada', texto],
      ['resumo', 'resumo', texto],
      ['resultados_snapshot', 'resultados_snapshot', texto],
      ['passou_secretaria', 'passou_secretaria', booleano],
      ['toques_estimados', 'toques_estimados', inteiroNulo],
    ],
  },

  agenda: {
    chave: ['task_id'],
    dimensoes: { owner: 'owner' },
    campos: [
      ['task_id', 'task_id', obrig(texto)],
      ['lead_id', 'lead_id', texto],
      ['subject', 'subject', texto],
      ['status', 'status', texto],
      ['description', 'description', texto],
      ['lead_status', 'lead_status', texto],
      ['due_date', 'due_date', data],
      ['is_overdue', 'is_overdue', booleano],
    ],
  },

  resumo_diario: {
    chave: ['data'],
    extras: ['por_vendedor', 'destaques'],
    origensExtras: [
      'ligacoes_por_vendedor',
      'emails_por_sender',
      'apresentacoes_por_vendedor',
      'propostas_por_vendedor',
      'reuniao_por_vendedor',
      'destaque_comercial',
      'destaque_marketing',
      'destaque_execucao',
      'destaque_atencao',
    ],
    campos: [
      ['data', 'data', obrig(data)],
      ['atualizado_em', 'atualizado_em', timestamp],
      ['mode', 'mode', texto],
      ['coverage', 'coverage', texto], // spec: `mode, coverage text` — opaco de propósito
      ['ligacoes_total', 'ligacoes_total', inteiroNulo],
      ['ligacoes_atendidas', 'ligacoes_atendidas', inteiroNulo],
      ['ligacoes_taxa', 'ligacoes_taxa', numeroNulo],
      ['emails_total', 'emails_total', inteiroNulo],
      ['apresentacoes_total', 'apresentacoes_total', inteiroNulo],
      ['propostas_total', 'propostas_total', inteiroNulo],
      ['reuniao_tecnica_total', 'reuniao_tecnica_total', inteiroNulo],
      ['whatsapp_msgs', 'whatsapp_msgs', inteiroNulo],
      ['whatsapp_convs', 'whatsapp_convs', inteiroNulo],
      ['linkedin_page', 'linkedin_page', inteiroNulo],
      ['linkedin_perfis', 'linkedin_perfis', inteiroNulo],
      ['pocs_ativas', 'pocs_ativas', inteiroNulo],
      ['base_total_licencas', 'base_total_licencas', inteiroNulo],
      ['base_clientes_ativos', 'base_clientes_ativos', inteiroNulo],
      ['base_demais_count', 'base_demais_count', inteiroNulo],
      ['base_demais_licencas', 'base_demais_licencas', inteiroNulo],
      ['total_tracao', 'total_tracao', inteiroNulo],
      ['pocs_lista', 'pocs_lista', json],
      ['base_top_contas', 'base_top_contas', json],
    ],
    pos: (bruta, saida, erro) => {
      // 5 colunas JSON viram UMA estrutura consultável (spec §agregados → jsonb)
      const grupos: Record<string, string> = {
        ligacoes: 'ligacoes_por_vendedor',
        emails: 'emails_por_sender',
        apresentacoes: 'apresentacoes_por_vendedor',
        propostas: 'propostas_por_vendedor',
        reuniao: 'reuniao_por_vendedor',
      };
      const porVendedor: Record<string, unknown> = {};
      for (const [chave, coluna] of Object.entries(grupos)) {
        const r = json(bruta[coluna]);
        if (!r.ok) erro(coluna, r.motivo);
        else porVendedor[chave] = r.v;
      }
      saida.por_vendedor = porVendedor;

      const destaques: Record<string, unknown> = {};
      for (const chave of ['comercial', 'marketing', 'execucao', 'atencao']) {
        const r = texto(bruta[`destaque_${chave}`]);
        if (!r.ok) erro(`destaque_${chave}`, r.motivo);
        else destaques[chave] = r.v;
      }
      saida.destaques = destaques;
    },
  },
};

export function camposDaTabela(tabela: Tabela): string[] {
  const def = DEFS[tabela];
  const dims = Object.values(def.dimensoes ?? {}).flatMap((p) => [`${p}_norm`, `${p}_exibicao`]);
  return [...def.campos.map(([destino]) => destino), ...dims, ...(def.extras ?? [])];
}

/** Colunas de ORIGEM que a tabela consome (o que o n8n/Sheets precisa mandar). */
export function origensDaTabela(tabela: Tabela): string[] {
  const def = DEFS[tabela];
  return [
    ...def.campos.map(([, origem]) => origem),
    ...Object.keys(def.dimensoes ?? {}),
    ...(def.origensExtras ?? []),
  ];
}

/**
 * Ordem POSICIONAL das 32 células que o nó `Build Row` do workflow n8n
 * `aMhvdTP5aAi0Z1sf` (Snapshot Diário) monta pra gravar a aba `resumo_diario`.
 *
 * Está aqui — e não só no n8n — porque posição é contrato invisível: inserir uma
 * coluna no meio desloca tudo e o número errado entra sem ninguém ver. Um teste
 * confere esta lista contra `origensDaTabela('resumo_diario')`; se o Build Row mudar
 * e esta lista não, o teste quebra antes do dado entrar torto.
 */
export const COLUNAS_ROW_VALUES = [
  'data',
  'atualizado_em',
  'mode',
  'coverage',
  'ligacoes_total',
  'ligacoes_atendidas',
  'ligacoes_taxa',
  'ligacoes_por_vendedor',
  'emails_total',
  'emails_por_sender',
  'apresentacoes_total',
  'apresentacoes_por_vendedor',
  'propostas_total',
  'propostas_por_vendedor',
  'reuniao_tecnica_total',
  'reuniao_por_vendedor',
  'whatsapp_msgs',
  'whatsapp_convs',
  'linkedin_page',
  'linkedin_perfis',
  'pocs_ativas',
  'pocs_lista',
  'base_total_licencas',
  'base_clientes_ativos',
  'base_top_contas',
  'base_demais_count',
  'base_demais_licencas',
  'total_tracao',
  'destaque_comercial',
  'destaque_marketing',
  'destaque_execucao',
  'destaque_atencao',
] as const;

/** Converte o array posicional do `Build Row` na linha nomeada que a rota espera. */
export function linhaDeRowValues(rowValues: unknown[]): Record<string, unknown> {
  if (!Array.isArray(rowValues) || rowValues.length !== COLUNAS_ROW_VALUES.length) {
    throw new Error(
      `row_values precisa ter ${COLUNAS_ROW_VALUES.length} posições (recebido ${
        Array.isArray(rowValues) ? rowValues.length : typeof rowValues
      }) — o Build Row mudou?`
    );
  }
  return Object.fromEntries(COLUNAS_ROW_VALUES.map((c, i) => [c, rowValues[i]]));
}

export function chaveDaTabela(tabela: Tabela): string[] {
  return DEFS[tabela].chave;
}

export function dimensoesDaTabela(tabela: Tabela): Record<string, string> {
  return DEFS[tabela].dimensoes ?? {};
}

/**
 * Valida e normaliza um lote. Linha inválida é REJEITADA e reportada com índice,
 * campo e motivo — nunca coagida em silêncio (spec §Rota de ingestão).
 * Chave repetida dentro do lote é deduplicada (a última vence) e contada em
 * `duplicados`: o `on conflict` do Postgres não aceita afetar a mesma linha 2×.
 */
export function validarLote(tabela: Tabela, linhas: unknown[]): ResultadoValidacao {
  const def = DEFS[tabela];
  const erros: ErroLinha[] = [];
  const validas: LinhaValidada[] = [];

  linhas.forEach((bruta, i) => {
    if (typeof bruta !== 'object' || bruta === null || Array.isArray(bruta)) {
      erros.push({ linha: i, campo: '_linha', motivo: 'esperado objeto' });
      return;
    }
    const origem = bruta as Record<string, unknown>;
    const saida: LinhaValidada = {};
    let ruim = false;
    const erro = (campo: string, motivo: string) => {
      ruim = true;
      erros.push({ linha: i, campo, motivo });
    };

    for (const [destino, col, coercer] of def.campos) {
      const r = coercer(origem[col]);
      if (!r.ok) erro(col, r.motivo);
      else saida[destino] = r.v;
    }

    for (const [col, prefixo] of Object.entries(def.dimensoes ?? {})) {
      const r = texto(origem[col]);
      if (!r.ok) {
        erro(col, r.motivo);
        continue;
      }
      const exibicao = r.v === null ? null : String(r.v).replace(/\s+/g, ' ');
      saida[`${prefixo}_norm`] = nomeNorm(exibicao);
      saida[`${prefixo}_exibicao`] = saida[`${prefixo}_norm`] ? exibicao : null;
    }

    def.pos?.(origem, saida, erro);

    saida._i = i; // índice da linha no lote — a rota usa pra reportar rejeição tardia (FK)
    if (!ruim) validas.push(saida);
  });

  // dedupe pela chave natural — a última ocorrência é a mais recente
  const porChave = new Map<string, LinhaValidada>();
  for (const linha of validas) {
    porChave.set(def.chave.map((c) => String(linha[c])).join(' '), linha);
  }

  return {
    validas: [...porChave.values()],
    erros,
    duplicados: validas.length - porChave.size,
  };
}
