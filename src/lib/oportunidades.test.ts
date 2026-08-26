import { describe, it, expect } from "vitest";
import { isAberto, computeOportunidades } from "./oportunidades";
import type { RawDeal } from "./types";

const HOJE = "2026-08-26";

describe("isAberto — denylist, não allowlist", () => {
  it("os 6 estágios reais do pipe são abertos", () => {
    for (const s of [
      "Proposta Enviada", "Reunião Técnica", "Proposta / Governo",
      "Em Trial / POC", "Em negociação", "E-Mail de Aceite Enviado",
    ]) expect(isAberto(s)).toBe(true);
  });

  it("fechados e geladeira ficam de fora", () => {
    for (const s of [
      "Fechado Ganho", "Fechado perdido",
      "Fechado perdido para a concorrência", "Fechado perdido para a concorrencia",
      "Contato Futuro",
    ]) expect(isAberto(s)).toBe(false);
  });

  it("estágio DESCONHECIDO aparece — é o ponto da denylist", () => {
    // `Grandes Contas` existe no picklist do Zoho e sumiu da v1 da spec por causa de uma
    // allowlist. Com denylist, estágio novo entra na tela em vez de sumir calado.
    expect(isAberto("Grandes Contas")).toBe(true);
    expect(isAberto("Estágio Que Ainda Não Existe")).toBe(true);
  });

  it("estágio vazio não é aberto", () => {
    expect(isAberto("")).toBe(false);
  });
});

describe("computeOportunidades", () => {
  const deals: RawDeal[] = [
    { id: "1", nome: "Grande sem cor", stage: "Proposta Enviada", valor: 30000, resultados: "20/08 - proposta" },
    { id: "2", nome: "Pequeno sem cor", stage: "Reunião Técnica", valor: 500, resultados: "" },
    { id: "3", nome: "Quente", stage: "Em negociação", valor: 9000, temperatura: "quente", resultados: "01/08 - call" },
    { id: "4", nome: "Ganho", stage: "Fechado Ganho", valor: 99999 },
    { id: "5", nome: "Geladeira", stage: "Contato Futuro", valor: 45000 },
  ];

  it("filtra para os abertos e soma só eles", () => {
    const r = computeOportunidades(deals, HOJE);
    expect(r.total).toBe(3);
    expect(r.valor_total).toBe(39500);
    expect(r.itens.map((x) => x.id)).not.toContain("4");
    expect(r.itens.map((x) => x.id)).not.toContain("5");
  });

  it("não classificados vêm PRIMEIRO, depois por valor", () => {
    const r = computeOportunidades(deals, HOJE);
    expect(r.itens.map((x) => x.id)).toEqual(["1", "2", "3"]);
    expect(r.sem_classificacao).toBe(2);
  });

  it("valor fora do picklist vira vazio, não quebra", () => {
    const r = computeOportunidades(
      [{ id: "x", nome: "n", stage: "Em negociação", temperatura: "TÉPIDO" }],
      HOJE
    );
    expect(r.itens[0].temperatura).toBe("");
  });

  it("aceita o valor do Zoho com maiúscula e acento", () => {
    const r = computeOportunidades(
      [{ id: "x", nome: "n", stage: "Em negociação", temperatura: " Quente " }],
      HOJE
    );
    expect(r.itens[0].temperatura).toBe("quente");
  });

  it("sem data no resultados: null, não zero", () => {
    const r = computeOportunidades(deals, HOJE);
    const pequeno = r.itens.find((x) => x.id === "2")!;
    expect(pequeno.ultimo_toque).toBeNull();
    expect(pequeno.dias_sem_toque).toBeNull();
  });

  it("NUNCA devolve comissao_valor — a tela é aberta ao time", () => {
    const r = computeOportunidades(
      [{ id: "x", nome: "n", stage: "Em negociação", valor: 1000, comissao_valor: 580 }],
      HOJE
    );
    expect(JSON.stringify(r)).not.toContain("comissao");
    expect(JSON.stringify(r)).not.toContain("580");
  });
});
