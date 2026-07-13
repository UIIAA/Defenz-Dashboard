# Plano de execução — Farol de Metas + Timeline do Cliente

> **Como usar:** abra uma **sessão dedicada NESTE projeto (`Defenz_Dashboard`)** e mande
> *"implementa o Farol Fase 1 pela `docs/features/feature-farol-metas.md`"*. Este arquivo é o mapa;
> as specs aterrissadas têm o detalhe. Escrito a partir de recon do código real em 12/07/2026.

## Ordem
1. ✅ **Farol Fase 1** — `feature-farol-metas.md` §7-1. "Tô batendo os 6k?" (semana + mês). **No ar.**
1b. ✅ **Seletor de Intervalo** — `feature-intervalo-datas.md` Fase 1+2 (DateRangePicker reusável, Diário + Exec/Operacional). **No ar.**
2. ⏳ **Farol Fase 2** — tela "por que bati / não bati" em `/metas`, reusando o `resumo_diario` agregado por semana. Ver "Fase 2 — Landed" em `feature-farol-metas.md`. **Em andamento.**
3. ⬜ **Ligações de IA** — `feature-ligacoes-ia.md`. Aba dedicada pras chamadas do agente de vendas (fonte Zoho → export novo pro Sheets). Enfileirada.
4. ⬜ **Timeline / raio-x por Deal** — `feature-timeline-cliente.md`. Consome o `DateRangePicker` (Overview por período). Depois do Farol.

## Por que é pequeno (reuso do que já existe)
O Dashboard **não tem banco**; lê Google Sheets populado pelo n8n (Zoho→Sheets, cron 6h/18h). Então:

| Peça | Reusa | Arquivo |
|---|---|---|
| Deals fechados com `valor` + `closing_date` | já carregados do Sheets | `src/lib/types.ts` (`RawDeal`), pipeline atual |
| "É ganho?" / filtro por data | `isClosedWon()`, `dateInRange()` | `src/lib/metrics.ts:14,51` |
| Parser de `Resultados` + inferência de ano | `extractEventDatesAnchored()` | `src/lib/metrics.ts:91` |
| Card/UI | `components/dashboard`, `components/ui` | — |

**Farol = função pura nova (`src/lib/farol.ts`) + 1 card. Zero fetch novo, zero Zoho direto, zero Neon, zero COQL.**

## Passo 0 (antes de codar) — verificações rápidas
1. Confirmar que a aba `deals` do Sheet traz `valor` e `closing_date` **preenchidos** (o `RawDeal` tem footgun documentado em `licencas/data_renovacao/recurring/owner` — evitar esses; `valor`/`closing_date`/`stage`/`resultados` são usados no dashboard todo e são confiáveis).
2. Decidir com o Marcos: **ganho = `isClosedWon()`** (inclui `contrato enviado`, reconcilia com o resto do dashboard) **vs Farol estrito** (só `fechado ganho`).
3. Confirmar meta de mês de 5 semanas (30k) vs teto 24k; e thresholds de cor (0.8).

> Obs.: NÃO é preciso ir ao Zoho `/settings/fields` (a spec original pedia). Os campos vêm do Sheets, e `metrics.ts` já prova quais existem.

## Correções que estas specs fizeram sobre o brainstorm original
- Zoho direto / COQL / OAuth → **removidos** (dado vem do Sheets).
- Neon `deals_won`/`weekly_snapshot`/`timeline_cache` → **removidos** (não há banco).
- "convenção `dd/mm` universal" → **falsa no dado real** (SDR escreve "9 de junho"); parser vira **híbrido** (regex fast-path + Sonnet fallback).
- `Stage_History`/`amount_change` na Timeline → **fora do MVP** (não estão no Sheets).

## Convenções do projeto (do CLAUDE.md deste repo)
- TDD. Testes antes do código.
- Nada de banco novo; fonte = Sheets via n8n.
- `Resultados` → sempre Sonnet quando for interpretar, nunca só regex.
- Branch atual: `feat/resumo-diario` (criar branch própria a partir da base limpa antes de começar).
