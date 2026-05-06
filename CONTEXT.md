# Contexto do Projeto Defenz_Dashboard

## Historia

O Defenz Dashboard nasceu como um painel de vendas para a Defenz, empresa de cibersegurança brasileira. Evoluiu de um MVP simples (V1) para uma plataforma de sales intelligence multi-página (V5.x).

Marcos importantes:
- **V1–V3**: Dashboard básico consumindo webhook N8N direto, layout single-page
- **V4.0 (2026-04-03)**: Funil hero, drill-down cards, N8N Consolidar V4.0
- **V5.0 (2026-04-13)**: Motor de métricas próprio (`metrics.ts`), planilha nova, filtragem temporal por eventos embutidos no texto de `Resultados`
- **V5.1 (2026-04-20)**: Callbox Fetch All Pages (loop dinâmico), corrige discrepância de ligações (2101 → 4719)
- **V5.3 (2026-04-29)**: Classificação IA incremental append-only + aba `classificacao_ia_historico`

## Decisoes arquitetonicas (ADRs)

### ADR-001: Sem banco de dados
**Data:** 2026-03-xx  
**Contexto:** MVP rápido, cliente não quer infraestrutura complexa.  
**Decisão:** Todas as métricas vêm do Google Sheets (populado pelo N8N). Nenhum ORM, nenhum Prisma.  
**Consequências:** Simplicidade extrema, mas leituras são lentas (gviz API). Cache obrigatório.

### ADR-002: Auth por senha única compartilhada
**Data:** 2026-03-xx  
**Contexto:** Usuários internos apenas, sem necessidade de accounts individuais.  
**Decisão:** HMAC-SHA256 signed cookie, senha única via env var.  
**Consequências:** Sem auditoria por usuário. Aceitável para uso interno.

### ADR-003: Cálculo de métricas no servidor Vercel (não no N8N)
**Data:** 2026-04-13 (V5.0)  
**Contexto:** N8N calculava métricas no `Consolidar` node — difícil de debugar, sem tipos, sem testes.  
**Decisão:** N8N coleta dados raw → escreve planilha. Vercel computa tudo via `src/lib/metrics.ts`.  
**Consequências:** Lógica de negócio versionada em TypeScript. N8N fica mais simples. Mais fácil testar.

### ADR-004: Filtragem temporal via eventos embutidos no texto
**Data:** 2026-04-13 (V5.0)  
**Contexto:** Zoho CRM armazena datas de apresentações/propostas como texto no campo `Resultados` (ex: `"15/04 - [APRESENTACAO]"`).  
**Decisão:** `extractEventDates()` em `metrics.ts` parseia esses textos e extrai datas.  
**Consequências:** Funciona sem mudança no Zoho. Frágil se o formato do texto mudar.

### ADR-005: Classificação IA incremental (V5.3)
**Data:** 2026-04-29  
**Contexto:** Classificar todos os leads a cada run desperdiça quota do Gemini e sobrescreve histórico.  
**Decisão:** `Preparar IA` lê planilha atual e filtra apenas leads novos ou com `Resultados` modificado (via `resultados_snapshot`). Histórico em aba append-only.  
**Consequências:** Runs subsequentes classificam ~0–10 leads em vez de 200. Histórico de mudanças preservado.

## Stakeholders e contexto de negocio

- **Usuário primário**: Time comercial Defenz (SDRs, closers, gestão)
- **Uso**: Acompanhamento diário de pipeline, comissões, esforço de prospecção
- **SLA**: Dashboard deve carregar em < 3s (cache 30min server + client)
- **Idioma da UI**: Português brasileiro

## Glossario do dominio

| Termo | Significado |
|---|---|
| Ligação | Chamada telefônica via Callbox (sistema de telefonia) |
| Reunião | Evento no Outlook com `<>` no título (ex: `Defenz <> Cliente`) |
| Apresentação | Evento `[APRESENTACAO]` no campo Resultados do Zoho |
| Proposta | Stage "Proposta Enviada" OU evento `[PROPOSTA]` no Resultados |
| Fechado | Deal no Stage "Closed Won" com `closing_date` no período |
| Decisor | Lead classificado pela IA como tomador de decisão |
| Esforço diário | Contagem de atividades por dia num período |
| Securisoft | Parceiro com comissão reduzida (5%) |
| Direto | Lead proveniente de prospecção própria (58% comissão Defenz) |
| Parceiro | Lead indicado por parceiro genérico (43% comissão Defenz) |

## Aprendizados / cicatrizes

