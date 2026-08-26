import { describe, it, expect } from "vitest";
import { ultimoToque } from "./ultimo-toque";

const REF = "2026-08-26";

describe("ultimoToque", () => {
  it("pega a ÚLTIMA data do texto, não a primeira", () => {
    const t = "14/07 - primeira prospeccao\n22/07 - ligacao\n25/08 - mandei 3 agendas";
    expect(ultimoToque(t, REF)).toEqual({ data: "2026-08-25", dias: 1 });
  });

  it("mês maior que o de referência cai no ano anterior", () => {
    // Dezembro visto de agosto/2026 só pode ser dez/2025.
    expect(ultimoToque("03/12 - reuniao", REF).data).toBe("2025-12-03");
  });

  it("texto sem data devolve null (não zero — 'nunca tocado' ≠ 'tocado hoje')", () => {
    expect(ultimoToque("sem data nenhuma aqui", REF)).toEqual({ data: null, dias: null });
    expect(ultimoToque("", REF)).toEqual({ data: null, dias: null });
  });

  it("ignora mês inválido — 32/13 não é data", () => {
    expect(ultimoToque("32/13 - lixo", REF)).toEqual({ data: null, dias: null });
  });

  it("pega a data que ABRE a linha, não um número no meio dela", () => {
    // O parser de eventos tem o mesmo comportamento (metrics.ts:108) e é o que faz o corte
    // no meio da linha ser perigoso: sem a data na frente, ele pesca outro par de 2 dígitos.
    const t = "20/08 - falei com o cliente sobre as 30/40 licencas";
    expect(ultimoToque(t, REF).data).toBe("2026-08-20");
  });

  it("conta dias corridos sem deixar fuso entrar", () => {
    expect(ultimoToque("01/08 - proposta", REF).dias).toBe(25);
  });

  it("data no futuro em relação à referência não vira negativo", () => {
    expect(ultimoToque("28/08 - agendado", REF).dias).toBe(0);
  });

  it("caso real: HM Engenharia truncada para em 30/04", () => {
    const truncado = "14/04 - Ricardo respondeu\n17/04 - mensagem\n30/04 - liguei";
    expect(ultimoToque(truncado, REF)).toEqual({ data: "2026-04-30", dias: 118 });
  });
});
