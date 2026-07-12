// Seletor de intervalo reusável — modelo + lógica pura (feature-intervalo-datas).
// Compartilhado entre DayNavigator (Resumo Diário) e DateFilter (Exec/Operacional).
// Tudo em YYYY-MM-DD (BRT), string-compare. NÃO usa Date local (evita drift de fuso).

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
