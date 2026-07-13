// Farol de Metas (feature-farol-metas, Fase 1) — função pura determinística.
// "Tô batendo os R$6k desta semana? E o mês?" — número absoluto (% da meta) + cor de ritmo (pace).
// Sem fetch, sem Zoho, sem banco: recebe os RawDeal[] já carregados do Sheets + `now`.
// Todas as janelas em America/Sao_Paulo (UTC-3 o ano todo; Brasil sem horário de verão).

import type { RawDeal, Farol, FarolBucket, FarolCor, FarolLabel } from './types';
import { isClosedWon, dateInRange } from './metrics';

// --- Config (defaults da spec §2/§9) ---
export const GOAL_WEEK = 6000;          // meta semanal fixa
const AMARELO = 0.8;                    // threshold amarelo (≥ 0.8×esperado)
const STRICT_WON = false;               // false → reusa isClosedWon (inclui "contrato enviado", reconcilia com o dashboard)

const TZ = 'America/Sao_Paulo';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isWon(stage: string | undefined): boolean {
  const s = String(stage ?? '').toLowerCase().trim();
  return STRICT_WON ? s === 'fechado ganho' : isClosedWon(s);
}

// --- BRT date/time helpers ---
// Exportados (não privados) para reuso em src/lib/metas.ts (Fase 2 — Farol de
// Metas) sem duplicar a lógica de semana ISO / pace. Ver docs/features/feature-farol-metas.md.

export interface BrtParts { date: string; dow: number; hour: number; minute: number; }

// Wall-clock BRT de um instante. `dow` = ISO weekday (Seg=1 … Dom=7).
export function brtParts(now: Date): BrtParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  let hour = parseInt(get('hour'), 10); if (hour === 24) hour = 0;
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  return { date, dow: isoDow(date), hour, minute: parseInt(get('minute'), 10) };
}

// ISO weekday (Seg=1 … Dom=7) de um YYYY-MM-DD. Math UTC só-data (à prova de fuso).
export function isoDow(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Dom..6=Sáb
  return wd === 0 ? 7 : wd;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Segunda-feira (YYYY-MM-DD) da semana que contém dateStr.
export function mondayOf(dateStr: string): string {
  return addDays(dateStr, -(isoDow(dateStr) - 1));
}

// Segundas (YYYY-MM-DD) cuja data cai no mês YYYY-MM.
function mondaysInMonth(ym: string): string[] {
  const [y, m] = ym.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${ym}-${String(day).padStart(2, '0')}`;
    if (isoDow(ds) === 1) out.push(ds);
  }
  return out;
}

// Fração de pace da semana [0,1]: rampa Seg 08:00 → Sex 23:59; Sáb/Dom = 1 (overtime).
export function weekElapsed(p: BrtParts): number {
  const RAMP_START = 8 * 60;                    // Seg 08:00 (min desde Seg 00:00)
  const RAMP_END = 4 * 1440 + 23 * 60 + 59;     // Sex 23:59
  if (p.dow >= 6) return 1;                      // Sáb/Dom = overtime
  const mow = (p.dow - 1) * 1440 + p.hour * 60 + p.minute;
  if (mow <= RAMP_START) return 0;
  if (mow >= RAMP_END) return 1;
  return (mow - RAMP_START) / (RAMP_END - RAMP_START);
}

export function sumWon(deals: RawDeal[], start: string, end: string): number {
  let s = 0;
  for (const d of deals) {
    if (isWon(d.stage) && dateInRange(d.closing_date, start, end)) {
      s += Number(d.valor) || 0;
    }
  }
  return s;
}

export function grade(revenue: number, goal: number, expected: number): { cor: FarolCor; label: FarolLabel } {
  const pctAbs = goal > 0 ? revenue / goal : 0;
  if (pctAbs >= 1) return { cor: 'verde', label: 'batido' };
  if (revenue >= expected) return { cor: 'verde', label: 'no ritmo' };
  if (revenue >= AMARELO * expected) return { cor: 'amarelo', label: 'atrás' };
  return { cor: 'vermelho', label: 'fora do ritmo' };
}

export function computeFarol(deals: RawDeal[], now: Date): Farol {
  const p = brtParts(now);
  const today = p.date;

  // --- Semana (Seg 00:00 → Dom 23:59, atribuída por closing_date) ---
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const revenueWeek = sumWon(deals, weekStart, weekEnd);
  const elapsedWeek = weekElapsed(p);
  const expectedWeek = GOAL_WEEK * elapsedWeek;
  const semana: FarolBucket = {
    revenue: revenueWeek,
    goal: GOAL_WEEK,
    pctAbs: revenueWeek / GOAL_WEEK,
    expected: expectedWeek,
    ...grade(revenueWeek, GOAL_WEEK, expectedWeek),
  };

  // --- Mês = união das semanas cuja segunda cai no mês (spec §2/§4) ---
  const ym = today.slice(0, 7); // YYYY-MM
  const mondays = mondaysInMonth(ym);
  const goalMonth = GOAL_WEEK * mondays.length;

  let revenueMonth = 0;
  for (const d of deals) {
    if (!isWon(d.stage)) continue;
    const cd = String(d.closing_date ?? '').slice(0, 10);
    if (!DATE_RE.test(cd)) continue;
    if (mondayOf(cd).slice(0, 7) === ym) revenueMonth += Number(d.valor) || 0;
  }

  // pace mensal: cada semana contribui até 1; a semana atual usa o pace da semana.
  let weekProgressSum = 0;
  for (const mon of mondays) {
    if (mon < weekStart) weekProgressSum += 1;
    else if (mon === weekStart) weekProgressSum += elapsedWeek;
    // semanas futuras → 0
  }
  const elapsedMonth = mondays.length > 0 ? weekProgressSum / mondays.length : 0;
  const expectedMonth = goalMonth * elapsedMonth;
  const mes: FarolBucket = {
    revenue: revenueMonth,
    goal: goalMonth,
    pctAbs: goalMonth > 0 ? revenueMonth / goalMonth : 0,
    expected: expectedMonth,
    ...grade(revenueMonth, goalMonth, expectedMonth),
  };

  return { semana, mes, generatedAt: now.toISOString() };
}
