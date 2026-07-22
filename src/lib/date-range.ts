// Seletor de intervalo reusável — modelo + lógica pura (feature-intervalo-datas).
// Compartilhado entre DayNavigator (Resumo Diário) e DateFilter (Exec/Operacional).
// Tudo em YYYY-MM-DD (BRT), string-compare. NÃO usa Date local (evita drift de fuso).

import { mondayOf, addDays } from './farol';

// Seleção normalizada que a UI conhece. `dia` = 1 data; `periodo` = intervalo from<=to.
export type RangeSelection =
  | { kind: 'dia'; data: string }
  | { kind: 'periodo'; from: string; to: string };

export function daySel(data: string): RangeSelection {
  return { kind: 'dia', data };
}

// Ordena from<=to e colapsa para `dia` quando from===to.
export function rangeSel(a: string, b: string): RangeSelection {
  const from = a <= b ? a : b;
  const to = a <= b ? b : a;
  return from === to ? daySel(from) : { kind: 'periodo', from, to };
}

// Reducer de 2 fases do calendário: 1º clique = dia (guarda âncora); 2º = intervalo.
// anchor === null ⇒ estado idle (próximo clique é o 1º).
export function reduceTwoClicks(
  anchor: string | null,
  clicked: string
): { anchor: string | null; sel: RangeSelection } {
  if (anchor === null) return { anchor: clicked, sel: daySel(clicked) };
  return { anchor: null, sel: rangeSel(anchor, clicked) };
}

function clampDay(d: string, floor: string, ceil: string): string {
  return d < floor ? floor : d > ceil ? ceil : d;
}

// Apara a seleção em [floor, ceil]. Pode colapsar `periodo` → `dia` (via rangeSel).
export function clampSelection(sel: RangeSelection, floor: string, ceil: string): RangeSelection {
  if (sel.kind === 'dia') return daySel(clampDay(sel.data, floor, ceil));
  return rangeSel(clampDay(sel.from, floor, ceil), clampDay(sel.to, floor, ceil));
}

// Codifica p/ a string do DateRangeProvider/DateFilter: sempre `custom:from:to`
// (dia único vira custom:d:d, exatamente como o DateFilter já faz hoje).
export function encodeCustom(sel: RangeSelection): string {
  const from = sel.kind === 'dia' ? sel.data : sel.from;
  const to = sel.kind === 'dia' ? sel.data : sel.to;
  return `custom:${from}:${to}`;
}

// Decodifica `custom:from:to` de volta pra RangeSelection (colapsa se from===to).
export function decodeCustom(s: string): RangeSelection {
  const [, from, to] = s.split(':');
  return rangeSel(from, to ?? from);
}

// Presets do seletor de intervalo do /metas v2 (feature-metas-v2-faturamento-esforco
// §6). `today` = YYYY-MM-DD (BRT). Sempre retorna `periodo` com from<=to.
export type PresetKey = '8sem' | '12sem' | 'este-mes' | 'mes-passado' | 'trimestre';

export function presetRange(key: PresetKey, today: string): RangeSelection {
  const [y, m] = today.split('-').map(Number);
  const firstOfMonth = `${today.slice(0, 8)}01`;
  switch (key) {
    case '8sem':  return { kind: 'periodo', from: addDays(mondayOf(today), -7 * 7), to: today };
    case '12sem': return { kind: 'periodo', from: addDays(mondayOf(today), -7 * 11), to: today };
    case 'este-mes': return { kind: 'periodo', from: firstOfMonth, to: today };
    case 'mes-passado': {
      const pm = m === 1 ? 12 : m - 1; const py = m === 1 ? y - 1 : y;
      const first = `${py}-${String(pm).padStart(2, '0')}-01`;
      const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
      return { kind: 'periodo', from: first, to: `${py}-${String(pm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` };
    }
    case 'trimestre': return { kind: 'periodo', from: addDays(today, -89), to: today };
  }
}
