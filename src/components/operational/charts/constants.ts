export const STAGE_COLORS: Record<string, string> = {
  'Qualificação': '#6366f1',
  'Apresentação': '#f59e0b',
  'Proposta Enviada': '#10b981',
  'Negociação': '#ef4444',
};

export const STAGE_ORDER = [
  'Qualificação',
  'Apresentação',
  'Proposta Enviada',
  'Negociação',
];

export const AGING_BUCKETS = [
  { label: '0-3d', min: 0, max: 3, color: '#10b981' },
  { label: '4-7d', min: 4, max: 7, color: '#f59e0b' },
  { label: '8-14d', min: 8, max: 14, color: '#f97316' },
  { label: '15-30d', min: 15, max: 30, color: '#ef4444' },
  { label: '30d+', min: 31, max: Infinity, color: '#e11d48' },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  securisoft: '#dc2626',
  direto: '#10b981',
  parceiro: '#3b82f6',
};

export const CATEGORY_LABELS: Record<string, string> = {
  securisoft: 'SecuriSoft 5%',
  direto: 'Direto 58%',
  parceiro: 'Parceiro 43%',
};

export const DEFAULT_STAGE_COLOR = '#94a3b8';
export const DEFAULT_CATEGORY_COLOR = '#94a3b8';
