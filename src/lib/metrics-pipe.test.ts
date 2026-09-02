import { describe, it, expect } from 'vitest';
import { computeMetrics, classifyPipelineBucket } from './metrics';
import type { RawDeal } from './types';

// feature-041 §3.3 — o pipe da tela executiva passa a ser `isAberto`, não a allowlist de 3
// estágios. Os 54 negócios que a allowlist descartava em silêncio entram na conta.

const RANGE = { start: '2026-08-01', end: '2026-08-31', label: 'ago' };

const deals: RawDeal[] = [
  { id: '1', nome: 'Na allowlist antiga', stage: 'Proposta Enviada', valor: 1000 },
  { id: '2', nome: 'Descartado em silêncio', stage: 'Reunião Técnica', valor: 500 },
  { id: '3', nome: 'Descartado em silêncio', stage: 'Proposta / Governo', valor: 300 },
  { id: '4', nome: 'Grande Conta', stage: 'Grandes Contas', valor: 0 },
  { id: '5', nome: 'Ganho', stage: 'Fechado Ganho', valor: 9999 },
  { id: '6', nome: 'Geladeira', stage: 'Contato Futuro', valor: 7777 },
];

describe('valor_pipeline usa a definição única de aberto', () => {
  it('inclui Reunião Técnica e Proposta / Governo, que eram descartados calados', () => {
    const m = computeMetrics(deals, [], [], [], RANGE);
    expect(m.valor_pipeline).toBe(1800); // 1000 + 500 + 300 + 0
  });

  it('continua excluindo fechados e a geladeira', () => {
    const m = computeMetrics(deals, [], [], [], RANGE);
    expect(m.valor_pipeline).not.toContain(9999);
    expect(m.valor_pipeline).toBeLessThan(9999);
  });
});

describe('classifyPipelineBucket continua sendo outra pergunta', () => {
  it('o rótulo do balde NÃO virou a definição de pipe', () => {
    // Este classificador nomeia baldes de um gráfico. Se ele passasse a usar `isAberto`,
    // tudo viraria 'PIPELINE' e o gráfico perderia a distinção que ele existe para mostrar.
    expect(classifyPipelineBucket('Proposta Enviada')).toBe('PIPELINE');
    expect(classifyPipelineBucket('Reunião Técnica')).toBe('OPORTUNIDADE');
    expect(classifyPipelineBucket('Em Trial / POC')).toBe('POC');
  });
});
