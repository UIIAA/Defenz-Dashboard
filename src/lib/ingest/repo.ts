// feature-migracao-neon (Fase 1) — gravação transacional no Neon.
//
// FORMA: cada lote vira 2–4 instruções SQL que leem o MESMO parâmetro `$1::jsonb`
// (o lote inteiro) via `jsonb_to_recordset`. Vantagens:
//   • uma ida ao banco por instrução, não por linha (11,5k ligações = 24 requisições);
//   • roda no driver HTTP do Neon, que só aceita transação NÃO-interativa
//     (`sql.transaction([...])`) — nenhuma instrução depende do resultado da anterior;
//   • as colunas gravadas são declaradas UMA vez aqui e conferidas contra o schema
//     em repo.test.ts — é o que impede o bug "coluna descartada em silêncio".
//
// IDEMPOTÊNCIA: upsert pela chave natural. Rodar o mesmo lote 2× não duplica.
// `(xmax = 0)` no RETURNING distingue inserido de atualizado (xmax = 0 → linha nova).

import { db } from '../db';
import { CLOSED_WON_STAGES } from '../metrics';
import type { ErroLinha, LinhaValidada, Tabela } from './schema';
import type { Resumo } from './paridade';

interface ColunaSQL {
  /** campo produzido pela validação (schema.ts) */
  campo: string;
  /** coluna no Postgres (default = mesmo nome do campo) */
  db?: string;
  /** tipo declarado no jsonb_to_recordset */
  tipo: string;
}

interface DimSQL {
  /** prefixo dos campos validados: `<prefixo>_norm` / `<prefixo>_exibicao` */
  prefixo: string;
  /** tabela de dimensão */
  dim: 'empresas' | 'pessoas';
  /** coluna FK na tabela destino */
  fk: string;
  alias: string;
}

interface DefSQL {
  destino: string;
  colunas: ColunaSQL[];
  dimensoes: DimSQL[];
  conflito: string[];
  /** campos consumidos por instruções extras (ex.: `tags` → deal_tags) */
  extras: string[];
  extraStmts?: string[];
}

const txt = (campo: string): ColunaSQL => ({ campo, tipo: 'text' });
const int = (campo: string): ColunaSQL => ({ campo, tipo: 'integer' });
const jsn = (campo: string): ColunaSQL => ({ campo, tipo: 'jsonb' });

const RESUMO_ESCALARES = [
  'ligacoes_total',
  'ligacoes_atendidas',
  'emails_total',
  'apresentacoes_total',
  'propostas_total',
  'reuniao_tecnica_total',
  'whatsapp_msgs',
  'whatsapp_convs',
  'linkedin_page',
  'linkedin_perfis',
  'pocs_ativas',
  'base_total_licencas',
  'base_clientes_ativos',
  'base_demais_count',
  'base_demais_licencas',
  'total_tracao',
];

