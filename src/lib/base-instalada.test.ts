import { describe, it, expect } from 'vitest';
import { aggregateBaseInstalada } from './base-instalada';
import type { RawDeal } from './types';

const won = (empresa: string, licencas: number): RawDeal =>
  ({ stage: 'Fechado Ganho', empresa, licencas } as RawDeal);

describe('aggregateBaseInstalada', () => {
  it('agrupa por empresa, soma licenças, ordena desc, ignora não-ganhos', () => {
    const deals: RawDeal[] = [
      won('ACME', 100), won('ACME', 50),            // 2 negócios, 150
      won('BETA', 300),
      { stage: 'Fechado Perdido', empresa: 'GAMA', licencas: 999 } as RawDeal,
    ];
    const r = aggregateBaseInstalada(deals);
    expect(r.totalClientes).toBe(2);
    expect(r.totalLicencas).toBe(450);
    expect(r.clientes[0]).toEqual({ empresa: 'BETA', licencas: 300, negocios: 1 });
    expect(r.clientes[1]).toEqual({ empresa: 'ACME', licencas: 150, negocios: 2 });
  });
  it('empresa vazia cai para "—" e não quebra', () => {
    const r = aggregateBaseInstalada([{ stage: 'Fechado Ganho', empresa: '', licencas: 10 } as RawDeal]);
    expect(r.clientes[0].empresa).toBe('—');
  });
});
