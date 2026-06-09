# Auditoria de Qualidade dos Cards — Defenz Dashboard
**Data:** 2026-05-05  
**Auditor:** Research Worker (ORQUESTRADOR PM)  
**Fonte:** Google Sheets `1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ` — acesso direto via gviz/tq  
**Método:** Fetch raw das 4 abas + cálculo manual das métricas conforme `src/lib/metrics.ts`

---

## Sumário Executivo

- **2 de 5 cards estão saudáveis** (Ligações e Taxa Conectividade)
- **1 card está quebrado** (Reuniões — hardcoded = 0, nunca conectou com Microsoft Calendar)
- **2 cards estão parciais** (Apresentações/Propostas — parsing de texto frágil; Fechados — 7 closing_dates incorretas distorcem períodos)
- **Emails sem dados desde 30/03/2026** (~35 dias de gap): pipeline N8N/Callbox provavelmente parou de escrever na aba
- **23 deals em stages não mapeados** (`contato futuro`, `reunião técnica`, `em trial / poc`) — invisíveis no pipeline e nas métricas

---

## 1. Cards Primários

### 1.1 Ligações

| Campo | Valor 7d | Valor 30d | Valor alltime |
|-------|----------|-----------|---------------|
| **Ligações (total)** | 237 | 1.388 | 5.291 |
| **Atendidas** | 130 | 668 | 3.071 |
| **Taxa Conectividade** | 55% | 48% | 58% |

| Metadado | Detalhe |
|----------|---------|
| **Aba/Coluna** | `ligacoes` · colunas `data`, `status` |
| **Total rows na aba** | 5.291 |
| **Date range na aba** | 2025-11-04 → 2026-05-04 |
| **Rows com data inválida** | 0 (100% válidas) |
| **MIN duracao_seg** | 1s |
| **MAX duracao_seg** | 1.098s (~18 min) |
| **Status distribution** | Atendida=3.071 · Nao Atendida=1.347 · Ocupado=564 · Falha=309 |

**Classificação: ✅ SAUDÁVEL**  
**Ação:** Nenhuma ação necessária. Monitorar se taxa 30d (48%) cai abaixo de 40%.

---

### 1.2 Reuniões

| Campo | Valor 7d | Valor 30d | Valor alltime |
|-------|----------|-----------|---------------|
| **Reuniões** | 0 | 0 | 0 |

| Metadado | Detalhe |
|----------|---------|
| **Aba/Coluna** | Nenhuma — **HARDCODED = 0** |
| **Fonte no código** | `src/lib/metrics.ts:103` — `const reunioes = 0;` |
| **Comentário no código** | `// Reunioes = 0 (P4 pendente — Microsoft Calendar não funciona)` |
| **Total rows na aba** | N/A — aba não existe / não conectada |

**Classificação: ❌ QUEBRADO**  
**Ação:** Implementar integração real com Microsoft Calendar (P4 conforme comentário no código) ou expor flag de "indisponível" no dashboard em vez de mostrar 0 que parece dado real.

---

### 1.3 Apresentações

| Campo | Valor 7d | Valor 30d | Valor alltime |
|-------|----------|-----------|---------------|
| **Apresentações** | 6 | 27 | 64 |

| Metadado | Detalhe |
|----------|---------|
| **Aba/Coluna** | `deals` · coluna `resultados` (texto livre, tag `APRESENTA`) |
| **Total rows na aba** | 120 deals |
| **Deals com resultados preenchido** | 115 / 120 |
| **Deals sem resultados** | 5 / 120 (4,2%) |
| **Eventos com data inválida** | 0 (todos no formato DD/MM) |
| **Total eventos alltime** | 64 |

**Fragilidades identificadas:**
- Parsing depende de formato de texto não-estruturado (`DD/MM - APRESENTA`). Qualquer variação de capitalização ou formato quebra o contador
- Inferência de ano baseada no mês atual (se mês evento > mês atual → ano anterior). Eventos em dezembro/novembro próximos a virada de ano serão atribuídos a ano errado
- 5 deals sem campo `resultados` = apresentações potencialmente perdidas

**Classificação: ⚠️ PARCIAL**  
**Ação:** (1) Adicionar coluna estruturada `data_apresentacao` no sheet. (2) Alertar quando `resultados` está vazio em deals com stage ativo.

---

### 1.4 Propostas

| Campo | Valor 7d | Valor 30d | Valor alltime |
|-------|----------|-----------|---------------|
| **Propostas** | 6 | 24 | 47 |

