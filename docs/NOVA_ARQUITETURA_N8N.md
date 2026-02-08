# Nova Arquitetura V2: N8N + Planilha + Dashboard

> **Atualizado:** 2026-02-06
> **Versao:** V1 - Dashboard Executivo

## Decisoes de Produto (V1)

| Metrica | Fonte | Filtro | Nota |
|---------|-------|--------|------|
| **Ligacoes** | Zoho Calls | `Call_Start_Time` no periodo | Atendidas = Subject contem "atendida" |
| **Emails** | Apollo.io | `completed_at` no periodo | **Apenas enviados.** Microsoft Emails fora do V1 |
| **Reunioes** | Microsoft Calendar | **Subject contem `<>`** | Padrao: `[Quem] <> [Cliente]`. Ex: `BitDefender <> Consube` ou `Defenz <> FDC` |
| **Apresentacoes** | Zoho Deals | Campo `Resultados` contem `[APRESENTACAO]` | |
| **Propostas** | Zoho Deals | Stage = "Proposta Enviada" OU `Resultados` contem `[PROPOSTA]` | |
| **Deals** | Zoho Deals | Stage para ativo/fechado | |

---

## Visao Geral

```
N8N (1x/dia as 6am)
    |
    +-- [Dados Brutos] Zoho Deals (TODOS os deals)
    +-- [Dados Brutos] Zoho Calls (ultimos 30 dias)
    +-- [Dados Brutos] Apollo Emails Enviados (ultimos 30 dias)
    +-- [Dados Brutos] Microsoft Reunioes (ultimos 30 dias)
    |
    +-- [Filtros] Aplica periodos (hoje, 7d, 15d, 30d, mes)
    |             + Reunioes: filtra apenas Subject com "<>"
    |             + Emails: apenas Apollo (enviados)
    |
    +-- [Consolidador] Gera 5 linhas (uma por periodo)
    |
    +-- [Google Sheets] Grava na aba "metricas"

Dashboard
    |
    +-- 1. Cache local (sessionStorage, 30min)
    +-- 2. Google Sheets (/api/dashboard-sheets)
    +-- 3. Fallback N8N (/api/dashboard)
    +-- 4. Fallback Mock data
```

---

## 1. ESTRUTURA DA PLANILHA

### Aba: `metricas` (CRIAR NOVA)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| data_coleta | DATE | Data em que os dados foram coletados (YYYY-MM-DD) |
| periodo | TEXT | Identificador do periodo: `hoje`, `7d`, `15d`, `30d`, `mes` |
| data_inicio | DATE | Data inicio do periodo |
| data_fim | DATE | Data fim do periodo |
| ligacoes | NUMBER | Total de ligacoes (Zoho Calls) |
| ligacoes_atendidas | NUMBER | Ligacoes atendidas |
| taxa_conectividade | NUMBER | Percentual (0-100) |
| emails | NUMBER | Emails enviados pelo Apollo |
| reunioes | NUMBER | Reunioes de pipeline (filtradas por `<>` no Subject) |
| apresentacoes | NUMBER | Deals com [APRESENTACAO] no campo Resultados |
| propostas | NUMBER | Deals com Stage "Proposta Enviada" ou [PROPOSTA] |
| deals_ativos | NUMBER | Quantidade de deals ativos |
| deals_fechados | NUMBER | Quantidade de deals fechados no periodo |
| valor_pipeline | NUMBER | Soma dos valores dos deals ativos |
| valor_fechado | NUMBER | Soma dos valores fechados no periodo |
| ultimo_cliente_nome | TEXT | Nome do ultimo cliente fechado |
| ultimo_cliente_origem | TEXT | Origem do ultimo cliente |
| ultimo_cliente_valor | NUMBER | Valor do ultimo cliente |

> **Removido do V1:** `emails_microsoft`, `emails_total` (simplificado para coluna unica `emails` = Apollo enviados)

### Aba: `deals_ativos` (JA EXISTE)

Manter como esta - lista de todos os deals ativos.

### Aba: `clientes_fechados` (JA EXISTE)

Manter como esta - lista de todos os clientes fechados.

---

## 2. NOS DO N8N

### 2.1 Zoho Deals - Dados Brutos (sem filtro de data)

```javascript
// URL: https://www.zohoapis.com/crm/v2/Deals
// Query Parameters:
{
  "fields": "Deal_Name,Stage,Amount,Created_Time,Closing_Date,Resultados,id,Lead_Source,Account_Name,Contact_Name,Owner",
  "per_page": "200",
  "sort_by": "Created_Time",
  "sort_order": "desc"
}
```

**Campos importantes do Zoho Deals:**
- `Deal_Name` - Nome do deal
- `Stage` - Estagio atual (Contato inicial, Em negociacao, Proposta Enviada, Fechado Ganho, Fechado perdido)
- `Amount` - Valor do deal
- `Created_Time` - Data de criacao
- `Closing_Date` - Data de fechamento
- `Resultados` - Campo customizado com tags [APRESENTACAO], [PROPOSTA]
- `Lead_Source` - Origem do lead
- `Account_Name` - Nome da empresa
- `Owner` - Responsavel

