# Indice de Confiabilidade dos Dados — Defenz Dashboard

> **Data:** 2026-04-06
> **Versao Dashboard:** V4.0
> **Score Global:** 62/100

---

## O que e este documento?

Este documento avalia **quao confiaveis sao os dados exibidos no Dashboard hoje**. Cada metrica recebe um score de 0 a 100 baseado em 5 dimensoes:

| Dimensao | Peso | O que mede |
|----------|------|------------|
| **Fonte** | 25% | O dado vem direto da fonte original ou passou por transformacoes? |
| **Validacao** | 20% | Existe checagem de consistencia, tipo, range? |
| **Frescor** | 20% | O dado reflete a realidade atual ou pode estar defasado? |
| **Transparencia** | 15% | O usuario sabe de onde veio o dado e quando foi atualizado? |
| **Fallback** | 20% | O que acontece quando a fonte falha? O erro e visivel? |

### Escala de Confianca

| Score | Nivel | Significado |
|-------|-------|-------------|
| 80-100 | **ALTA** | Dado confiavel para decisoes de negocio |
| 60-79 | **MEDIA** | Dado util mas requer validacao cruzada |
| 40-59 | **BAIXA** | Dado indicativo, nao usar para decisoes criticas |
| 0-39 | **CRITICA** | Dado potencialmente incorreto ou ausente |

---

## Resumo por Area

| Area | Score | Status |
|------|-------|--------|
| Ligacoes (Callbox) | **78** | MEDIA |
| Emails (Apollo) | **75** | MEDIA |
| Reunioes (Microsoft) | **15** | CRITICA |
| Funil (Apresentacoes/Propostas) | **65** | MEDIA |
| Deals Fechados / Receita | **72** | MEDIA |
| Comissoes | **58** | BAIXA |
| Win Rate | **60** | MEDIA |
| Pipeline (ativos) | **70** | MEDIA |
| Correlacao de Atividades | **0** | CRITICA |
| Nome da Empresa | **20** | CRITICA |
| Parceiros | **10** | CRITICA |

**Score Global Ponderado: 62/100 (MEDIA)**

---

## Analise Detalhada por Metrica

### 1. LIGACOES — Score: 78/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 90 | Callbox API → N8N → Sheets `ligacoes_raw` (3.885 registros). Dado bruto real. |
| Validacao | 70 | `Math.max(0, num(...))`. Consistency check compara `taxa_conectividade` calculada vs informada (2% tolerancia). Avisa mas nao corrige. |
| Frescor | 75 | Cron N8N 6am/18pm + cache 30min API + cache 30min client. Defasagem maxima: ~12h30. |
| Transparencia | 65 | Badge de fonte (Cache/Planilha/N8N/Mock) existe, mas sem timestamp de "ultima atualizacao". |
| Fallback | 85 | Cascade: Sheets → N8N → Mock. Mock gera dados proporcionais ao periodo (detectavel pelo badge cinza). |

**Riscos:**
- Valor pre-agregado pela aba `metricas` no N8N. Se o Consolidar calcular errado, o dashboard herda o erro.
- Callbox pode ter paginacao incompleta (1000 records/pagina) — se ultrapassar, dados truncados.

---

### 2. EMAILS — Score: 75/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 85 | Apollo API → N8N → Sheets `emails_raw` (2.963 registros). Dado bruto real. |
| Validacao | 65 | Non-negative enforcement. Sem check de duplicatas ou consistencia com `emails_raw`. |
| Frescor | 75 | Mesmo ciclo: Cron 6am/18pm. |
| Transparencia | 65 | Badge de fonte. Sem timestamp. |
| Fallback | 85 | Cascade completa. |

**Riscos:**
- Header `emails ` tem espaco trailing na planilha (key no N8N = `"emails "`). Ja conhecido e tratado, mas fragil.
- Apollo `completed_at` e o filtro — emails agendados mas nao enviados nao contam.

---

