import type { EnrichedLead } from './types';

/**
 * Normalize phone: strip non-digits, return last N digits.
 * Used to build dual-key index (8 and 9 digits) for matching.
 */
export function normalizePhone(phone: string, digits: 8 | 9 = 9): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return ''; // too short (internal, 0800, etc.)
  return d.slice(-digits);
}

/**
 * Normalize email: lowercase + trim
 */
export function normalizeEmail(email: string): string {
  return (email || '').toLowerCase().trim();
}

/** Domains too generic for company matching */
const GENERIC_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br',
  'live.com', 'icloud.com', 'aol.com', 'uol.com.br', 'bol.com.br',
  'terra.com.br', 'ig.com.br', 'globo.com', 'protonmail.com',
  'outlook.com.br', 'hotmail.com.br',
]);

function extractDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at > 0 ? email.slice(at + 1).toLowerCase().trim() : '';
}

interface RawLead {
  lead_id?: string;
  nome?: string;
  empresa?: string;
  lead_source?: string;
  lead_status?: string;
  telefone?: string;
  email?: string;
  resultados?: string;
  created_time?: string;
  modified_time?: string;
  owner?: string;
}

interface RawCall {
  call_id?: string;
  data?: string;
  hora?: string;
  agente?: string;
  destino?: string;
  duracao_seg?: number | string;
  status?: string;
  disposicao?: string;
}

interface RawEmail {
  email_id?: string;
  data?: string;
  hora?: string;
  destinatario?: string;
  destinatario_nome?: string;
  assunto?: string;
  status?: string;
  sequencia?: string;
}

interface RawClassificacao {
  lead_id?: string;
  lead_name?: string;
  data_classificacao?: string;
  nivel_maximo?: string;
  passou_secretaria?: string;
  resultado_principal?: string;
  concorrente?: string;
  renovacao_concorrente?: string;
  toques_estimados?: number | string;
  pessoa_contactada?: string;
  cargo_estimado?: string;
  resumo?: string;
}

interface LeadAccumulator {
  total_ligacoes: number;
  ligacoes_atendidas: number;
  total_emails: number;
  datas_contato: string[];
}