### 2.2 Zoho Calls - Dados Brutos (ultimos 30 dias)

```javascript
// URL: https://www.zohoapis.com/crm/v2/Calls
// Query Parameters:
{
  "fields": "Subject,Call_Start_Time,Call_Duration,Call_Type,Call_Result,Owner,Who_Id",
  "per_page": "200",
  "criteria": "((Call_Start_Time:greater_equal:{{30_DIAS_ATRAS}}T00:00:00-03:00))"
}
```

**Campos importantes do Zoho Calls:**
- `Subject` - Assunto (contem "atendida" se foi atendida)
- `Call_Start_Time` - Data/hora da ligacao
- `Call_Duration` - Duracao em segundos
- `Call_Type` - Tipo (Inbound, Outbound)
- `Call_Result` - Resultado da ligacao
- `Owner` - Quem fez a ligacao

### 2.3 Apollo Emails - Enviados (ultimos 30 dias)

```javascript
// Apollo API - Emailer Messages
// Filtro: apenas emails enviados (completed_at preenchido)
// NAO inclui Microsoft/Outlook emails no V1
```

### 2.4 Microsoft Reunioes - Pipeline Only

```javascript
// Microsoft Graph API - Calendar Events
// URL: /me/calendarView?startDateTime={{30d_atras}}&endDateTime={{hoje}}
//
// IMPORTANTE: O N8N puxa TODAS as reunioes, mas o Code Node
// filtra apenas as que tem "<>" no Subject (reunioes de pipeline)
//
// Padroes aceitos:
//   "BitDefender <> Nome do Cliente"  (agendadas pela SecuriSoft)
//   "Defenz <> Nome do Cliente"       (agendadas pela equipe Defenz)
//   Qualquer assunto com "<>"         (futuras variações)
```

### 2.5 Code Node - Filtros por Periodo

```javascript
// Input: dados brutos de deals, calls, emails Apollo, reunioes Microsoft
// Output: 5 objetos (um para cada periodo)

const deals = $('Zoho Deals Bruto').first().json.data || [];
const calls = $('Zoho Calls Bruto').first().json.data || [];
const emailsApollo = $('Apollo Emails Bruto').first().json.emailer_messages || [];
const reunioesRaw = $('Microsoft Reunioes Bruto').first().json.value || [];

// FILTRO DE REUNIOES: apenas reunioes de pipeline (Subject contem "<>")
const reunioes = reunioesRaw.filter(r => r.subject?.includes('<>'));

const now = new Date();
const hoje = now.toISOString().split('T')[0];

// Funcao para calcular data X dias atras
const diasAtras = (dias) => {
  const d = new Date(now);
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
};

// Funcao para primeiro dia do mes
const primeiroDiaMes = () => {
  return hoje.slice(0, 8) + '01';
};

// Definir periodos
const periodos = [
  { id: 'hoje', inicio: hoje, fim: hoje },
  { id: '7d', inicio: diasAtras(7), fim: hoje },
  { id: '15d', inicio: diasAtras(15), fim: hoje },
  { id: '30d', inicio: diasAtras(30), fim: hoje },
  { id: 'mes', inicio: primeiroDiaMes(), fim: hoje }
];

// Funcao para filtrar por periodo
const filtrarPorData = (items, campoData, inicio, fim) => {
  return items.filter(item => {
    const data = item[campoData]?.split('T')[0];
    return data && data >= inicio && data <= fim;
  });
};

// Gerar metricas para cada periodo
const resultados = periodos.map(p => {
  // Filtrar deals
  const dealsNoPeriodo = filtrarPorData(deals, 'Created_Time', p.inicio, p.fim);
  const dealsAtivos = dealsNoPeriodo.filter(d =>
    d.Stage !== 'Fechado Ganho' && d.Stage !== 'Fechado perdido'
  );
  const dealsFechados = dealsNoPeriodo.filter(d => d.Stage === 'Fechado Ganho');

  // Filtrar calls
  const callsNoPeriodo = filtrarPorData(calls, 'Call_Start_Time', p.inicio, p.fim);
  const callsAtendidas = callsNoPeriodo.filter(c =>
    c.Subject?.toLowerCase().includes('atendida')
  );

  // Filtrar emails Apollo (apenas enviados)
  const emailsPeriodo = filtrarPorData(emailsApollo, 'completed_at', p.inicio, p.fim);

  // Reunioes de pipeline (ja filtradas por "<>" acima, agora filtra por data)
  const reunioesPeriodo = filtrarPorData(reunioes, 'start', p.inicio, p.fim);

  // Apresentacoes e Propostas (do Zoho Deals)
  const apresentacoes = dealsNoPeriodo.filter(d =>
    d.Resultados?.toUpperCase().includes('[APRESENTACAO]')
  ).length;
  const propostas = dealsNoPeriodo.filter(d =>
    d.Stage === 'Proposta Enviada' || d.Resultados?.toUpperCase().includes('[PROPOSTA]')
  ).length;

  // Valores
  const valorPipeline = dealsAtivos.reduce((s, d) => s + (parseFloat(d.Amount) || 0), 0);
  const valorFechado = dealsFechados.reduce((s, d) => s + (parseFloat(d.Amount) || 0), 0);

  // Ultimo cliente fechado
  const ultimoCliente = dealsFechados.sort((a, b) =>
    new Date(b.Created_Time) - new Date(a.Created_Time)
  )[0];

  return {
    data_coleta: hoje,
    periodo: p.id,
    data_inicio: p.inicio,
    data_fim: p.fim,
    ligacoes: callsNoPeriodo.length,
    ligacoes_atendidas: callsAtendidas.length,
    taxa_conectividade: callsNoPeriodo.length > 0
      ? Math.round((callsAtendidas.length / callsNoPeriodo.length) * 100)
      : 0,
    emails: emailsPeriodo.length,
    reunioes: reunioesPeriodo.length,
    apresentacoes: apresentacoes,
    propostas: propostas,
    deals_ativos: dealsAtivos.length,
    deals_fechados: dealsFechados.length,
    valor_pipeline: Math.round(valorPipeline * 100) / 100,
    valor_fechado: Math.round(valorFechado * 100) / 100,
    ultimo_cliente_nome: ultimoCliente?.Deal_Name || '',
    ultimo_cliente_origem: ultimoCliente?.Lead_Source || '',
    ultimo_cliente_valor: parseFloat(ultimoCliente?.Amount) || 0
  };
});

return resultados.map(r => ({ json: r }));
```

