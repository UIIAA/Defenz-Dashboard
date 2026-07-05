# Feature 017: Contrato canônico Metricas → Snapshot Diário (era pós-regex / Sonnet)

**Status:** Draft (aguardando aprovação)
**Priority:** P1 (dado quebrado em produção desde 2026-07-02)
**Date:** 2026-07-04
**Depende de:** feature-016 (resumo_diario), feature-023 do Chief (produtor Sonnet do relatório diário)

> Escopo: WRITER (produtor Sonnet remoto, via `defenz-metricas-write`) + READER (node "Parse Metricas" do WF n8n `aMhvdTP5aAi0Z1sf`). **Zero mudança** no app Vercel (`/diario`, `/api/resumo-diario`, `src/lib/resumo-diario.ts`) e **zero mudança** nos WFs de escrita da Metricas. Regra de casa: **LLM interpreta, JS calcula; NUNCA regex no chat da Operação.**

## Problema & root cause (evidência verificada ao vivo)

Dois sistemas compartilham a planilha privada `Metricas` (doc `1Len6mDHKDE0Zv4ue8aGyN9hnhR38fbl_GKIWQetszXQ`, aba `Metricas`, cols `timestamp,data,autor,categoria,chave,valor,raw_msg,parse_status`):

1. **WRITER** — produtor do relatório diário (feature-023, rotina remota Sonnet `trig_01ECVreEGAiUvbrn2fgoDZC1`, 17:10 BRT): interpreta o chat "Operação" e grava linhas via webhook `defenz-metricas-write` (idempotente por data — **regrava todas as linhas da data**). É a fonte única da verdade das métricas interpretadas/manuais.
2. **READER** — WF "Defenz - Dashboard - Snapshot Diário" (`aMhvdTP5aAi0Z1sf`, cron 17h50 BRT): node "Parse Metricas" (Code) → "Build Row" → upsert 1 linha/dia na aba pública `resumo_diario` (doc `1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ`). O Vercel só lê/renderiza esse snapshot.

**Root cause:** a remoção do regex (f-023) mudou o formato das linhas que o WRITER grava, mas o "Parse Metricas" continua esperando o formato antigo. Pior: o formato novo é **instável dia a dia** (Sonnet escolhe a forma livremente):

| Dia | Forma das linhas de métrica | Forma das `atividade_N` |
|---|---|---|
| ≤2026-07-01 (**antiga**, funcionava) | 1 linha por chave, autor=`Operacao (chat)`, valor agregado com parêntese: `"55 envios (Gustavo: 51 \| Leonardo: 4 \| Marcos: 0 \| Automatico: 0)"`; escalares (`linkedin_*`, `whatsapp_*`) = número puro | `valor` = TEXTO da atividade |
| 2026-07-02 | **N linhas por chave**, uma por pessoa: autor=`Gustavo Figueira`, valor=`12`; autor=`Leonardo Alves`, valor=`8`… sem parêntese | `valor` = `"1"` (placeholder); TEXTO em `raw_msg` |
| 2026-07-03 | volta a 1 linha `Operacao (chat)` mas valor = contagem seca `"12"` (sem breakdown — **breakdown perdido na escrita**) | idem 07-02 |

Efeito verificado na `resumo_diario`: `emails_por_sender`/`apresentacoes_por_vendedor`/`propostas_por_vendedor`/`reuniao_por_vendedor` = `{}`; totais subcontados (`map[chave]=valor` → última linha vence, então dias per-pessoa somam só 1 pessoa); `destaque_*` com lixo tipo `"1; 1; 1"` (o node sanitiza `valor`, que agora é placeholder). Callbox (E–H) e Zoho (U–AA) seguem OK — não passam pela Metricas.

Duas lições do incidente: (i) o formato "livre" do Sonnet **perde informação na escrita** (07-03 gravou contagem seca — o breakdown por pessoa não existe mais nas linhas); (ii) leitor que "adivinha" formato instável é o mesmo pecado do regex, só que do outro lado.