### 3. REUNIOES — Score: 15/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 0 | Microsoft Calendar retorna **0 reunioes** consistentemente. Token OAuth possivelmente expirado. |
| Validacao | 50 | Non-negative enforcement funciona, mas valida "0" como correto. |
| Frescor | 0 | Dado esta zerado. Nao reflete realidade. |
| Transparencia | 20 | Dashboard mostra "0" sem indicar que a fonte esta quebrada. Usuario pode achar que nao houve reunioes. |
| Fallback | 0 | Nao ha fallback. Zero e aceito silenciosamente. |

**Problema P4 — NAO RESOLVIDO:**
- URL corrigida de `/me/calendar/calendarView` para `/me/calendarView`
- Token Microsoft pode estar expirado
- Eventos Teams podem estar em calendario separado
- **Impacto:** Funil mostra 0 reunioes. Toda conversao apos "Ligacoes" fica artificialmente alta.
- **Acao necessaria:** Verificar manualmente no N8N (nao e possivel remotamente)

---

### 4. FUNIL (Apresentacoes + Propostas) — Score: 65/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 70 | Zoho Deals → N8N Consolidar V4.0. Snapshot (sem filtro temporal). |
| Validacao | 60 | Non-negative. Sem check cruzado com deals_ativos. |
| Frescor | 65 | Cron 6am/18pm. Snapshot reflete estado atual, nao historico. |
| Transparencia | 60 | Valores corretos para alltime (37 apres, 34 prop). Sem breakdown por periodo real. |
| Fallback | 70 | Mock gera proporcionalmente. |

**Riscos:**
- Apresentacoes dependem de tag `[APRESENTACAO]` no campo Resultados do Zoho. Se vendedor nao taguear, nao conta.
- Propostas: Stage = "Proposta Enviada" OU tag `[PROPOSTA]`. Dupla fonte pode causar contagem dupla se deal tiver ambos.
- **Fix V4.0 aplicado:** Antes usava `Created_Time` (errado). Agora usa snapshot. Melhoria significativa.

---

### 5. DEALS FECHADOS / RECEITA — Score: 72/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 85 | Zoho Deals com Stage CLOSED_WON → Sheets `clientes_fechados`. Dado direto. |
| Validacao | 65 | Non-negative. Custom ranges recomputam de raw data (bom). Sem validacao de valores individuais. |
| Frescor | 70 | Cron 6am/18pm. Deals fechados durante o dia so aparecem na proxima execucao. |
| Transparencia | 70 | Tabela mostra deals individuais com nome, valor, data. Verificavel. |
| Fallback | 70 | Custom ranges usam `clientes_fechados` raw (independente da aba metricas). |

**Dados validados (03/04):**
- Alltime: 17 fechados, R$279k — **verificado manualmente na planilha**
- 30d: 3 fechados, R$152k

**Riscos:**
- `valor` individual dos deals nao validado (pode ter negativos ou outliers extremos)
- Data de fechamento depende de `Modified_Time` no Zoho — pode nao refletir data real do contrato

---

### 6. COMISSOES — Score: 58/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 55 | Pre-calculada no N8N Consolidar com `classifyOrigin()`. Logica de negocio em no-code. |
| Validacao | 50 | Non-negative. Sem reverse-check (comissao / valor = taxa esperada?). |
| Frescor | 65 | Mesmo ciclo. |
| Transparencia | 55 | Tooltip mostra taxas (58%, 43%, 5%) mas sem breakdown por deal. Impossivel auditar. |
| Fallback | 65 | Custom ranges recomputam `comissao_valor` de cada deal. |

**Riscos:**
- `classifyOrigin()` vive no N8N (nao testavel). Sera migrada para `metrics.ts`.
- Lead_Source incorretos no Zoho (ex: JRC Law = "Parceiro" mas deveria ser "Direto"). Afeta comissao.
- Taxas hardcoded no frontend (`formatters.ts` linhas 59-64). Se taxa mudar, precisa deploy.

---