### 2.6 Google Sheets - Gravar Metricas

**Operacao:** Append ou Update
**Aba:** `metricas`
**Matching Column:** `data_coleta` + `periodo` (combinado)

---

## 3. FLUXO COMPLETO DO N8N

```
[Cron 6am]
    |
    v
[Definir Periodo 30 dias] --> data_inicio = 30 dias atras, data_fim = hoje
    |
    +---> [Apollo Emails Bruto] --> GET enviados ultimos 30 dias
    +---> [Zoho Deals Bruto] --> GET todos os deals recentes
    +---> [Zoho Calls Bruto] --> GET ultimos 30 dias
    +---> [Microsoft Reunioes Bruto] --> GET ultimos 30 dias
    |
    v
[Merge] --> Junta todos os dados brutos
    |
    v
[Code Node - Filtros] --> Filtra reunioes por "<>", aplica 5 periodos
    |
    v
[Split Out] --> Separa em 5 items
    |
    v
[Google Sheets - metricas] --> Grava/Atualiza as 5 linhas
    |
    +---> [Google Sheets - deals_ativos] --> Atualiza lista completa
    +---> [Google Sheets - clientes_fechados] --> Atualiza lista completa
```

---

## 4. DASHBOARD - STATUS DE IMPLEMENTACAO

### Ja implementado (codigo pronto)

- [x] `/api/dashboard-sheets/route.ts` - Le da planilha publica via Google Visualization API
- [x] Cache em memoria no servidor (30min)
- [x] Cache no cliente (sessionStorage, 30min)
- [x] Cascata de fontes: Cache -> Sheets -> N8N -> Mock
- [x] Badge indicador de fonte de dados (Cache/Planilha/N8N/Mock)
- [x] Mapeamento de periodos (today->hoje, 7d->7d, month->mes)

### Pendente (precisa ajustar no Dashboard)

- [ ] Remover referencia a `emails_microsoft` e `emails_total` na API route (simplificar para `emails` = Apollo)
- [ ] Ajustar mapeamento `deals_novos` na API route (hoje mapeia para `deals_ativos`, pode confundir)

### Pendente (N8N / Planilha)

- [ ] Criar aba `metricas` na planilha Google Sheets com as 18 colunas
- [ ] Tornar planilha publica para leitura
- [ ] Criar/modificar workflow N8N com os nos descritos acima
- [ ] Configurar Cron para 6am

---

## 5. CONVENCAO DE REUNIOES (IMPORTANTE)

Para que reunioes aparecam no funil do Dashboard, o **assunto do evento no Outlook** deve seguir o padrao:

```
[Origem] <> [Nome do Cliente]
```

**Exemplos:**
- `BitDefender <> Consube Agropecuaria` (SecuriSoft agenda)
- `Defenz <> FDC - Fundacao Dom Cabral` (equipe Defenz agenda)
- `BitDefender <> Allied Brasil` (SecuriSoft agenda)

**Regra:** Qualquer reuniao com `<>` no assunto sera contada como reuniao de pipeline.
Reunioes sem `<>` (internas, pessoais, etc.) sao ignoradas automaticamente.

---

## 6. FONTES

- [Zoho CRM API Directory](https://www.zoho.com/crm/developer/docs/api-directory.html)
- [Zoho CRM Field Meta Data API](https://www.zoho.com/crm/developer/docs/api/v8/field-meta.html)
- [Zoho CRM v8 API Docs](https://www.zoho.com/crm/developer/docs/api/v8/)
