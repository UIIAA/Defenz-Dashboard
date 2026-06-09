import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { fetchFromSheets } from "@/lib/sheets";
import type { RawCall } from "@/lib/types";
import type { DailyCallPoint, MesSummary } from "@/lib/types";

// Cache em memória (por instância do servidor)
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Mapeia período canônico → {start, end, label}
function getDateRange(periodo: string): { start: string; end: string; label: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const todayStr = fmt(today);

  switch (periodo) {
    case 'today':
      return { start: todayStr, end: todayStr, label: todayStr };
    case '7d': {
      const s = new Date(today);
      s.setDate(s.getDate() - 7);
      return { start: fmt(s), end: todayStr, label: 'Últimos 7 dias' };
    }
    case '15d': {
      const s = new Date(today);
      s.setDate(s.getDate() - 15);
      return { start: fmt(s), end: todayStr, label: 'Últimos 15 dias' };
    }
    case '30d': {
      const s = new Date(today);
      s.setDate(s.getDate() - 30);
      return { start: fmt(s), end: todayStr, label: 'Últimos 30 dias' };
    }
    case 'month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmt(s), end: todayStr, label: 'Este Mês' };
    }
    case 'alltime':
      return { start: '2020-01-01', end: todayStr, label: 'Todo o Período' };
    default: {
      // "custom:YYYY-MM-DD:YYYY-MM-DD"
      if (periodo.startsWith('custom:')) {
        const parts = periodo.split(':');
        const inicio = parts[1] ?? '';
        const fim = parts[2] ?? '';
        if (DATE_RE.test(inicio) && DATE_RE.test(fim)) {
          const fmtDate = (iso: string) => {
            const [, m, d] = iso.split('-');
            return `${d}/${m}`;
          };
          return { start: inicio, end: fim, label: `${fmtDate(inicio)} - ${fmtDate(fim)}` };
        }
      }
      // "mes:YYYY-MM" — mês específico
      if (periodo.startsWith('mes:')) {
        const ym = periodo.slice(4); // "YYYY-MM"
        if (/^\d{4}-\d{2}$/.test(ym)) {
          const [yearStr, monthStr] = ym.split('-');
          const year = Number(yearStr);
          const month = Number(monthStr) - 1; // 0-indexed
          const firstDay = fmt(new Date(year, month, 1));
          const lastDay = fmt(new Date(year, month + 1, 0)); // last day of month
          const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          const label = `${MONTHS_PT[month]} ${year}`;
          return { start: firstDay, end: lastDay, label };
        }
      }
      return { start: todayStr, end: todayStr, label: todayStr };
    }
  }
}

// Agrega ligações por dia dentro do range
function aggregateByDay(calls: RawCall[], start: string, end: string): DailyCallPoint[] {
  const dayMap = new Map<string, { total: number; atendidas: number }>();

  for (const call of calls) {
    const raw = String(call.data || '');
    const d = raw.slice(0, 10);
    if (!DATE_RE.test(d)) continue;
    if (d < start || d > end) continue;

    const entry = dayMap.get(d) ?? { total: 0, atendidas: 0 };
    entry.total++;
    if (String(call.status || '').toLowerCase() === 'atendida') {
      entry.atendidas++;
    }
    dayMap.set(d, entry);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, { total, atendidas }]) => ({
      data,
      total,
      atendidas,
      taxa: total > 0 ? Math.round((atendidas / total) * 100) : 0,
    }));
}

// Nomes dos meses em pt-BR
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Agrega todas as ligações disponíveis por mês (para navegação)
function aggregateByMonth(calls: RawCall[]): MesSummary[] {
  const monthMap = new Map<string, { total: number; atendidas: number; days: Set<string> }>();

  for (const call of calls) {
    const raw = String(call.data || '');
    const d = raw.slice(0, 10);
    if (!DATE_RE.test(d)) continue;

    const mes = d.slice(0, 7); // "YYYY-MM"
    const entry = monthMap.get(mes) ?? { total: 0, atendidas: 0, days: new Set() };
    entry.total++;
    if (String(call.status || '').toLowerCase() === 'atendida') {
      entry.atendidas++;
    }
    entry.days.add(d);
    monthMap.set(mes, entry);
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, { total, atendidas, days }]) => {
      const [yearStr, monthStr] = mes.split('-');
      const monthIdx = Number(monthStr) - 1;
      const label = `${MONTHS_PT[monthIdx] ?? monthStr} ${yearStr}`;
      const diasComDados = days.size;
      return {
        mes,
        label,
        total,
        atendidas,
        media_diaria: diasComDados > 0 ? Math.round((total / diasComDados) * 10) / 10 : 0,
      };
    });
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get("periodo") || "30d";

  // Verificar cache
  const cacheKey = `ligacoes_serie_${periodo}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, _cached: true, _cacheAge: Math.round((Date.now() - cached.timestamp) / 1000) });
  }

  try {
    const calls = await fetchFromSheets("ligacoes") as RawCall[];

    const dateRange = getDateRange(periodo);
    const serie = aggregateByDay(calls, dateRange.start, dateRange.end);
    const meses = aggregateByMonth(calls);

    const total = serie.reduce((s, p) => s + p.total, 0);
    const total_atendidas = serie.reduce((s, p) => s + p.atendidas, 0);
    const taxa_media = total > 0 ? Math.round((total_atendidas / total) * 100) : 0;

    const response = {
      serie,
      meses,
      total,
      total_atendidas,
      taxa_media,
      periodo: dateRange.label,
    };

    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in ligacoes-serie route:", error);
    return NextResponse.json(
      { error: "Erro ao buscar série de ligações" },
      { status: 500 }
    );
  }
}
