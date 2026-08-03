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

// --- feature-cnpj-identidade-empresa ---

const wonCnpj = (nome: string, cnpj: string, licencas: number): RawDeal => ({
  stage: 'Fechado Ganho',
  nome,
  cnpj,
  licencas,
});

describe('identidade por CNPJ', () => {
  it('caso AMGS: dois negócios reais da mesma empresa viram 1 cliente', () => {
    // Medido no Zoho: dois deals ganhos, mesmo CNPJ, 105 e 10 endpoints, valores distintos.
    // São vendas separadas — 1 cliente, 115 licenças, 2 negócios.
    const r = aggregateBaseInstalada([
      wonCnpj('AMGS COMERCIO E REPRESENTACOES LTDA', '20.858.411/0001-20', 105),
      wonCnpj('AMGS Comércio e Representações', '20858411000120', 10),
    ]);
    expect(r.totalClientes).toBe(1);
    expect(r.totalLicencas).toBe(115);
    expect(r.clientes[0].negocios).toBe(2);
    expect(r.clientes[0].cnpj).toBe('20.858.411/0001-20');
  });

  it('um único negócio não vira dois clientes (caso Estaleiro, pós-limpeza)', () => {
    // O Estaleiro tinha um SEGUNDO registro de R$ 7.540 que NÃO era venda: era o custo da
    // SecuriSoft, duplicado pela esteira de onboarding. Deletado no Zoho em 02/08 e removido
    // da aba/Neon em 03/08. Sobra 1 negócio, 200 licenças — não 400.
    const r = aggregateBaseInstalada([
      wonCnpj('ESTALEIRO ATLANTICO SUL S/A EM RECUPERACAO JUDICIAL', '07.699.082/0001-53', 200),
    ]);
    expect(r.totalClientes).toBe(1);
    expect(r.totalLicencas).toBe(200);
    expect(r.clientes[0].negocios).toBe(1);
  });

  it('une o mesmo CNPJ mesmo com o nome grafado diferente', () => {
    const r = aggregateBaseInstalada([
      wonCnpj('SEICOM - INDÚSTRIA, COMÉRCIO E SERVIÇOS ESPECIALIZADOS LTDA', '10.843.079/0001-76', 7),
      wonCnpj('Seicom Materiais', '10843079000176', 3),
    ]);
    expect(r.totalClientes).toBe(1);
    expect(r.totalLicencas).toBe(10);
  });

  it('não une empresas diferentes que só parecem parecidas', () => {
    const r = aggregateBaseInstalada([
      wonCnpj('AMGS COMERCIO E REPRESENTACOES', '20.858.411/0001-20', 105),
      wonCnpj('AMGS Engenharia', '10.843.079/0001-76', 10),
    ]);
    expect(r.totalClientes).toBe(2);
  });

  it('sem CNPJ válido cai no nome normalizado e ainda agrupa', () => {
    const r = aggregateBaseInstalada([
      { stage: 'Fechado Ganho', nome: 'Consórcio Triângulo LTDA', licencas: 5 },
      { stage: 'Fechado Ganho', nome: 'CONSORCIO TRIANGULO', cnpj: 'Localizando', licencas: 5 },
    ]);
    expect(r.totalClientes).toBe(1);
    expect(r.totalLicencas).toBe(10);
    expect(r.clientes[0].cnpj).toBeUndefined();
  });
});
