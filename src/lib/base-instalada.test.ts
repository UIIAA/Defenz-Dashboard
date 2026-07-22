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
    expect(r.clientes[0]).toEqual({ empresa: 'BETA', licencas: 300, negocios: 1, setup: 'nao-iniciado' });
    expect(r.clientes[1]).toEqual({ empresa: 'ACME', licencas: 150, negocios: 2, setup: 'nao-iniciado' });
  });
  it('empresa vazia cai para "—" e não quebra', () => {
    const r = aggregateBaseInstalada([{ stage: 'Fechado Ganho', empresa: '', licencas: 10 } as RawDeal]);
    expect(r.clientes[0].empresa).toBe('—');
  });
});

const wonTag = (empresa: string, tags: string): RawDeal =>
  ({ stage: 'Fechado Ganho', empresa, licencas: 10, tags } as RawDeal);

describe('setup status', () => {
  it('classifica por tag e calcula % na console', () => {
    const r = aggregateBaseInstalada([
      wonTag('A', 'cliente na console'),
      wonTag('B', 'enviar health check; hash e-mail enviado'),
      wonTag('C', 'cliente não está console'),
      wonTag('D', ''),
    ]);
    const by = Object.fromEntries(r.clientes.map(c => [c.empresa, c.setup]));
    expect(by.A).toBe('na-console');
    expect(by.B).toBe('em-setup');
    expect(by.C).toBe('recusou');
    expect(by.D).toBe('nao-iniciado');
    expect(r.setupConcluidoPct).toBeCloseTo(0.25); // 1 de 4
  });
  it('não confunde "na console" com "não está console"', () => {
    const r = aggregateBaseInstalada([wonTag('X', 'cliente não está console')]);
    expect(r.clientes[0].setup).toBe('recusou');
  });
});
