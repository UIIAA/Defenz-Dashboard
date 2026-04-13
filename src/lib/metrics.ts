import type { RawDeal, RawCall, RawEmail, RawClassificacao, ComputedMetrics, DailyEffort } from './types';

// --- Stage classification helpers ---

const CLOSED_WON_STAGES = ['fechado ganho', 'contrato enviado'];
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

function dateInRange(dateStr: string | undefined, start: string, end: string): boolean {
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  return d >= start && d <= end;
}

// --- Event date extraction from resultados text ---

function extractEventDates(resultados: string, tag: string): string[] {
  const lines = String(resultados || '').split('\n');
  const dates: string[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  for (const line of lines) {
    if (!line.includes(tag)) continue;
    const match = line.match(/(\d{2})\/(\d{2})/);
    if (!match) continue;
    const day = match[1];
    const month = parseInt(match[2]);
    const year = month > currentMonth ? currentYear - 1 : currentYear;
    dates.push(`${year}-${String(month).padStart(2, '0')}-${day}`);
  }
  return dates;
}

// --- Main metrics computation ---

export function computeMetrics(
  deals: RawDeal[],
  calls: RawCall[],
  emails: RawEmail[],
  classificacoes: RawClassificacao[],
  dateRange: { start: string; end: string }
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

  // Reunioes = 0 (P4 pendente — Microsoft Calendar não funciona)
  const reunioes = 0;

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

  // Deal counts filtered by date range
  const closedWonInRange = deals.filter(d =>
    isClosedWon(String(d.stage || '')) && dateInRange(d.modified_time, start, end)
  );
  const closedLostInRange = deals.filter(d =>
    isClosedLost(String(d.stage || '')) && dateInRange(d.modified_time, start, end)
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

  // Decision maker contacts (from IA classification — snapshot)
  const contatos_decisor = classificacoes.filter(
    c => String(c.nivel_maximo || '').toLowerCase() === 'decisor'
  ).length;
  const contatos_decisor_info = classificacoes.filter(
    c => ['decisor', 'tecnico'].includes(String(c.nivel_maximo || '').toLowerCase())
  ).length;

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

// --- Helper to get last closed client ---

export function getLastClosedClient(
  deals: RawDeal[],
  dateRange?: { start: string; end: string }
): { nome: string; origem: string; valor: number; data: string } | null {
  let closedWon = deals.filter(d => isClosedWon(String(d.stage || '')));

  if (dateRange) {
    closedWon = closedWon.filter(d => dateInRange(d.modified_time, dateRange.start, dateRange.end));
  }

  if (closedWon.length === 0) return null;

  const sorted = closedWon.sort((a, b) =>
    String(b.modified_time || '').localeCompare(String(a.modified_time || ''))
  );

  const last = sorted[0];
  return {
    nome: String(last.nome || 'N/A'),
    origem: String(last.lead_source || 'N/A'),
    valor: Number(last.valor) || 0,
    data: String(last.modified_time || '').slice(0, 10),
  };
}