## Decisão de design (trade-off avaliado)

| Opção | Veredito | Por quê |
|---|---|---|
| (a) Consertar só o READER (agregador tolerante a todas as formas) | ❌ como solução única | Não recupera o que não foi gravado (07-03 sem breakdown); condena o JS a perseguir a criatividade do Sonnet para sempre — interpretação migraria de volta pro JS (o bug original com outra roupa). |
| **(b) Consertar o CONTRATO: produtor emite 1 JSON canônico/dia; reader consome verbatim; agregador determinístico só como FALLBACK** | ✅ **escolhida** | Quem interpreta (Sonnet, que já resolveu os números exatos pro markdown) emite o resultado **uma vez, estruturado**. Reader vira mapeamento burro campo→coluna (JS calcula). Fallback cobre backfill + dias em que o produtor falhar. Reusa `defenz-metricas-write` (zero infra nova). O reader atual **já ignora chaves iniciadas em `_`** (verificado no código do node: `charAt(0)!=='_'`) → a linha `_resumo_json` é retrocompatível por construção: pode entrar em produção ANTES do reader novo sem quebrar nada. |
| (c) Produtor escreve a linha da `resumo_diario` direto; Snapshot só anexa colunas live | ❌ | O produtor é rotina remota com allowlist de rede restrita a `code.escaladaonline.com.br` — não alcança Google Sheets; precisaria de webhook/WF novo (infra + blast radius no doc PÚBLICO). Merge parcial de linha no Sheets (produtor 17:10 + snapshot 17:50) é mais frágil que ler 1 JSON. Mata o modo backfill do Snapshot e mistura responsabilidades (live vs interpretado). |

## Goals / Non-goals

**Goals**
- G1. Colunas I–T e AC–AF da `resumo_diario` voltam a ser corretas todo dia útil, com breakdown por pessoa.
- G2. Contrato explícito e versionado entre produtor e snapshot (`_resumo_json` schema v1).
- G3. Fallback determinístico (sem interpretação) que reconstrói o possível a partir das linhas granulares, nas 3 formas conhecidas — para backfill e resiliência.
- G4. Backfill dos dias quebrados (2026-07-02, 2026-07-03 e, se a implementação passar das 17:10, 2026-07-04).
- G5. null ≠ 0 preservado fim a fim (breakdown desconhecido = `null` → "—", nunca `{}` nem `0`).

**Non-goals**
- Nenhuma mudança no app Vercel (tipos, parse, UI) — o contrato `resumo_diario` A–AF fica intacto.
- Nenhuma mudança nos WFs `zq8udGDB9YzSAqO4` (metricas-write), `c8lHYjIyJc1xPGy6` (metricas-read), nem no gerador de API `WdMgn8tSwzQo1cOc`.
- Não reprocessar dias da era regex (≤07-01) — formato antigo já é lido pelo fallback.
- Não resolver P9 (ingestão Apollo→aba `emails`) nem base histórica de Zoho.

## Data Contract — JSON canônico (`_resumo_json` schema v1)

Uma linha por dia na `Metricas`, gravada pelo produtor **no mesmo payload** `rows[]` das linhas granulares (o endpoint regrava a data inteira — mandar em chamada separada apagaria as granulares):

```
{ autor: "Operacao (chat)", categoria: "", chave: "_resumo_json",
  valor: "<JSON string abaixo>", raw_msg: "", parse_status: "ok" }
```

`valor` (JSON compacto, ~1 KB, muito abaixo do limite de 50K chars/célula):

