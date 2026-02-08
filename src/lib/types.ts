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
  ultimo_cliente: Client;
  parceiros: Partners;
  deals_ativos: Deal[];
  clientes_fechados: Deal[];
}

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