### 7. WIN RATE — Score: 60/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 60 | Pre-calculado no N8N: `won / (won + lost) * 100`. |
| Validacao | 55 | Bounded [0, 100]. Sem reverse-check contra dados raw. |
| Frescor | 65 | Cron 6am/18pm. |
| Transparencia | 55 | Mostra % mas nao mostra won/lost breakdown. |
| Fallback | 65 | Mock gera valor plausivel. |

**Fix V4.0 aplicado:** CLOSED_LOST expandido para incluir "Fechado perdido para a concorrencia", variantes de case, "Perdido". Antes retornava `None`. Agora: 77% alltime, 75% 30d, 50% 7d — **numeros plaussiveis e verificados**.

**Risco residual:** Se novo Stage de perda for criado no Zoho sem atualizar N8N, win rate infla silenciosamente.

---

### 8. PIPELINE (Deals Ativos) — Score: 70/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 80 | Zoho Deals → Sheets `deals_ativos`. Dado raw direto. |
| Validacao | 65 | Consistency check `deals_novos` vs `deals_ativos.length`. Avisa mas nao corrige. |
| Frescor | 65 | Cron 6am/18pm. Fix P1 aplicado: "Clear Deals Ativos" limpa antes de reescrever. |
| Transparencia | 70 | Tabela mostra cada deal com valor, stage, empresa. |
| Fallback | 70 | Date filtering permissivo: se data malformada, deal e incluido (false positive). |

**Fix P1 aplicado:** Antes acumulava registros (83 → 43 apos fix). Clear node roda antes dos splits.

---

### 9. CORRELACAO DE ATIVIDADES — Score: 0/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 0 | `correlateLeads()` existe em `src/lib/correlate.ts` (254 linhas) mas **NAO e chamado** por nenhuma API route ou componente do dashboard. |
| Validacao | 0 | N/A — funcao nao executada. |
| Frescor | 0 | N/A. |
| Transparencia | 0 | Dashboard operacional mostra atividades mas sem correlacao real lead↔call↔email. |
| Fallback | 0 | N/A. |

**Problema P5 — NAO RESOLVIDO:**
- Correlacao no N8N (por Who_Id) falhou: Callbox usa campo "destino" sem relacao com Zoho IDs.
- Motor Vercel pronto (`correlate.ts`: dual-key phone 8+9 digitos, domain fallback) mas nao integrado.
- **Impacto:** Timeline de atividades no Operacional mostra dados, mas sem associacao lead↔atividade.

---

### 10. NOME DA EMPRESA — Score: 20/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 30 | `Account_Name` do Zoho retorna `""` (string vazia) em muitos deals. |
| Validacao | 0 | Operador `\|\|` nao pega string vazia. Dashboard mostra "-" para todos. |
| Frescor | 30 | Dado existe no Zoho mas chega vazio via N8N. |
| Transparencia | 10 | Usuario ve "-" sem saber se e dado ausente ou empresa sem nome. |
| Fallback | 20 | Nenhum fallback implementado. |

**Problema P6 — NAO RESOLVIDO:**
- Fix trivial: `.trim().length > 0` check no Vercel.
- Sera aplicado junto com `metrics.ts`.

---

### 11. PARCEIROS — Score: 10/100

| Dimensao | Score | Detalhe |
|----------|-------|---------|
| Fonte | 0 | **HARDCODED** em `dashboard-sheets/route.ts` linhas 217-220: `["SecuriSoft", "EXHTech", "AlphaNetworking", "Adriano", "Otavio"]`. Nunca atualizado. |
| Validacao | 0 | Consistency check `total === lista.length` sempre passa (5 == 5) porque e estatico. |
| Frescor | 0 | Lista nunca muda. |
| Transparencia | 30 | Aparece no dashboard sem indicar que e estatico. |
| Fallback | 0 | N/A — nao tem fonte real. |

**Nota:** Card de parceiros foi removido do layout V4.0 (componente existe mas nao e importado). Score afeta pouco o dashboard atual.

---

## Problemas Transversais

### 1. Fallback Silencioso para Mock Data