```json
{
  "schema": 1,
  "date": "2026-07-04",
  "source": "operacao-chat-sonnet",
  "generated_at": "2026-07-04T20:15:00Z",
  "emails":          { "total": 55, "por_sender":   { "Gustavo": 51, "Leonardo": 4, "Marcos": 0, "Automatico": 0 } },
  "apresentacoes":   { "total": 1,  "por_vendedor": { "Gustavo": 1 } },
  "propostas":       { "total": 0,  "por_vendedor": {} },
  "reuniao_tecnica": { "total": null, "por_vendedor": null },
  "linkedin":        { "page": 16, "perfis": 41 },
  "whatsapp":        { "msgs": 6, "convs": 2 },
  "destaques": {
    "comercial": "Follow-up Volix; proposta enviada p/ Exact",
    "marketing": null,
    "execucao":  "Contrato Wine assinado",
    "atencao":   null
  }
}
```

**Regras do schema (duras):**
- `schema` = `1` (int). `date` = data BRT `YYYY-MM-DD` — o reader confere contra o alvo; divergência ⇒ trata como ausente (fallback).
- **null ≠ 0 em todo campo:** `null`/chave ausente = não capturado no chat → coluna vazia → UI "—". `0` = zero real reportado. Grupo inteiro pode ser `null`.
- Mapas `por_sender`/`por_vendedor`: chaves **canônicas** `Gustavo` (= Gustavo **Figueira**, comercial — nunca confundir com Gustavo Barbosa/marketing), `Leonardo`, `Marcos`, `Automatico` (só e-mails). Pessoa que **não reportou** fica **fora** do mapa (f-016: canal capturado + célula vazia de vendedor renderiza 0). Breakdown **desconhecido** = `null` (nunca `{}`; `{}` significa "capturado, todos zero/ninguém individualizado").
- `total` já consolidado pelas regras do runbook (`relatorio-diario`): e-mail/apresentações/propostas/reunião = soma dos slots próprios; `linkedin.page` = **máximo** entre pessoas (página única); `linkedin.perfis`/`whatsapp.*` = soma. São **os mesmos números do markdown do relatório** — divergência entre relatório e dashboard passa a ser bug de um lugar só.
- `destaques.*`: string pronta pra célula (itens unidos por `"; "`) ou `null`. Classificação nos 4 buckets (comercial/marketing/execucao/atencao) é do **Sonnet** (interpretação), não de keyword-matching JS. **Sanitizada pelo produtor**: sem e-mail, telefone, CPF/CNPJ (a `resumo_diario` é doc público — LGPD, f-016). O reader mantém o `sani()` como segunda linha de defesa.
- Números são inteiros ≥ 0. Sem campos extras no v1 (evolução ⇒ `schema: 2`).
- Atividades granulares **não** entram no JSON (evita verdade duplicada): continuam como linhas `atividade_N` (audit trail; insumo do fallback).

### Formato das linhas granulares (re-pin, para audit + fallback)

O runbook `relatorio-diario` JÁ especifica o formato; o produtor driftou. Reafirmar na skill e no prompt da rotina:
- Métricas: **1 linha por chave**, autor=`Operacao (chat)`, valor agregado `"<soma> envios (Gustavo: a | Leonardo: b | Marcos: c | Automatico: d)"`; escalares = número puro.
- `atividade_N`: `valor` = **texto conciso** da atividade (não placeholder), `raw_msg` = mensagem original, categoria `comercial`/`gestao`, autor = pessoa.

Com o JSON como contrato, drift nas granulares deixa de quebrar o dashboard — mas o formato documentado continua valendo para leitura humana e fallback de qualidade.

## READER — novo "Parse Metricas" (WF `aMhvdTP5aAi0Z1sf`)

Contexto confirmado no WF ao vivo: `Ler Metricas` já filtra `data == target` (`Definir Alvo`), então o node só vê linhas de UM dia. `Build Row` consome os campos `{has_chat, linkedin_page, linkedin_perfis, whatsapp_msgs, whatsapp_convs, emails_total, emails_por_sender, apres_total, apres_pv, prop_total, prop_pv, reun_total, reun_pv, destaque_*}` — **manter exatamente esses nomes de saída** (Build Row quase não muda).

**Ordem de resolução:**