const DEFS: Record<Tabela, DefSQL> = {
  deals: {
    destino: 'deals',
    conflito: ['id'],
    dimensoes: [{ prefixo: 'empresa', dim: 'empresas', fk: 'empresa_id', alias: 'e' }],
    extras: ['tags'],
    colunas: [
      txt('id'),
      txt('nome'),
      txt('cnpj'),
      txt('stage'),
      { campo: 'valor', tipo: 'numeric' },
      txt('lead_source'),
      txt('categoria'),
      { campo: 'comissao_valor', tipo: 'numeric' },
      int('licencas'),
      txt('temperatura'),
      { campo: 'created_time', tipo: 'date' },
      { campo: 'modified_time', tipo: 'date' },
      { campo: 'closing_date', tipo: 'date' },
      txt('resultados'),
    ],
    extraStmts: [
      // substituição completa: a tag some no Zoho → some aqui (o Zoho é a fonte)
      `delete from deal_tags where deal_id in
         (select r.id from jsonb_to_recordset($1::jsonb) as r(id text))`,
      `insert into deal_tags (deal_id, tag)
         select r.id, t.tag
         from jsonb_to_recordset($1::jsonb) as r(id text, tags jsonb)
         cross join lateral jsonb_array_elements_text(r.tags) as t(tag)
       on conflict do nothing`,
    ],
  },

  ligacoes: {
    destino: 'ligacoes',
    conflito: ['call_id'],
    dimensoes: [{ prefixo: 'agente', dim: 'pessoas', fk: 'agente_id', alias: 'p' }],
    extras: [],
    colunas: [
      txt('call_id'),
      { campo: 'data', tipo: 'date' },
      { campo: 'hora', tipo: 'time' },
      txt('destino'),
      int('duracao_seg'),
      txt('status'),
      txt('disposicao'),
    ],
  },

  emails: {
    destino: 'emails',
    conflito: ['email_id'],
    dimensoes: [],
    extras: [],
    colunas: [
      txt('email_id'),
      { campo: 'data', tipo: 'date' },
      { campo: 'hora', tipo: 'time' },
      txt('destinatario'),
      txt('destinatario_nome'),
      txt('assunto'),
      txt('status'),
      txt('sequencia'),
    ],
  },

  leads: {
    destino: 'leads',
    conflito: ['lead_id'],
    dimensoes: [
      { prefixo: 'empresa', dim: 'empresas', fk: 'empresa_id', alias: 'e' },
      { prefixo: 'owner', dim: 'pessoas', fk: 'owner_id', alias: 'o' },
    ],
    extras: [],
    colunas: [
      txt('lead_id'),
      txt('nome'),
      txt('lead_source'),
      txt('lead_status'),
      txt('telefone'),
      txt('email'),
      txt('resultados'),
      { campo: 'created_time', tipo: 'date' },
      { campo: 'modified_time', tipo: 'date' },
    ],
  },

  classificacao_ia: {
    destino: 'classificacoes_ia',
    conflito: ['lead_id', 'data_classificacao'],
    dimensoes: [],
    extras: [],
    colunas: [
      txt('lead_id'),
      { campo: 'data_classificacao', tipo: 'timestamptz' },
      txt('nivel_maximo'),
      txt('resultado_principal'),
      txt('concorrente'),
      txt('renovacao_concorrente'),
      txt('cargo_estimado'),
      txt('pessoa_contactada'),
      txt('resumo'),
      txt('resultados_snapshot'),
      { campo: 'passou_secretaria', tipo: 'boolean' },
      int('toques_estimados'),
    ],
  },

  agenda: {
    destino: 'agenda_tarefas',
    conflito: ['task_id'],
    dimensoes: [{ prefixo: 'owner', dim: 'pessoas', fk: 'owner_id', alias: 'o' }],
    extras: [],
    colunas: [
      txt('task_id'),
      txt('lead_id'),
      txt('subject'),
      txt('status'),
      txt('description'),
      txt('lead_status'),
      { campo: 'due_date', tipo: 'date' },
      { campo: 'is_overdue', tipo: 'boolean' },
    ],
  },

  resumo_diario: {
    destino: 'resumo_diario',
    conflito: ['data'],
    dimensoes: [],
    extras: [],
    colunas: [
      { campo: 'data', tipo: 'date' },
      { campo: 'atualizado_em', tipo: 'timestamptz' },
      txt('mode'),
      txt('coverage'),
      { campo: 'ligacoes_taxa', tipo: 'numeric' },
      ...RESUMO_ESCALARES.map(int),
      jsn('pocs_lista'),
      jsn('base_top_contas'),
      jsn('por_vendedor'),
      jsn('destaques'),
    ],
  },
};

const colunaDb = (c: ColunaSQL) => c.db ?? c.campo;
const compacta = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Todos os campos validados que este módulo grava. Confrontado com o schema no teste. */
export function camposConsumidos(tabela: Tabela): string[] {
  const def = DEFS[tabela];
  return [
    ...def.colunas.map((c) => c.campo),
    ...def.dimensoes.flatMap((d) => [`${d.prefixo}_norm`, `${d.prefixo}_exibicao`]),
    ...def.extras,
  ];
}

function stmtDimensao(d: DimSQL): string {
  return compacta(`
    insert into ${d.dim} (nome_norm, nome_exibicao)
    select distinct r.${d.prefixo}_norm, r.${d.prefixo}_exibicao
    from jsonb_to_recordset($1::jsonb) as r(${d.prefixo}_norm text, ${d.prefixo}_exibicao text)
    where r.${d.prefixo}_norm is not null
    on conflict (nome_norm) do nothing
  `);
}

