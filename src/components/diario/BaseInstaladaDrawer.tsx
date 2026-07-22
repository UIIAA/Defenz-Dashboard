"use client";

import { useEffect, useMemo, useState } from 'react';
import { X, Search, Loader2, AlertTriangle } from 'lucide-react';
import type { BaseInstalada } from '@/lib/types';

interface BaseInstaladaDrawerProps {
  open: boolean;
  onClose: () => void;
}

// feature-base-instalada-drilldown (§Padrões): DADO é neutro (grafite → cinza),
// nunca cor de alarme — a barra de ranking por licenças usa a mesma paleta
// neutra já usada em ExecutiveDashboard.CANAL_DOT (#334155/#64748b/#cbd5e1).
export function BaseInstaladaDrawer({ open, onClose }: BaseInstaladaDrawerProps) {
  const [data, setData] = useState<BaseInstalada | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Fetch once per time the drawer is opened (cached in state for subsequent opens).
  useEffect(() => {
    if (!open || data || loading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch('/api/base-instalada')
      .then(async (res) => {
        if (!res.ok) throw new Error('Falha ao carregar base instalada');
        return res.json();
      })
      .then((json: BaseInstalada) => { if (!cancelled) setData(json); })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Erro ao carregar base instalada'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, data, loading]);

  // Escape fecha o drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Guard: se ninguém tem licenças ainda (pré-migração `licencas` na aba deals,
  // ver Task 0 do plano), max === 0 → barras renderizam 0% em vez de NaN/Infinity.
  const maxLicencas = useMemo(() => {
    if (!data) return 0;
    return data.clientes.reduce((m, c) => Math.max(m, c.licencas), 0);
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.clientes;
    return data.clientes.filter((c) => c.empresa.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Base instalada — lista completa por cliente"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 pb-3 pt-5">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-600">Base Instalada</h2>
            <p className="mt-1 text-xs text-slate-400">
              {data ? (
                <>{data.totalClientes} clientes · {data.totalLicencas.toLocaleString('pt-BR')} licenças</>
              ) : (
                'lista completa por cliente'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Fechar"
            aria-label="Fechar"
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-red-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls */}
        <div className="space-y-2 border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-red-200 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>
          <div className="flex items-center justify-end">
            <span
              title="Segmentação por porte/vertical — planejado para uma fase futura"
              className="cursor-not-allowed rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400"
            >
              Segmento — FASE 2
            </span>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 size={24} className="mb-2 animate-spin" />
              <p className="text-xs">Carregando...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-red-500">
              <AlertTriangle size={24} className="mb-2" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && data && filtered.length === 0 && (
            <p className="py-16 text-center text-sm text-slate-400">Nenhum cliente encontrado.</p>
          )}

          {!loading && !error && filtered.map((c, i) => {
            const pctDaBase = data && data.totalLicencas > 0 ? (c.licencas / data.totalLicencas) * 100 : 0;
            const barWidth = maxLicencas > 0 ? (c.licencas / maxLicencas) * 100 : 0;
            return (
              <div key={`${c.empresa}-${i}`} className="border-b border-slate-50 py-2.5 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex-1 truncate text-sm text-slate-700">
                    <span className="mr-1.5 tabular-nums text-slate-400">{i + 1}.</span>
                    {c.empresa}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-700 transition-all duration-500" style={{ width: `${barWidth}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-900">
                    {c.licencas.toLocaleString('pt-BR')}
                  </span>
                  <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
                    {pctDaBase.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