1. **Caminho primário — JSON verbatim.** Achar linhas `chave === '_resumo_json'` com `parse_status` ∉ {`revisar`,`erro`}; se >1, vence a de maior `timestamp`. Validar: `JSON.parse` ok · `schema === 1` · `date === target` · type-check raso (cada grupo é objeto/null; `total`/escalares int≥0 ou null; mapas são objeto string→int ou null; destaques string ou null). Válido ⇒ mapear campo→saída **sem reinterpretar** (ex.: `emails_total = json.emails?.total ?? null`). `manual_detail='resumo_json'`.
2. **Fallback — agregador determinístico** (JSON ausente/inválido/data errada). Sobre as linhas granulares (excluindo `_*`, `revisar`, `erro`), por chave conhecida (`email_envios, apresentacoes, propostas, reuniao_tecnica, linkedin_page, linkedin_perfis, whatsapp_msgs, whatsapp_convs`), detecção de forma **nesta ordem**:
   - **F1 agregada-parêntese** (era ≤07-01): existe linha cujo valor contém `(` e `)` com `:` no miolo ⇒ usar a mais recente: `total=leadInt(valor)`, mapa=`parsePV(valor)` (lógica atual, preservada).
   - **F2 per-pessoa** (era 07-02): ≥1 linha cujo `autor` ≠ `Operacao (chat)` e valor numérico ⇒ última linha por autor vence; autor → chave canônica via **tabela de lookup** (lowercase exato, sem regex): `gustavo figueira→Gustavo`, `gustavo→Gustavo`, `leonardo alves→Leonardo`, `leonardo→Leonardo`, `marcos→Marcos`, `marcos cruz→Marcos`, `automatico/automático→Automatico`; `gustavo barbosa` NÃO vira `Gustavo` (fica `Gustavo Barbosa`); desconhecido = nome original trim. `total` = soma (exceto `linkedin_page` = **máximo**); mapa = pares autor→valor (só p/ chaves com coluna de breakdown).
   - **F3 contagem-seca** (era 07-03): 1 linha, valor numérico puro ⇒ `total=leadInt`, mapa=`null` (breakdown desconhecido — **nunca** `{}`).
   - Sem linhas da chave ⇒ `total=null`, mapa=`null`.
   - **Atividades/destaques (fallback):** por linha `atividade_N`: texto = `valor` se contiver ≥1 letra (checagem por char-class em loop, padrão do node); senão `raw_msg` (placeholder `"1"` da era nova). Bucketing = keyword-matching atual, mantido **apenas** aqui, documentado como best-effort legado. `manual_detail='rows_agg'`.
3. Dia sem nada ⇒ tudo null, `has_chat=false`, `manual_detail='none'`.

**Transversal:** `sani()` (e-mail→`[email]`, ≥10 dígitos→`[num]`) aplicado aos destaques nos DOIS caminhos. `has_chat` = (JSON válido com ≥1 campo não-null) ou (fallback com ≥1 linha válida). Null flui até a célula: `Build Row` já faz `N(null)→''`/`J(null)→''` e o Vercel `numOrNull('')→null` — sem mudança lá.

**Build Row (micro-mudança, 1 campo):** incluir `manual_detail: man.manual_detail || 'none'` dentro do JSON `coverage` (diagnóstico: detecta fallback silencioso em dia de produtor ativo). Campo **aditivo e opcional**: `parseResumoRow` faz spread de `Partial<ResumoCoverage>` sobre defaults — chave extra passa inofensiva; nenhum type do dashboard muda no v1.

## WRITER — mudanças no produtor (rotina remota + skill)