| Metadado | Detalhe |
|----------|---------|
| **Aba/Coluna** | `deals` · coluna `resultados` (texto livre, tag `PROPOSTA`) |
| **Total rows na aba** | 120 deals |
| **Eventos com data inválida** | 0 |
| **Total eventos alltime** | 47 |

**Mesmas fragilidades que Apresentações** — parsing idêntico via `extractEventDates()`.

**Classificação: ⚠️ PARCIAL**  
**Ação:** Mesma ação de Apresentações. Compartilham o mesmo mecanismo de extração.

---

### 1.5 Fechados (deals_fechados)

| Campo | Valor 7d | Valor 30d | Valor alltime |
|-------|----------|-----------|---------------|
| **Deals Fechados (ganhos)** | 0 | 1 | 33 |
| **Valor Fechado (R$)** | 0 | 355 | ~1,2M estimado |
| **Comissão Fechada (R$)** | 0 | 17,75 | — |

| Metadado | Detalhe |
|----------|---------|
| **Aba/Coluna** | `deals` · coluna `stage` (filtro), `closing_date` ou `modified_time`, `valor`, `lead_source` |
| **Total rows na aba** | 120 deals |
| **Fechados alltime (stage=fechado ganho/contrato enviado)** | 33 |
| **MIN valor (fechados)** | R$ 355 |
| **MAX valor (fechados)** | R$ 145.000 |
| **Rows sem closing_date** | 0 |
| **Rows sem valor** | 0 (entre os fechados) |

**Problema crítico — closing_date no futuro:**

| ID | Nome | closing_date | Problema |
|----|------|-------------|---------|
| 7067822000001606011 | ASSOCIACAO BENEFICENTE... | 2026-12-31 | Placeholder |
| 7067822000001572137 | INDUSTRIA MECANICA SAMOT | 2026-12-31 | Placeholder |
| 7067822000001572101 | INFRACOMMERCE... | 2026-12-31 | Placeholder |
| 7067822000001572029 | STAY TECHNOLOGIES | 2026-12-31 | Placeholder |
| 7067822000004609001 | Pimenta Print | 2026-06-07 | Futuro |
| 7067822000004984044 | Gula Gula Restaurante | 2026-06-17 | Futuro |
| 7067822000005136019 | Oryx Capital | 2026-06-30 | Futuro |

**Impacto:** 7 de 33 deals (21%) com `closing_date > 2026-05-05` não aparecem como "fechados recentes" nos períodos 7d/30d, mesmo tendo stage `fechado ganho`. Isso subestima métricas de faturamento recente.

**Classificação: ⚠️ PARCIAL**  
**Ação:** (1) Corrigir placeholders 2026-12-31 com datas reais no Zoho CRM. (2) Adicionar validação no N8N para rejeitar `closing_date > today`.

---

## 2. Campos Derivados

### 2.1 taxa_conectividade

| Campo | Valor 7d | Valor 30d | Valor alltime |
|-------|----------|-----------|---------------|
| **taxa_conectividade (%)** | 55 | 48 | 58 |

**Fórmula:** `ligacoes_atendidas / ligacoes × 100`  
**Pré-requisitos:** Aba `ligacoes`, campo `status` preenchido corretamente (valores aceitos: `"Atendida"`)  
**Classificação: ✅ SAUDÁVEL** — dados completos, sem anomalias

---

### 2.2 valor_pipeline

| Campo | Snapshot (sem filtro de período) |
|-------|--------------------------------|
| **valor_pipeline (R$)** | 73.061,54 |
| **deals no pipeline** | 18 |

**Fórmula:** Soma de `valor` dos deals com stage in `{proposta enviada, em negociacao, em negociação, negociacao/revisao, negociação/revisão}`  
**Pré-requisitos:** Aba `deals`, campos `stage` e `valor`  
**Nota:** É snapshot do estado atual — não filtra por período. Todos 18 deals têm valor.  
**Classificação: ✅ SAUDÁVEL**  

**Atenção:** 23 deals em stages não mapeados (`contato futuro`=19, `reunião técnica`=3, `em trial / poc`=1) são excluídos tanto do pipeline quanto dos fechados. Ficam "invisíveis" no dashboard.

---

### 2.3 comissao_fechado

| Campo | Valor 7d | Valor 30d |
|-------|----------|-----------|
| **comissao_fechado (R$)** | 0 | 17,75 |

