"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users, Zap, TrendingUp,
  Target, AlertTriangle, Activity, CheckCircle2,
  DollarSign, Trophy, RefreshCcw, LogOut
} from 'lucide-react';
import { MagicCard } from '@/components/ui/MagicCard';
import { DateFilter } from '@/components/ui/DateFilter';
import { motion, AnimatePresence } from 'framer-motion';
import { FunnelChart } from '@/components/charts/FunnelChart';

// --- Types based on N8n JSON ---
interface Client {
  nome: string;
  origem: string;
  valor: number;
  data: string;
}

interface Deal {
  id_data?: string;
  id: string;
  data: string;
  nome: string;
  origem: string;
  stage?: string;
  valor?: number;
}

interface Partners {
  total: number;
  lista: string[];
}

interface N8nData {
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
  ultimo_cliente: Client;
  parceiros: Partners;
  deals_ativos: Deal[];
  clientes_fechados: Deal[];
}

// --- Mock Data Generator ---
const generateMockData = (range: string): N8nData => {
  const multiplier = range === '7d' ? 1 : range === '15d' ? 2 : range === '30d' ? 4 : 4.5;

  return {
    data: new Date().toISOString().split('T')[0],
    hora: new Date().toLocaleTimeString(),
    periodo: range === '7d' ? 'Últimos 7 dias' : range === 'month' ? 'Este Mês' : `Últimos ${range.replace('d', '')} dias`,
    ligacoes: Math.floor(150 * multiplier),
    ligacoes_atendidas: Math.floor(53 * multiplier),
    taxa_conectividade: 35,
    emails: Math.floor(155 * multiplier),
    reunioes: Math.floor(10 * multiplier),
    apresentacoes: Math.floor(5 * multiplier),
    propostas: Math.floor(3 * multiplier),
    deals_novos: Math.floor(31 * multiplier),
    deals_fechados: Math.floor(2 * multiplier),
    valor_pipeline: 210551.69 * multiplier,
    valor_fechado: 14617.40 * multiplier,
    ultimo_cliente: {
      nome: "Zztech Informatica LTDA",
      origem: "Parceiro SS (SecuriSoft)",
      valor: 1223.65,
      data: "2026-01-26"
    },
    parceiros: {
      total: 5,
      lista: ["SecuriSoft", "EXHTech", "AlphaNetworking", "Adriano", "Otavio"]
    },
    deals_ativos: [
      { id: "1", data: "2026-01-26", nome: "Consube Agropecuária", origem: "Linkedin Ads", stage: "Contato inicial", valor: 0 },
      { id: "2", data: "2026-01-26", nome: "Brago Atacadista", origem: "Parceiro SS", stage: "Em negociação", valor: 0 },
      { id: "3", data: "2026-01-26", nome: "FDC - Fundação Dom Cabral", origem: "Parceiro SS", stage: "Contato inicial", valor: 57103.55 },
      { id: "4", data: "2026-01-26", nome: "Plena Contabilidade", origem: "Apollo", stage: "Em negociação", valor: 13052.24 },
      { id: "5", data: "2026-01-26", nome: "Allied Brasil", origem: "Parceiro SS", stage: "Em negociação", valor: 56310.00 },
    ],
    clientes_fechados: [
      { id: "101", data: "2026-01-26", nome: "Zztech Informatica LTDA", origem: "Parceiro SS", valor: 1223.65 },
      { id: "102", data: "2026-01-23", nome: "ESTÂNCIA SUPERMERCADOS", origem: "Parceiro SS", valor: 14617.40 },
      { id: "103", data: "2026-01-16", nome: "SEA TELECOM", origem: "Parceiro SS", valor: 35467.50 },
    ]
  };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  if (DATE_RE.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) return dateStr.slice(0, 10);
  const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(value);
};

// --- Data Validation ---

const str = (v: any, fallback = '', maxLen = 200): string => {
  if (typeof v !== 'string') return fallback;
  return v.slice(0, maxLen);
};