1. **Prompt da rotina remota** `trig_01ECVreEGAiUvbrn2fgoDZC1` (via RemoteTrigger) e **skill `~/.claude/skills/relatorio-diario/SKILL.md`** (operações A e D): após consolidar as métricas (regras existentes), montar o JSON canônico v1 e incluir a linha `_resumo_json` **no mesmo `rows[]`** do `defenz-metricas-write` (endpoint regrava a data inteira — nunca em chamada separada).
2. Re-pin do formato granular (seção acima) no prompt/skill.
3. **Auto-verificação do produtor:** os totais do JSON DEVEM bater com os números do markdown (mesma consolidação, um passo só). Após gravar, ler de volta via `defenz-metricas-read {date}` e conferir que `_resumo_json` existe e parseia; falhou ⇒ regravar 1×; falhou de novo ⇒ registrar no próprio relatório ("⚠ resumo estruturado não gravado") — o snapshot cai no fallback sozinho.
4. Backup antes de escrever (regra existente do runbook) permanece.

Sem WF novo, sem token novo, sem mudança nos webhooks.

## Backfill (02/07, 03/07, e 04/07 se aplicável)

0. **Backup**: `defenz-metricas-read` (histograma completo + linhas de cada data afetada) salvo em arquivo. Conferir no histograma se há OUTROS dias pós-01/07 quebrados (hoje só se conhecem 02 e 03; 04/07 entra se o produtor de hoje rodar antes do fix).
1. **Regenerar `_resumo_json` por dia afetado** via operação D do runbook (Graph → histórico do chat `19:7cb6ecaeec974beaa5afe3abef2a8b31@thread.v2` do dia → interpretação Sonnet → `defenz-metricas-write` com `date` correta, payload = granulares re-pinadas + `_resumo_json`). Motivo: é o ÚNICO jeito de recuperar o breakdown de 03/07 (as linhas gravadas não o contêm — F3 devolveria só totais, breakdown "—"). Para 02/07 o F2 recuperaria o breakdown, mas reinterpretar dá uniformidade pelo mesmo custo.
2. **Preservar U–AA**: copiar os valores atuais de `pocs_*`/`base_*` das linhas 02–03/07 da `resumo_diario` (foram capturados live no dia — Zoho não tem histórico; re-rodar em modo backfill os apagaria). Re-rodar o Snapshot por data (`{data:"2026-07-02"}` etc. — upsert idempotente por `data`), depois **restaurar U–AA** manualmente nas células. Alternativa aceitável se o Marcos preferir zero trabalho manual: aceitar `null` (UI "—") nesses 2 dias — o card "Clientes Ativos" usa `base_atual` (linha mais recente), então o estado atual não é afetado. **← decisão do humano (Q2).**
3. **Verificação:** `/diario?data=2026-07-02` e `03` — totais e breakdowns batem com os relatórios markdown daqueles dias; destaques legíveis (sem `"1; 1"`); nenhum `0` onde deveria ser "—".

## TDD — plano de testes (antes do código, como sempre)

O parse/fallback vira **módulo TS puro e testado**, depois embutido no Code node (precedente: f-018, `operacao-aggregator.ts`). Local: repo Defenz_Chief (dono dos WFs n8n), `src/lib/metricas-canon.ts` + `tests/lib/metricas-canon.test.ts` (Vitest). Exports puros: `parseResumoJson(rows, target)` e `aggregateFallback(rows)`.

Fixtures = linhas REAIS anonimizadas das 3 eras (copiar da Metricas via `defenz-metricas-read`):
- `fixtures/metricas-2026-07-01.json` (agregada-parêntese), `-07-02.json` (per-pessoa), `-07-03.json` (contagem seca), um dia misto sintético, dia vazio.