Quando Google Sheets falha, o dashboard carrega **dados mock sem aviso prominente**. O badge "Mock" (cinza) existe mas e discreto. O usuario pode tomar decisoes baseado em dados sinteticos sem perceber.

**Severidade:** ALTA
**Mitigacao sugerida:** Banner vermelho "MODO DEMONSTRACAO — dados nao sao reais" quando `dataSource === 'mock'`.

### 2. Sem Timestamp de Atualizacao

Nenhuma tela mostra "Dados atualizados em: 06/04/2026 06:00". O usuario nao sabe se esta vendo dados de 5 minutos ou 12 horas atras.

**Severidade:** ALTA
**Mitigacao sugerida:** Exibir `_cached_at` ou hora da ultima execucao do Cron N8N.

### 3. Metricas Pre-Agregadas sem Auditoria

A aba `metricas` da planilha contem valores ja calculados pelo N8N (Consolidar). O dashboard confia nesses valores sem recalcular. Se o Consolidar tiver bug, o dashboard herda silenciosamente.

**Severidade:** MEDIA
**Mitigacao:** `metrics.ts` recalculara tudo a partir de dados raw — eliminando dependencia do Consolidar.

### 4. Filtros Custom vs Presets

Filtros preset (7d, 30d, mes) usam valores pre-agregados da planilha. Filtros custom recomputam de dados raw. **Os dois caminhos podem gerar numeros diferentes para o mesmo periodo**, causando confusao.

**Severidade:** MEDIA
**Mitigacao:** Unificar tudo via `metrics.ts` (sempre recomputar de raw).

---

## Plano de Melhoria de Confiabilidade

### Fase 1: Quick Wins (1-2h) — Score esperado: 68/100

| Acao | Metricas afetadas | Impacto |
|------|-------------------|---------|
| Banner "MODO DEMO" quando mock | Todas | Transparencia +10 |
| Timestamp "Ultima atualizacao" no header | Todas | Transparencia +8 |
| Fix empresa `.trim()` | Nome empresa | +60 pontos nessa metrica |
| Remover parceiros hardcoded (ou buscar de sheet) | Parceiros | +50 pontos nessa metrica |

### Fase 2: `metrics.ts` (3-4h) — Score esperado: 78/100

| Acao | Metricas afetadas | Impacto |
|------|-------------------|---------|
| Recomputar tudo de dados raw | Comissoes, Win Rate, Pipeline, Funil | Fonte +20, Validacao +15 |
| Unificar preset vs custom path | Todas | Consistencia +10 |
| Reverse-check comissao/taxa | Comissoes | Validacao +15 |
| Integrar `correlateLeads()` | Correlacao | De 0 → 65+ |

### Fase 3: Infraestrutura (2-3h) — Score esperado: 85/100

| Acao | Metricas afetadas | Impacto |
|------|-------------------|---------|
| Resolver P4 (Microsoft Calendar) | Reunioes | De 15 → 70+ |
| Schema validation nos dados da planilha | Todas | Validacao +10 |
| Cache com metadata (`_cached_at`, `_ttl`) | Todas | Transparencia +10 |
| Vitest para `metrics.ts` e `correlate.ts` | Todas computadas | Validacao +10 |

---

## Como Interpretar o Score Global

```
HOJE:     62/100 ████████████░░░░░░░░  MEDIO — util para acompanhamento, nao para decisoes criticas
FASE 1:   68/100 █████████████░░░░░░░  MEDIO — transparencia melhorada, usuario sabe o que confia
FASE 2:   78/100 ███████████████░░░░░  MEDIO-ALTO — dados recomputados e auditaveis
FASE 3:   85/100 █████████████████░░░  ALTO — dados confiaveis para decisoes de negocio
```

**Conclusao:** O Dashboard e util HOJE para acompanhamento diario e tendencias. Para decisoes financeiras (comissoes, metas), os dados devem ser validados cruzando com Zoho CRM ate que `metrics.ts` esteja operacional e os problemas P4/P5/P6 resolvidos.
