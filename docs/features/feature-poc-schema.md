# Feature: POC Tracking — Schema e Correlação com Deal

**Status:** Approved  
**Priority:** P2  
**Date:** 2026-05-07

## Objective

Rastrear POCs (Proof of Concept) com ciclo de vida próprio (`ativa → convertida | perdida`) em uma aba dedicada no Google Sheets, correlacionando cada POC com seu deal Zoho via `deal_id`.

## Behavior

1. N8N cria/atualiza linhas na aba `pocs` da planilha (manual ou via Cron)
2. Cada linha representa uma POC com estado `ativa`, `convertida` ou `perdida`
3. O `deal_id` faz join com a aba `deals` — permite enriquecer deals com status POC
4. O Dashboard (rota futura `/poc` ou painel no Operacional) exibe métricas: total, ativas, taxa de conversão, duração média

## Business Rules

- Uma POC pode existir sem deal associado (deal_id vazio = POC pré-deal)
- Status `convertida` = POC resultou em fechamento; `perdida` = POC encerrada sem venda
- `data_fim_real` é preenchida apenas quando status muda de `ativa` para terminal
- `dias_em_poc` é calculado em runtime (não armazenado): `today - data_inicio` se ativa, `data_fim_real - data_inicio` se concluída
- `taxa_conversao = convertidas / (convertidas + perdidas) * 100` — exclui POCs ativas do denominador

## Schema da Aba `pocs` (Google Sheets)

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `poc_id` | TEXT | Sim | ID único (ex: `POC-001`). Chave de matching para upsert N8N. |
| `deal_id` | TEXT | Não | ID do deal no Zoho CRM. FK para `RawDeal.id`. Vazio = POC sem deal ainda. |
| `deal_nome` | TEXT | Não | Nome do deal (denormalizado para legibilidade). |
| `empresa` | TEXT | Sim | Nome da empresa cliente. |
| `data_inicio` | DATE | Sim | Data de início da POC (`YYYY-MM-DD`). |
| `data_fim_prevista` | DATE | Não | Prazo previsto (`YYYY-MM-DD`). |
| `data_fim_real` | DATE | Não | Data real de encerramento (`YYYY-MM-DD`). Vazio enquanto `status = ativa`. |
| `status` | TEXT | Sim | `ativa` \| `convertida` \| `perdida` |
| `descricao` | TEXT | Não | Escopo / objetivo da POC. |
| `responsavel` | TEXT | Sim | Vendedor / dono interno. |
| `resultado` | TEXT | Não | Notas: motivo de perda, valor convertido, etc. |
| `created_time` | DATE | Sim | Data de criação da linha (`YYYY-MM-DD`). |
| `modified_time` | DATE | Sim | Última modificação (`YYYY-MM-DD`). |

**Ordem das colunas (obrigatória para o N8N node schema):**
```
poc_id | deal_id | deal_nome | empresa | data_inicio | data_fim_prevista | data_fim_real | status | descricao | responsavel | resultado | created_time | modified_time
```

## Correlação com Deal

A correlação é feita via `deal_id` (campo da aba `pocs`) ↔ `id` (campo da aba `deals`).

No código TypeScript (`src/lib/metrics.ts` ou rota futura `/api/poc`):

```typescript
// Enrichment pattern (igual ao usado em enrichDealsWithActivities)
const pocByDealId = new Map<string, Poc>();
for (const poc of parsedPocs) {
  if (poc.deal_id) pocByDealId.set(poc.deal_id, poc);
}

// Ao enriquecer um deal:
const poc = pocByDealId.get(deal.id);
const pocStatus = poc?.status ?? null;
```

## TypeScript Types Implementados

Em `src/lib/types.ts`:

- `PocStatus` — union type `'ativa' | 'convertida' | 'perdida'`
- `RawPoc` — campos opcionais diretos da planilha (strings brutas)
- `Poc` — versão processada com campos tipados e `dias_em_poc` calculado
- `PocMetrics` — métricas agregadas: total, ativas, convertidas, perdidas, `taxa_conversao`, `duracao_media_dias`

## Parse de RawPoc → Poc

```typescript
function parsePoc(raw: RawPoc, today: string): Poc {
  const status = (['ativa', 'convertida', 'perdida'].includes(raw.status ?? '')
    ? raw.status as PocStatus
    : 'ativa');

  const dataInicio = raw.data_inicio ?? '';
  const dataFimReal = raw.data_fim_real || null;

  const diasEmPoc = dataInicio
    ? Math.floor(
        (new Date(dataFimReal ?? today).getTime() - new Date(dataInicio).getTime())
        / 86_400_000
      )
    : 0;

  return {
    poc_id: raw.poc_id ?? '',
    deal_id: raw.deal_id ?? '',
    deal_nome: raw.deal_nome ?? '',
    empresa: raw.empresa ?? '',
    data_inicio: dataInicio,
    data_fim_prevista: raw.data_fim_prevista || null,
    data_fim_real: dataFimReal,
    status,
    descricao: raw.descricao ?? '',
    responsavel: raw.responsavel ?? '',
    resultado: raw.resultado ?? '',
    created_time: raw.created_time ?? '',
    modified_time: raw.modified_time ?? '',
    dias_em_poc: Math.max(0, diasEmPoc),
  };
}
```

## Edge Cases

- `deal_id` vazio → POC sem deal; não enriquecer nenhum deal, mas incluir nas métricas
- `status` com valor inválido → default `'ativa'`
- `data_inicio` inválida → `dias_em_poc = 0`
- Mesmo `deal_id` em múltiplas POCs → usar a mais recente (`modified_time` desc)
- POC ativa sem `data_fim_real` → `dias_em_poc` calculado até hoje

## Acceptance Criteria

- [x] `RawPoc`, `Poc`, `PocStatus`, `PocMetrics` definidos em `src/lib/types.ts`
- [x] Schema da aba `pocs` documentado com 13 colunas e ordem correta
- [x] Lógica de correlação `deal_id → deal` documentada
- [x] Parse `RawPoc → Poc` documentado com tratamento de edge cases
- [ ] Aba `pocs` criada na planilha (N8N / manual)
- [ ] Rota `/api/poc` implementada (task futura)
- [ ] UI de POCs no dashboard (task futura)

## Technical Decisions

- Schema mantém `deal_nome` denormalizado na aba para legibilidade humana direta na planilha (mesmo que seja redundante com a aba `deals`)
- `status` armazenado como TEXT (não enum) na planilha — validação feita no parse TypeScript
- `poc_id` usado como `matchingColumns` no N8N Sheets node (upsert idempotente)
- `PocMetrics.taxa_conversao` exclui POCs ativas do denominador (igual à definição padrão de win rate)

## Dependencies

- Depende de: aba `deals` da planilha (para enriquecimento)
- Bloqueia: rota `/api/poc`, painel POC no dashboard, widget de "POCs em andamento" no Operacional
