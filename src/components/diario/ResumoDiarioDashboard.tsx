"use client";

import { useMemo, useState, useEffect } from 'react';
import {
  Phone, Presentation, FileText, FlaskConical,
  Mail, MessageCircle, Linkedin, Users, RefreshCcw, Loader2, AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DiarioCard } from './DiarioCard';
import { DayNavigator, type DiarioView } from './DayNavigator';
import { BaseInstaladaDrawer } from './BaseInstaladaDrawer';
import { useResumoDiario } from '@/hooks/useResumoDiario';
import { todayBRT } from '@/lib/resumo-diario';
import type { ResumoDiario, ResumoSeriePoint, ResumoBaseInstalada } from '@/lib/types';

const nf = (n: number) => n.toLocaleString('pt-BR');
const dash = (v: number | null | undefined): string => (v === null || v === undefined ? '—' : nf(v));

function summarizeVendores(map: Record<string, number> | null | undefined): string | null {
  if (!map) return null;
  const entries = Object.entries(map).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return entries.map(([k, v]) => `${k}: ${v}`).join(' · ');
}

// ─── Por Canal / Responsável table ───────────────────────────────────────────
function PorCanalTable({ r }: { r: ResumoDiario }) {
  const callsVend = (name: string) => r.ligacoes.por_vendedor[name]?.realizadas ?? 0;
  const vcell = (map: Record<string, number> | null, name: string) =>
    map === null ? '—' : nf(map[name] ?? 0);

  // Robô = ramal 102 do Callbox (disca sozinho). Só faz ligação → só aparece na linha
  // Telefonia; nas demais fica "—". O n8n (snapshot) mapeia ramal 102 → bucket "Robô"
  // em ligacoes.por_vendedor (feature-metas-robo-semana §2).
  const rows = [
    { ind: 'Telefonia', total: dash(r.ligacoes.total), conv: `${nf(r.ligacoes.atendidas)} (${r.ligacoes.taxa}%)`,
      g: nf(callsVend('Gustavo')), l: nf(callsVend('Leonardo')), ms: nf(callsVend('Marcos')), rb: nf(callsVend('Robô')), obs: 'ligações realizadas' },
    { ind: 'E-mail', total: dash(r.emails.total), conv: '—',
      g: vcell(r.emails.por_sender, 'Gustavo'), l: vcell(r.emails.por_sender, 'Leonardo'), ms: vcell(r.emails.por_sender, 'Marcos'), rb: '—',
      obs: r.coverage.emails_source === 'chat' ? 'fonte: chat' : 'fonte: planilha' },
    { ind: 'WhatsApp', total: dash(r.whatsapp.msgs), conv: dash(r.whatsapp.convs), g: '—', l: '—', ms: '—', rb: '—', obs: 'mensagens / conversas' },
    { ind: 'LinkedIn', total: r.linkedin.page === null && r.linkedin.perfis === null ? '—' : nf((r.linkedin.page ?? 0) + (r.linkedin.perfis ?? 0)),
      conv: '—', g: '—', l: '—', ms: '—', rb: '—', obs: `${r.linkedin.page ?? 0} Page · ${r.linkedin.perfis ?? 0} perfis` },
    { ind: 'Apresentações', total: dash(r.apresentacoes.total), conv: '—',
      g: vcell(r.apresentacoes.por_vendedor, 'Gustavo'), l: vcell(r.apresentacoes.por_vendedor, 'Leonardo'), ms: vcell(r.apresentacoes.por_vendedor, 'Marcos'), rb: '—',
      obs: r.apresentacoes.aproximado ? 'aproximado (~)' : (r.apresentacoes.total ? 'enviadas' : 'sem envios') },
    { ind: 'Propostas', total: dash(r.propostas.total), conv: '—',
      g: vcell(r.propostas.por_vendedor, 'Gustavo'), l: vcell(r.propostas.por_vendedor, 'Leonardo'), ms: vcell(r.propostas.por_vendedor, 'Marcos'), rb: '—',
      obs: r.propostas.aproximado ? 'aproximado (~)' : (r.propostas.total ? 'enviadas' : 'sem envios') },
    { ind: 'Reunião técnica', total: dash(r.reuniao_tecnica.total), conv: '—',
      g: vcell(r.reuniao_tecnica.por_vendedor, 'Gustavo'), l: vcell(r.reuniao_tecnica.por_vendedor, 'Leonardo'), ms: vcell(r.reuniao_tecnica.por_vendedor, 'Marcos'), rb: '—',
      obs: r.reuniao_tecnica.total ? 'registradas' : 'sem registros' },
  ];

  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-red-600">Por Canal / Responsável</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Indicadores de tração por canal e responsável</caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th scope="col" className="px-5 py-2 font-semibold">Indicador</th>
              <th scope="col" className="px-3 py-2 font-semibold text-right">Total</th>
              <th scope="col" className="px-3 py-2 font-semibold text-right">Atend./Conv.</th>
              <th scope="col" className="px-3 py-2 font-semibold text-right">Gustavo</th>
              <th scope="col" className="px-3 py-2 font-semibold text-right">Leonardo</th>
              <th scope="col" className="px-3 py-2 font-semibold text-right">Marcos</th>
              <th scope="col" className="px-3 py-2 font-semibold text-right">Robô</th>
              <th scope="col" className="px-5 py-2 font-semibold">Obs.</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {rows.map((row) => (
              <tr key={row.ind} className="border-b border-slate-50 hover:bg-slate-50/60">
                <th scope="row" className="px-5 py-2.5 font-medium text-slate-900 text-left">{row.ind}</th>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{row.total}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{row.conv}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.g}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.l}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.ms}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{row.rb}</td>
                <td className="px-5 py-2.5 text-slate-400 text-xs">{row.obs}</td>
              </tr>
            ))}
            <tr className="bg-red-50/60">
              <th scope="row" className="px-5 py-3 font-bold text-red-700 text-left uppercase tracking-wide">Total Tração</th>
              <td className="px-3 py-3 text-right tabular-nums font-bold text-red-700">
                {dash(r.total_tracao)}{r.coverage.partial_tracao ? '*' : ''}
              </td>
              <td colSpan={4} />
              <td className="px-5 py-3 text-slate-400 text-xs">
                {r.coverage.partial_tracao ? '* soma parcial (canais sem dado)' : 'volume bruto dos canais'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tração Diária chart (barras agrupadas por canal) ────────────────────────
const CANAIS_CHART = [
  { key: 'ligacoes', label: 'Ligações', color: '#dc2626' },
  { key: 'emails', label: 'E-mail', color: '#f59e0b' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#22c55e' },
  { key: 'linkedin', label: 'LinkedIn', color: '#0ea5e9' },
  { key: 'apresentacoes', label: 'Apresentações', color: '#8b5cf6' },
  { key: 'propostas', label: 'Propostas', color: '#ec4899' },
] as const;

function TracaoChart({ serie, onPick }: { serie: ResumoSeriePoint[]; onPick: (d: string) => void }) {
  const data = serie.map(p => {
    const ligacoes = p.ligacoes ?? 0;
    const emails = p.emails ?? 0;
    const whatsapp = p.whatsapp ?? 0;
    const linkedin = p.linkedin ?? 0;
    const apresentacoes = p.apresentacoes ?? 0;
    const propostas = p.propostas ?? 0;
    return {
      data: p.data, ligacoes, emails, whatsapp, linkedin, apresentacoes, propostas,
      total: ligacoes + emails + whatsapp + linkedin + apresentacoes + propostas,
    };
  });
  const tickFmt = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-3">Tração Diária por Canal (30 dias)</h2>
      {data.length === 0 ? (
        <p className="text-slate-400 text-sm py-10 text-center">Sem série histórica para o período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
            barCategoryGap="18%"
            barGap={1}
            onClick={(e: any) => { if (e?.activeLabel) onPick(String(e.activeLabel)); }}
          >
            <XAxis dataKey="data" tickFormatter={tickFmt} tick={{ fill: '#94a3b8', fontSize: 11 }} interval="preserveStartEnd" axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <ReTooltip
              cursor={{ fill: 'rgba(220,38,38,0.05)' }}
              contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              labelFormatter={(s) => format(new Date(`${s}T12:00:00`), "dd 'de' MMM", { locale: ptBR })}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
            {CANAIS_CHART.map(c => (
              <Bar key={c.key} dataKey={c.key} name={c.label} fill={c.color} radius={[2, 2, 0, 0]} maxBarSize={12} cursor="pointer" />
            ))}
            <Line type="monotone" dataKey="total" name="Total" stroke="#64748b" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2, fill: '#64748b' }} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      <p className="text-[11px] text-slate-400 mt-2">Uma barra por canal, por dia · linha cinza tracejada = Total. Clique numa coluna pra abrir o dia. (Reunião técnica omitida — sem fonte de dados.)</p>
    </div>
  );
}

// ─── Destaques ────────────────────────────────────────────────────────────────
function Destaques({ r }: { r: ResumoDiario }) {
  const items = [
    { label: 'Vendas', value: r.destaques.comercial, color: 'text-red-600' },
    { label: 'Marketing', value: r.destaques.marketing, color: 'text-sky-600' },
    { label: 'Execução', value: r.destaques.execucao, color: 'text-violet-600' },
    { label: 'Ponto de atenção', value: r.destaques.atencao, color: 'text-amber-600' },
  ];
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
      <h2 className="text-sm font-bold uppercase tracking-widest text-red-600 mb-3">Destaques Operacionais</h2>
      <div className="space-y-2.5">
        {items.map(it => (
          <div key={it.label} className="grid grid-cols-[120px_1fr] gap-3 items-start border-b border-slate-50 pb-2.5 last:border-0">
            <span className={`text-xs font-bold uppercase tracking-wide ${it.color}`}>{it.label}</span>
            <span className={`text-sm ${it.value ? 'text-slate-700' : 'text-slate-400 italic'}`}>
              {it.value ?? 'sem registro do chat'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Coverage badges ──────────────────────────────────────────────────────────
function CoverageBadges({ r }: { r: ResumoDiario }) {
  const badges: { text: string; cls: string; title: string }[] = [];
  if (r.mode === 'backfill') badges.push({ text: 'histórico', cls: 'bg-slate-100 text-slate-500', title: 'Linha reconstruída por backfill — campos não-históricos ficam em branco' });
  if (r.coverage.emails_source === 'chat') badges.push({ text: 'e-mail via chat', cls: 'bg-amber-50 text-amber-600', title: 'Ingestão Apollo parada (P9) — total de e-mails vem do chat' });
  if (r.coverage.manual_source === 'none') badges.push({ text: 'sem chat', cls: 'bg-slate-100 text-slate-500', title: 'Sem dados do chat Operação para este dia' });
  if (!r.coverage.ligacoes_fresh) badges.push({ text: 'ligações defasadas', cls: 'bg-red-50 text-red-600', title: 'Abas raw ainda não atualizaram para este dia' });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {badges.map(b => (
        <span key={b.text} title={b.title} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-help ${b.cls}`}>{b.text}</span>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export const ResumoDiarioDashboard = () => {
  const today = useMemo(() => todayBRT(), []);
  const [view, setView] = useState<DiarioView>({ kind: 'dia', data: today });
  const [baseDrawerOpen, setBaseDrawerOpen] = useState(false);
  const query = view.kind === 'dia' ? `data=${view.data}` : `from=${view.from}&to=${view.to}`;
  const { setQuery, response, loading, error, refetch } = useResumoDiario(`data=${today}`);

  useEffect(() => { setQuery(query); }, [query, setQuery]);

  const onDay = (d: string) => setView({ kind: 'dia', data: d });
  const onRange = (from: string, to: string) => setView({ kind: 'periodo', from, to });

  const isPeriodo = !!response?.periodo;
  const headerLabel = useMemo(() => {
    try {
      if (view.kind === 'periodo') {
        const f = format(new Date(`${view.from}T12:00:00`), 'dd/MM', { locale: ptBR });
        const t = format(new Date(`${view.to}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR });
        const dias = response?.periodo?.dias ?? 0;
        return `PERÍODO ${f} – ${t} · ${dias} ${dias === 1 ? 'DIA COM DADO' : 'DIAS COM DADO'}`;
      }
      return format(new Date(`${view.data}T12:00:00`), "dd 'DE' MMMM yyyy", { locale: ptBR }).toUpperCase();
    } catch {
      return '';
    }
  }, [view, response]);

  const r = response?.resumo ?? null;
  const floor = response?.floor ?? today;
  // Base instalada is current-state: show the latest known base even on historical days.
  const baseShow: ResumoBaseInstalada | null = r?.base_instalada ?? response?.base_atual ?? null;
  const baseIsCurrent = !!baseShow && !r?.base_instalada;

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 font-display">Resumo Diário</h1>
          <p className="text-red-600 text-sm font-bold tracking-wide mt-1">{headerLabel} · INDICADORES DIÁRIOS DEFENZ</p>
        </div>
        <div className="flex items-center gap-3">
          <DayNavigator view={view} floor={floor} today={today} onDay={onDay} onRange={onRange} loading={loading} />
          <button
            onClick={refetch}
            disabled={loading}
            title="Atualizar"
            className="p-2 rounded-full bg-white/80 border border-slate-200/60 text-slate-500 hover:text-red-600 hover:border-red-200 shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* status line */}
      <div className="flex items-center justify-between text-xs text-slate-400 -mt-2">
        <div className="flex items-center gap-3">
          {isPeriodo
            ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">totais somados do período</span>
            : r && <span>Atualizado: {r.atualizado_em ? format(new Date(r.atualizado_em), 'dd/MM HH:mm') : '—'}</span>}
          {response?._cached && <span className="text-amber-500">cache</span>}
          {r && !isPeriodo && <CoverageBadges r={r} />}
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle size={36} className="text-red-500 mb-3" />
          <p className="text-slate-600">{error}</p>
          <button onClick={refetch} className="mt-4 px-4 py-2 text-sm rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">Tentar novamente</button>
        </div>
      ) : loading && !response ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 size={36} className="animate-spin text-red-500 mb-4" />
          <p className="text-slate-400 text-sm">Carregando resumo...</p>
        </div>
      ) : !r ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-lg text-slate-600">
            {view.kind === 'periodo'
              ? 'Sem dados no período selecionado'
              : `Sem snapshot para ${view.data.slice(8, 10)}/${view.data.slice(5, 7)}`}
          </p>
          <p className="text-sm text-slate-400 mt-2">Rode o snapshot diário ou escolha outra data.</p>
          {response && response.datas_disponiveis.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-xl">
              {response.datas_disponiveis.slice(-10).reverse().map(d => (
                <button key={d} onClick={() => onDay(d)} className="px-2.5 py-1 text-xs rounded-md bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200">
                  {d.slice(8, 10)}/{d.slice(5, 7)}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DiarioCard icon={Phone} highlight title="Ligações"
              value={dash(r.ligacoes.total)}
              subtext={`${nf(r.ligacoes.atendidas)} atendidas (${r.ligacoes.taxa}%)`} />
            <DiarioCard icon={Presentation} title="Apresentações"
              value={r.apresentacoes.total === null ? null : nf(r.apresentacoes.total)}
              badge={r.apresentacoes.aproximado ? '~' : undefined} badgeTitle="Valor aproximado (backfill)"
              subtext={summarizeVendores(r.apresentacoes.por_vendedor) ?? 'no dia'} />
            <DiarioCard icon={FileText} title="Propostas"
              value={r.propostas.total === null ? null : nf(r.propostas.total)}
              badge={r.propostas.aproximado ? '~' : undefined} badgeTitle="Valor aproximado (backfill)"
              subtext={summarizeVendores(r.propostas.por_vendedor) ?? 'no dia'} />
            <DiarioCard icon={FlaskConical} title="POCs Ativas"
              value={r.pocs === null ? null : nf(r.pocs.ativas)}
              subtext={r.pocs && r.pocs.lista.length ? r.pocs.lista.slice(0, 2).join(', ') : 'em andamento'} />
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DiarioCard icon={Mail} title="E-mails"
              value={r.emails.total === null ? null : nf(r.emails.total)}
              subtext={summarizeVendores(r.emails.por_sender) ?? (r.coverage.emails_source === 'chat' ? 'fonte: chat' : 'enviados')} />
            <DiarioCard icon={MessageCircle} title="WhatsApp"
              value={r.whatsapp.msgs === null ? null : `${nf(r.whatsapp.msgs)}/${nf(r.whatsapp.convs ?? 0)}`}
              subtext="msgs / conversas" />
            <DiarioCard icon={Linkedin} title="LinkedIn"
              value={r.linkedin.page === null && r.linkedin.perfis === null ? null : nf((r.linkedin.page ?? 0) + (r.linkedin.perfis ?? 0))}
              subtext={`${r.linkedin.page ?? 0} Page · ${r.linkedin.perfis ?? 0} perfis`} />
            <DiarioCard icon={Users} highlight title="Clientes Ativos"
              value={baseShow ? nf(baseShow.clientes_ativos) : null}
              subtext={baseShow ? `${nf(baseShow.total_licencas)} licenças${baseIsCurrent ? ' (atual)' : ''}` : undefined} />
          </div>

          {/* Tabela Por Canal/Responsável (largura total) */}
          <PorCanalTable r={r} />

          {/* Tração diária por canal — barras agrupadas (largura total) */}
          <TracaoChart serie={response?.serie ?? []} onPick={onDay} />

          {/* Destaques — só no modo diário (são registros por dia) */}
          {!isPeriodo ? (
            <Destaques r={r} />
          ) : (
            <div className="rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5 text-sm text-slate-500">
              Destaques operacionais e ata aparecem no <strong className="text-slate-700">modo diário</strong> (são registros por dia). Aqui você vê os <strong className="text-slate-700">totais somados</strong> do período.
            </div>
          )}

          {/* Base instalada top contas — clicável, abre o drawer com a lista completa */}
          {baseShow && baseShow.top_contas.length > 0 && (
            <div className="w-full rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/60 shadow-lg shadow-slate-200/50 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-red-600">
                  Base Instalada · Top Contas {baseIsCurrent && <span className="text-slate-400 normal-case font-medium">(atual)</span>}
                </h2>
                <button
                  type="button"
                  onClick={() => setBaseDrawerOpen(true)}
                  className="text-xs font-semibold text-slate-400 hover:text-red-600 shrink-0 transition-colors cursor-pointer"
                >
                  ver todas as {nf(baseShow.clientes_ativos)} →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5">
                {baseShow.top_contas.slice(0, 8).map((c, i) => (
                  <div key={c.name} className="flex justify-between text-sm border-b border-slate-50 py-1.5">
                    <span className="text-slate-600 truncate pr-3">{i + 1}. {c.name}</span>
                    <span className="text-slate-900 font-semibold tabular-nums">{nf(c.licencas)}</span>
                  </div>
                ))}
              </div>
              {baseShow.demais_count > 0 && (
                <p className="text-xs text-slate-400 mt-3">
                  (Demais {baseShow.demais_count} contas somam {nf(baseShow.demais_licencas)} licenças)
                </p>
              )}
            </div>
          )}

          {/* LGPD footer */}
          <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-4">
            Uso interno — LGPD: dashboard executivo diário com informações comerciais e operacionais. Campos sem fonte para a data aparecem como traço (—).
          </p>
        </motion.div>
      )}
    </div>
    <BaseInstaladaDrawer open={baseDrawerOpen} onClose={() => setBaseDrawerOpen(false)} />
    </>
  );
};
