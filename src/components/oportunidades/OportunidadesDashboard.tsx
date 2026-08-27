"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, Clock, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { SemaforoDot, TEMPERATURA_NOME } from './SemaforoDot';
import { POSSE_TITULO, EM_VALIDACAO, montaFicha, type Posse } from '@/lib/estado';
import type { Oportunidade, OportunidadesResult, Temperatura } from '@/lib/oportunidades';
import { ErrorState } from '@/components/shared/ErrorState';

// feature-semaforo-oportunidades §5.
//
// NÃO reusa `DealRow`: ele recebe `Deal` (não `RawDeal`), tem uma bolinha âmbar fixa em :60
// (que faria TODO negócio nascer amarelo, a cor de "Morno") e renderiza `comissao_valor`.

type Filtro = Temperatura | 'vazio';
const CHIPS: Filtro[] = ['quente', 'morno', 'frio', 'vazio'];
const chipTemp = (f: Filtro): Temperatura | '' => (f === 'vazio' ? '' : f);

// Classes completas e estáticas: o Tailwind não vê nome de classe montado em runtime.
// Chip ativo assume a PRÓPRIA cor — sem isso o único sinal de ligado/desligado era um cinza
// levemente diferente, e ninguém percebe que o chip é clicável.
// Barra lateral de 3px na cor da temperatura. Delimita o inicio/fim de cada registro sem
// desenhar linhas de tabela, e reforça a cor muito mais do que a bolinha sozinha.
const BARRA: Record<Temperatura | '', string> = {
  quente: 'border-l-red-500',
  morno: 'border-l-amber-400',
  frio: 'border-l-blue-500',
  '': 'border-l-slate-200',
};

// feature-038 — cor do grupo de posse. Cinza para "sem estado" de propósito: é ausência de
// informação, não uma quarta categoria de negócio.
const POSSE_COR: Record<Posse | '', string> = {
  parado: 'text-red-700',
  nossa: 'text-slate-900',
  cliente: 'text-slate-500',
  '': 'text-slate-400',
};

const ATIVO: Record<Filtro, string> = {
  quente: 'border-red-300 bg-red-50 text-red-800',
  morno: 'border-amber-300 bg-amber-50 text-amber-800',
  frio: 'border-blue-300 bg-blue-50 text-blue-800',
  vazio: 'border-slate-400 bg-slate-100 text-slate-800',
};

/** Mesma janela do servidor (`refresh/route.ts`). O cliente é conveniência; o servidor manda. */
const JANELA_MS = 2 * 60 * 1000;

type Payload = OportunidadesResult & { atualizado_em?: string };

