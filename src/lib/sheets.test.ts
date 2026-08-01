import { describe, it, expect } from 'vitest';
import { gvizCellToValue } from './sheets';

// O gviz serializa TRÊS coisas diferentes como "Date(...)":
//   date      → Date(2026,3,9)              → 2026-04-09
//   datetime  → Date(2026,3,9,21,32,15)     → 2026-04-09
//   timeofday → Date(1899,11,30,21,32,15)   → 21:32:15   ← 1899-12-30 é a época do Sheets
// O terceiro caso virava "1899-12-30" e destruía a hora em silêncio (achado do backfill
// de 28/07: 11.529 ligações e 3.786 e-mails rejeitados por "hora inválida").
describe('gvizCellToValue', () => {
  it('data pura vira YYYY-MM-DD', () => {
    expect(gvizCellToValue('Date(2026,3,9)')).toBe('2026-04-09');
  });

  it('datetime real trunca pra data (comportamento existente)', () => {
    expect(gvizCellToValue('Date(2026,3,9,21,32,15)')).toBe('2026-04-09');
  });

  it('hora-do-dia (época 1899-12-30) vira HH:MM:SS, não a data da época', () => {
    expect(gvizCellToValue('Date(1899,11,30,21,32,15)')).toBe('21:32:15');
  });

  it('hora-do-dia zera com padding', () => {
    expect(gvizCellToValue('Date(1899,11,30,9,5,0)')).toBe('09:05:00');
    expect(gvizCellToValue('Date(1899,11,30,0,0,0)')).toBe('00:00:00');
  });

  it('valores que não são Date(...) passam intactos', () => {
    expect(gvizCellToValue('Marcos Cruz')).toBe('Marcos Cruz');
    expect(gvizCellToValue(65)).toBe(65);
    expect(gvizCellToValue(null)).toBeNull();
  });
});
