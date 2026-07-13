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
  closing_date?: string;
  resultados?: string;
  // FOOTGUN (feature-016 eval): the public `deals` tab does NOT currently export
  // these four columns. They compile but read as undefined → metrics that use them
  // (computeComissaoOwnerCanal, computeRenovacoesVencidas, total_licencas_ativas)
  // silently produce empty/0. Only populated if a future Fase 2 adds them to the
  // N8N "Format Deals Raw" export. Do NOT source per-owner data from the deals tab.
  licencas?: number | string;
  data_renovacao?: string;  // YYYY-MM-DD — data de renovação do contrato (SS deals)
  recurring?: string;       // 'true'|'sim'|'1' quando o contrato é recorrente (MRR/ARR)
  owner?: string;           // responsável pelo deal no Zoho CRM (Deal Owner)
  tags?: string;            // nomes das tags do deal no Zoho, unidas por ", " (feature-metas-fonte-receita)
}

export interface RawReuniao {
  data?: string;    // YYYY-MM-DD
  assunto?: string;
  duracao?: string | number;
}

export interface CoverageSourceStats {
  total: number;
  in_range: number;
  dropped_invalid_date: number;
  min_date: string | null;
  max_date: string | null;
  source?: 'sheet' | 'resultados-proxy' | 'unavailable';
}