const validateN8nData = (raw: any): N8nData => {
  const num = (v: any, fallback = 0) => {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  };

  return {
    data: str(raw.data, new Date().toISOString().split('T')[0], 10),
    hora: str(raw.hora, '--:--', 12),
    periodo: str(raw.periodo, '', 100),
    ligacoes: Math.max(0, num(raw.ligacoes)),
    ligacoes_atendidas: Math.max(0, num(raw.ligacoes_atendidas)),
    taxa_conectividade: Math.min(100, Math.max(0, num(raw.taxa_conectividade))),
    emails: Math.max(0, num(raw.emails)),
    reunioes: Math.max(0, num(raw.reunioes)),
    apresentacoes: Math.max(0, num(raw.apresentacoes)),
    propostas: Math.max(0, num(raw.propostas)),
    deals_novos: Math.max(0, num(raw.deals_novos)),
    deals_fechados: Math.max(0, num(raw.deals_fechados)),
    valor_pipeline: Math.max(0, num(raw.valor_pipeline)),
    valor_fechado: Math.max(0, num(raw.valor_fechado)),
    ultimo_cliente: {
      nome: str(raw.ultimo_cliente?.nome, 'N/A'),
      origem: str(raw.ultimo_cliente?.origem, 'N/A'),
      valor: num(raw.ultimo_cliente?.valor),
      data: str(raw.ultimo_cliente?.data, '', 10),
    },
    parceiros: {
      total: num(raw.parceiros?.total),
      lista: Array.isArray(raw.parceiros?.lista)
        ? raw.parceiros.lista.slice(0, 100).map((p: any) => str(p, '', 100))
        : [],
    },
    deals_ativos: Array.isArray(raw.deals_ativos)
      ? raw.deals_ativos.slice(0, 500)
      : [],
    clientes_fechados: Array.isArray(raw.clientes_fechados)
      ? raw.clientes_fechados.slice(0, 500)
      : [],
  };
};

const checkConsistency = (d: N8nData): string[] => {
  const warnings: string[] = [];

  if (d.deals_fechados !== d.clientes_fechados.length) {
    warnings.push('Divergência entre deals_fechados e lista de clientes fechados');
  }

  const sumAtivos = d.deals_ativos.reduce((s, deal) => s + (deal.valor || 0), 0);
  if (sumAtivos > 0 && Math.abs(d.valor_pipeline - sumAtivos) / Math.max(d.valor_pipeline, 1) > 0.01) {
    warnings.push('Divergência entre valor_pipeline e soma dos deals ativos');
  }

  const sumFechados = d.clientes_fechados.reduce((s, c) => s + (c.valor || 0), 0);
  if (sumFechados > 0 && Math.abs(d.valor_fechado - sumFechados) / Math.max(d.valor_fechado, 1) > 0.01) {
    warnings.push('Divergência entre valor_fechado e soma dos clientes fechados');
  }

  if (d.parceiros.total !== d.parceiros.lista.length) {
    warnings.push('Divergência entre total de parceiros e lista');
  }

  if (d.ligacoes > 0) {
    const taxaCalculada = Math.round((d.ligacoes_atendidas / d.ligacoes) * 100);
    if (Math.abs(d.taxa_conectividade - taxaCalculada) > 2) {
      warnings.push('Divergência na taxa de conectividade');
    }
  }

  return warnings;
};

// --- Components ---