function stmtPrincipal(def: DefSQL): string {
  const recordset = [
    ...def.colunas.map((c) => `${c.campo} ${c.tipo}`),
    ...def.dimensoes.map((d) => `${d.prefixo}_norm text`),
  ].join(', ');

  const destinoCols = [...def.colunas.map(colunaDb), ...def.dimensoes.map((d) => d.fk), 'ingerido_em'];
  const selectCols = [
    ...def.colunas.map((c) => `r.${c.campo}`),
    ...def.dimensoes.map((d) => `${d.alias}.id`),
    'now()',
  ];
  const joins = def.dimensoes
    .map((d) => `left join ${d.dim} ${d.alias} on ${d.alias}.nome_norm = r.${d.prefixo}_norm`)
    .join(' ');

  const setar = [
    ...def.colunas.map(colunaDb).filter((c) => !def.conflito.includes(c)),
    ...def.dimensoes.map((d) => d.fk),
  ]
    .map((c) => `${c} = excluded.${c}`)
    .concat('ingerido_em = now()')
    .join(', ');

  return compacta(`
    insert into ${def.destino} (${destinoCols.join(', ')})
    select ${selectCols.join(', ')}
    from jsonb_to_recordset($1::jsonb) as r(${recordset})
    ${joins}
    on conflict (${def.conflito.join(', ')}) do update set ${setar}
    returning (xmax = 0) as inserido
  `);
}

/** Instruções do lote, na ordem: dimensões → entidade → extras. */
export function sqlDoLote(tabela: Tabela): string[] {
  const def = DEFS[tabela];
  return [
    ...def.dimensoes.map(stmtDimensao),
    stmtPrincipal(def),
    ...(def.extraStmts ?? []).map(compacta),
  ];
}

export interface ResultadoGravacao {
  inseridos: number;
  atualizados: number;
  orfaos: number;
  erros: ErroLinha[];
}

// `classificacoes_ia` e `agenda_tarefas` têm FK real pra `leads`. O que fazer quando o
// lead referenciado não existe depende do que a linha SIGNIFICA sem ele:
//
//   agenda           → 'anular'  a tarefa (assunto, prazo, dono) é dado válido por si;
//                                o lead é atributo. Guarda com lead_id NULL e conta.
//                                Achado 28/07: 145 das 279 tarefas da aba apontam pra
//                                lead que não está na aba `leads` — rejeitar jogaria
//                                metade da agenda fora. Se o lead aparecer depois, o
//                                upsert religa a FK sozinho.
//   classificacao_ia → 'rejeitar' uma classificação sem lead não significa nada, e o
//                                lead é METADE da chave natural (lead_id, data).
//                                Rejeita e reporta; o run seguinte grava.
type ModoOrfao = 'anular' | 'rejeitar';

const DEPENDE_DE_LEAD: Partial<Record<Tabela, ModoOrfao>> = {
  agenda: 'anular',
  classificacao_ia: 'rejeitar',
};

export interface ParticaoOrfaos {
  gravaveis: LinhaValidada[];
  erros: ErroLinha[];
  orfaos: number;
}

const ehTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Parte o lote conforme o modo da tabela. Puro — o SELECT de `existentes` fica fora. */
export function classificarOrfaos(
  tabela: Tabela,
  validas: LinhaValidada[],
  existentes: Set<string>
): ParticaoOrfaos {
  const modo = DEPENDE_DE_LEAD[tabela];
  if (!modo) return { gravaveis: validas, erros: [], orfaos: 0 };

  const gravaveis: LinhaValidada[] = [];
  const erros: ErroLinha[] = [];
  let orfaos = 0;

  for (const linha of validas) {
    const id = linha.lead_id;
    // lead_id vazio não é órfão: é tarefa sem lead nenhum
    if (!ehTexto(id) || existentes.has(id)) {
      gravaveis.push(linha);
      continue;
    }
    orfaos++;
    if (modo === 'anular') {
      gravaveis.push({ ...linha, lead_id: null });
    } else {
      const i = typeof linha._i === 'number' ? linha._i : -1;
      erros.push({ linha: i, campo: 'lead_id', motivo: `lead ${id} ainda não ingerido` });
    }
  }
  return { gravaveis, erros, orfaos };
}