export interface CoverageReport {
  deals: CoverageSourceStats;
  calls: CoverageSourceStats;
  emails: CoverageSourceStats;
  classificacoes: CoverageSourceStats;
  reunioes: CoverageSourceStats;
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
  total_licencas_ativas: number;
  coverage: CoverageReport;
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
  total_licencas_ativas: number;
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

// Série diária de ligações — um ponto por dia
export interface DailyCallPoint {
  data: string;        // YYYY-MM-DD
  total: number;       // total de ligações no dia
  atendidas: number;   // ligações atendidas
  taxa: number;        // taxa de conectividade (%)
}

// Resumo mensal para navegação por mês
export interface MesSummary {
  mes: string;          // YYYY-MM
  label: string;        // "Nov 2025", "Dez 2025", etc.
  total: number;        // total de ligações no mês
  atendidas: number;    // ligações atendidas
  media_diaria: number; // média diária (total / dias com dados)
}

// Resposta do endpoint /api/ligacoes-serie
export interface LigacoesSerieResponse {
  serie: DailyCallPoint[];
  meses: MesSummary[];
  total: number;
  total_atendidas: number;
  taxa_media: number;
  periodo: string;
  _cached?: boolean;
  _cacheAge?: number;
}

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

// Weekly activity buckets — used by bucketizeByWeek() in metrics.ts
export interface WeeklyBucket {
  key: string;         // YYYY-MM-SN (ex: 2026-04-S2)
  month: string;       // YYYY-MM
  week: 1 | 2 | 3 | 4 | 5;
  label: string;       // ex: "Abr S2"
  ligacoes: number;
  emails: number;
  reunioes: number;
  apresentacoes: number;
  propostas: number;
  fechamentos: number;
}

// POC (Proof of Concept) types — schema V1 (2026-05-07)
// Aba `pocs` na planilha. deal_id faz FK para RawDeal.id (Zoho Deal ID).
export type PocStatus = 'ativa' | 'convertida' | 'perdida';

export interface RawPoc {
  poc_id?: string;          // ID único da POC (ex: POC-001)
  deal_id?: string;         // ID do deal Zoho CRM (correlação com RawDeal.id)
  deal_nome?: string;       // Nome do deal (denormalizado)
  empresa?: string;         // Nome da empresa
  data_inicio?: string;     // YYYY-MM-DD
  data_fim_prevista?: string; // YYYY-MM-DD
  data_fim_real?: string;   // YYYY-MM-DD — vazio enquanto ativa
  status?: string;          // 'ativa' | 'convertida' | 'perdida'
  descricao?: string;       // Escopo / objetivo da POC
  responsavel?: string;     // Vendedor / dono interno
  resultado?: string;       // Notas: motivo de perda, valor convertido, etc.
  created_time?: string;    // YYYY-MM-DD
  modified_time?: string;   // YYYY-MM-DD
}

export interface Poc {
  poc_id: string;
  deal_id: string;
  deal_nome: string;
  empresa: string;
  data_inicio: string;
  data_fim_prevista: string | null;
  data_fim_real: string | null;
  status: PocStatus;
  descricao: string;
  responsavel: string;
  resultado: string;
  created_time: string;
  modified_time: string;
  /** Número de dias desde data_inicio (calculado em runtime) */
  dias_em_poc: number;
}

export interface PocMetrics {
  total: number;
  ativas: number;
  convertidas: number;
  perdidas: number;
  taxa_conversao: number;      // convertidas / (convertidas + perdidas) * 100
  duracao_media_dias: number;  // média de (data_fim_real - data_inicio) para concluídas
}

// Renovações vencidas — closed_won SS deals with data_renovacao < today
export interface RenovacaoVencida {
  id: string;
  nome: string;
  empresa: string;
  valor: number;
  closing_date: string;   // data em que o deal foi fechado
  data_renovacao: string; // data de renovação contratual
  dias_vencido: number;   // dias desde data_renovacao até hoje
}

export interface RenovacoesVencidasMetrics {
  total: number;        // quantidade de renovações vencidas
  valor_total: number;  // soma dos valores dos deals vencidos
  lista: RenovacaoVencida[];
}

// Clientes Ativos — base instalada + delta mensal por canal
export interface ClientesAtivosSplit {
  direto: number;
  parceiro: number;
  securisoft: number;
  total: number;
}

export interface ClientesAtivosMes {
  label: string;            // ex: "Mai 2026"
  month: string;            // YYYY-MM
  total: number;
  split: ClientesAtivosSplit;
}

export interface ClientesAtivosMetrics {
  total: number;            // todos os fechados ganhos (base instalada completa)
  split: ClientesAtivosSplit;
  mes_atual: ClientesAtivosMes;
  mes_anterior: ClientesAtivosMes;
  delta: number;            // mes_atual.total - mes_anterior.total
  delta_split: ClientesAtivosSplit; // delta por canal
}

// Pipeline Bucket Classifier types
export type PipelineBucketType = 'PIPELINE' | 'POC' | 'FOLLOW-UP' | 'OPORTUNIDADE';

export interface PipelineBucketDeal {
  id: string;
  nome: string;
  empresa: string;
  stage: string;
  valor: number;
  categoria: string;
  comissao_valor: number;
  modified_time: string;
  days_in_stage: number;
}

export interface PipelineBucket {
  bucket: PipelineBucketType;
  count: number;
  valor_total: number;
  comissao_total: number;
  deals: PipelineBucketDeal[];
}

export interface PipelineBucketsMetrics {
  buckets: PipelineBucket[];
  total_deals: number;
  total_valor: number;
  total_comissao: number;
}

// MRR/ARR — Monthly/Annual Recurring Revenue from recurring closed_won deals
export interface MrrArrMetrics {
  mrr: number;               // Monthly Recurring Revenue (ARR / 12)
  arr: number;               // Annual Recurring Revenue (sum of recurring deal values)
  recurring_deals: number;   // count of deals explicitly marked recurring
  non_recurring_deals: number;
  // 'explicit' = deals have recurring flag; 'fallback' = no flag set, all closed_won used
  source: 'explicit' | 'fallback';
}

// Faturamento Mensal — monthly revenue breakdown from closed_won deals
export interface FaturamentoMes {
  mes: string;           // YYYY-MM
  label: string;         // "Jan 2026"
  valor_fechado: number; // soma dos valores dos deals closed_won no mês
  comissao_fechado: number; // soma das comissões calculadas
  deals_count: number;   // número de deals fechados no mês
  ticket_medio: number;  // valor_fechado / deals_count (0 se count = 0)
}

export interface FaturamentoMensalMetrics {
  meses: FaturamentoMes[];       // sorted chronologically
  total_valor: number;           // soma de todos os meses
  total_comissao: number;
  total_deals: number;
  ticket_medio_geral: number;    // total_valor / total_deals
}

// Comissão por Owner + Canal por Mês
export interface ComissaoPorOwnerCanal {
  owner: string;        // vendedor responsável
  canal: string;        // 'direto' | 'parceiro' | 'securisoft'
  taxa: number;         // taxa de comissão (ex: 0.58)
  deals_count: number;
  valor_fechado: number;
  comissao: number;     // valor_fechado * taxa
}

export interface ComissaoMes {
  mes: string;                         // YYYY-MM
  label: string;                       // "Jan 2026"
  total_valor: number;
  total_comissao: number;
  por_owner_canal: ComissaoPorOwnerCanal[];
}

export interface ComissaoOwnerCanalMetrics {
  meses: ComissaoMes[];                // sorted chronologically
  total_comissao: number;
  owners: {
    owner: string;
    total_valor: number;
    total_comissao: number;
    deals_count: number;
  }[];
}

// Receita por canal — breakdown de valor_fechado por Direto/SS/Parceiro no período
export interface ReceitaCanalItem {
  categoria: 'direto' | 'parceiro' | 'securisoft';
  label: string;          // "Direto" | "SecuriSoft" | "Parceiro"
  valor_fechado: number;
  comissao_fechado: number;
  deals: number;
  percentual: number;     // % de valor_fechado total (0-100)
}

export interface ReceitaPorCanalMetrics {
  canais: ReceitaCanalItem[];
  total_valor: number;
  total_comissao: number;
  total_deals: number;
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

// ─── Resumo Diário (feature-016) ────────────────────────────────────────────
// Snapshot diário persistido na aba `resumo_diario` (doc público). 1 linha/dia.
// REGRA null vs 0: `0` = valor real capturado e é zero. `null` = NÃO capturado /
// NÃO-histórico (POCs/base em backfill, manuais sem linha de chat) → UI mostra "—".
export type Captured<T> = T | null;

export type EmailsSource = 'chat' | 'raw-fresh' | 'raw-stale';
export type ManualSource = 'chat' | 'none';
export type BaseSource = 'live' | 'none';

export interface ResumoCoverage {
  ligacoes_fresh: boolean;
  emails_source: EmailsSource;
  manual_source: ManualSource;
  base_source: BaseSource;
  partial_tracao: boolean;
}

export interface VendedorCalls { realizadas: number; atendidas: number; }

export interface ResumoBaseInstalada {
  total_licencas: number;
  clientes_ativos: number;
  top_contas: { name: string; licencas: number }[];
  demais_count: number;
  demais_licencas: number;
}

export interface ResumoDiario {
  data: string;            // YYYY-MM-DD (BRT)
  atualizado_em: string;   // ISO
  mode: 'live' | 'backfill';
  coverage: ResumoCoverage;
  ligacoes: { total: number; atendidas: number; taxa: number; por_vendedor: Record<string, VendedorCalls> };
  emails: { total: Captured<number>; por_sender: Captured<Record<string, number>> };
  apresentacoes: { total: Captured<number>; aproximado: boolean; por_vendedor: Captured<Record<string, number>> };
  propostas: { total: Captured<number>; aproximado: boolean; por_vendedor: Captured<Record<string, number>> };
  reuniao_tecnica: { total: Captured<number>; por_vendedor: Captured<Record<string, number>> };
  whatsapp: { msgs: Captured<number>; convs: Captured<number> };
  linkedin: { page: Captured<number>; perfis: Captured<number> };
  pocs: Captured<{ ativas: number; lista: string[] }>;
  base_instalada: Captured<ResumoBaseInstalada>;
  destaques: { comercial: Captured<string>; marketing: Captured<string>; execucao: Captured<string>; atencao: Captured<string> };
  total_tracao: Captured<number>;
}

// Linha bruta da aba `resumo_diario` (gviz). Colunas JSON chegam como string.
export interface RawResumoDiario {
  data?: string;
  atualizado_em?: string;
  mode?: string;
  coverage?: string;                    // JSON
  ligacoes_total?: number | string;
  ligacoes_atendidas?: number | string;
  ligacoes_taxa?: number | string;
  ligacoes_por_vendedor?: string;       // JSON
  emails_total?: number | string;
  emails_por_sender?: string;           // JSON
  apresentacoes_total?: number | string;
  apresentacoes_por_vendedor?: string;  // JSON
  propostas_total?: number | string;
  propostas_por_vendedor?: string;      // JSON
  reuniao_tecnica_total?: number | string;
  reuniao_por_vendedor?: string;        // JSON
  whatsapp_msgs?: number | string;
  whatsapp_convs?: number | string;
  linkedin_page?: number | string;
  linkedin_perfis?: number | string;
  pocs_ativas?: number | string;
  pocs_lista?: string;                  // JSON
  base_total_licencas?: number | string;
  base_clientes_ativos?: number | string;
  base_top_contas?: string;             // JSON
  base_demais_count?: number | string;
  base_demais_licencas?: number | string;
  total_tracao?: number | string;
  destaque_comercial?: string;
  destaque_marketing?: string;
  destaque_execucao?: string;
  destaque_atencao?: string;
}

export interface ResumoSeriePoint {
  data: string;
  total_tracao: number | null;
  ligacoes: number;
  emails: number | null;
  whatsapp: number | null;
  linkedin: number | null;
  apresentacoes: number | null;
  propostas: number | null;
  reuniao: number | null;
}

// Quando o usuário seleciona um intervalo no calendário (totais somados do período).
export interface PeriodoInfo {
  from: string;   // YYYY-MM-DD
  to: string;     // YYYY-MM-DD
  dias: number;   // dias com snapshot dentro do intervalo
}

export interface ResumoDiarioResponse {
  resumo: ResumoDiario | null;     // null = sem snapshot para a data/período. Em modo período = totais somados.
  datas_disponiveis: string[];     // YYYY-MM-DD com snapshot (para navegação)
  serie: ResumoSeriePoint[];       // série para o gráfico Tração Diária
  floor: string;                   // data mínima navegável (YYYY-MM-DD)
  base_atual: ResumoBaseInstalada | null; // base instalada mais recente (estado atual)
  periodo: PeriodoInfo | null;     // preenchido quando a resposta é um intervalo agregado
  farol: Farol | null;             // Farol de Metas (semana/mês ao vivo); null se deals indisponíveis
  _cached?: boolean;
  _cacheAge?: number;
}

// ─── Farol de Metas (feature-farol-metas, Fase 1) ────────────────────────────
export type FarolCor = 'verde' | 'amarelo' | 'vermelho';
export type FarolLabel = 'batido' | 'no ritmo' | 'atrás' | 'fora do ritmo';

export interface FarolBucket {
  revenue: number;   // receita ganha na janela (Σ valor dos deals ganhos)
  goal: number;      // meta da janela (R$)
  pctAbs: number;    // revenue / goal (0..∞)
  expected: number;  // esperado pelo pace no instante (R$)
  cor: FarolCor;
  label: FarolLabel;
}

export interface Farol {
  semana: FarolBucket;
  mes: FarolBucket;
  generatedAt: string; // ISO do instante de cálculo
}

// ─── Farol de Metas (feature-farol-metas, Fase 2 — Landed) ───────────────────
// "Por que bati / não bati" por semana ISO (Seg–Dom), reusando resumo_diario + deals.
export interface WeekEsforco {
  ligacoes: number;
  emails: number;
  apresentacoes: number;
  propostas: number;
  reunioes: number;
}

// Variação percentual vs a semana anterior (ex.: -0.6 = caiu 60%). null = sem
// semana anterior para comparar, ou divisão por zero indefinida.
export interface WeekDelta {
  revenue: number | null;
  ligacoes: number | null;
  emails: number | null;
  apresentacoes: number | null;
  propostas: number | null;
  reunioes: number | null;
}

export interface WeekMetric {
  weekStart: string; // YYYY-MM-DD (segunda)
  weekEnd: string;   // YYYY-MM-DD (domingo)
  // feature-metas-fonte-receita: `revenue` passou a significar SÓ a receita
  // "Venda Defenz" (fonteVenda === 'defenz') — é o que alimenta a meta/pctAbs/
  // cor/label/diagnóstico. `revenueRepasse` é a receita "Repasse SS" (informativa,
  // fora da meta). `revenueTotal` = revenue + revenueRepasse (reconcilia com o
  // Farol Fase 1 do /diario, que soma tudo). Ver docs/features/feature-metas-fonte-receita.md.
  revenue: number;
  revenueRepasse: number;
  revenueTotal: number;
  goal: number;      // GOAL_WEEK (R$ 6.000)
  pctAbs: number;     // revenue / goal
  cor: FarolCor;
  label: FarolLabel;
  esforco: WeekEsforco;
  delta: WeekDelta;
  diagnostico: string; // heurístico determinístico "por que bati/não bati"
}

export interface MetasResponse {
  semanas: WeekMetric[]; // mais recente primeiro
  generatedAt: string;   // ISO do instante de cálculo
  _cached?: boolean;
  _cacheAge?: number;
}