const StatCard = ({ icon: Icon, title, value, subtext, highlight, loading, trend }: any) => (
  <MagicCard className="h-full flex flex-col justify-between border-slate-200/60 bg-white/60 hover:border-red-500/30 hover:shadow-red-500/5 transition-all duration-500">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest font-display">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-slate-200 rounded mt-1 animate-pulse"></div>
        ) : (
          <motion.h3
            initial={{ scale: 0.95, opacity: 0, filter: "blur(4px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`text-2xl lg:text-3xl font-semibold mt-2 tracking-tight font-display ${highlight ? 'text-red-600' : 'text-slate-900'}`}
          >
            {value}
          </motion.h3>
        )}
      </div>
      <div className={`p-2 rounded-lg ${highlight ? 'bg-red-500/10 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
        <Icon size={18} strokeWidth={2} />
      </div>
    </div>
    {subtext && (
      <div className="border-t border-slate-100 pt-3 mt-auto">
        <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
          {trend === 'up' && <TrendingUp size={14} className="text-emerald-500" />}
          {trend === 'down' && <TrendingUp size={14} className="text-red-500 rotate-180" />}
          {subtext}
        </p>
      </div>
    )}
  </MagicCard>
);

const DealRow = ({ deal, type }: { deal: Deal, type: 'active' | 'closed' }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    className="group flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-all text-sm"
  >
    <div className="flex items-center gap-3">
      <div className={`w-1.5 h-1.5 rounded-full ${type === 'active' ? 'bg-amber-400' : 'bg-emerald-500'} shadow-sm`} />
      <div>
        <p className="text-slate-700 font-semibold font-display text-sm leading-tight">{deal.nome}</p>
        <p className="text-xs text-slate-400 uppercase tracking-wider mt-0.5">{deal.origem}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-slate-900 font-mono font-medium text-sm">{deal.valor ? formatCurrency(deal.valor) : '-'}</p>
      <p className="text-xs text-slate-400">{deal.data}</p>
    </div>
  </motion.div>
);

// --- Throttle constant ---
const REFRESH_INTERVAL_MS = 5_000;

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('resumo');
  const [dateRange, setDateRange] = useState('today');
  const [data, setData] = useState<N8nData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const lastFetchRef = useRef<number>(0);

  const getDateBounds = (range: string): { data_inicio: string; data_fim: string } => {
    const today = new Date().toISOString().split('T')[0];

    if (range.startsWith('custom:')) {
      const parts = range.split(':');
      const inicio = parts[1] ?? '';
      const fim = parts[2] ?? '';
      // Validate custom dates
      if (DATE_RE.test(inicio) && DATE_RE.test(fim) && !isNaN(new Date(inicio).getTime()) && !isNaN(new Date(fim).getTime()) && inicio <= fim) {
        return { data_inicio: inicio, data_fim: fim };
      }
      // Fallback to today if invalid
      return { data_inicio: today, data_fim: today };
    }
    if (range === 'today') {
      return { data_inicio: today, data_fim: today };
    }
    if (range === 'month') {
      return { data_inicio: today.slice(0, 8) + '01', data_fim: today };
    }
    // 7d, 15d, 30d
    const dias = parseInt(range.replace('d', ''), 10);
    if (isNaN(dias) || dias <= 0 || dias > 366) {
      return { data_inicio: today, data_fim: today };
    }
    const start = new Date();
    start.setDate(start.getDate() - dias);
    return { data_inicio: start.toISOString().split('T')[0], data_fim: today };
  };

  const applyValidatedData = (raw: any) => {
    const validated = validateN8nData(raw);
    setData(validated);
    const w = checkConsistency(validated);
    setWarnings(w);
  };

  const fetchData = async (range: string) => {
    // Throttle: minimum interval between fetches
    const now = Date.now();
    if (now - lastFetchRef.current < REFRESH_INTERVAL_MS) {
      return;
    }
    lastFetchRef.current = now;

    try {
      setLoading(true);
      setError(null);
      setWarnings([]);

      const payload = getDateBounds(range);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      const response = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        // Use mock data as fallback
        applyValidatedData(generateMockData(range));
        return;
      }

      const result = await response.json();

      // Extract the data object from various possible n8n response formats
      let parsed: any = null;

      if (Array.isArray(result)) {
        const first = result[0];
        if (first?.json && typeof first.json === 'object') {
          parsed = first.json;
        } else if (first && typeof first === 'object') {
          parsed = first;
        }
      } else if (result && typeof result === 'object') {
        if (result.json && typeof result.json === 'object') {
          parsed = result.json;
        } else {
          parsed = result;
        }
      }

      if (parsed && ('ligacoes' in parsed || 'deals_ativos' in parsed || 'valor_pipeline' in parsed)) {
        applyValidatedData(parsed);
      } else {
        applyValidatedData(generateMockData(range));
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError("Tempo limite excedido. Tente novamente.");
      } else {
        setError("Não foi possível sincronizar os dados. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(dateRange);
  }, [dateRange]);

  // Transform data for charts
  const funnelData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Abordagens', value: data.ligacoes + data.emails, fill: '#ef4444', label: 'Abordagens' },
      { name: 'Apresentações', value: data.apresentacoes, fill: '#f97316', label: 'Apresentações' },
      { name: 'Propostas', value: data.propostas, fill: '#f59e0b', label: 'Propostas' },
      { name: 'Reuniões', value: data.reunioes, fill: '#84cc16', label: 'Reuniões' },
      { name: 'Fechados', value: data.deals_fechados, fill: '#10b981', label: 'Fechados' },
    ];
  }, [data]);

  // Client-side date filtering for deals/clients
  const { data_inicio, data_fim } = useMemo(() => getDateBounds(dateRange), [dateRange]);

  const filteredDealsAtivos = useMemo(() => {
    if (!data) return [];
    return data.deals_ativos.filter(d => {
      const date = normalizeDate(d.id_data) || normalizeDate(d.data);
      if (!date) return true;
      return date >= data_inicio && date <= data_fim;
    });
  }, [data, data_inicio, data_fim]);

  const filteredClientesFechados = useMemo(() => {
    if (!data) return [];
    return data.clientes_fechados.filter(d => {
      const date = normalizeDate(d.id_data) || normalizeDate(d.data);
      if (!date) return true;
      return date >= data_inicio && date <= data_fim;
    });
  }, [data, data_inicio, data_fim]);

  const renderContent = () => {
    if (error) {
      return (
        <MagicCard className="border-red-200 bg-red-50 text-center py-12">
          <AlertTriangle className="mx-auto mb-4 text-red-500" size={32} strokeWidth={1.5} />
          <h3 className="font-medium text-red-900 text-lg font-display">Erro de Sincronização</h3>
          <p className="text-red-700/60 mb-6 text-sm">{error}</p>
          <button onClick={() => fetchData(dateRange)} className="px-6 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg transition-colors text-sm font-medium shadow-sm">
            Tentar Novamente
          </button>
        </MagicCard>
      );
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          {/* Main Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              loading={loading}
              icon={DollarSign}
              title="Receita no Pipeline"
              value={data ? formatCurrency(data.valor_pipeline) : "-"}
              subtext={`${filteredDealsAtivos.length} negócios ativos`}
              highlight={true}
            />
            <StatCard
              loading={loading}
              icon={Trophy}
              title="Total em Receita"
              value={data ? formatCurrency(data.valor_fechado) : "-"}
              subtext={`${data?.deals_fechados || 0} negócios ganhos`}
            />
            <StatCard
              loading={loading}
              icon={Zap}
              title="Taxa de Ligações Atendidas"
              value={data ? `${data.taxa_conectividade}%` : "-"}
              subtext="Sobre ligações totais"
            />
            <StatCard
              loading={loading}
              icon={Users}
              title="Último Cliente Fechado"
              value={data?.ultimo_cliente.valor ? formatCurrency(data.ultimo_cliente.valor) : "-"}
              subtext={data?.ultimo_cliente.nome || "Nenhum recente"}
              highlight={true}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Funnel Chart Section */}
            <div className="lg:col-span-2 h-[500px]">
              <FunnelChart data={funnelData} />
            </div>

            {/* Side Column: Partners & Executive Summary */}
            <div className="space-y-6">
              {/* Partners Card */}
              <MagicCard className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest font-display">Parceiros Ativos</h3>
                  <span className="bg-blue-50 text-blue-600 text-xs font-mono px-2 py-1 rounded border border-blue-100">{data?.parceiros.total || 0} TOTAL</span>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-6 bg-slate-200 rounded w-full animate-pulse" />)}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data?.parceiros.lista.map((partner, i) => (
                      <span key={i} className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors cursor-default">
                        {partner}
                      </span>
                    ))}
                  </div>
                )}
              </MagicCard>

              {/* Last Client Highlight */}
              <MagicCard className="p-6 bg-gradient-to-br from-red-50 to-transparent">
                <h3 className="text-xs font-bold text-red-600 mb-2 uppercase tracking-widest font-display flex items-center gap-2">
                  <Target size={14} /> Último Fechamento
                </h3>
                {loading ? (
                  <div className="h-12 bg-slate-100 rounded w-full animate-pulse" />
                ) : (
                  <div>
                    <p className="text-2xl font-display font-medium text-slate-900 leading-snug">{data?.ultimo_cliente.nome}</p>
                    <div className="mt-4 flex justify-between items-end border-t border-red-100 pt-4">
                      <div>
                        <p className="text-xs text-slate-500 uppercase mb-0.5">Origem</p>
                        <p className="text-sm text-slate-700 font-medium">{data?.ultimo_cliente.origem}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase mb-0.5">Valor</p>
                        <p className="text-red-600 text-lg font-mono font-bold">{formatCurrency(data?.ultimo_cliente.valor || 0)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </MagicCard>
            </div>
          </div>

          {/* Data Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Deals List */}
            <MagicCard className="p-0 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest font-display flex items-center gap-2">
                  <Activity size={16} className="text-amber-500" /> Deals Ativos
                </h3>
                <span className="text-xs text-slate-400">{filteredDealsAtivos.length} registros</span>
              </div>
              <div className="p-3 overflow-y-auto max-h-[420px] space-y-1">
                {loading ? (
                  [1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-800/20 rounded-lg animate-pulse mb-2" />)
                ) : (
                  filteredDealsAtivos.map((deal) => (
                    <DealRow key={deal.id || Math.random()} deal={deal} type="active" />
                  ))
                )}
              </div>
            </MagicCard>

            {/* Closed Clients List */}
            <MagicCard className="p-0 overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest font-display flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" /> Clientes Fechados
                </h3>
                <span className="text-xs text-slate-400">{filteredClientesFechados.length} registros</span>
              </div>
              <div className="p-3 overflow-y-auto max-h-[420px] space-y-1">
                {loading ? (
                  [1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-800/20 rounded-lg animate-pulse mb-2" />)
                ) : (
                  filteredClientesFechados.map((client) => (
                    <DealRow key={client.id || Math.random()} deal={client} type="closed" />
                  ))
                )}
              </div>
            </MagicCard>
          </div>

        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans bg-transparent text-slate-900">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-display mb-1 flex items-baseline gap-1">
              Defenz<span className="text-red-600">.Dashboard</span>
            </h1>
            <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.4)] animate-pulse"></span>
              <p>Operação Comercial</p>
              {data && (
                <>
                  <span className="text-slate-300">|</span>
                  <p className="text-slate-400 text-sm">Atualizado: {data.data} às {data.hora}</p>
                </>
              )}
            </div>
          </div>
          <div className="mt-6 md:mt-0 flex flex-col md:items-end gap-3">
            <div className="flex items-center gap-2">
              {warnings.length > 0 && (
                <div className="relative group">
                  <button
                    className="p-2 bg-amber-50 border border-amber-200 rounded-full text-amber-600 hover:bg-amber-100 transition-all shadow-sm"
                    title={`${warnings.length} inconsistência(s) detectada(s)`}
                  >
                    <AlertTriangle size={16} />
                  </button>
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {warnings.length}
                  </span>
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-amber-200 rounded-lg shadow-lg p-3 hidden group-hover:block z-50">
                    <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wider">Inconsistências</p>
                    <ul className="space-y-1">
                      {warnings.map((w, i) => (
                        <li key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                          <span className="mt-0.5 shrink-0">&bull;</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <button
                onClick={() => fetchData(dateRange)}
                disabled={loading}
                className="p-2 bg-white/80 border border-slate-200/60 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-red-600 shadow-sm disabled:opacity-50"
                title="Atualizar Dados"
              >
                <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <DateFilter currentRange={dateRange} onRangeChange={setDateRange} />
              <a
                href="/api/auth/logout"
                className="p-2 bg-white/80 border border-slate-200/60 rounded-full hover:bg-red-50 hover:border-red-200 transition-all text-slate-400 hover:text-red-600 shadow-sm"
                title="Sair"
              >
                <LogOut size={16} />
              </a>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="min-h-[600px]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
