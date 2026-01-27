"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Phone, Users, Briefcase, Mail, TrendingUp,
  Target, LayoutDashboard, FileText,
  Loader2, AlertTriangle, Activity, Zap, CheckCircle2,
  Calendar, DollarSign, Trophy, ArrowRight
} from 'lucide-react';
import axios from 'axios';
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
  const isMonth = range === 'month';
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

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(value);
};

// --- Components ---

const StatCard = ({ icon: Icon, title, value, subtext, highlight, loading, trend }: any) => (
  <MagicCard className="h-full flex flex-col justify-between border-white/5 bg-slate-900/50 hover:border-slate-700/50 transition-colors duration-500">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-slate-500 text-[11px] font-semibold uppercase tracking-widest font-display">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-slate-800/50 rounded mt-1 animate-pulse"></div>
        ) : (
          <motion.h3
            initial={{ scale: 0.95, opacity: 0, filter: "blur(4px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`text-2xl lg:text-3xl font-medium mt-1 tracking-tight font-display ${highlight ? 'text-white' : 'text-slate-200'}`}
          >
            {value}
          </motion.h3>
        )}
      </div>
      <div className={`p-2 rounded-lg ${highlight ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800/30 text-slate-500'}`}>
        <Icon size={18} strokeWidth={1.5} />
      </div>
    </div>
    {subtext && (
      <div className="border-t border-white/5 pt-3 mt-auto">
        <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          {trend === 'up' && <TrendingUp size={12} className="text-emerald-500" />}
          {trend === 'down' && <TrendingUp size={12} className="text-red-500 rotate-180" />}
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
    className="group flex items-center justify-between p-3 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 transition-all text-sm"
  >
    <div className="flex items-center gap-3">
      <div className={`w-1.5 h-1.5 rounded-full ${type === 'active' ? 'bg-amber-400/80' : 'bg-emerald-400/80'} shadow-[0_0_8px_rgba(251,191,36,0.2)]`} />
      <div>
        <p className="text-slate-200 font-medium font-display leading-tight">{deal.nome}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{deal.origem}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-slate-200 font-mono font-medium">{deal.valor ? formatCurrency(deal.valor) : '-'}</p>
      <p className="text-[10px] text-slate-500">{deal.data}</p>
    </div>
  </motion.div>
);

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('resumo');
  const [dateRange, setDateRange] = useState('7d');
  const [data, setData] = useState<N8nData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (range: string) => {
    try {
      setLoading(true);
      setError(null);
      const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

      // Construct URL with range parameter
      const url = N8N_WEBHOOK_URL ? `${N8N_WEBHOOK_URL}?range=${range}` : '';

      if (!N8N_WEBHOOK_URL) {
        // Simulate network delay and return mock data based on range
        await new Promise(r => setTimeout(r, 800));
        setData(generateMockData(range));
      } else {
        const response = await axios.get<N8nData[]>(url); // Expecting an array
        // Assuming the first item in the array is what we need based on the provided JSON
        if (Array.isArray(response.data) && response.data.length > 0) {
          setData(response.data[0]);
        } else {
          // Fallback if structure is different
          console.warn("Unexpected data structure received from N8n:", response.data);
          // ENGINEERING LEAD: "Zero Hallucination" - Do not guess structure. Fail safely or use Mock.
          // Check if it looks like a single object instead of array
          if (response.data && typeof response.data === 'object' && 'ligacoes' in (response.data as any)) {
            setData(response.data as unknown as N8nData);
          } else {
            // Safe Fallback to Mock Data to prevent UI Crash (White Screen)
            console.error("Critical: Data structure mismatch. Reverting to SAFE MODE (Mock Data).");
            setData(generateMockData(range));
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError("Não foi possível sincronizar os dados. Tente novamente.");
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
      { name: 'Ligações', value: data.ligacoes, fill: '#3b82f6', label: 'Ligações' },
      { name: 'Atendidas', value: data.ligacoes_atendidas, fill: '#60a5fa', label: 'Atendidas' },
      { name: 'E-mails', value: data.emails, fill: '#a78bfa', label: 'E-mails' },
      { name: 'Reuniões', value: data.reunioes, fill: '#f472b6', label: 'Reuniões' },
      { name: 'Propostas', value: data.propostas, fill: '#fbbf24', label: 'Propostas' },
      { name: 'Fechados', value: data.deals_fechados, fill: '#10b981', label: 'Fechados' },
    ];
  }, [data]);

  const renderContent = () => {
    if (error) {
      return (
        <MagicCard className="border-red-500/20 bg-red-900/5 text-center py-12">
          <AlertTriangle className="mx-auto mb-4 text-red-400" size={32} strokeWidth={1.5} />
          <h3 className="font-medium text-red-200 text-lg font-display">Erro de Sincronização</h3>
          <p className="text-red-200/50 mb-6 text-sm">{error}</p>
          <button onClick={() => fetchData(dateRange)} className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 rounded-lg transition-colors text-sm font-medium">
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
              title="Pipeline Ativo"
              value={data ? formatCurrency(data.valor_pipeline) : "-"}
              subtext={`${data?.deals_ativos.length || 0} negócios em andamento`}
              highlight={true}
            />
            <StatCard
              loading={loading}
              icon={Trophy}
              title="Receita Fechada"
              value={data ? formatCurrency(data.valor_fechado) : "-"}
              subtext={`${data?.deals_fechados || 0} negócios ganhos`}
            />
            <StatCard
              loading={loading}
              icon={Zap}
              title="Taxa de Conexão"
              value={data ? `${data.taxa_conectividade}%` : "-"}
              subtext="Sobre ligações totais"
            />
            <StatCard
              loading={loading}
              icon={Users}
              title="Novo Cliente"
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
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-display">Parceiros Ativos</h3>
                  <span className="bg-blue-500/10 text-blue-400 text-[10px] font-mono px-2 py-1 rounded border border-blue-500/20">{data?.parceiros.total || 0} TOTAL</span>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-6 bg-slate-800/50 rounded w-full animate-pulse" />)}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {data?.parceiros.lista.map((partner, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-800/50 border border-white/5 rounded text-xs text-slate-300 hover:bg-slate-700/50 transition-colors cursor-default">
                        {partner}
                      </span>
                    ))}
                  </div>
                )}
              </MagicCard>

              {/* Last Client Highlight */}
              <MagicCard className="p-6 bg-gradient-to-br from-indigo-900/10 to-transparent">
                <h3 className="text-xs font-bold text-indigo-400 mb-2 uppercase tracking-widest font-display flex items-center gap-2">
                  <Target size={14} /> Último Fechamento
                </h3>
                {loading ? (
                  <div className="h-12 bg-slate-800/50 rounded w-full animate-pulse" />
                ) : (
                  <div>
                    <p className="text-xl font-display font-medium text-white leading-snug">{data?.ultimo_cliente.nome}</p>
                    <div className="mt-3 flex justify-between items-end border-t border-indigo-500/10 pt-3">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase mb-0.5">Origem</p>
                        <p className="text-xs text-slate-300">{data?.ultimo_cliente.origem}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-500 uppercase mb-0.5">Valor</p>
                        <p className="text-emerald-400 font-mono font-medium">{formatCurrency(data?.ultimo_cliente.valor || 0)}</p>
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
            <MagicCard className="p-0 overflow-hidden flex flex-col max-h-[500px]">
              <div className="p-5 border-b border-white/5 bg-slate-900/30 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-display flex items-center gap-2">
                  <Activity size={14} className="text-amber-500" /> Deals Ativos
                </h3>
                <span className="text-[10px] text-slate-500">{data?.deals_ativos.length || 0} registros</span>
              </div>
              <div className="p-3 overflow-y-auto custom-scrollbar space-y-1">
                {loading ? (
                  [1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-800/20 rounded-lg animate-pulse mb-2" />)
                ) : (
                  data?.deals_ativos.map((deal) => (
                    <DealRow key={deal.id || Math.random()} deal={deal} type="active" />
                  ))
                )}
              </div>
            </MagicCard>

            {/* Closed Clients List */}
            <MagicCard className="p-0 overflow-hidden flex flex-col max-h-[500px]">
              <div className="p-5 border-b border-white/5 bg-slate-900/30 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-display flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Clientes Fechados
                </h3>
                <span className="text-[10px] text-slate-500">{data?.clientes_fechados.length || 0} registros</span>
              </div>
              <div className="p-3 overflow-y-auto custom-scrollbar space-y-1">
                {loading ? (
                  [1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-slate-800/20 rounded-lg animate-pulse mb-2" />)
                ) : (
                  data?.clientes_fechados.map((client) => (
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
    <div className="min-h-screen p-4 md:p-8 font-sans bg-transparent text-slate-200">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold text-white tracking-tight font-display mb-1">
              Defenz<span className="text-slate-600">.Dashboard</span>
            </h1>
            <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
              <p>Operação Comercial</p>
              {data && (
                <>
                  <span className="text-slate-700">|</span>
                  <p className="text-slate-500 text-xs">Atualizado: {data.data} às {data.hora}</p>
                </>
              )}
            </div>
          </div>
          <div className="mt-6 md:mt-0 flex flex-col md:items-end gap-3">
            <DateFilter currentRange={dateRange} onRangeChange={setDateRange} />
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
