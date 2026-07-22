// Farol de Metas — Fase 2 (Landed) + fonte da receita (feature-metas-fonte-receita).
// Função pura determinística — sem fetch, sem LLM. Reusa a bucketização de semana e
// a lógica de ganho do Farol (Fase 1, `farol.ts`): zero duplicação de
// isoDow/mondayOf/addDays/brtParts/weekElapsed/grade. Esforço vem da aba
// `resumo_diario` (mesmo parser do `resumo-diario.ts`), agregado por semana.
// Ver docs/features/feature-farol-metas.md — seção "Fase 2 — Landed" — e
// docs/features/feature-metas-fonte-receita.md (separação Venda Defenz × Repasse SS).

import type {
  RawDeal, RawResumoDiario, WeekMetric, WeekEsforco, WeekDelta, MetasConsolidado,
  EficienciaIndices, EficienciaDelta, MetasEficiencia,
} from './types';
import { GOAL_WEEK, mondayOf, addDays, brtParts, weekElapsed, grade, isoDow } from './farol';
import { isClosedWon, dateInRange, classifyOrigin } from './metrics';
import { dedupeByData, parseResumoRow } from './resumo-diario';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fonte da receita do deal (feature-metas-fonte-receita §3) — determinística, computada
// na Vercel (não vem pronta do n8n/Sheets):
//   categoria ∈ {direto, parceiro}  → 'defenz'  (nossa pela origem, via classifyOrigin(lead_source))
//   tags contém "Venda Defenz"      → 'defenz'  (lead SS que a Defenz trabalhou, marcado no Zoho)
//   senão (securisoft sem tag)      → 'repasse' (default conservador: SecuriSoft vendeu e repassou)
export function fonteVenda(deal: RawDeal): 'defenz' | 'repasse' {
  const { categoria } = classifyOrigin(String(deal.lead_source || ''));
  if (categoria === 'direto' || categoria === 'parceiro') return 'defenz';

  const tags = String(deal.tags || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (tags.includes('venda defenz')) return 'defenz';

  return 'repasse';
}

export interface WeekRevenueSplit {
  defenz: number;
  repasse: number;
  defenzCount: number;
  repasseCount: number;
}

// Receita ganha (mesma regra do Farol: isClosedWon + closing_date na janela),
// particionada por fonteVenda. `defenz` alimenta a meta; `repasse` é informativo.
export function weekRevenue(deals: RawDeal[], weekStart: string, weekEnd: string): WeekRevenueSplit {
  let defenz = 0;
  let repasse = 0;
  let defenzCount = 0;
  let repasseCount = 0;
  for (const d of deals) {
    if (!isClosedWon(String(d.stage || '')) || !dateInRange(d.closing_date, weekStart, weekEnd)) continue;
    const valor = Number(d.valor) || 0;
    if (fonteVenda(d) === 'defenz') { defenz += valor; defenzCount++; }
    else { repasse += valor; repasseCount++; }
  }
  return { defenz, repasse, defenzCount, repasseCount };
}

// Soma os campos de esforço da aba resumo_diario para os dias ÚTEIS (Seg–Sex) dentro
// de [weekStart, weekEnd]. Sáb/Dom não entram no esforço/ritmo (feature-metas-robo-semana
// §4) — a receita continua atribuída Seg→Dom em weekRevenue (deal de fim de semana conta).
// Campos Captured<number> (podem vir null) contam como 0 na soma semanal — não há como
// distinguir "não capturado" de "zero" depois de somar múltiplos dias.
export function weeklyEsforco(
  resumoRows: RawResumoDiario[],
  weekStart: string,
  weekEnd: string
): WeekEsforco {
  const rows = dedupeByData(resumoRows)
    .map(parseResumoRow)
    .filter(r => DATE_RE.test(r.data) && r.data >= weekStart && r.data <= weekEnd && isoDow(r.data) <= 5);

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
  revenue: number;         // Venda Defenz — alimenta meta/pctAbs/cor/label/diagnóstico
  revenueRepasse: number;  // Repasse SS — informativo
  revenueTotal: number;    // defenz + repasse
  defenzCount: number;     // nº de negócios Venda Defenz na semana
  repasseCount: number;    // nº de negócios Repasse SS na semana
  expected: number;        // esperado pelo pace no instante (semana fechada = GOAL_WEEK)
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

// Segundas (YYYY-MM-DD) da janela, mais recente primeiro. Sem `range`: as `nWeeks`
// semanas a partir da atual. Com `range`: toda semana cuja segunda cai em
// [mondayOf(from), mondayOf(to)] — cap defensivo de 60 semanas.
function weekStartsFor(
  currentWeekStart: string,
  nWeeks: number,
  range?: { from: string; to: string }
): string[] {
  if (range) {
    const first = mondayOf(range.from <= range.to ? range.from : range.to);
    const last = mondayOf(range.from <= range.to ? range.to : range.from);
    const out: string[] = [];
    let w = last;
    for (let i = 0; i < 60 && w >= first; i++) { out.push(w); w = addDays(w, -7); }
    return out.length ? out : [currentWeekStart];
  }
  return Array.from({ length: Math.max(1, nWeeks) }, (_, i) => addDays(currentWeekStart, -7 * i));
}

const zeroEsforco = (): WeekEsforco => ({ ligacoes: 0, emails: 0, apresentacoes: 0, propostas: 0, reunioes: 0 });

// Somatório das semanas da janela (Σ receita / Σ esforço / meta = 6k × nº semanas).
function buildConsolidado(raw: WeekRaw[]): MetasConsolidado {
  const nWeeks = raw.length;
  const esforco = raw.reduce<WeekEsforco>((acc, w) => ({
    ligacoes: acc.ligacoes + w.esforco.ligacoes,
    emails: acc.emails + w.esforco.emails,
    apresentacoes: acc.apresentacoes + w.esforco.apresentacoes,
    propostas: acc.propostas + w.esforco.propostas,
    reunioes: acc.reunioes + w.esforco.reunioes,
  }), zeroEsforco());
  const revenue = raw.reduce((s, w) => s + w.revenue, 0);
  const revenueRepasse = raw.reduce((s, w) => s + w.revenueRepasse, 0);
  const dealsDefenz = raw.reduce((s, w) => s + w.defenzCount, 0);
  const dealsRepasse = raw.reduce((s, w) => s + w.repasseCount, 0);
  const expected = raw.reduce((s, w) => s + w.expected, 0);
  const goal = GOAL_WEEK * nWeeks;
  // raw é mais-recente-primeiro: a mais antiga é a última, a mais recente é a primeira.
  const oldest = raw[raw.length - 1];
  const newest = raw[0];
  return {
    weekStart: oldest.weekStart,
    weekEnd: newest.weekEnd,
    nWeeks,
    revenue,
    revenueRepasse,
    revenueTotal: revenue + revenueRepasse,
    dealsDefenz,
    dealsRepasse,
    goal,
    pctAbs: goal > 0 ? revenue / goal : 0,
    esforco,
    ...grade(revenue, goal, expected),
  };
}

interface EficInput { receita: number; deals: number; esforco: WeekEsforco }
const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);

// Índices Esforço→Vendas (feature-metas-v2 §5b) + delta vs uma janela de comparação
// (tipicamente a janela anterior de mesmo tamanho). Delta é suprimido (null) quando
// o denominador do índice for < 3 em qualquer uma das duas janelas — amostra pequena
// não sustenta uma variação percentual confiável.
export function computeEficiencia(cur: EficInput, prev: EficInput, labelComparacao: string): MetasEficiencia {
  const idx = (i: EficInput): EficienciaIndices => ({
    ticketMedio: ratio(i.receita, i.deals),
    rsPorProposta: ratio(i.receita, i.esforco.propostas),
    propostasPor100Ligacoes: i.esforco.ligacoes > 0 ? (i.esforco.propostas / i.esforco.ligacoes) * 100 : null,
    reuniaoParaProposta: ratio(i.esforco.propostas, i.esforco.reunioes),
  });
  const atual = idx(cur), ant = idx(prev);
  // delta só quando ambos definidos E amostra (denominador do índice) >= 3 nas duas janelas
  const guarded = (a: number | null, b: number | null, denCur: number, denPrev: number): number | null =>
    a === null || b === null || b === 0 || denCur < 3 || denPrev < 3 ? null : (a - b) / b;
  const delta: EficienciaDelta = {
    ticketMedio: guarded(atual.ticketMedio, ant.ticketMedio, cur.deals, prev.deals),
    rsPorProposta: guarded(atual.rsPorProposta, ant.rsPorProposta, cur.esforco.propostas, prev.esforco.propostas),
    propostasPor100Ligacoes: guarded(atual.propostasPor100Ligacoes, ant.propostasPor100Ligacoes, cur.esforco.ligacoes, prev.esforco.ligacoes),
    reuniaoParaProposta: guarded(atual.reuniaoParaProposta, ant.reuniaoParaProposta, cur.esforco.reunioes, prev.esforco.reunioes),
  };
  return { atual, delta, labelComparacao };
}

// `now` define a semana atual (BRT). Sem `range`, geram-se as `nWeeks` semanas ISO
// (Seg–Dom) pra trás a partir dela; com `range`, as semanas cujas segundas caem no
// intervalo. Sempre mais recente primeiro. A semana mais antiga da janela não tem
// "semana anterior" dentro do próprio recorte → delta null (decisão de escopo).
export function computeMetas(
  deals: RawDeal[],
  resumoRows: RawResumoDiario[],
  now: Date,
  nWeeks = 8,
  range?: { from: string; to: string }
): { semanas: WeekMetric[]; consolidado: MetasConsolidado; eficiencia: MetasEficiencia } {
  const p = brtParts(now);
  const currentWeekStart = mondayOf(p.date);
  const elapsedCurrent = weekElapsed(p);

  const raw: WeekRaw[] = weekStartsFor(currentWeekStart, nWeeks, range).map(weekStart => {
    const weekEnd = addDays(weekStart, 6);
    const rev = weekRevenue(deals, weekStart, weekEnd);
    // Semana encerrada: 100% do pace → expected = goal. Semana em andamento: pace real
    // (rampa Seg 08h→Sex 23:59 do Farol). Semana futura (só em modo range): 0.
    const expected =
      weekStart < currentWeekStart ? GOAL_WEEK :
      weekStart === currentWeekStart ? GOAL_WEEK * elapsedCurrent :
      0;
    return {
      weekStart,
      weekEnd,
      revenue: rev.defenz,
      revenueRepasse: rev.repasse,
      revenueTotal: rev.defenz + rev.repasse,
      defenzCount: rev.defenzCount,
      repasseCount: rev.repasseCount,
      expected,
      esforco: weeklyEsforco(resumoRows, weekStart, weekEnd),
    };
  });

  const semanas: WeekMetric[] = raw.map((cur, i) => {
    const prev = raw[i + 1];
    const { cor, label } = grade(cur.revenue, GOAL_WEEK, cur.expected);
    const pctAbs = cur.revenue / GOAL_WEEK;
    const delta = computeDelta(cur, prev);
    const batido = pctAbs >= 1;

    return {
      weekStart: cur.weekStart,
      weekEnd: cur.weekEnd,
      revenue: cur.revenue,
      revenueRepasse: cur.revenueRepasse,
      revenueTotal: cur.revenueTotal,
      goal: GOAL_WEEK,
      pctAbs,
      cor,
      label,
      esforco: cur.esforco,
      delta,
      diagnostico: diagnosticar(delta, batido, !!prev),
    };
  });

  const consolidado = buildConsolidado(raw);

  // Janela anterior de mesmo tamanho: as `windowSize` semanas imediatamente antes
  // da mais antiga da janela atual (contíguas, sem sobreposição). Alimenta os
  // índices de eficiência (Esforço→Vendas) com um delta vs "antes".
  const windowSize = raw.length;
  const oldestWeekStart = raw[raw.length - 1].weekStart;
  const prevWeekStarts = Array.from({ length: windowSize }, (_, i) => addDays(oldestWeekStart, -7 * (i + 1)));
  let prevReceita = 0;
  let prevDeals = 0;
  const prevEsforco = prevWeekStarts.reduce<WeekEsforco>((acc, weekStart) => {
    const weekEnd = addDays(weekStart, 6);
    const rev = weekRevenue(deals, weekStart, weekEnd);
    prevReceita += rev.defenz;
    prevDeals += rev.defenzCount;
    const esf = weeklyEsforco(resumoRows, weekStart, weekEnd);
    return {
      ligacoes: acc.ligacoes + esf.ligacoes,
      emails: acc.emails + esf.emails,
      apresentacoes: acc.apresentacoes + esf.apresentacoes,
      propostas: acc.propostas + esf.propostas,
      reunioes: acc.reunioes + esf.reunioes,
    };
  }, zeroEsforco());

  const labelComparacao = `vs ${windowSize} semana${windowSize === 1 ? '' : 's'} anteriores`;
  const eficiencia = computeEficiencia(
    { receita: consolidado.revenue, deals: consolidado.dealsDefenz, esforco: consolidado.esforco },
    { receita: prevReceita, deals: prevDeals, esforco: prevEsforco },
    labelComparacao
  );

  return { semanas, consolidado, eficiencia };
}