- **N8N Google Sheets schema mismatch**: Se a ordem das colunas na planilha não bate com o schema do node, dá erro silencioso. Fix: sempre atualizar schema via MCP updateNode.
- **modified_time NÃO é data de fechamento**: `Modified_Time` do Zoho muda por qualquer edição. Usar `Closing_Date`.
- **Gemini retorna JSON em markdown**: Resposta vem como ` ```json {...} ``` `. Precisa strip antes de `JSON.parse`.
- **Cache client-side stale após mudança de lógica**: `sessionStorage` serve dados com lógica antiga. Fix: `fetchData(range, true)` no `useEffect` de `dateRange`.
- **N8N Respond Webhook + responseMode**: Se remover Respond Webhook, mudar Webhook para `responseMode="onReceived"`. Coexistência (mesmo disabled) causa erro.
- **Callbox paginação no POST body**: `page` vai no body, não na query string. Loop sobre `data.pages` com cap 20.
- **`.first()` vs `.all()` no N8N**: Code nodes que precisam processar todos os items devem usar `.all()`, não `.first()`.

## Roadmap detalhado

### V5.4 (próxima)
- [ ] P8: Fix cache `operational_v5` global (ignora período)
- [ ] P9: `dateInRange` silent drop — logar rows descartados com data inválida
- [ ] P10: Coverage banner no dashboard (MIN/MAX/count dos dados)
- [ ] P4: Reuniões via fallback `[REUNIAO]` em `deals.resultados` (token Microsoft expirado)

### V5.5
- [ ] Restaurar seções removidas: Evolução Diária, Deals Table, Base Instalada
- [ ] P13: Paginação Zoho Deals + Zoho Tasks (hoje funciona por sorte com < 200 registros)

### V6.0 (pesquisa feita, não iniciado)
- [ ] Abandonar N8N — tudo na Vercel (ver `memory/project_future_no_n8n.md`)
- [ ] Specs + testes unitários para `metrics.ts` (vitest)
- [ ] Dashboard `/metas` (TV mode, metas semanais)
- [ ] Dashboard `/atividade` (atividade por vendedor)

## FAQ

**Por que não tem banco de dados?**
ADR-001. Dados vêm do Zoho CRM via N8N → Google Sheets. Simples, sem infra extra.

**Por que as reuniões estão zeradas?**
Token Microsoft Calendar expirou (P4). Fallback via `[REUNIAO]` em `Resultados` está planejado para V5.4.

**Por que o build não está na Vercel?**
Build minutes do free plan foram consumidos por outros projetos. Deploy manual ou upgrade necessário.

**Como atualizar os dados do dashboard?**
O N8N roda automaticamente às 6h e 18h. Para forçar: executar o workflow manualmente em `https://code.escaladaonline.com.br`.

**O que é o `computeMetrics()`?**
Função em `src/lib/metrics.ts` que recebe dados raw das 4 abas (deals, ligacoes, emails, classificacao_ia) e retorna todas as métricas computadas para o dashboard executivo.

## Links externos relevantes

- **N8N**: `https://code.escaladaonline.com.br` (workflow ID: `QjnzGicZHIPBNN1g`)
- **Planilha ativa**: `https://docs.google.com/spreadsheets/d/1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ`
- **Planilha backup (antiga)**: `https://docs.google.com/spreadsheets/d/1U6ley8bTw6SuVqoxLJDlVUFCkkYSAVPz9AZm6AU40p4`
- **Callbox**: `https://defenz.callbox.com.br`
- **GitHub**: `UIIAA/Defenz-Dashboard` (não linkado à Vercel)

## Apendice tecnico

### Planilha Google Sheets (ativa)
ID: `1roirh1RRFg8Pfg7iFO9-rp9xtMgPCbQBuMpsOQGZoZQ`

Abas e volumes (2026-04-20):
| Aba | Rows | Descrição |
|---|---|---|
| `ligacoes` | 4719 | Chamadas Callbox desde 2025-11-04 |
| `deals` | 90 | Deals do Zoho CRM com closing_date |
| `emails` | 2963 | Emails Apollo.io |
| `leads` | 512 | Leads do Zoho CRM |
| `classificacao_ia` | 165 | Classificações Gemini (incremental) |
| `agenda` | 105 | Tasks/atividades do Zoho |
| `classificacao_ia_historico` | ~600+ | Histórico append-only (600 rows sujas pré-V5.3) |

### Shape do registro Callbox
```typescript
{
  origin: string,
  date: "DD-MM-YYYY HH:MM:SS",
  status: string,
  disposition: string,
  event: string,
  duration: number,
  billsec: number,
  identification: string,
  destiny: string,
  interface: string,
  uniqueid: string,
  userfield: string
}
```

### Regras de comissão
| Lead_Source contém | Categoria | Taxa Defenz |
|---|---|---|
| `securisoft` ou `parceiro ss` | securisoft | 5% |
| `apollo`, `linkedin`, `cold call`, `chamada surpresa` | direto | 58% |
| `parceiro` (genérico) | parceiro | 43% |
| qualquer outra coisa | direto | 58% |