function LinhaOportunidade({ o }: { o: Oportunidade }) {
  const [aberto, setAberto] = useState(false);

  const toque =
    o.dias_sem_toque === null
      ? 'sem registro datado'
      : `${o.ultimo_toque!.slice(8, 10)}/${o.ultimo_toque!.slice(5, 7)} · ${o.dias_sem_toque}d`;

  // Duas linhas comportam ~180 chars nesta largura. Só oferece "ver tudo" quando há de fato
  // texto escondido — botão que não revela nada é pior que botão nenhum.
  const andamento = o.ultimo_andamento;
  const temMais = Boolean(andamento && andamento.length > 170);

  const ficha = montaFicha(o.licencas, o.antivirus_atual, o.vencimento);
  // Vencida conta como dentro da janela (ver naJanela em estado.ts), mas quem lê precisa
  // saber qual dos dois é: "vence" e "venceu" pedem ações diferentes.
  const vencida = o.dias_para_vencer !== null && o.dias_para_vencer < 0;

  return (
    <div
      className={`rounded-r-lg border-l-[3px] bg-white/70 py-2.5 pl-3 pr-1 transition-colors hover:bg-slate-50/80 ${BARRA[o.temperatura]}`}
    >
      <div className="flex items-center gap-3">
        <SemaforoDot temperatura={o.temperatura} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800 font-medium truncate">{o.nome}</p>
          <p className="text-xs text-slate-400 truncate">
            {/* O DONO ocupa o lugar onde antes se lia 'sem estado'. Enquanto a rotina da
                f-038 não roda, o estado é vazio em todos os cards, e 'sem estado' era um
                rótulo que gastava a linha sem informar nada. De quem é o negócio informa
                sempre. Quando o estado chegar, os dois convivem. */}
            <span className="font-medium text-slate-600">{o.dono}</span>
            {o.estado && (
              <>
                {' · '}
                <span className={`font-medium ${POSSE_COR[o.posse]}`}>{o.estado}</span>
              </>
            )}
            {' · '}
            {o.stage}
            {' · '}
            <span className={ficha.licencas.endsWith(EM_VALIDACAO) ? 'italic' : undefined}>
              {ficha.licencas}
            </span>
            {' · '}
            <span className={ficha.antivirus.endsWith(EM_VALIDACAO) ? 'italic' : undefined}>
              {ficha.antivirus}
            </span>
            {' · '}
            <span
              className={
                o.janela
                  ? 'font-medium text-amber-700'
                  : ficha.vencimento.endsWith(EM_VALIDACAO)
                    ? 'italic'
                    : undefined
              }
              title={
                o.dias_para_vencer === null
                  ? undefined
                  : vencida
                    ? `licença vencida há ${Math.abs(o.dias_para_vencer)} dias`
                    : `vence em ${o.dias_para_vencer} dias`
              }
            >
              {o.janela && <Clock size={10} className="mb-px mr-1 inline" aria-hidden />}
              {/* Sem data, o rótulo some: "vence em validação" não quer dizer nada. */}
              {ficha.vencimento.endsWith(EM_VALIDACAO)
                ? ficha.vencimento
                : `${vencida ? 'venceu' : 'vence'} ${ficha.vencimento}`}
            </span>
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

      {andamento && (
        <div className="mt-1.5 pl-6">
          <p
            className={`text-xs leading-relaxed text-slate-500 whitespace-pre-line ${
              aberto ? '' : 'line-clamp-2'
            }`}
          >
            {andamento}
          </p>
          {temMais && (
            <button
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
            >
              {aberto ? 'ver menos' : 'ler o andamento completo'}
              <ChevronDown
                size={12}
                aria-hidden
                className={`transition-transform ${aberto ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * feature-038 §5 — a lista é agrupada por POSSE, maior valor primeiro dentro do grupo.
 * O cabeçalho carrega contagem e dinheiro porque é isso que decide o que olhar primeiro:
 * "parado, 13 negócios, R$ 93.518" é a frase que faz alguém agir.
 */
function CabecalhoGrupo({ posse, n, valor }: { posse: Posse | ''; n: number; valor: number }) {
  return (
    <div className="pt-4 pb-1">
      <div className="flex items-baseline gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${POSSE_COR[posse]}`}>
          {posse === '' ? 'Ainda sem estado do negócio' : POSSE_TITULO[posse]}
        </span>
        <span className="text-xs text-slate-400">
          {n} {n === 1 ? 'negócio' : 'negócios'}
        </span>
        {valor > 0 && (
          <span className="text-xs font-mono text-slate-400">{formatCurrency(valor)}</span>
        )}
      </div>
      {/* Sem esta linha, "sem estado" parece um diagnóstico do negócio quando na verdade é
          uma etapa que ainda não rodou. */}
      {posse === '' && (
        <p className="text-xs text-slate-400">
          a rotina que diz onde o negócio parou ainda não classificou estes
        </p>
      )}
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

  // Os itens já vêm ordenados por posse do servidor (estado.ts/ORDEM_POSSE), então basta
  // quebrar na troca. A contagem é recalculada AQUI, e não lida de `data.grupos`, porque o
  // chip de temperatura filtra a lista: dizer "13 negócios" num grupo com 2 linhas visíveis
  // seria mentira.
  const grupos = useMemo(() => {
    const out: { posse: Posse | ''; itens: Oportunidade[] }[] = [];
    for (const o of visiveis) {
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.posse === o.posse) ultimo.itens.push(o);
      else out.push({ posse: o.posse, itens: [o] });
    }
    return out;
  }, [visiveis]);

  // Contagem por chip — o número muda quando o dado muda, e é o que deixa claro que o chip
  // é um controle e não um rótulo.
  const contagem = useMemo(() => {
    const c: Partial<Record<Filtro, number>> = {};
    for (const o of data?.itens ?? []) {
      const k: Filtro = o.temperatura === '' ? 'vazio' : o.temperatura;
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [data]);

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

      {/* feature-038 — só aparece quando a rotina classificou PARTE do pipe. Enquanto ela não
          roda, sem_estado === total e um banner "68 de 68" todo dia é ruído: não é um card
          esquecido, é a feature ainda não ligada. */}
      {data.sem_estado > 0 && data.sem_estado < data.total && (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-slate-500" />
          <p className="text-sm text-slate-700">
            <strong className="font-semibold">
              {data.sem_estado} de {data.total}
            </strong>{' '}
            sem estado do negócio. A rotina deixa em branco quando o texto do{' '}
            <span className="font-mono text-xs">Resultados</span> não sustenta a leitura, e isso
            é uma pergunta para o vendedor, não um erro.
          </p>
        </div>
      )}

      {data.janela.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Clock size={15} aria-hidden />
            Vencendo em até 90 dias: {data.janela.length} ·{' '}
            <span className="font-mono">
              {formatCurrency(data.janela.reduce((s, x) => s + x.valor, 0))}
            </span>
          </p>
          {/* Numa revenda de antivírus a data de vencimento é o gatilho do negócio, então ela
              sobe para o topo em vez de ficar só na linha do card. */}
          <p className="mt-1 text-xs text-amber-800">
            {data.janela.map((x) => `${x.nome} (${x.vencimento.slice(5, 7)}/${x.vencimento.slice(0, 4)})`).join(' · ')}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 mr-0.5">Filtrar</span>
        {CHIPS.map((f) => {
          const on = filtros.has(f);
          const n = contagem[f] ?? 0;
          return (
            <button
              key={f}
              onClick={() => toggle(f)}
              aria-pressed={on}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                on ? ATIVO[f] : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SemaforoDot temperatura={chipTemp(f)} size="md" />
              {TEMPERATURA_NOME[chipTemp(f)]}
              <span className={on ? 'opacity-70' : 'text-slate-400'}>{n}</span>
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
        {grupos.map((g) => (
          <div key={g.posse || 'sem-estado'}>
            <CabecalhoGrupo
              posse={g.posse}
              n={g.itens.length}
              valor={g.itens.reduce((s, x) => s + x.valor, 0)}
            />
            <div className="space-y-1.5">
              {g.itens.map((o) => (
                <LinhaOportunidade key={o.id} o={o} />
              ))}
            </div>
          </div>
        ))}
        {visiveis.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Nenhum negócio com esse filtro.</p>
        )}
      </div>
    </div>
  );
};
