import type { RawDeal, RawCall, RawEmail, RawClassificacao, RawReuniao, ComputedMetrics, CoverageSourceStats, CoverageReport, DailyEffort, WeeklyBucket, ClientesAtivosSplit, ClientesAtivosMes, ClientesAtivosMetrics, RenovacaoVencida, RenovacoesVencidasMetrics, PipelineBucketType, PipelineBucket, PipelineBucketsMetrics, FaturamentoMes, FaturamentoMensalMetrics, MrrArrMetrics, ComissaoPorOwnerCanal, ComissaoMes, ComissaoOwnerCanalMetrics, ReceitaCanalItem, ReceitaPorCanalMetrics } from './types';

// --- Stage classification helpers ---

// exportado pra que o comparador de paridade (src/lib/ingest/paridade.ts) e o SQL do
// Neon usem EXATAMENTE a mesma definição de "ganho" que o dashboard usa.
export const CLOSED_WON_STAGES = ['fechado ganho', 'contrato enviado'];
const CLOSED_LOST_STAGES = [
  'fechado perdido',
  'fechado perdido para a concorrencia',
  'fechado perdido para a concorrência',
  'perdido',
];
const PIPELINE_STAGES = ['proposta enviada', 'em negociacao', 'em negociação', 'negociacao/revisao', 'negociação/revisão'];

export function isClosedWon(stage: string): boolean {
  return CLOSED_WON_STAGES.includes(stage.toLowerCase().trim());
}

export function isClosedLost(stage: string): boolean {
  return CLOSED_LOST_STAGES.includes(stage.toLowerCase().trim());
}

export function isPipeline(stage: string): boolean {
  return PIPELINE_STAGES.includes(stage.toLowerCase().trim());
}

export function isActive(stage: string): boolean {
  return !isClosedWon(stage) && !isClosedLost(stage);
}

// --- Commission classification ---

export function classifyOrigin(leadSource: string): { categoria: string; taxa: number } {
  const src = (leadSource || '').toLowerCase().trim();

  if (src.includes('securisoft') || src.includes('parceiro ss')) {
    return { categoria: 'securisoft', taxa: 0.05 };
  }
  if (src.includes('apollo') || src.includes('linkedin') || src.includes('cold call') || src.includes('chamada surpresa')) {
    return { categoria: 'direto', taxa: 0.58 };
  }
  if (src.includes('parceiro')) {
    return { categoria: 'parceiro', taxa: 0.43 };
  }
  return { categoria: 'direto', taxa: 0.58 };
}

// --- Date helpers ---

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dateInRange(dateStr: string | undefined, start: string, end: string): boolean {
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  if (!DATE_RE.test(d)) return false;
  return d >= start && d <= end;
}

function buildCoverageStats(
  dates: (string | undefined)[],
  start: string,
  end: string
): CoverageSourceStats {
  let in_range = 0;
  let dropped_invalid_date = 0;
  let min_date: string | null = null;
  let max_date: string | null = null;

  for (const dateStr of dates) {
    if (!dateStr) {
      dropped_invalid_date++;
      continue;
    }
    const d = String(dateStr).slice(0, 10);
    if (!DATE_RE.test(d)) {
      dropped_invalid_date++;
      continue;
    }
    if (min_date === null || d < min_date) min_date = d;
    if (max_date === null || d > max_date) max_date = d;
    if (d >= start && d <= end) in_range++;
  }

  return { total: dates.length, in_range, dropped_invalid_date, min_date, max_date };
}

// --- Event date extraction from resultados text ---

// Extracts dated events ("DD/MM - [TAG]") from a resultados blob, inferring the
// year RELATIVE TO `referenceDate` (not always today). Use this for the daily
// snapshot/backfill so a 120-day-ago day doesn't get stamped with today's year.
export function extractEventDatesAnchored(
  resultados: string,
  tag: string,
  referenceDate: string
): string[] {
  const ref = DATE_RE.test(referenceDate)
    ? referenceDate
    : new Date().toISOString().slice(0, 10);
  const refYear = parseInt(ref.slice(0, 4));
  const refMonth = parseInt(ref.slice(5, 7));

  const lines = String(resultados || '').split('\n');
  const dates: string[] = [];
  for (const line of lines) {
    if (!line.includes(tag)) continue;
    const match = line.match(/(\d{2})\/(\d{2})/);
    if (!match) continue;
    const day = match[1];
    const month = parseInt(match[2]);
    const year = month > refMonth ? refYear - 1 : refYear;
    dates.push(`${year}-${String(month).padStart(2, '0')}-${day}`);
  }
  return dates;
}

