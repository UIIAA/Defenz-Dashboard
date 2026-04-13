// Raw data types (from Google Sheets tabs)
export interface RawCall {
  call_id?: string;
  data?: string;
  hora?: string;
  agente?: string;
  destino?: string;
  duracao_seg?: number | string;
  status?: string;
  disposicao?: string;
}

export interface RawEmail {
  email_id?: string;
  data?: string;
  hora?: string;
  destinatario?: string;
  destinatario_nome?: string;
  assunto?: string;
  status?: string;
  sequencia?: string;
}

export interface RawLead {
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

export interface RawClassificacao {
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

export interface RawDeal {
  id?: string;
  nome?: string;
  empresa?: string;
  stage?: string;
  valor?: number | string;
  lead_source?: string;
  categoria?: string;
  comissao_valor?: number | string;
  created_time?: string;
  modified_time?: string;
  resultados?: string;
}

export interface ComputedMetrics {
  ligacoes: number;
  ligacoes_atendidas: number;
  taxa_conectividade: number;
  emails: number;
  reunioes: number;
  apresentacoes: number;
  propostas: number;
  deals_novos: number;
  deals_fechados: number;
  deals_pipeline: number;
  valor_pipeline: number;
  valor_fechado: number;
  comissao_pipeline: number;
  comissao_fechado: number;
  ticket_medio: number;
  win_rate: number;
  contatos_decisor: number;
  contatos_decisor_info: number;
}

export interface Client {
  nome: string;
  origem: string;
  valor: number;
  data: string;
}

export interface Deal {
  id_data?: string;
  id: string;
  data: string;
  nome: string;
  origem: string;
  empresa?: string;
  stage?: string;
  valor?: number;
  categoria?: string;
  comissao_valor?: number;
  modified_time?: string;
  days_in_stage?: number;
  last_activity_date?: string;
  last_activity_type?: string;
}

export interface Partners {
  total: number;
  lista: string[];
}

export interface N8nData {
  data: string;
  hora: string;
  periodo: string;
  ligacoes: number;
  ligacoes_atendidas: number;
  taxa_conectividade: number;
  emails: number;
  reunioes: number;
  apresentacoes: number;
  propostas: number;
  deals_novos: number;
  deals_fechados: number;
  valor_pipeline: number;
  valor_fechado: number;
  comissao_pipeline: number;
  comissao_fechado: number;
  ticket_medio: number;
  win_rate: number;
  contatos_decisor: number;
  contatos_decisor_info: number;
  deals_pipeline: number;
  ultimo_cliente: Client;
  parceiros: Partners;
  deals_ativos: Deal[];
  clientes_fechados: Deal[];
  _comparison?: ComparisonData;
}

export interface ComparisonData {
  periodo: string;
  dias: number;
  comissao_fechado: number;
  deals_fechados: number;
  ligacoes: number;
  emails: number;
  reunioes: number;
  taxa_conectividade: number;
  win_rate: number;
  ticket_medio: number;
  contatos_decisor: number;
  contatos_decisor_info: number;
}

export type TrendDirection = 'up' | 'down' | 'neutral';

export type DataSource = 'cache' | 'sheets' | 'n8n' | 'mock';

// Operational types (V3.0)
export interface OperationalDeal extends Deal {
  modified_time: string;
  days_in_stage: number;
  last_activity_date: string;
  last_activity_type: 'call' | 'email' | 'meeting' | 'none';
  activities: DealActivity[];
  is_stale: boolean;
}

export interface DealActivity {
  deal_id: string;
  deal_nome: string;
  tipo: 'call' | 'email' | 'meeting';
  data: string;
  descricao: string;
  vendedor: string;
}

export interface DailyEffort {
  data: string;
  calls: number;
  emails: number;
  meetings: number;
  total: number;
}

// Esforco Comercial (IA Classification) types
export interface ClassificacaoDeal {
  lead_id: string;
  lead_name: string;
  data_classificacao: string;
  nivel_maximo: 'secretaria' | 'tecnico' | 'decisor' | 'nenhum_contato' | 'tag_apenas' | 'erro_parse';
  passou_secretaria: boolean;
  resultado_principal: string;
  concorrente: string;
  renovacao_concorrente: string;
  toques_estimados: number;
  pessoa_contactada: string;
  cargo_estimado: string;
  resumo: string;
}

export interface EsforcoMetrics {
  deals_com_resultados: number;
  taxa_gatekeeper: number;
  taxa_decisor: number;
  toques_medio: number;
  resposta_top1: string;
  concorrente_top1: string;
  deals_com_concorrente: number;
}

export interface EsforcoFunnelStep {
  label: string;
  value: number;
  percent: number;
}

export interface EsforcoData {
  classificacoes: ClassificacaoDeal[];
  metrics: EsforcoMetrics;
  funnel: EsforcoFunnelStep[];
  respostas: { label: string; count: number }[];
  concorrentes: { nome: string; deals: number; renovacao: string }[];
}

export type ClassificacaoLead = ClassificacaoDeal;

export interface AgendaItem {
  task_id: string;
  lead_id: string;
  lead_name: string;
  empresa: string;
  subject: string;
  due_date: string;
  status: string;
  description: string;
  owner: string;
  is_overdue: boolean;
  lead_status: string;
}

export interface AgendaData {
  items: AgendaItem[];
  total: number;
  overdue: number;
  upcoming_7d: number;
}

// Excel Export types (V3.9)
export interface EnrichedLead {
  // Dados do lead (leads_completo)
  lead_id: string;
  nome: string;
  empresa: string;
  lead_source: string;
  lead_status: string;
  telefone: string;
  email: string;
  created_time: string;
  modified_time: string;
  owner: string;
  // Classificacao IA (classificacao_esforco) — ou defaults se DEPRECADO
  nivel_maximo: string;
  passou_secretaria: boolean;
  resultado_principal: string;
  concorrente: string;
  toques_estimados: number;
  cargo_estimado: string;
  resumo: string;
  // Correlacao
  total_ligacoes: number;
  ligacoes_atendidas: number;
  total_emails: number;
  canal: 'ligacoes_only' | 'emails_only' | 'ambos' | 'nenhum';
  primeiro_contato: string;
  ultimo_contato: string;
  // Tag
  is_deprecado: boolean;
}

export interface ScorecardKPI {
  metrica: string;
  valor: number;
  benchmark: string;
  gap: string;
  status: 'ok' | 'warning' | 'critical';
}

export interface ExcelExportData {
  leads: EnrichedLead[];
  metricas: any;
  deals_ativos: any[];
  clientes_fechados: any[];
  kpis: ScorecardKPI[];
}