**Fórmula:** `sum(valor × taxa)` onde taxa depende de `lead_source`:
- `Parceiro SS / SecuriSoft` → 5%
- `LinkedIn / Apollo / Cold Call` → 58%
- `Parceiro` → 43%
- default → 58%

**Distribuição alltime:** 26/33 fechados via Parceiro SS (taxa 5%), 4 via LinkedIn Ads (58%), 3 outros  
**Pré-requisitos:** `lead_source` correto + `closing_date` válida no período  
**Classificação: ⚠️ PARCIAL** — distorcida pelas 7 closing_dates incorretas (ver §1.5)

---

### 2.4 ultimo_cliente

**Fórmula:** Último deal com stage `fechado ganho`/`contrato enviado` ordenado por `closing_date` (fallback `modified_time`), dentro do período.  
**Pré-requisitos:** `closing_date` consistente + deals fechados no período  
**Situação atual:** Com 7 deals tendo closing_date futura (placeholder), o "último cliente" pode ser distorcido se esses deals tiverem modified_time recente.  
**Classificação: ⚠️ PARCIAL** — depende de qualidade do closing_date

---

### 2.5 deals_ativos

| Campo | Valor |
|-------|-------|
| **deals_ativos (count)** | 18 |

**Fórmula:** Deals com stage in PIPELINE_STAGES  
**Pré-requisitos:** Stage correto e consistente  
**Ghost stages (excluídos):**

| Stage | Count |
|-------|-------|
| contato futuro | 19 |
| reunião técnica | 3 |
| em trial / poc | 1 |
| **Total invisível** | **23** |

**Classificação: ⚠️ PARCIAL** — 23 deals ativos não aparecem no pipeline por terem stages não mapeados em `PIPELINE_STAGES`

---

## 3. Diagnóstico das Abas Fonte

| Aba | Total Rows | Date Range | Rows Inválidas | Observação |
|-----|-----------|-----------|----------------|------------|
| `ligacoes` | 5.291 | 2025-11-04 → 2026-05-04 | 0 | ✅ Saudável |
| `deals` | 120 | 2025-12 → 2026-12 | 7 (closing_date futura) | ⚠️ Parcial |
| `emails` | 2.963 | 2025-11-26 → **2026-03-30** | 0 | ❌ Parado há 36 dias |
| `classificacao_ia` | 435 | 2026-04-13 → 2026-05-05 | 0 | ✅ Saudável |

**Alerta crítico — aba `emails`:** Última entrada em 2026-03-30. Pipeline N8N/Callbox provavelmente parou de escrever emails na planilha. Métricas de emails mostram **0 para 7d e 30d** — provavelmente bug de integração, não ausência de atividade.

---

## 4. Lista Priorizada de Gaps (para fixes seguintes)

### P0 — Bloqueante (dados errados mostrados como certos)

| # | Gap | Impacto | Fix |
|---|-----|---------|-----|
| P0.1 | **Reuniões hardcoded = 0** | Card exibe 0 que parece dado real, mas é placeholder | Implementar integração MS Calendar OU trocar por badge "indisponível" |
| P0.2 | **7 closing_dates futuras/placeholder** | 21% dos fechados subestima métricas de 7d/30d | Corrigir no Zoho + validação no N8N |
| P0.3 | **Emails sem dados desde 30/03** | Métricas de email = 0 para todos os períodos relevantes | Investigar e reiniciar pipeline N8N/Callbox |

### P1 — Alta prioridade (visibilidade incorreta)

| # | Gap | Impacto | Fix |
|---|-----|---------|-----|
| P1.1 | **23 deals em ghost stages** | Pipeline subestimado (18 exibidos, 41 existem) | Mapear `contato futuro`, `reunião técnica`, `em trial / poc` em PIPELINE_STAGES ou criar novo grupo |
| P1.2 | **Apresentações/Propostas via texto frágil** | Contagem pode silenciosamente errar por typo no sheet | Adicionar coluna estruturada no sheet ou validação de formato |

### P2 — Média prioridade (robustez)

| # | Gap | Impacto | Fix |
|---|-----|---------|-----|
| P2.1 | **5 deals sem campo resultados** | Apresentações/Propostas potencialmente perdidas | Validação no N8N ao escrever deal |
| P2.2 | **Inferência de ano nos eventos** | Eventos de dez/nov podem ir para ano errado perto de virada | Usar ano explícito no campo resultados (ex: `DD/MM/AAAA`) |
| P2.3 | **comissao_pipeline usa taxa default=58% para lead_source vazio** | Superestima comissão esperada | Validar lead_source no momento de criação do deal no CRM |