async function separarOrfaos(tabela: Tabela, validas: LinhaValidada[]): Promise<ParticaoOrfaos> {
  if (!DEPENDE_DE_LEAD[tabela]) return { gravaveis: validas, erros: [], orfaos: 0 };

  const ids = [...new Set(validas.map((l) => l.lead_id).filter(ehTexto))];
  if (!ids.length) return { gravaveis: validas, erros: [], orfaos: 0 };

  const rows = (await db()`select lead_id from leads where lead_id = any(${ids})`) as {
    lead_id: string;
  }[];
  return classificarOrfaos(tabela, validas, new Set(rows.map((r) => r.lead_id)));
}

export async function gravarLote(
  tabela: Tabela,
  validas: LinhaValidada[]
): Promise<ResultadoGravacao> {
  if (!validas.length) return { inseridos: 0, atualizados: 0, orfaos: 0, erros: [] };

  const { gravaveis, erros, orfaos } = await separarOrfaos(tabela, validas);
  if (!gravaveis.length) return { inseridos: 0, atualizados: 0, orfaos, erros };

  const stmts = sqlDoLote(tabela);
  const payload = JSON.stringify(gravaveis);

  const resultados = (await db().transaction((tx) =>
    stmts.map((s) => tx.query(s, [payload]))
  )) as { inserido: boolean }[][];

  const principal = resultados[stmts.findIndex((s) => s.includes('(xmax = 0) as inserido'))] ?? [];
  const inseridos = principal.filter((r) => r.inserido).length;

  return { inseridos, atualizados: principal.length - inseridos, orfaos, erros };
}

// --- lado Neon do portão de paridade -------------------------------------
// Espelha resumirSheets() 1:1. Se um dos dois mudar, o outro TEM que mudar junto.

export async function resumirNeon(tabela: Tabela): Promise<Resumo> {
  const sql = db();
  switch (tabela) {
    case 'deals': {
      const [r] = (await sql`select count(*)::int as contagem,
                                    coalesce(sum(valor), 0)::float8 as soma_valor,
                                    coalesce(sum(licencas), 0)::int as soma_licencas,
                                    count(*) filter (where lower(trim(stage)) = any(${CLOSED_WON_STAGES}))::int as ganhos
                             from deals`) as Resumo[];
      return r;
    }
    case 'ligacoes': {
      const [r] = (await sql`select count(*)::int as contagem,
                                    coalesce(sum(duracao_seg), 0)::int as soma_duracao,
                                    to_char(min(data), 'YYYY-MM-DD') as data_min,
                                    to_char(max(data), 'YYYY-MM-DD') as data_max
                             from ligacoes`) as Resumo[];
      return r;
    }
    case 'emails': {
      const [r] = (await sql`select count(*)::int as contagem,
                                    to_char(min(data), 'YYYY-MM-DD') as data_min,
                                    to_char(max(data), 'YYYY-MM-DD') as data_max
                             from emails`) as Resumo[];
      return r;
    }
    case 'leads': {
      const [r] = (await sql`select count(*)::int as contagem from leads`) as Resumo[];
      return r;
    }
    case 'classificacao_ia': {
      const [r] = (await sql`select count(distinct lead_id)::int as leads_distintos
                             from classificacoes_ia`) as Resumo[];
      return r;
    }
    case 'agenda': {
      const [r] = (await sql`select count(*)::int as contagem from agenda_tarefas`) as Resumo[];
      return r;
    }
    case 'resumo_diario': {
      const [r] = (await sql`select count(*)::int as contagem,
                                    to_char(min(data), 'YYYY-MM-DD') as data_min,
                                    to_char(max(data), 'YYYY-MM-DD') as data_max
                             from resumo_diario`) as Resumo[];
      return r;
    }
  }
}

/** Datas com snapshot no Neon — alimenta a checagem "nenhum dia útil faltando". */
export async function datasDoResumo(): Promise<string[]> {
  const rows = (await db()`select to_char(data, 'YYYY-MM-DD') as data
                           from resumo_diario order by data`) as { data: string }[];
  return rows.map((r) => r.data);
}