Casos mínimos:
1. JSON válido ⇒ saída verbatim; `manual_detail='resumo_json'`; granulares ignoradas.
2. JSON com `date` ≠ target ⇒ fallback. 3. JSON malformado/`schema`≠1/tipo errado ⇒ fallback. 4. Duas linhas `_resumo_json` ⇒ vence maior timestamp.
5. `emails:{total:0, por_sender:{}}` ⇒ `0`/`{}` (zero real ≠ null). 6. `reuniao_tecnica:null` e chave ausente ⇒ ambos null (célula vazia, nunca `0`/`{}`).
7. Fallback F1 (fixture 07-01) ⇒ reproduz saída do node antigo (regressão: mesmos totais/mapas de antes).
8. Fallback F2 (fixture 07-02) ⇒ soma correta multi-pessoa; canonicalização (`Gustavo Figueira→Gustavo`; `Gustavo Barbosa` NÃO mesclado); `linkedin_page`=max, `perfis`=soma; última linha por autor vence.
9. Fallback F3 (fixture 07-03) ⇒ totais ok, mapas `null` (não `{}`).
10. Atividades: valor-texto ⇒ usa valor; valor=`"1"` ⇒ usa `raw_msg`; valor `"3 propostas enviadas"` (número + letras) ⇒ usa valor.
11. `sani()`: e-mail e telefone nos destaques ⇒ `[email]`/`[num]` nos dois caminhos.
12. `parse_status` `revisar`/`erro` e chaves `_*`/desconhecidas ⇒ excluídas sem quebrar.
13. Dia vazio ⇒ tudo null, `has_chat=false`, `manual_detail='none'`.

Cobertura obrigatória do módulo antes de tocar o node. Sem testes novos no Vercel (nada muda lá); rodar a suíte existente do Dashboard como regressão.

## Rollout / verificação

1. Spec aprovada pelo Marcos (este doc).
2. TDD verde no módulo (Chief repo).
3. **WRITER primeiro** (retrocompatível — reader atual ignora `_*`): atualizar skill + prompt da rotina remota. No dia D às 17:10, conferir via `defenz-metricas-read` que `_resumo_json` chegou válido.
4. **READER depois:** substituir o `jsCode` do node "Parse Metricas" (+1 campo no "Build Row") via API. GOTCHA conhecido: substituir o objeto `parameters` INTEIRO do node (updateNode com dot-path em array cria chave-lixo). Validar o WF; rodada manual com `{data: ontem}` antes de confiar no cron.
5. Dia D+0: cron 17h50 roda; conferir linha da `resumo_diario`: I–T preenchidos, `coverage.manual_detail='resumo_json'`, totais == markdown do relatório 17:30, destaques limpos.
6. Backfill 02–03/07 (seção acima) + screenshot `/diario` dos dias corrigidos pro Marcos.
7. Monitoramento leve (1ª semana): se `manual_detail='rows_agg'` num dia em que o produtor rodou ⇒ investigar produtor (JSON inválido).

## Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Sonnet emite JSON inválido/incompleto | Validação estrita no reader + fallback determinístico; read-back no produtor; `manual_detail` denuncia fallback silencioso. |
| Verdade duplicada (JSON × granulares divergem) | JSON é canônico p/ snapshot; granulares = audit. Ambos saem da MESMA consolidação num único passo do produtor; auto-verificação exige JSON == markdown. |
| Chamada separada do `_resumo_json` apaga granulares (endpoint regrava a data) | Regra dura: sempre no mesmo `rows[]`. Documentado na skill e neste spec. |
| Produtor atrasa (>17:50) ⇒ snapshot gravou via fallback | Upsert idempotente: re-rodar o Snapshot manualmente após rodada tardia do produtor (adicionar 1 linha na operação C do runbook). |
| PII no doc público via destaques | Sanitização no produtor (regra de prompt) + `sani()` mantido no reader (defesa em profundidade, f-016). |
| Drift futuro do formato granular | Irrelevante p/ dashboard (JSON é o contrato); fallback cobre as 3 formas conhecidas; formas novas caem em F3/null (subnotifica honesto, nunca lixo). |
| Backfill em modo backfill zera U–AA capturados live | Passo explícito de preservação/restauração (ou aceite consciente de null — Q2). |

## Acceptance Criteria

