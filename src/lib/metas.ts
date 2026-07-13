// Farol de Metas — Fase 2 (Landed): "por que bati / não bati" por semana ISO.
// Função pura determinística — sem fetch, sem LLM. Reusa a bucketização de semana e
// a lógica de receita ganha do Farol (Fase 1, `farol.ts`): zero duplicação de
// isoDow/mondayOf/addDays/brtParts/weekElapsed/sumWon/grade. Esforço vem da aba
// `resumo_diario` (mesmo parser do `resumo-diario.ts`), agregado por semana.
// Ver docs/features/feature-farol-metas.md — seção "Fase 2 — Landed".

import type { RawDeal, RawResumoDiario, WeekMetric, WeekEsforco, WeekDelta } from './types';
import { GOAL_WEEK, mondayOf, addDays, brtParts, weekElapsed, sumWon, grade } from './farol';
import { dedupeByData, parseResumoRow } from './resumo-diario';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Receita ganha (mesma regra do Farol: isClosedWon + closing_date na janela).
export function weekRevenue(deals: RawDeal[], weekStart: string, weekEnd: string): number {
  return sumWon(deals, weekStart, weekEnd);
}

// Soma os campos de esforço da aba resumo_diario para os dias dentro de [weekStart, weekEnd].
// Campos Captured<number> (podem vir null) contam como 0 na soma semanal — não há como
// distinguir "não capturado" de "zero" depois de somar múltiplos dias.
export function weeklyEsforco(
  resumoRows: RawResumoDiario[],
  weekStart: string,
  weekEnd: string
): WeekEsforco {
  const rows = dedupeByData(resumoRows)
    .map(parseResumoRow)
    .filter(r => DATE_RE.test(r.data) && r.data >= weekStart && r.data <= weekEnd);

  const sum = (get: (r: ReturnType<typeof parseResumoRow>) => number | null) =>
    rows.reduce((s, r) => s + (get(r) ?? 0), 0);

  return {
    ligacoes: sum(r => r.ligacoes.total),
    emails: sum(r => r.emails.total),
    apresentacoes: sum(r => r.apresentacoes.total),
    propostas: sum(r => r.propostas.total),
    reunioes: sum(r => r.reuniao_tecnica.total),
  };
}

// Variação percentual (cur vs prev). null quando não há como calcular (prev=0 e cur!=0).
function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return (cur - prev) / prev;
}

const ESFORCO_FIELDS = ['ligacoes', 'emails', 'apresentacoes', 'propostas', 'reunioes'] as const;
type EsforcoField = (typeof ESFORCO_FIELDS)[number];

const ESFORCO_LABELS: Record<EsforcoField, string> = {
  ligacoes: 'Ligações',
  emails: 'Emails',
  apresentacoes: 'Apresentações',
  propostas: 'Propostas',
  reunioes: 'Reuniões',
};

interface WeekRaw {
  weekStart: string;
  weekEnd: string;
  revenue: number;
  esforco: WeekEsforco;
}

function computeDelta(cur: WeekRaw, prev: WeekRaw | undefined): WeekDelta {
  if (!prev) {
    return { revenue: null, ligacoes: null, emails: null, apresentacoes: null, propostas: null, reunioes: null };
  }
  return {
    revenue: pctChange(cur.revenue, prev.revenue),
    ligacoes: pctChange(cur.esforco.ligacoes, prev.esforco.ligacoes),
    emails: pctChange(cur.esforco.emails, prev.esforco.emails),
    apresentacoes: pctChange(cur.esforco.apresentacoes, prev.esforco.apresentacoes),
    propostas: pctChange(cur.esforco.propostas, prev.esforco.propostas),
    reunioes: pctChange(cur.esforco.reunioes, prev.esforco.reunioes),
  };
}

// Heurístico determinístico (sem LLM): sem semana anterior → mensagem neutra;
// bateu a meta → aponta o(s) campo(s) de esforço que mais SUBIRAM (o que "puxou");
// não bateu → aponta o(s) que mais CAÍRAM vs a semana anterior (a causa provável).
function diagnosticar(delta: WeekDelta, batido: boolean, hasPrev: boolean): string {
  if (!hasPrev) {
    return batido
      ? 'Meta batida — sem semana anterior para comparar o esforço.'
      : 'Meta não batida — sem semana anterior para comparar o esforço.';
  }

  const entries = ESFORCO_FIELDS
    .map(f => ({ f, d: delta[f] }))
    .filter((x): x is { f: EsforcoField; d: number } => x.d !== null);

  if (batido) {
    const subiram = entries.filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 2);
    if (!subiram.length) {
      return 'Meta batida mesmo com esforço estável ou em queda — conversão acima da média.';
    }
    const parts = subiram.map(x => `${ESFORCO_LABELS[x.f]} subiu ${Math.round(x.d * 100)}%`);
    return `Meta batida — ${parts.join(' e ')}.`;
  }

  const cairam = entries.filter(x => x.d < 0).sort((a, b) => a.d - b.d).slice(0, 2);
  if (!cairam.length) {
    return 'Meta não batida apesar do esforço estável — a conversão pode ser o gargalo.';
  }
  const parts = cairam.map(x => `${ESFORCO_LABELS[x.f]} caiu ${Math.round(Math.abs(x.d) * 100)}%`);
  return `Meta não batida — ${parts.join(' e ')}.`;
}

// `now` define a semana atual (BRT); as `nWeeks` semanas ISO (Seg–Dom) são geradas
// pra trás a partir dela, mais recente primeiro. A semana mais antiga da janela não
// tem "semana anterior" dentro do próprio recorte → delta null (decisão de escopo:
// não buscamos uma semana extra só pra isso).
export function computeMetas(
  deals: RawDeal[],
  resumoRows: RawResumoDiario[],
  now: Date,
  nWeeks = 8
): { semanas: WeekMetric[] } {
  const p = brtParts(now);
  const currentWeekStart = mondayOf(p.date);
  const elapsedCurrent = weekElapsed(p);

  const raw: WeekRaw[] = Array.from({ length: nWeeks }, (_, i) => {
    const weekStart = addDays(currentWeekStart, -7 * i);
    const weekEnd = addDays(weekStart, 6);
    return {
      weekStart,
      weekEnd,
      revenue: weekRevenue(deals, weekStart, weekEnd),
      esforco: weeklyEsforco(resumoRows, weekStart, weekEnd),
    };
  });

  const semanas: WeekMetric[] = raw.map((cur, i) => {
    const prev = raw[i + 1];
    const isCurrent = cur.weekStart === currentWeekStart;
    // Semana já encerrada: 100% do pace decorrido → expected = goal. Semana em
    // andamento: pace real (mesma rampa Seg 08h→Sex 23:59 do Farol Fase 1).
    const expected = isCurrent ? GOAL_WEEK * elapsedCurrent : GOAL_WEEK;
    const { cor, label } = grade(cur.revenue, GOAL_WEEK, expected);
    const pctAbs = cur.revenue / GOAL_WEEK;
    const delta = computeDelta(cur, prev);
    const batido = pctAbs >= 1;

    return {
      weekStart: cur.weekStart,
      weekEnd: cur.weekEnd,
      revenue: cur.revenue,
      goal: GOAL_WEEK,
      pctAbs,
      cor,
      label,
      esforco: cur.esforco,
      delta,
      diagnostico: diagnosticar(delta, batido, !!prev),
    };
  });

  return { semanas };
}