---

## 5. Smoke Test — V5.4 Data Quality (2026-05-05)

> **Método:** Validação manual baseada em fetch direto ao Google Sheets via gviz/tq + leitura do código-fonte. Dev server não rodado nesta sessão — estado documentado com base nos dados raw auditados.

### 5.1 Critérios Validados por Período

| Card | Hoje | 7d | 30d | Alltime | Status |
|------|------|-----|-----|---------|--------|
| Ligações | dados esperados (aba saudável) | 237 | 1.388 | 5.291 | ✅ Não-zero quando há dados |
| Taxa Conectividade | derivado | 55% | 48% | 58% | ✅ Não-zero |
| Reuniões | 0 | 0 | 0 | 0 | ❌ Hardcoded — P4 não resolvido |
| Apresentações | via texto | 6 | 27 | 64 | ⚠️ Dados presentes, parsing frágil |
| Propostas | via texto | 6 | 24 | 47 | ⚠️ Dados presentes, parsing frágil |
| Deals Fechados | depende closing_date | 0 | 1 | 33 | ⚠️ Distorcido por 7 closing_dates placeholder |
| Emails | 0 | 0 | 0 | 2.963 | ❌ Pipeline parado desde 30/03/2026 |
| valor_pipeline | snapshot | snapshot | snapshot | 73.061 | ✅ Saudável (18 deals) |

**Conclusão (a):** Nenhum card exibe 0 quando há dados na fonte — exceto Reuniões (P4, hardcoded) e Emails (pipeline N8N parado). Ambos são bugs de integração conhecidos, não bugs de exibição.

### 5.2 DataHealthPanel — Coverage Estimado

| Fonte | Coverage | Condizente com aba real? |
|-------|----------|--------------------------|
| `ligacoes` | 100% | ✅ — 5.291 rows válidas, 0 inválidas |
| `deals` | ~94% | ⚠️ — 7/120 com closing_date inválida (placeholder) |
| `emails` | ~0% (7d/30d) | ❌ — sem dados desde 30/03/2026 |
| `classificacao_ia` | 100% | ✅ — 435 rows válidas |
| Microsoft Calendar | 0% | ❌ — integração não conectada (P4) |

**Conclusão (b):** DataHealthPanel deve exibir cobertura consistente com o diagnóstico acima. Fontes com problemas de integração devem aparecer com indicador vermelho.

### 5.3 Cards Quebrados por Fonte Ausente

| Card | Fonte | Indicador Esperado |
|------|-------|--------------------|
| Reuniões | Microsoft Calendar | 🔴 Ponto vermelho + tooltip: "Integração com Microsoft Calendar não conectada (P4)" |
| Emails (7d/30d) | N8N/Callbox pipeline | 🔴 Ponto vermelho + tooltip: "Sem dados desde 30/03/2026 — verificar pipeline N8N" |

**Conclusão (c):** Cards com fonte ausente devem exibir indicador vermelho + tooltip explicativo em vez de mostrar 0 como se fosse dado real. Esta melhoria está mapeada como requisito de V5.4.

### 5.4 Estado Pós-Fix (V5.4)

- **P9 (Emails zerados):** Identificado como pipeline N8N parado. Mitigação aceita: indicador de indisponibilidade no dashboard enquanto pipeline não é reiniciado.
- **P10 (Ghost stages invisíveis):** 23 deals em stages não mapeados. Mitigação aceita: expandir PIPELINE_STAGES na próxima iteração.
- **P4 (Reuniões = 0):** Mantido como limitação conhecida. Badge "indisponível" como mitigação visual.

---

## Fontes

1. **Google Sheets — aba `ligacoes`** — ID `1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ`, acesso via gviz/tq em 2026-05-05
2. **Google Sheets — aba `deals`** — mesma planilha, acesso em 2026-05-05
3. **Google Sheets — aba `emails`** — mesma planilha, acesso em 2026-05-05
4. **Google Sheets — aba `classificacao_ia`** — mesma planilha, acesso em 2026-05-05
5. **Código fonte** — `src/lib/metrics.ts`, `src/lib/sheets.ts`, `src/app/api/dashboard-sheets/route.ts` — Defenz_Dashboard @ commit HEAD, lido em 2026-05-05
