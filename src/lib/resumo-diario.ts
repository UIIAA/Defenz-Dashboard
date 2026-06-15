// Resumo Diário (feature-016) — parsing + date helpers for the daily snapshot.
// All dates are BRT (America/Sao_Paulo) calendar dates compared as strings.

import type {
  RawResumoDiario,
  ResumoDiario,
  ResumoCoverage,
  ResumoSeriePoint,
  VendedorCalls,
} from './types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const BACKFILL_MAX_DAYS = 120;

// --- BRT date helpers (never use toISOString — that's UTC and drifts after 21h BRT) ---

export function todayBRT(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Add (or subtract) days to a YYYY-MM-DD string using UTC math (no tz drift).
export function addDays(dateStr: string, n: number): string {
  if (!DATE_RE.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Clamp a requested date into [today-120, today] (BRT).
export function clampData(data: string, today: string): string {
  const floor = addDays(today, -BACKFILL_MAX_DAYS);
  if (!DATE_RE.test(data)) return today;
  if (data > today) return today;
  if (data < floor) return floor;
  return data;
}

// --- Cell coercion with null semantics ---

function num(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// null = não capturado / não-histórico (UI shows "—"); 0 = real captured zero.
function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function jsonOrNull<T>(v: unknown): T | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

function jsonOr<T>(v: unknown, fallback: T): T {
  const parsed = jsonOrNull<T>(v);
  return parsed === null ? fallback : parsed;
}

const DEFAULT_COVERAGE: ResumoCoverage = {
  ligacoes_fresh: true,
  emails_source: 'chat',
  manual_source: 'chat',
  base_source: 'none',
  partial_tracao: false,
};

// --- RawResumoDiario (gviz row) → ResumoDiario (typed, null-aware) ---

export function parseResumoRow(raw: RawResumoDiario): ResumoDiario {
  const data = String(raw.data ?? '').slice(0, 10);
  const mode = raw.mode === 'backfill' ? 'backfill' : 'live';
  const aproximado = mode === 'backfill';

  const pocsAtivas = numOrNull(raw.pocs_ativas);
  const baseLicencas = numOrNull(raw.base_total_licencas);

  return {
    data,
    atualizado_em: String(raw.atualizado_em ?? ''),
    mode,
    coverage: { ...DEFAULT_COVERAGE, ...jsonOr<Partial<ResumoCoverage>>(raw.coverage, {}) },
    ligacoes: {
      total: num(raw.ligacoes_total),
      atendidas: num(raw.ligacoes_atendidas),
      taxa: num(raw.ligacoes_taxa),
      por_vendedor: jsonOr<Record<string, VendedorCalls>>(raw.ligacoes_por_vendedor, {}),
    },
    emails: {
      total: numOrNull(raw.emails_total),
      por_sender: jsonOrNull<Record<string, number>>(raw.emails_por_sender),
    },
    apresentacoes: {
      total: numOrNull(raw.apresentacoes_total),
      aproximado: aproximado && raw.apresentacoes_total != null && raw.apresentacoes_total !== '',
      por_vendedor: jsonOrNull<Record<string, number>>(raw.apresentacoes_por_vendedor),
    },
    propostas: {
      total: numOrNull(raw.propostas_total),
      aproximado: aproximado && raw.propostas_total != null && raw.propostas_total !== '',
      por_vendedor: jsonOrNull<Record<string, number>>(raw.propostas_por_vendedor),
    },
    reuniao_tecnica: {
      total: numOrNull(raw.reuniao_tecnica_total),
      por_vendedor: jsonOrNull<Record<string, number>>(raw.reuniao_por_vendedor),
    },
    whatsapp: { msgs: numOrNull(raw.whatsapp_msgs), convs: numOrNull(raw.whatsapp_convs) },
    linkedin: { page: numOrNull(raw.linkedin_page), perfis: numOrNull(raw.linkedin_perfis) },
    pocs: pocsAtivas === null
      ? null
      : { ativas: pocsAtivas, lista: jsonOr<string[]>(raw.pocs_lista, []) },
    base_instalada: baseLicencas === null
      ? null
      : {
          total_licencas: baseLicencas,
          clientes_ativos: num(raw.base_clientes_ativos),
          top_contas: jsonOr<{ name: string; licencas: number }[]>(raw.base_top_contas, []),
          demais_count: num(raw.base_demais_count),
          demais_licencas: num(raw.base_demais_licencas),
        },
    destaques: {
      comercial: strOrNull(raw.destaque_comercial),
      marketing: strOrNull(raw.destaque_marketing),
      execucao: strOrNull(raw.destaque_execucao),
      atencao: strOrNull(raw.destaque_atencao),
    },
    total_tracao: numOrNull(raw.total_tracao),
  };
}

// --- Aggregate helpers over a set of raw rows ---

// Keep one row per `data` (the one with the latest atualizado_em).
export function dedupeByData(raws: RawResumoDiario[]): RawResumoDiario[] {
  const byData = new Map<string, RawResumoDiario>();
  for (const r of raws) {
    const d = String(r.data ?? '').slice(0, 10);
    if (!DATE_RE.test(d)) continue;
    const prev = byData.get(d);
    if (!prev || String(r.atualizado_em ?? '') > String(prev.atualizado_em ?? '')) {
      byData.set(d, r);
    }
  }
  return Array.from(byData.values());
}

export function availableDates(raws: RawResumoDiario[]): string[] {
  return dedupeByData(raws)
    .map(r => String(r.data ?? '').slice(0, 10))
    .filter(d => DATE_RE.test(d))
    .sort();
}

// Last `n` days ending at `endDate` (inclusive), for the Tração Diária chart.
export function buildSerie(
  raws: RawResumoDiario[],
  endDate: string,
  n = 30
): ResumoSeriePoint[] {
  const startDate = addDays(endDate, -(n - 1));
  return dedupeByData(raws)
    .map(parseResumoRow)
    .filter(r => DATE_RE.test(r.data) && r.data >= startDate && r.data <= endDate)
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(r => ({
      data: r.data,
      total_tracao: r.total_tracao,
      ligacoes: r.ligacoes.total,
      emails: r.emails.total,
      whatsapp: r.whatsapp.msgs,
      linkedin:
        r.linkedin.page === null && r.linkedin.perfis === null
          ? null
          : (r.linkedin.page ?? 0) + (r.linkedin.perfis ?? 0),
      apresentacoes: r.apresentacoes.total,
      propostas: r.propostas.total,
      reuniao: r.reuniao_tecnica.total,
    }));
}

// Floor of the date navigator: earliest available snapshot, but never before today-120.
export function navigatorFloor(dates: string[], today: string): string {
  const hardFloor = addDays(today, -BACKFILL_MAX_DAYS);
  const earliest = dates.length ? dates[0] : null;
  return earliest && earliest > hardFloor ? earliest : hardFloor;
}