// Today-anchored variant (preserves existing dashboard behavior).
function extractEventDates(resultados: string, tag: string): string[] {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return extractEventDatesAnchored(resultados, tag, today);
}

// --- Main metrics computation ---

export function computeMetrics(
  deals: RawDeal[],
  calls: RawCall[],
  emails: RawEmail[],
  classificacoes: RawClassificacao[],
  dateRange: { start: string; end: string },
  // null = tab not found (use proxy); RawReuniao[] = tab exists (use sheet data)
  reunioesRaw?: RawReuniao[] | null
): ComputedMetrics {
  const { start, end } = dateRange;

  // Filter calls and emails by date range
  const callsInRange = calls.filter(c => dateInRange(c.data, start, end));
  const emailsInRange = emails.filter(e => dateInRange(e.data, start, end));

  // Call metrics
  const ligacoes = callsInRange.length;
  const ligacoes_atendidas = callsInRange.filter(
    c => String(c.status || '').toLowerCase() === 'atendida'
  ).length;
  const taxa_conectividade = ligacoes > 0
    ? Math.round((ligacoes_atendidas / ligacoes) * 100)
    : 0;

  // Email count
  const emailCount = emailsInRange.length;

  // Reunioes: try sheet tab first (reunioesRaw !== null), fall back to [REUNIAO] events in deals.resultados
  let reunioes = 0;
  let reunioesDates: string[] = [];
  let reunioesSource: 'sheet' | 'resultados-proxy' | 'unavailable';

  if (reunioesRaw !== null && reunioesRaw !== undefined) {
    reunioesDates = reunioesRaw.map(r => String(r.data || ''));
    reunioes = reunioesDates.filter(d => {
      const day = d.slice(0, 10);
      return DATE_RE.test(day) && day >= start && day <= end;
    }).length;
    reunioesSource = 'sheet';
  } else {
    for (const deal of deals) {
      const eventDates = extractEventDates(String(deal.resultados || ''), 'REUNIAO');
      reunioesDates.push(...eventDates);
    }
    reunioes = reunioesDates.filter(d => d >= start && d <= end).length;
    reunioesSource = 'resultados-proxy';
  }

  // Apresentacoes & Propostas — contagem de EVENTOS no período
  // Extrai datas do campo resultados (formato "DD/MM - [TAG]")
  let apresentacoes = 0;
  for (const deal of deals) {
    const eventDates = extractEventDates(String(deal.resultados || ''), 'APRESENTA');
    apresentacoes += eventDates.filter(d => d >= start && d <= end).length;
  }

  let propostas = 0;
  for (const deal of deals) {
    const eventDates = extractEventDates(String(deal.resultados || ''), 'PROPOSTA');
    propostas += eventDates.filter(d => d >= start && d <= end).length;
  }

  // Deal counts filtered by date range (use closing_date for closed deals, fallback to modified_time)
  const closedWonInRange = deals.filter(d =>
    isClosedWon(String(d.stage || '')) && dateInRange(d.closing_date || d.modified_time, start, end)
  );
  const closedLostInRange = deals.filter(d =>
    isClosedLost(String(d.stage || '')) && dateInRange(d.closing_date || d.modified_time, start, end)
  );
  const newDealsInRange = deals.filter(d =>
    dateInRange(d.created_time, start, end)
  );

  // Pipeline deals (snapshot — current state)
  const pipelineDeals = deals.filter(d => isPipeline(String(d.stage || '')));

  // Financial metrics
  const valor_pipeline = pipelineDeals.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  const valor_fechado = closedWonInRange.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);

  const comissao_pipeline = pipelineDeals.reduce((sum, d) => {
    const valor = Number(d.valor) || 0;
    const { taxa } = classifyOrigin(String(d.lead_source || ''));
    return sum + (valor * taxa);
  }, 0);

  const comissao_fechado = closedWonInRange.reduce((sum, d) => {
    const valor = Number(d.valor) || 0;
    const { taxa } = classifyOrigin(String(d.lead_source || ''));
    return sum + (valor * taxa);
  }, 0);

  const deals_fechados = closedWonInRange.length;
  const ticket_medio = deals_fechados > 0 ? Math.round(valor_fechado / deals_fechados) : 0;

  // Win rate
  const totalClosed = closedWonInRange.length + closedLostInRange.length;
  const win_rate = totalClosed > 0
    ? Math.round((closedWonInRange.length / totalClosed) * 100)
    : 0;

  // Total de licenças ativas — soma das licencas de todos os deals "Fechado Ganho" (snapshot, sem filtro temporal)
  const total_licencas_ativas = deals
    .filter(d => isClosedWon(String(d.stage || '')))
    .reduce((sum, d) => sum + (Number(d.licencas) || 0), 0);

  // Decision maker contacts (filtered by data_classificacao)
  const classificacoesInRange = classificacoes.filter(
    c => dateInRange(c.data_classificacao, start, end)
  );
  const contatos_decisor = classificacoesInRange.filter(
    c => String(c.nivel_maximo || '').toLowerCase() === 'decisor'
  ).length;
  const contatos_decisor_info = classificacoesInRange.filter(
    c => ['decisor', 'tecnico'].includes(String(c.nivel_maximo || '').toLowerCase())
  ).length;

  // Coverage diagnostics — track valid/invalid/in-range per data source
  const coverage: CoverageReport = {
    deals: buildCoverageStats(
      deals.map(d => d.closing_date || d.modified_time || d.created_time),
      start,
      end
    ),
    calls: buildCoverageStats(
      calls.map(c => c.data),
      start,
      end
    ),
    emails: buildCoverageStats(
      emails.map(e => e.data),
      start,
      end
    ),
    classificacoes: buildCoverageStats(
      classificacoes.map(c => c.data_classificacao),
      start,
      end
    ),
    reunioes: {
      ...buildCoverageStats(reunioesDates, start, end),
      source: reunioesSource,
    },
  };

  return {
    ligacoes,
    ligacoes_atendidas,
    taxa_conectividade,
    emails: emailCount,
    reunioes,
    apresentacoes,
    propostas,
    deals_novos: newDealsInRange.length,
    deals_fechados,
    deals_pipeline: pipelineDeals.length,
    valor_pipeline,
    valor_fechado,
    comissao_pipeline,
    comissao_fechado,
    ticket_medio,
    win_rate,
    contatos_decisor,
    contatos_decisor_info,
    total_licencas_ativas,
    coverage,
  };
}

