# Ramo de classificação IA desligado — 12/08/2026

> Alterações feitas **no n8n** (não neste repo) pela sessão do **Defenz_Chief**, a pedido
> do Marcos, após investigação de custo do Gemini. Este documento existe para que quem
> trabalha no Dashboard saiba o que mudou e por quê.

**Workflow afetado:** `Defenz - Dashboard - Coleta Métricas v2` — id `QjnzGicZHIPBNN1g`
https://code.escaladaonline.com.br/workflow/QjnzGicZHIPBNN1g

## Por que mexemos

O console do Google acusava **R$ 248,43 no mês**, sendo **R$ 208,02 em 28 dias no
"Gemini 3.6 Flash"**. A origem era o ramo de classificação deste workflow — não o Chief,
não o Autopilot (que não usa Gemini em nenhum fluxo), não o ATRIO.

O nó `IA Classificar` usava **`models/gemini-flash-latest`** (Flash, não Flash-Lite), com
cron `0 6,18 * * *` (2x/dia, todos os dias) e **200 chamadas por execução** (CAP do
`Preparar IA`) = ~400/dia = ~11.200 no período.

### O desperdício, medido na aba `classificacao_ia_historico`

| | |
|---|---|
| Classificações pagas | **6.293** |
| Leads únicos | **1.292** |
| Duplicata na MESMA execução | **1.261** pares (lead+timestamp) exatamente 2x |
| Reclassificados com `resultados_snapshot` idêntico | 253 leads |

Um lead chegou a **64 classificações** com um único snapshot distinto. **~80% do custo
foi trabalho repetido.**

### Por que o ramo não fazia falta hoje

Rastreado neste repo: o hook `src/hooks/useEsforcoData.ts` (que chama `/api/esforco`)
**não é referenciado por nenhum componente**; `contatos_decisor` /
`contatos_decisor_info` (em `src/lib/metrics.ts`) só aparecem nas rotas
`api/relatorio-mensal` e `api/dashboard-sheets`, em **nenhuma página**. Origem no git:
`feat: V3.3→V3.9 — IA funnel`. O Marcos confirmou: "não estamos usando essa parte da
classificação nesse momento".

## O que foi alterado

### 1. Modelo trocado
`IA Classificar`: `models/gemini-flash-latest` → **`models/gemini-flash-lite-latest`**.
(Também padronizados para `flash-lite-latest`, fora deste WF: Sub-Agent Zoho
`2z6ZngTNoLWXdtfS`, Sub-Agent Microsoft `WdSewF0rO620MOFa`, Sub-Agent Microsoft Fernando
`f1CF8JPWIN9sDxwp`.)

### 2. Ramo DESABILITADO (8 nós)
`Preparar IA` · `IA Classificar` · `Google Gemini Chat Model` · `Salvar Classificacoes` ·
`Sheets Classificacoes` · `Sheets Classificacoes Historico` ·
`Lote → Neon: classificacao_ia` · `Ingest → Neon: classificacao_ia`

O ramo é **beco sem saída** — não alimenta nenhum outro nó. `Zoho Leads` continua
servindo `Zoho Tasks` (agenda) e `Format Leads Raw` (base de leads). Todo o resto do
workflow (deals, ligações, e-mails, leads, agenda, reuniões → Sheets + Neon) segue
intacto. Validado: 0 erros, 32 nós habilitados.

**Impacto para este repo:** a aba `classificacao_ia`, a `classificacao_ia_historico` e a
tabela `classificacao_ia` no Neon **param de receber linhas novas**. Os dados já
existentes continuam lá (1.464 / 6.293 linhas). Se alguma tela passar a consumir
`nivel_maximo`, `passou_secretaria`, `toques_estimados`, `cargo_estimado`,
`resultado_principal` ou `concorrente`, ela verá dados **congelados em 13/08/2026**.

### 3. Bug corrigido no `Preparar IA` (V5.2 → V5.3)

```js
// ANTES — cada lead entrava 2x
const allLeads = leadsPages.flatMap(p => p.json.data || []);

// DEPOIS — dedup por id
const rawLeads = leadsPages.flatMap(p => p.json.data || []);
const _porId = new Map();
for (const l of rawLeads) { if (l && l.id != null) _porId.set(String(l.id), l); }
const allLeads = [..._porId.values()];
```

**Causa:** `$('Zoho Leads').all()` devolve **todas as execuções** do nó. Como `Zoho Deals`
emite 2 itens, o `Zoho Leads` roda duas vezes e o `flatMap` juntava as duas rodadas —
cada lead duplicado, sempre exatamente 2x. Metade do CAP de 200 era repetição.

O `console.log` agora informa quantos duplicados foram removidos, para o problema ficar
visível se voltar.

## Se for religar o ramo

1. Reabilitar os 8 nós (a correção do `Preparar IA` já está aplicada).
2. **Decidir a regra de negócio pendente:** o Sales AI escreve no campo `Resultados` do
   Zoho a cada ligação, então todo "não atendido" muda o texto e devolve o lead à fila —
   foi o que manteve 742 leads reclassificando legitimamente. Considerar ignorar mudanças
   que só acrescentam registro de tentativa sem contato.
3. Manter o modelo em Flash-Lite; a tarefa é extração de JSON estruturado, não raciocínio.
4. Avaliar rodar 1x/dia (ou 1x/mês, se o único consumo for o relatório mensal) em vez de
   2x/dia. **O ramo não tem cron próprio** — pendura no gatilho único do workflow, então
   mudar a frequência só do ramo exige uma condição antes do `Preparar IA`.

## Observação de segurança (não corrigida)

O workflow tem um webhook `dashboard-metricas` **sem autenticação**: qualquer chamada
nessa URL dispara o fluxo inteiro. Enquanto o ramo de IA estava ligado, isso significava
200 chamadas de LLM por requisição.
