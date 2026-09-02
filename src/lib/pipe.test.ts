import { describe, it, expect } from 'vitest';
import { isAberto, isGanho, isPerdido, isGrandeConta, GELADEIRA } from './pipe';

// feature-041 §3.3 — UMA definição de pipe, com nome.
//
// Antes existiam quatro: `isPipeline` (9), `isAberto` (63), `isActive` (108) e a allowlist do
// farol (24), todas chamadas de "pipe". A `isPipeline` era allowlist de 3 estágios e descartava
// 54 negócios EM SILÊNCIO — 11 de Reunião Técnica, 4 de Proposta/Governo e as 39 Grandes Contas.

describe('isAberto — denylist, para estágio novo APARECER', () => {
  it('mantém os estágios que a allowlist antiga descartava calada', () => {
    for (const s of ['Reunião Técnica', 'Proposta / Governo', 'Grandes Contas']) {
      expect(isAberto(s)).toBe(true);
    }
  });

  it('mantém os que a allowlist antiga já pegava', () => {
    for (const s of ['Proposta Enviada', 'Em negociação']) expect(isAberto(s)).toBe(true);
  });

  it('estágio inventado aparece — é o ponto da denylist', () => {
    expect(isAberto('Em Homologação')).toBe(true);
  });

  it('fechados e geladeira ficam de fora', () => {
    for (const s of ['Fechado Ganho', 'Contrato Enviado', 'Fechado perdido',
                     'Fechado perdido para a concorrência', 'Contato Futuro']) {
      expect(isAberto(s)).toBe(false);
    }
  });

  it('estágio vazio não é aberto', () => {
    expect(isAberto('')).toBe(false);
    expect(isAberto('   ')).toBe(false);
  });

  it('não depende de acento nem de caixa', () => {
    expect(isAberto('FECHADO PERDIDO PARA A CONCORRENCIA')).toBe(false);
    expect(isAberto('fechado perdido para a concorrência')).toBe(false);
  });
});

describe('vocabulário', () => {
  it('ganho e perdido são disjuntos e nenhum é aberto', () => {
    expect(isGanho('Fechado Ganho')).toBe(true);
    expect(isPerdido('Fechado Ganho')).toBe(false);
    expect(isGanho('Fechado perdido')).toBe(false);
    expect(isPerdido('Fechado perdido')).toBe(true);
  });

  it('a geladeira tem gatilho datado próprio, não é oportunidade em andamento', () => {
    expect(GELADEIRA).toBe('contato futuro');
    expect(isAberto('Contato Futuro')).toBe(false);
    expect(isGanho('Contato Futuro')).toBe(false);
    expect(isPerdido('Contato Futuro')).toBe(false);
  });

  it('isGrandeConta reconhece o estágio que semeia a carteira', () => {
    expect(isGrandeConta('Grandes Contas')).toBe(true);
    expect(isGrandeConta('grandes contas')).toBe(true);
    expect(isGrandeConta('Proposta Enviada')).toBe(false);
  });
});