// --- Daily effort computation ---

export function computeEsforcoDiario(
  calls: RawCall[],
  emails: RawEmail[],
  dateRange: { start: string; end: string }
): DailyEffort[] {
  const { start, end } = dateRange;
  const dayMap = new Map<string, { calls: number; emails: number }>();

  for (const call of calls) {
    const d = String(call.data || '').slice(0, 10);
    if (d < start || d > end) continue;
    const entry = dayMap.get(d) || { calls: 0, emails: 0 };
    entry.calls++;
    dayMap.set(d, entry);
  }

  for (const email of emails) {
    const d = String(email.data || '').slice(0, 10);
    if (d < start || d > end) continue;
    const entry = dayMap.get(d) || { calls: 0, emails: 0 };
    entry.emails++;
    dayMap.set(d, entry);
  }

  return Array.from(dayMap.entries())
    .map(([data, { calls, emails }]) => ({
      data,
      calls,
      emails,
      meetings: 0,
      total: calls + emails,
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

// --- Deal activity enrichment for operational dashboard ---

const STALE_THRESHOLD_DAYS = 7;

export function enrichDealsWithActivities(
  deals: RawDeal[],
  calls: RawCall[],
  emails: RawEmail[]
): any[] {
  const today = new Date().toISOString().split('T')[0];

  // Build empresa → activities index for correlation
  // Since we don't have deal_id in calls/emails, correlate by empresa name
  const empresaCallsMap = new Map<string, RawCall[]>();
  const empresaEmailsMap = new Map<string, RawEmail[]>();

  for (const call of calls) {
    const dest = String(call.destino || '');
    if (!dest) continue;
    // Group by agent for now — will match to deals by empresa later
    const arr = empresaCallsMap.get(dest) || [];
    arr.push(call);
    empresaCallsMap.set(dest, arr);
  }

  return deals.map(deal => {
    const dealId = String(deal.id || '');
    const empresa = String(deal.empresa || '').trim();
    const valor = Number(deal.valor) || 0;
    const { categoria, taxa } = classifyOrigin(String(deal.lead_source || ''));
    const comissao_valor = valor * taxa;
    const modifiedTime = String(deal.modified_time || '');

    // Calculate days_in_stage from modified_time
    let days_in_stage = 0;
    if (modifiedTime) {
      const modDate = new Date(modifiedTime.slice(0, 10));
      const todayDate = new Date(today);
      days_in_stage = Math.max(0, Math.round((todayDate.getTime() - modDate.getTime()) / 86400000));
    }

    // For now, activities are empty until we have proper deal_id correlation
    // The correlation will improve as N8N writes deal_id to activity records
    const activities: any[] = [];
    const lastActivityDate = modifiedTime.slice(0, 10);

    // Determine staleness
    let is_stale = true;
    if (lastActivityDate) {
      const lastDate = new Date(lastActivityDate);
      const diffDays = Math.round((new Date(today).getTime() - lastDate.getTime()) / 86400000);
      is_stale = diffDays >= STALE_THRESHOLD_DAYS;
    }

    return {
      id: dealId,
      id_data: dealId,
      nome: String(deal.nome || ''),
      empresa: empresa.length > 0 ? empresa : '-',
      stage: String(deal.stage || ''),
      valor,
      origem: String(deal.lead_source || ''),
      categoria,
      comissao_valor,
      data: String(deal.created_time || '').slice(0, 10),
      created_time: String(deal.created_time || ''),
      modified_time: modifiedTime,
      days_in_stage,
      last_activity_date: lastActivityDate,
      last_activity_type: 'none' as const,
      activities,
      is_stale,
    };
  });
}

// --- Weekly activity bucketizer ---

// Maps day of month to week slot (S1–S5)
function weekOfMonth(day: number): 1 | 2 | 3 | 4 | 5 {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

// Short month abbreviations in pt-BR (no i18n API needed)
const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function bucketKey(yearMonth: string, week: 1 | 2 | 3 | 4 | 5) {
  return `${yearMonth}-S${week}`;
}

function getOrCreate(
  map: Map<string, WeeklyBucket>,
  date: string // YYYY-MM-DD
): WeeklyBucket | null {
  const parts = date.split('-');
  if (parts.length < 3) return null;
  const year = parseInt(parts[0]);
  const monthIdx = parseInt(parts[1]) - 1; // 0-based
  const day = parseInt(parts[2]);
  if (isNaN(year) || isNaN(monthIdx) || isNaN(day)) return null;

  const yearMonth = `${parts[0]}-${parts[1]}`;
  const week = weekOfMonth(day);
  const key = bucketKey(yearMonth, week);

  if (!map.has(key)) {
    map.set(key, {
      key,
      month: yearMonth,
      week,
      label: `${MONTH_ABBR[monthIdx] ?? parts[1]} S${week}`,
      ligacoes: 0,
      emails: 0,
      reunioes: 0,
      apresentacoes: 0,
      propostas: 0,
      fechamentos: 0,
    });
  }
  return map.get(key)!;
}

export function bucketizeByWeek(
  deals: RawDeal[],
  calls: RawCall[],
  emails: RawEmail[],
  dateRange: { start: string; end: string },
  reunioesRaw?: RawReuniao[] | null
): WeeklyBucket[] {
  const { start, end } = dateRange;
  const buckets = new Map<string, WeeklyBucket>();

  // Calls
  for (const call of calls) {
    const d = String(call.data || '').slice(0, 10);
    if (!DATE_RE.test(d) || d < start || d > end) continue;
    const b = getOrCreate(buckets, d);
    if (b) b.ligacoes++;
  }

  // Emails
  for (const email of emails) {
    const d = String(email.data || '').slice(0, 10);
    if (!DATE_RE.test(d) || d < start || d > end) continue;
    const b = getOrCreate(buckets, d);
    if (b) b.emails++;
  }

  // Reunioes
  if (reunioesRaw != null) {
    for (const r of reunioesRaw) {
      const d = String(r.data || '').slice(0, 10);
      if (!DATE_RE.test(d) || d < start || d > end) continue;
      const b = getOrCreate(buckets, d);
      if (b) b.reunioes++;
    }
  } else {
    // Fallback: extract [REUNIAO] events from deals.resultados
    for (const deal of deals) {
      for (const d of extractEventDates(String(deal.resultados || ''), 'REUNIAO')) {
        if (d < start || d > end) continue;
        const b = getOrCreate(buckets, d);
        if (b) b.reunioes++;
      }
    }
  }

  // Apresentacoes
  for (const deal of deals) {
    for (const d of extractEventDates(String(deal.resultados || ''), 'APRESENTA')) {
      if (d < start || d > end) continue;
      const b = getOrCreate(buckets, d);
      if (b) b.apresentacoes++;
    }
  }

  // Propostas
  for (const deal of deals) {
    for (const d of extractEventDates(String(deal.resultados || ''), 'PROPOSTA')) {
      if (d < start || d > end) continue;
      const b = getOrCreate(buckets, d);
      if (b) b.propostas++;
    }
  }

  // Fechamentos (closed won)
  for (const deal of deals) {
    if (!isClosedWon(String(deal.stage || ''))) continue;
    const d = String(deal.closing_date || deal.modified_time || '').slice(0, 10);
    if (!DATE_RE.test(d) || d < start || d > end) continue;
    const b = getOrCreate(buckets, d);
    if (b) b.fechamentos++;
  }

  // Sort chronologically by key (YYYY-MM-Sx sorts correctly as string)
  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

// --- Clientes ativos: base instalada + delta mensal por canal ---

const MONTH_LONG: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${MONTH_LONG[month] ?? month} ${year}`;
}

function emptySplit(): ClientesAtivosSplit {
  return { direto: 0, parceiro: 0, securisoft: 0, total: 0 };
}

function addToSplit(split: ClientesAtivosSplit, categoria: string): void {
  split.total++;
  if (categoria === 'securisoft') split.securisoft++;
  else if (categoria === 'parceiro') split.parceiro++;
  else split.direto++;
}

export function computeClientesAtivos(deals: RawDeal[]): ClientesAtivosMetrics {
  const closedWon = deals.filter(d => isClosedWon(String(d.stage || '')));

  // Current and previous calendar months (absolute, not period-relative)
  const now = new Date();
  const yyyyMM = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const mesAtualKey = yyyyMM(now);
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mesAnteriorKey = yyyyMM(prevDate);

  const totalSplit = emptySplit();
  const mesAtualSplit = emptySplit();
  const mesAnteriorSplit = emptySplit();

  for (const deal of closedWon) {
    const { categoria } = classifyOrigin(String(deal.lead_source || ''));
    const closingDate = String(deal.closing_date || deal.modified_time || '').slice(0, 7); // YYYY-MM

    addToSplit(totalSplit, categoria);

    if (closingDate === mesAtualKey) addToSplit(mesAtualSplit, categoria);
    if (closingDate === mesAnteriorKey) addToSplit(mesAnteriorSplit, categoria);
  }

  const delta = mesAtualSplit.total - mesAnteriorSplit.total;
  const deltaSplit: ClientesAtivosSplit = {
    direto: mesAtualSplit.direto - mesAnteriorSplit.direto,
    parceiro: mesAtualSplit.parceiro - mesAnteriorSplit.parceiro,
    securisoft: mesAtualSplit.securisoft - mesAnteriorSplit.securisoft,
    total: delta,
  };

  const mesAtual: ClientesAtivosMes = {
    label: monthLabel(mesAtualKey),
    month: mesAtualKey,
    total: mesAtualSplit.total,
    split: mesAtualSplit,
  };
  const mesAnterior: ClientesAtivosMes = {
    label: monthLabel(mesAnteriorKey),
    month: mesAnteriorKey,
    total: mesAnteriorSplit.total,
    split: mesAnteriorSplit,
  };

  return {
    total: totalSplit.total,
    split: totalSplit,
    mes_atual: mesAtual,
    mes_anterior: mesAnterior,
    delta,
    delta_split: deltaSplit,
  };
}

// --- Renovações vencidas (closed_won SS deals with data_renovacao < today) ---

export function computeRenovacoesVencidas(deals: RawDeal[]): RenovacoesVencidasMetrics {
  const today = new Date().toISOString().split('T')[0];

  const lista: RenovacaoVencida[] = [];

  for (const deal of deals) {
    if (!isClosedWon(String(deal.stage || ''))) continue;

    const { categoria } = classifyOrigin(String(deal.lead_source || ''));
    if (categoria !== 'securisoft') continue;

    const data_renovacao = String(deal.data_renovacao || '').slice(0, 10);
    if (!DATE_RE.test(data_renovacao)) continue;
    if (data_renovacao >= today) continue; // not expired yet

    const closing_date = String(deal.closing_date || deal.modified_time || '').slice(0, 10);
    const renovDate = new Date(data_renovacao);
    const todayDate = new Date(today);
    const dias_vencido = Math.max(0, Math.round((todayDate.getTime() - renovDate.getTime()) / 86400000));

    lista.push({
      id: String(deal.id || ''),
      nome: String(deal.nome || ''),
      empresa: String(deal.empresa || '').trim() || '(sem empresa)',
      valor: Number(deal.valor) || 0,
      closing_date,
      data_renovacao,
      dias_vencido,
    });
  }

  // Sort by most overdue first
  lista.sort((a, b) => b.dias_vencido - a.dias_vencido);

  const valor_total = lista.reduce((sum, r) => sum + r.valor, 0);

  return { total: lista.length, valor_total, lista };
}

// --- Pipeline bucket classifier ---

const POC_STAGE_KEYWORDS = ['poc', 'prova de conceito', 'piloto'];
const FOLLOW_UP_STAGE_KEYWORDS = ['follow-up', 'follow up', 'acompanhamento', 'aguardando resposta', 'aguardando retorno'];

export function classifyPipelineBucket(stage: string): PipelineBucketType {
  const s = (stage || '').toLowerCase().trim();

  if (POC_STAGE_KEYWORDS.some(k => s.includes(k))) return 'POC';
  if (FOLLOW_UP_STAGE_KEYWORDS.some(k => s.includes(k))) return 'FOLLOW-UP';
  if (PIPELINE_STAGES.includes(s)) return 'PIPELINE';
  return 'OPORTUNIDADE';
}

export function computePipelineBuckets(deals: RawDeal[]): PipelineBucketsMetrics {
  const today = new Date().toISOString().split('T')[0];
  const activeDeals = deals.filter(d => isActive(String(d.stage || '')));

  const BUCKET_ORDER: PipelineBucketType[] = ['OPORTUNIDADE', 'FOLLOW-UP', 'POC', 'PIPELINE'];
  const bucketMap = new Map<PipelineBucketType, PipelineBucket>(
    BUCKET_ORDER.map(type => [type, { bucket: type, count: 0, valor_total: 0, comissao_total: 0, deals: [] }])
  );

  for (const deal of activeDeals) {
    const stage = String(deal.stage || '');
    const bucketType = classifyPipelineBucket(stage);
    const valor = Number(deal.valor) || 0;
    const { categoria, taxa } = classifyOrigin(String(deal.lead_source || ''));
    const comissao_valor = valor * taxa;

    let days_in_stage = 0;
    const modifiedDate = String(deal.modified_time || '').slice(0, 10);
    if (DATE_RE.test(modifiedDate)) {
      days_in_stage = Math.max(
        0,
        Math.round((new Date(today).getTime() - new Date(modifiedDate).getTime()) / 86400000)
      );
    }

    const entry = bucketMap.get(bucketType)!;
    entry.count++;
    entry.valor_total += valor;
    entry.comissao_total += comissao_valor;
    entry.deals.push({
      id: String(deal.id || ''),
      nome: String(deal.nome || ''),
      empresa: String(deal.empresa || '').trim() || '(sem empresa)',
      stage,
      valor,
      categoria,
      comissao_valor,
      modified_time: String(deal.modified_time || ''),
      days_in_stage,
    });
  }

  const buckets = Array.from(bucketMap.values());
  const total_deals = buckets.reduce((s, b) => s + b.count, 0);
  const total_valor = buckets.reduce((s, b) => s + b.valor_total, 0);
  const total_comissao = buckets.reduce((s, b) => s + b.comissao_total, 0);

  return { buckets, total_deals, total_valor, total_comissao };
}

// --- Faturamento mensal: soma valor closed_won por mês ---

export function computeFaturamentoMensal(
  deals: RawDeal[],
  ano?: number // optional: filter to a specific year
): FaturamentoMensalMetrics {
  // Group closed_won deals by YYYY-MM
  const monthMap = new Map<string, { valor: number; comissao: number; count: number }>();

  for (const deal of deals) {
    if (!isClosedWon(String(deal.stage || ''))) continue;

    const dateStr = String(deal.closing_date || deal.modified_time || '').slice(0, 10);
    if (!DATE_RE.test(dateStr)) continue;

    const yearMonth = dateStr.slice(0, 7); // YYYY-MM
    if (ano !== undefined && !yearMonth.startsWith(String(ano))) continue;

    const valor = Number(deal.valor) || 0;
    const { taxa } = classifyOrigin(String(deal.lead_source || ''));
    const comissao = valor * taxa;

    const entry = monthMap.get(yearMonth) ?? { valor: 0, comissao: 0, count: 0 };
    entry.valor += valor;
    entry.comissao += comissao;
    entry.count++;
    monthMap.set(yearMonth, entry);
  }

  // Build sorted list of months
  const meses: FaturamentoMes[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, { valor, comissao, count }]) => {
      const [year, month] = mes.split('-');
      return {
        mes,
        label: `${MONTH_ABBR[parseInt(month) - 1] ?? month} ${year}`,
        valor_fechado: Math.round(valor),
        comissao_fechado: Math.round(comissao),
        deals_count: count,
        ticket_medio: count > 0 ? Math.round(valor / count) : 0,
      };
    });

  const total_valor = meses.reduce((s, m) => s + m.valor_fechado, 0);
  const total_comissao = meses.reduce((s, m) => s + m.comissao_fechado, 0);
  const total_deals = meses.reduce((s, m) => s + m.deals_count, 0);

  return {
    meses,
    total_valor,
    total_comissao,
    total_deals,
    ticket_medio_geral: total_deals > 0 ? Math.round(total_valor / total_deals) : 0,
  };
}

// --- MRR/ARR computation ---

// Checks the raw `recurring` column from Sheets (accepts: 'true', 'sim', '1', 'yes', 'recorrente')
function isRecurring(raw: string | undefined): boolean {
  const v = String(raw || '').toLowerCase().trim();
  return v === 'true' || v === 'sim' || v === '1' || v === 'yes' || v === 'recorrente';
}

export function computeMrrArr(deals: RawDeal[]): MrrArrMetrics {
  const closedWon = deals.filter(d => isClosedWon(String(d.stage || '')));

  // Deals explicitly flagged as recurring in the `recurring` column
  const recurringDeals = closedWon.filter(d => isRecurring(d.recurring));

  // If the column isn't populated yet, fall back to all closed_won (subscription-first assumption)
  const source: 'explicit' | 'fallback' = recurringDeals.length > 0 ? 'explicit' : 'fallback';
  const dealsForMrr = source === 'explicit' ? recurringDeals : closedWon;

  // Each deal valor is treated as annual contract value → ARR = sum, MRR = ARR / 12
  const arr = dealsForMrr.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  const mrr = arr / 12;

  return {
    mrr: Math.round(mrr),
    arr: Math.round(arr),
    recurring_deals: recurringDeals.length,
    non_recurring_deals: closedWon.length - recurringDeals.length,
    source,
  };
}

// --- Comissão a pagar por owner + canal por mês ---

export function computeComissaoOwnerCanal(
  deals: RawDeal[],
  ano?: number
): ComissaoOwnerCanalMetrics {
  // key: YYYY-MM|owner|canal
  const groupMap = new Map<string, { valor: number; comissao: number; count: number; taxa: number }>();

  for (const deal of deals) {
    if (!isClosedWon(String(deal.stage || ''))) continue;

    const dateStr = String(deal.closing_date || deal.modified_time || '').slice(0, 10);
    if (!DATE_RE.test(dateStr)) continue;

    const yearMonth = dateStr.slice(0, 7);
    if (ano !== undefined && !yearMonth.startsWith(String(ano))) continue;

    const owner = String(deal.owner || '').trim() || '(sem owner)';
    const { categoria, taxa } = classifyOrigin(String(deal.lead_source || ''));
    const valor = Number(deal.valor) || 0;
    const comissao = valor * taxa;

    const key = `${yearMonth}|${owner}|${categoria}`;
    const entry = groupMap.get(key) ?? { valor: 0, comissao: 0, count: 0, taxa };
    entry.valor += valor;
    entry.comissao += comissao;
    entry.count++;
    groupMap.set(key, entry);
  }

  // Group into months
  const mesMap = new Map<string, ComissaoMes>();

  for (const [key, { valor, comissao, count, taxa }] of groupMap.entries()) {
    const [yearMonth, owner, canal] = key.split('|');
    const [year, month] = yearMonth.split('-');

    if (!mesMap.has(yearMonth)) {
      mesMap.set(yearMonth, {
        mes: yearMonth,
        label: `${MONTH_ABBR[parseInt(month) - 1] ?? month} ${year}`,
        total_valor: 0,
        total_comissao: 0,
        por_owner_canal: [],
      });
    }

    const mes = mesMap.get(yearMonth)!;
    mes.total_valor += valor;
    mes.total_comissao += comissao;
    mes.por_owner_canal.push({
      owner,
      canal,
      taxa,
      deals_count: count,
      valor_fechado: Math.round(valor),
      comissao: Math.round(comissao),
    });
  }

  // Sort months chronologically; sort entries within each month by owner then canal
  const meses: ComissaoMes[] = Array.from(mesMap.values())
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map(m => ({
      ...m,
      total_valor: Math.round(m.total_valor),
      total_comissao: Math.round(m.total_comissao),
      por_owner_canal: m.por_owner_canal.sort((a, b) =>
        a.owner.localeCompare(b.owner) || a.canal.localeCompare(b.canal)
      ),
    }));

  const total_comissao = meses.reduce((s, m) => s + m.total_comissao, 0);

  // Aggregate per owner across all months
  const ownerMap = new Map<string, { valor: number; comissao: number; count: number }>();
  for (const mes of meses) {
    for (const row of mes.por_owner_canal) {
      const entry = ownerMap.get(row.owner) ?? { valor: 0, comissao: 0, count: 0 };
      entry.valor += row.valor_fechado;
      entry.comissao += row.comissao;
      entry.count += row.deals_count;
      ownerMap.set(row.owner, entry);
    }
  }

  const owners = Array.from(ownerMap.entries())
    .sort(([, a], [, b]) => b.comissao - a.comissao)
    .map(([owner, { valor, comissao, count }]) => ({
      owner,
      total_valor: valor,
      total_comissao: comissao,
      deals_count: count,
    }));

  return { meses, total_comissao, owners };
}

// --- Receita por canal: breakdown de valor_fechado por Direto/SS/Parceiro no período ---

const CANAL_LABELS: Record<string, string> = {
  direto: 'Direto',
  parceiro: 'Parceiro',
  securisoft: 'SecuriSoft',
};

export function computeReceitaPorCanal(
  deals: RawDeal[],
  dateRange: { start: string; end: string }
): ReceitaPorCanalMetrics {
  const { start, end } = dateRange;

  const closedWonInRange = deals.filter(d =>
    isClosedWon(String(d.stage || '')) && dateInRange(d.closing_date || d.modified_time, start, end)
  );

  const accumulator: Record<string, { valor: number; comissao: number; count: number }> = {
    direto: { valor: 0, comissao: 0, count: 0 },
    parceiro: { valor: 0, comissao: 0, count: 0 },
    securisoft: { valor: 0, comissao: 0, count: 0 },
  };

  for (const deal of closedWonInRange) {
    const { categoria, taxa } = classifyOrigin(String(deal.lead_source || ''));
    const valor = Number(deal.valor) || 0;
    const comissao = valor * taxa;
    const cat = categoria in accumulator ? categoria : 'direto';
    accumulator[cat].valor += valor;
    accumulator[cat].comissao += comissao;
    accumulator[cat].count++;
  }

  const total_valor = Object.values(accumulator).reduce((s, v) => s + v.valor, 0);
  const total_comissao = Object.values(accumulator).reduce((s, v) => s + v.comissao, 0);
  const total_deals = Object.values(accumulator).reduce((s, v) => s + v.count, 0);

  const ordem: Array<'direto' | 'parceiro' | 'securisoft'> = ['direto', 'parceiro', 'securisoft'];

  const canais: ReceitaCanalItem[] = ordem.map(cat => ({
    categoria: cat,
    label: CANAL_LABELS[cat] ?? cat,
    valor_fechado: Math.round(accumulator[cat].valor),
    comissao_fechado: Math.round(accumulator[cat].comissao),
    deals: accumulator[cat].count,
    percentual: total_valor > 0 ? Math.round((accumulator[cat].valor / total_valor) * 100) : 0,
  }));

  return { canais, total_valor: Math.round(total_valor), total_comissao: Math.round(total_comissao), total_deals };
}

// --- Helper to get last closed client ---

export function getLastClosedClient(
  deals: RawDeal[],
  dateRange?: { start: string; end: string }
): { nome: string; origem: string; valor: number; data: string } | null {
  let closedWon = deals.filter(d => isClosedWon(String(d.stage || '')));

  if (dateRange) {
    closedWon = closedWon.filter(d => dateInRange(d.closing_date || d.modified_time, dateRange.start, dateRange.end));
  }

  if (closedWon.length === 0) return null;

  const sorted = closedWon.sort((a, b) =>
    String(b.closing_date || b.modified_time || '').localeCompare(String(a.closing_date || a.modified_time || ''))
  );

  const last = sorted[0];
  return {
    nome: String(last.nome || last.empresa || 'N/A'),
    origem: String(last.lead_source || 'N/A'),
    valor: Number(last.valor) || 0,
    data: String(last.closing_date || last.modified_time || '').slice(0, 10),
  };
}
