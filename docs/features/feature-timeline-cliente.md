# Spec (aterrissada) — Timeline do Cliente / Negócio (Defenz Dashboard)

> **Origem:** brainstorm do Marcos ("Spec Timeline do Cliente"), reescrita **contra o código real**.
> **Achados:** (1) o parser de `Resultados` **já existe** (`extractEventDatesAnchored`, com inferência de ano);
> (2) o texto `Resultados` **já chega via Sheets** por deal; (3) a convenção `dd/mm` **NÃO é universal** no dado real
> (o SDR escreve "9 de junho (16:34)"), então o parser tem que ser híbrido; (4) **não há `Stage_History` no Sheets**,
> então mudança-de-estágio com "tempo parado" fica fora do MVP.

## 1. Objetivo
Abrir um **cliente (Account)** e ver a jornada do negócio: o que o Marcos/SDR escreveu, datado, mais âncoras estruturais (criado/ganho/perdido). Chave = cliente, agregando os deals dele (cada deal = uma raia).

## 2. Realidade do código (reusar)
| Preciso de… | Já existe | Onde |
|---|---|---|
| Parser de data em `Resultados` + inferência de ano | `extractEventDatesAnchored(resultados, tag, referenceDate)` — lógica `mês > refMês → ano-1` | `metrics.ts:91` |
| Texto `Resultados` por deal | `RawDeal.resultados` (do Sheets) | `types.ts:65` |
| Deals por empresa | filtrar `RawDeal[]` por `empresa`/`nome` | pipeline atual |
| Ganho/Perdido | `isClosedWon()` / `isClosedLost()` | `metrics.ts:14,18` |

## 3. 🚩 Parser de `Resultados` — o que o dado REAL exige
A spec original travou "cada entrada prefixada por `dd/mm` (CONFIRMADA)". Amostrando o campo real, **quebra**:
- ✅ Entradas de ligação (Marcos): `17/06 -`, `24/06 —`, `18/06 -`.
- ❌ Entradas do SDR (Leonardo): `9 de junho (16:34) —`, `17 de junho (terça-feira)` → dia por extenso e/ou 1 dígito. O regex atual `/(\d{2})\/(\d{2})/` **descarta essas**.

**Parser híbrido (recomendado):**
1. **Fast-path determinístico:** generalizar o `extractEventDatesAnchored` — tirar o filtro de `tag` (pegar TODA entrada datada, não só `[TAG]`) e ampliar o regex p/ aceitar dia de 1–2 dígitos. Reusa a **inferência de ano** que já está pronta.
2. **Fallback Sonnet:** blocos que não casam o fast-path (data por extenso) vão pra extração via LLM (LLM extrai a data, JS ordena/calcula). Alinhado à regra do projeto: `Resultados` → sempre Sonnet, nunca só regex.
3. **Split multi-linha:** cada data inicia uma entrada; texto vai até a próxima data → `result_log` com `ts` + `detail` (texto cru).

## 4. Fontes → eventos (o que É sourceável hoje)
| Fonte | Vira evento | Disponível via Sheets? |
|---|---|---|
| `Resultados` (parse §3) | `result_log` | ✅ conteúdo principal |
| `created_time` | `created` | ✅ |
| `stage` + `closing_date` (via `isClosedWon`/`isClosedLost`) | `won` / `lost` | ✅ |
| `Stage_History` (tempo parado no estágio) | `stage_change` | ❌ **não está no Sheets** → fora do MVP (precisaria pull Zoho dedicado) |
| Activities (Calls/Tasks/Notes) | — | ❌ fora do MVP (enriquecimento futuro) |

## 5. Modelo normalizado (a UI só conhece `TimelineEvent[]`)
```ts
type TimelineEvent = {
  id: string
  client_id: string   // empresa (Account)
  deal_id: string     // raia
  ts: string          // ISO; result_log = data parseada (§3)
  type: 'result_log' | 'created' | 'won' | 'lost'   // 'stage_change'/'amount_change' = fora do MVP
  title: string
  detail?: string     // result_log = texto cru
  source: string
  meta?: Record<string, any>
}
```
Montagem: por cliente → seus deals → (parse Resultados → result_log[]) + (created/won/lost) → merge + sort `ts` desc.

## 6. Fetch (on-demand)
- Reusa os deals **já carregados** (filtra por empresa). Se precisar de leitura dedicada, cache curto (5–15 min).
- **Sem Zoho direto, sem Neon.** Se um dia quisermos `stage_change` real, aí sim entra um pull Zoho `Stage_History` — decisão de Fase futura, sem mudar o contrato `TimelineEvent`.

## 7. Telas
- **Overview por período:** lista de clientes com deal fechado/ativo no período → nome · nº negócios · Σ ganho · Σ aberto · último `result_log`. Clique → timeline.
- **Timeline do cliente:** header (cliente, totais ganho/aberto/perdido, nº negócios) + linha do tempo vertical (mais recente no topo), agrupada por negócio quando houver >1. Conteúdo principal = `result_log`; `won`/`lost`/`created` como âncoras. Filtro por tipo.

## 8. Faseamento
1. Parser híbrido (§3) + `result_log` + `created/won/lost` → timeline por cliente.
2. Overview por período + deep-links do Farol/dashboard (`?client_id=`).
3. (futuro) `Stage_History` via Zoho + Activities + ligações Callbox/3CX como eventos.
> No roadmap: **Farol (Fase 1) sobe primeiro**; esta timeline é posterior.

## 9. Reality-check vs spec original
- ❌ "convenção dd/mm confirmada/universal" → **falso no dado real**; parser híbrido obrigatório (§3).
- ❌ `Stage_History`/`amount_change` no MVP → **não sourceável via Sheets**; movido p/ futuro.
- ❌ Neon `timeline_cache` / Zoho direto → não há banco; on-demand sobre dados já carregados.
- ⚠️ `actor`/owner: a aba `deals` tem footgun em `owner` (pode vir vazio) → não depender dele no MVP.
- ✅ Chave = `Account` (empresa), raia por deal → mantido.
- ✅ Reusa a inferência de ano que a spec reinventou (já pronta em `extractEventDatesAnchored`).

## 10. Itens abertos
- [ ] Validar o parser híbrido num deal longo real (>12 meses) p/ o edge de ano.
- [ ] Confirmar que o `Resultados` no Sheet vem **completo** (não truncado) — se truncar, timeline precisa de pull Zoho por cliente.
- [ ] Custo/latência do fallback Sonnet: cachear o resultado do parse por deal (por `modified_time`).
