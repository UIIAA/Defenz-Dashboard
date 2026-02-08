const DATE_BOUNDS_RE = /^\d{4}-\d{2}-\d{2}$/;

export const getDateBounds = (range: string): { data_inicio: string; data_fim: string } => {
  const today = new Date().toISOString().split('T')[0];

  if (range.startsWith('custom:')) {
    const parts = range.split(':');
    const inicio = parts[1] ?? '';
    const fim = parts[2] ?? '';
    if (DATE_BOUNDS_RE.test(inicio) && DATE_BOUNDS_RE.test(fim) && !isNaN(new Date(inicio).getTime()) && !isNaN(new Date(fim).getTime()) && inicio <= fim) {
      return { data_inicio: inicio, data_fim: fim };
    }
    return { data_inicio: today, data_fim: today };
  }
  if (range === 'alltime') {
    return { data_inicio: '2020-01-01', data_fim: today };
  }
  if (range === 'today') {
    return { data_inicio: today, data_fim: today };
  }
  if (range === 'month') {
    return { data_inicio: today.slice(0, 8) + '01', data_fim: today };
  }
  const dias = parseInt(range.replace('d', ''), 10);
  if (isNaN(dias) || dias <= 0 || dias > 366) {
    return { data_inicio: today, data_fim: today };
  }
  const start = new Date();
  start.setDate(start.getDate() - dias);
  return { data_inicio: start.toISOString().split('T')[0], data_fim: today };
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(value);
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const normalizeDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  if (DATE_RE.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) return dateStr.slice(0, 10);
  const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
};

export const str = (v: any, fallback = '', maxLen = 200): string => {
  if (typeof v !== 'string') return fallback;
  return v.slice(0, maxLen);
};

export const originBadge = (categoria?: string) => {
  if (categoria === 'securisoft') return { label: 'SS 5%', className: 'bg-red-50 text-red-600 border-red-100' };
  if (categoria === 'direto') return { label: 'Direto 58%', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  if (categoria === 'parceiro') return { label: 'Parceiro 43%', className: 'bg-blue-50 text-blue-600 border-blue-100' };
  return null;
};
