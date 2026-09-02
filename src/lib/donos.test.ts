import { describe, it, expect } from 'vitest';
import { nomeDono, SEM_DONO } from './donos';

describe('nomeDono', () => {
  it('traduz os dois donos reais pelo id do Zoho', () => {
    expect(nomeDono('7067822000000576001', 'vendor 2')).toBe('Leonardo');
    expect(nomeDono('7067822000000743027', 'Gustavo Figueira')).toBe('Gustavo F');
  });

  it('o id vence o nome, então renomear a conta no Zoho não muda a tela', () => {
    expect(nomeDono('7067822000000576001', 'qualquer outro nome')).toBe('Leonardo');
    expect(nomeDono('7067822000000576001', '')).toBe('Leonardo');
  });

  it('dono novo aparece com o nome cru, não como "sem dono"', () => {
    // Um vendedor que entrar amanhã tem que aparecer na tela no primeiro dia, antes de
    // alguém lembrar de vir aqui cadastrar o id.
    expect(nomeDono('7067822000009999999', 'Fulano de Tal')).toBe('Fulano de Tal');
  });

  it('só a ausência de dono vira "sem dono"', () => {
    expect(nomeDono(null, null)).toBe(SEM_DONO);
    expect(nomeDono('', '   ')).toBe(SEM_DONO);
    expect(nomeDono(undefined, undefined)).toBe(SEM_DONO);
  });

  // --- feature-040 §pedido 4 ---
  it('Grande Conta na conta compartilhada aparece como Francisco', () => {
    expect(nomeDono('7067822000000576001', 'vendor 2', true)).toBe('Francisco');
  });

  it('o resto da conta compartilhada continua Leonardo', () => {
    expect(nomeDono('7067822000000576001', 'vendor 2', false)).toBe('Leonardo');
  });

  it('a marca de Grande Conta não sequestra os outros donos', () => {
    expect(nomeDono('7067822000000743027', 'Gustavo Figueira', true)).toBe('Gustavo F');
    expect(nomeDono('7067822000009999999', 'Fulano de Tal', true)).toBe('Fulano de Tal');
  });

  it('sem a marca, o comportamento é exatamente o de hoje', () => {
    expect(nomeDono('7067822000000576001', 'vendor 2')).toBe('Leonardo');
  });
});
