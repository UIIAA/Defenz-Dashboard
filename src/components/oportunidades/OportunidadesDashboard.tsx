"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { SemaforoDot, TEMPERATURA_NOME } from './SemaforoDot';
import type { Oportunidade, OportunidadesResult, Temperatura } from '@/lib/oportunidades';
import { ErrorState } from '@/components/shared/ErrorState';

// feature-semaforo-oportunidades §5.
//
// NÃO reusa `DealRow`: ele recebe `Deal` (não `RawDeal`), tem uma bolinha âmbar fixa em :60
// (que faria TODO negócio nascer amarelo, a cor de "Morno") e renderiza `comissao_valor`.

type Filtro = Temperatura | 'vazio';
const CHIPS: Filtro[] = ['quente', 'morno', 'frio', 'vazio'];
const chipTemp = (f: Filtro): Temperatura | '' => (f === 'vazio' ? '' : f);

/** Mesma janela do servidor (`refresh/route.ts`). O cliente é conveniência; o servidor manda. */
const JANELA_MS = 2 * 60 * 1000;

type Payload = OportunidadesResult & { atualizado_em?: string };

function LinhaOportunidade({ o }: { o: Oportunidade }) {
  // Sem cor no "dias sem toque": o número já é o sinal, e vermelho nesta tela já é "Quente".
  const toque =
    o.dias_sem_toque === null
      ? 'sem registro datado'
      : `${o.ultimo_toque!.slice(8, 10)}/${o.ultimo_toque!.slice(5, 7)} · ${o.dias_sem_toque}d`;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <SemaforoDot temperatura={o.temperatura} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 font-medium truncate">{o.nome}</p>
        <p className="text-xs text-slate-400">
          {o.stage}
          {o.licencas > 0 && ` · ${o.licencas} lic`}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs font-mono ${
          o.dias_sem_toque === null ? 'text-slate-300 italic' : 'text-slate-500'
        }`}
        title="Último registro datado no campo Resultados do Zoho"
      >
        {toque}
      </span>
      <span className="shrink-0 text-sm font-mono text-slate-900 w-28 text-right">
        {o.valor > 0 ? formatCurrency(o.valor) : '—'}
      </span>
    </div>
  );
}

const horaBR = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : null;

export const OportunidadesDashboard = () => {
  const [data, setData] = useState<Payload | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Set<Filtro>>(new Set());
  const [atualizando, setAtualizando] = useState(false);
  const ultimoRefresh = useRef(0);
  const montado = useRef(true);

  const atualizar = useCallback(async () => {
    if (Date.now() - ultimoRefresh.current < JANELA_MS) return;
    ultimoRefresh.current = Date.now();
    setAtualizando(true);
    try {
      const r = await fetch('/api/oportunidades/refresh', { method: 'POST' });
      const j = await r.json();
      if (montado.current && !j.error) setData(j);
    } catch {
      // Falha do refresh não apaga o que já está na tela — só não atualiza.
    } finally {
      if (montado.current) setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    // Primeiro o GET (rápido, cacheado): a tela aparece na hora em vez de esperar ~8s de
    // workflow. Só depois dispara o refresh, que substitui os dados por baixo.
    fetch('/api/oportunidades')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!montado.current) return;
        if (j.error) setErro(j.error);
        else {
          setData(j);
          void atualizar();
        }
      })
      .catch(() => montado.current && setErro('Não foi possível carregar as oportunidades.'));
    return () => {
      montado.current = false;
    };
  }, [atualizar]);

  const visiveis = useMemo(() => {
    if (!data) return [];
    if (filtros.size === 0) return data.itens;
    return data.itens.filter((o) => filtros.has(o.temperatura === '' ? 'vazio' : o.temperatura));
  }, [data, filtros]);

  const valorVisivel = useMemo(() => visiveis.reduce((s, o) => s + o.valor, 0), [visiveis]);

  if (erro) return <ErrorState error={erro} onRetry={() => window.location.reload()} />;
  if (!data) return <p className="text-sm text-slate-400 py-12 text-center">Carregando…</p>;

  const toggle = (f: Filtro) => {
    const n = new Set(filtros);
    if (n.has(f)) n.delete(f);
    else n.add(f);
    setFiltros(n);
  };

  const hora = horaBR(data.atualizado_em);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={atualizar}
          disabled={atualizando}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          <RefreshCw size={13} className={atualizando ? 'animate-spin' : undefined} aria-hidden />
          {atualizando ? 'Atualizando…' : 'Atualizar'}
        </button>
        {/* Sem carimbo, ninguém sabe se está olhando o dado de agora ou o de ontem — e é
            justamente essa dúvida que a tela existe pra matar. */}
        {hora && <span className="text-xs text-slate-400">atualizado às {hora}</span>}
      </div>

      {data.sem_classificacao > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            <strong className="font-semibold">
              {data.sem_classificacao} de {data.total}
            </strong>{' '}
            sem classificação — abra o negócio no Zoho e preencha o campo{' '}
            <span className="font-mono text-xs">Temperatura</span>.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {CHIPS.map((f) => {
          const on = filtros.has(f);
          return (
            <button
              key={f}
              onClick={() => toggle(f)}
              aria-pressed={on}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                on
                  ? 'border-slate-400 bg-slate-100 text-slate-900'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <SemaforoDot temperatura={chipTemp(f)} size="md" />
              {TEMPERATURA_NOME[chipTemp(f)]}
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline gap-2 border-b border-slate-200 pb-2">
        <span className="text-lg font-semibold text-slate-900">
          {visiveis.length} {visiveis.length === 1 ? 'negócio' : 'negócios'}
        </span>
        <span className="text-sm text-slate-500 font-mono">{formatCurrency(valorVisivel)}</span>
        {filtros.size > 0 && (
          <button
            onClick={() => setFiltros(new Set())}
            className="ml-auto text-xs text-slate-400 hover:text-red-600"
          >
            limpar filtro
          </button>
        )}
      </div>

      <div>
        {visiveis.map((o) => (
          <LinhaOportunidade key={o.id} o={o} />
        ))}
        {visiveis.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Nenhum negócio com esse filtro.</p>
        )}
      </div>
    </div>
  );
};
