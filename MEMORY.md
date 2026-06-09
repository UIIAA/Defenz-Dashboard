# Defenz Dashboard — Memory

## Problemas de qualidade de dados (auditados em 2026-05-05)

### P4 — Reuniões sempre 0 (Microsoft Calendar)
- **Status:** Limitação conhecida. Hardcoded em `src/lib/metrics.ts:103`
- **Mitigação aceita:** Badge "indisponível" no card. Não exibir 0 como dado real.
- **Fix real:** Requer token OAuth Microsoft válido + acesso manual ao N8N para reconectar.

### P9 — Pipeline de emails parado
- **Status:** Pipeline N8N/Callbox não escreve na aba `emails` desde 30/03/2026 (~36 dias de gap em 2026-05-05)
- **Impacto:** Cards de email mostram 0 para 7d e 30d — parece ausência de atividade mas é bug de integração
- **Mitigação aceita:** Indicador vermelho no DataHealthPanel + tooltip explicativo
- **Fix real:** Investigar execuções N8N e reiniciar node de escrita de emails

### P10 — 23 deals em ghost stages (invisíveis)
- **Status:** Diagnosticado. Fix planejado para V5.5
- **Stages afetados:** `contato futuro` (19 deals), `reunião técnica` (3), `em trial / poc` (1)
- **Impacto:** Pipeline exibe 18 deals ativos; existem 41
- **Fix:** Expandir `PIPELINE_STAGES` em `src/lib/metrics.ts`

## Dados validados (smoke test 2026-05-05)

| Aba | Rows | Date range | Saúde |
|-----|------|-----------|-------|
| ligacoes | 5.291 | 2025-11-04 → 2026-05-04 | ✅ |
| deals | 120 | 2025-12 → 2026-12 | ⚠️ 7 closing_dates placeholder |
| emails | 2.963 | 2025-11-26 → **2026-03-30** | ❌ parado |
| classificacao_ia | 435 | 2026-04-13 → 2026-05-05 | ✅ |

- Ligações 7d=237, 30d=1.388, alltime=5.291
- Taxa conectividade 7d=55%, 30d=48%, alltime=58%
- Apresentações alltime=64, Propostas alltime=47
- Deals fechados alltime=33 (7 com closing_date futura/placeholder)
- valor_pipeline snapshot=R$73.061 (18 deals mapeados)

## Arquitetura atual (V5.4)

- **N8N:** ETL puro — coleta dados raw das fontes (Zoho, Apollo, Callbox, Microsoft, Gemini)
- **Google Sheets:** Data lake — 4 abas principais (ligacoes, deals, emails, classificacao_ia)
- **Vercel:** Motor de negócio — `src/lib/metrics.ts` computa tudo, filtros custom

## Histórico de versões resumido

| Versão | Marco |
|--------|-------|
| V1–V3 | Base + multipage + pipeline aging |
| V4.0 | Funil hero, drill-down, N8N Consolidar V4.0 |
| V5.0–V5.3 | Arquitetura híbrida, metrics.ts centralizado |
| V5.4 | Data Quality: auditoria + smoke test + DataHealthPanel |