- [ ] Módulo `metricas-canon.ts` com suíte TDD verde (fixtures das 3 eras + JSON v1), ANTES de tocar o node.
- [ ] Produtor grava `_resumo_json` v1 no mesmo payload das granulares; totais do JSON == números do markdown do mesmo dia.
- [ ] Reader novo: dia com JSON válido ⇒ colunas I–T/AC–AF corretas com breakdown; `coverage.manual_detail='resumo_json'`.
- [ ] Dia sem JSON ⇒ fallback: fixture 07-01 reproduz o resultado do node antigo; 07-02 soma multi-pessoa; 07-03 totais + mapas null ("—", nunca `{}`/`0`).
- [ ] null ≠ 0 fim a fim: campo não capturado = célula vazia = "—" no `/diario`; zero reportado = `0`.
- [ ] Backfill 02–03/07 aplicado e verificado no `/diario` contra os relatórios markdown dos dias; destaques sem placeholders.
- [ ] Nenhuma mudança em: app Vercel, WFs `zq8udGDB9YzSAqO4`/`c8lHYjIyJc1xPGy6`/`WdMgn8tSwzQo1cOc`, colunas A–AF da `resumo_diario`.
- [ ] Skill `relatorio-diario` atualizada (JSON v1 + re-pin granular + re-run do snapshot após produtor tardio).

## Decisões (2026-07-04 — aprovadas pelo Marcos)

- **Aprovação:** spec aprovada; implementar na ordem: (1) módulo `metricas-canon.ts` TDD → (2) WRITER → (3) READER → (4) backfill.
- **Q1 — Backfill 03/07:** ✅ **reinterpretar** o chat do dia (op D) pra recuperar o breakdown por pessoa.
- **Q2 — U–AA nos dias re-processados:** ✅ **preservar/restaurar** as células base/POCs capturadas live.
- **Q3 — Destaques 100% Sonnet:** ✅ **sim** — classificação nos 4 buckets migra pro produtor; keyword-matching sobrevive SÓ no fallback.
- **Q4 — Formato granular canônico:** ✅ **manter o agregado-parêntese** da skill como formato documentado (evita 3ª era).
- **Q5 — 04/07:** decidir na implementação, checando o histograma (`defenz-metricas-read`).

## Adendo (05/07) — Regra de Destaques: "Venda é prioridade"

Refino aprovado pelo Marcos para a seção **Destaques Operacionais** do `/diario`. A caixa **Comercial** foi renomeada para **Vendas** (label; o campo/coluna `comercial` não muda) e é a prioridade (vem primeiro). A caixa Vendas mostra só as **atividades de venda** do chat (os números seguem nos cards existentes, sem duplicar).

**Regra de classificação (precedência dura):** `pós-venda → venda → atenção → marketing → execução(default)`.
- **É Vendas (comercial):** prospecção / lead novo / mapeamento de CNPJ · apresentação, demo, POC, reunião técnica de oportunidade · proposta · negociação · follow-up comercial · fechamento (ganho/perdido) · renovação, upsell, expansão.
- **NÃO é Vendas (mantém a caixa limpa):** pós-venda operacional (setup, ativação de licença, hash/console, onboarding, suporte, ticket de cliente já fechado) → **Execução**; marketing (posts, criativos, LinkedIn, carrossel) → **Marketing**; gestão/contrato/financeiro/admin → **Execução**; bug, risco, problema, pendência, "sem sucesso" → **Ponto de atenção**.
- **Desempate:** venda vence; item operacional "menor" fica fora de Vendas. **Default = Execução** (não Comercial), para não poluir Vendas.

**Implementação:** (1) classificador `classifyAtividade(text, categoria)` em `Defenz_Chief/src/lib/metricas-canon.ts` (5 testes novos + fixtures das 3 eras atualizadas), portado verbatim no Code node "Parse Metricas". De quebra, checar venda antes de marketing resolve a colisão `proposta`→`post`. (2) Produtor Sonnet (skill `relatorio-diario` + rotina remota) recebe a regra para classificar os destaques no `_resumo_json`. (3) Render: `ResumoDiarioDashboard.tsx` label Comercial→Vendas. Nota: o classificador do fallback é conservador (só termo claro de venda entra em Vendas); a classificação "de verdade" é do Sonnet no JSON.
