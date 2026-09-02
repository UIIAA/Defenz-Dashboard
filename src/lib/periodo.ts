// Presets de período do dashboard (feature-041 §3.2).
//
// Extraído de `src/app/api/dashboard-sheets/route.ts`, onde era função privada e portanto
// intestável. Recebe `hoje` como parâmetro: não lê relógio, não lê fuso — quem sabe o dia é
// `hojeBRT()`, e quem decide o intervalo é aqui.
//
// DOIS DEFEITOS CONSERTADOS:
//  1. o dia vinha de `toISOString()` (UTC) — agora chega pronto, em BRT;
//  2. "7 dias" fazia `-7` sobre intervalo FECHADO, cobrindo 8 datas. Agora é `-6`.

import { addDays } from './farol';

export interface Periodo {
  start: string;
  end: string;
  label: string;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** '2026-08-27' → '27/08' */
function ddmm(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Rótulo que mostra as datas. Rótulo sem data foi o que deixou duas janelas conviverem. */
function rotulo(start: string, end: string): string {
  return start === end ? ddmm(start) : `${ddmm(start)} a ${ddmm(end)}`;
}

function janela(hoje: string, dias: number): Periodo {
  // Intervalo FECHADO: `dias` datas incluem hoje, então recua `dias - 1`.
  const start = addDays(hoje, -(dias - 1));
  return { start, end: hoje, label: rotulo(start, hoje) };
}

export function getDateRange(periodo: string, hoje: string): Periodo {
  switch (periodo) {
    case 'today':
      return { start: hoje, end: hoje, label: rotulo(hoje, hoje) };
    case '7d':
      return janela(hoje, 7);
    case '15d':
      return janela(hoje, 15);
    case '30d':
      return janela(hoje, 30);
    case 'month': {
      const start = `${hoje.slice(0, 7)}-01`;
      return { start, end: hoje, label: rotulo(start, hoje) };
    }
    case 'alltime':
      return { start: '2020-01-01', end: hoje, label: 'All Time' };
    default: {
      if (periodo.startsWith('custom:')) {
        const [, inicio = '', fim = ''] = periodo.split(':');
        if (DATA_RE.test(inicio) && DATA_RE.test(fim)) {
          return { start: inicio, end: fim, label: rotulo(inicio, fim) };
        }
      }
      return { start: hoje, end: hoje, label: rotulo(hoje, hoje) };
    }
  }
}
