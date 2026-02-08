# Sales Pipeline & KPI Protocols

## Description
Core business logic for calculating commercial metrics and sales pipeline health. These rules define "Truth" for the Defenz Sales Intelligence Dashboard.

## Persona
**Role:** Sales Operations Analyst / Revenue Analyst
**Mindset:** "Numbers tell the story, but only if the formula is right."
**Mantra:** "Valor Fechado is what hit the contract. Everything else is pipeline."

## Technical Grounding
> *Auto-generated Research Notes:*
> * **Metric:** Valor Pipeline. **Formula:** Sum of all active deal values (`valor_pipeline`).
> * **Metric:** Valor Fechado. **Formula:** Sum of all closed deal values (`valor_fechado`).
> * **Metric:** Taxa de Conectividade. **Formula:** `(ligacoes_atendidas / ligacoes) * 100`.
> * **Metric:** Conversion Funnel. **Flow:** Ligacoes -> Emails -> Reunioes -> Apresentacoes -> Propostas -> Deals Novos -> Deals Fechados.

## Context & Rules
*   **Project:** Defenz Dashboard.
*   **Non-Negotiables:**
    1.  **Currency Format:** Always BRL via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
    2.  **Date Boundaries:**
        *   **Hoje:** Current day only.
        *   **7/15/30 Dias:** Rolling window from today.
        *   **Este Mes:** 1st of current month to today.
    3.  **Funnel Integrity:** Each stage must be <= the previous stage. If `deals_fechados > deals_novos`, flag as inconsistency.
    4.  **Data Consistency:** Use `checkConsistency()` to validate that `deals_fechados` count matches `clientes_fechados` array length.

## Formulas

### 1. Taxa de Conectividade (Connection Rate)
```typescript
const taxa = (ligacoes_atendidas / ligacoes) * 100;
// Display as percentage with 1 decimal: "67.5%"
```

### 2. Pipeline Value
```typescript
// Sum of all active deal values from N8N data
const pipeline = data.valor_pipeline;
// Format: R$ 1.234.567,89
```

### 3. Conversion Rate (Stage to Stage)
```typescript
// Example: Emails to Reunioes conversion
const conversionRate = (reunioes / emails) * 100;
```

### 4. Sales Funnel Stages
```typescript
// The funnel follows this order (each stage <= previous):
const funnel = [
    { label: "Ligacoes", value: data.ligacoes },
    { label: "Emails", value: data.emails },
    { label: "Reunioes", value: data.reunioes },
    { label: "Apresentacoes", value: data.apresentacoes },
    { label: "Propostas", value: data.propostas },
    { label: "Deals Novos", value: data.deals_novos },
    { label: "Deals Fechados", value: data.deals_fechados },
];
```

### 5. Data Source Priority
```typescript
// 1. sessionStorage cache (30 min TTL)
// 2. Google Sheets (/api/dashboard-sheets)
// 3. N8N webhook (/api/dashboard)
// 4. Mock data (generateMockData())
```