export function correlateLeads(
  leads: RawLead[],
  calls: RawCall[],
  emails: RawEmail[],
  classificacoes: RawClassificacao[]
): EnrichedLead[] {
  // Build phone → lead_id maps (dual key: 8 and 9 digits)
  const phone9ToLeadId = new Map<string, string>();
  const phone8ToLeadId = new Map<string, string>();
  const emailToLeadId = new Map<string, string>();
  // Domain → lead_ids for fallback matching (excludes generic domains)
  const domainToLeadIds = new Map<string, string[]>();

  for (const lead of leads) {
    const id = String(lead.lead_id || '');
    if (!id) continue;

    if (lead.telefone) {
      const norm9 = normalizePhone(String(lead.telefone), 9);
      const norm8 = normalizePhone(String(lead.telefone), 8);
      if (norm9) phone9ToLeadId.set(norm9, id);
      if (norm8) phone8ToLeadId.set(norm8, id);
    }
    if (lead.email) {
      const norm = normalizeEmail(String(lead.email));
      if (norm && norm.includes('@')) {
        emailToLeadId.set(norm, id);
        // Build domain index for fallback
        const domain = extractDomain(norm);
        if (domain && !GENERIC_DOMAINS.has(domain)) {
          const arr = domainToLeadIds.get(domain);
          if (arr) arr.push(id);
          else domainToLeadIds.set(domain, [id]);
        }
      }
    }
  }

  // Build classificacao map by lead_id
  const classMap = new Map<string, RawClassificacao>();
  for (const c of classificacoes) {
    const id = String(c.lead_id || '');
    if (id) classMap.set(id, c);
  }

  // Accumulate calls and emails per lead
  const accum = new Map<string, LeadAccumulator>();

  const getAccum = (leadId: string): LeadAccumulator => {
    let a = accum.get(leadId);
    if (!a) {
      a = { total_ligacoes: 0, ligacoes_atendidas: 0, total_emails: 0, datas_contato: [] };
      accum.set(leadId, a);
    }
    return a;
  };

  // Match calls to leads by phone (try 9-digit first, then 8-digit)
  for (const call of calls) {
    if (!call.destino) continue;
    const dest = String(call.destino);
    const norm9 = normalizePhone(dest, 9);
    const norm8 = normalizePhone(dest, 8);
    const leadId = (norm9 && phone9ToLeadId.get(norm9))
                || (norm8 && phone8ToLeadId.get(norm8));
    if (!leadId) continue;

    const a = getAccum(leadId);
    a.total_ligacoes++;
    const status = String(call.status || '').toLowerCase();
    if (status === 'atendida') {
      a.ligacoes_atendidas++;
    }
    if (call.data) {
      a.datas_contato.push(String(call.data).slice(0, 10));
    }
  }

  // Match emails to leads: exact email first, then domain fallback
  for (const email of emails) {
    if (!email.destinatario) continue;
    const norm = normalizeEmail(String(email.destinatario));

    // 1) Exact match
    let matchedIds: string[] = [];
    const exactId = emailToLeadId.get(norm);
    if (exactId) {
      matchedIds = [exactId];
    } else {
      // 2) Domain fallback: same corporate domain → attribute to those leads
      const domain = extractDomain(norm);
      if (domain && !GENERIC_DOMAINS.has(domain)) {
        const domainIds = domainToLeadIds.get(domain);
        if (domainIds && domainIds.length > 0) {
          matchedIds = domainIds;
        }
      }
    }

    for (const leadId of matchedIds) {
      const a = getAccum(leadId);
      a.total_emails++;
      if (email.data) {
        a.datas_contato.push(String(email.data).slice(0, 10));
      }
    }
  }

  // Build enriched leads
  return leads.map((lead): EnrichedLead => {
    const id = String(lead.lead_id || '');
    const cls = classMap.get(id);
    const a = accum.get(id) || { total_ligacoes: 0, ligacoes_atendidas: 0, total_emails: 0, datas_contato: [] };

    // Determine if deprecated: no classificacao AND no resultados content
    const hasResultados = !!(lead.resultados && String(lead.resultados).trim().length > 10);
    const hasClassificacao = !!cls;
    const isDeprecado = !hasClassificacao && !hasResultados;

    // Determine canal
    const hasLig = a.total_ligacoes > 0;
    const hasEmail = a.total_emails > 0;
    const canal: EnrichedLead['canal'] =
      hasLig && hasEmail ? 'ambos' :
      hasLig ? 'ligacoes_only' :
      hasEmail ? 'emails_only' :
      'nenhum';

    // Contact date range
    const sortedDates = a.datas_contato.filter(Boolean).sort();
    const primeiro_contato = sortedDates[0] || '';
    const ultimo_contato = sortedDates[sortedDates.length - 1] || '';

    return {
      lead_id: id,
      nome: String(lead.nome || ''),
      empresa: String(lead.empresa || '-'),
      lead_source: String(lead.lead_source || ''),
      lead_status: String(lead.lead_status || ''),
      telefone: String(lead.telefone || ''),
      email: String(lead.email || ''),
      created_time: String(lead.created_time || ''),
      modified_time: String(lead.modified_time || ''),
      owner: String(lead.owner || ''),
      // IA classification fields
      nivel_maximo: isDeprecado ? 'DEPRECADO' : String(cls?.nivel_maximo || 'inconclusivo'),
      passou_secretaria: String(cls?.passou_secretaria || '').toLowerCase() === 'sim',
      resultado_principal: isDeprecado ? 'DEPRECADO' : String(cls?.resultado_principal || 'inconclusivo'),
      concorrente: String(cls?.concorrente || ''),
      toques_estimados: Number(cls?.toques_estimados) || 0,
      cargo_estimado: String(cls?.cargo_estimado || 'desconhecido'),
      resumo: String(cls?.resumo || ''),
      // Correlation fields
      total_ligacoes: a.total_ligacoes,
      ligacoes_atendidas: a.ligacoes_atendidas,
      total_emails: a.total_emails,
      canal,
      primeiro_contato,
      ultimo_contato,
      // Tag
      is_deprecado: isDeprecado,
    };
  });
}
