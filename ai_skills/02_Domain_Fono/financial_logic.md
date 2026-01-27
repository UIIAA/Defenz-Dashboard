# Financial Logic & KPI Protocols

## Description
Core business logic for calculating clinical financial health. These rules define "Truth" for the Finance Dashboard.

## Persona
**Role:** CFO / Clinical Auditor
**Mindset:** "Numbers tell the story, but only if the formula is right."
**Mantra:** "Receita Real is what hit the bank. Everything else is fantasy."

## Technical Grounding
> *Auto-generated Research Notes:*
> * **Metric:** Net Profit (Lucro Real). **Formula:** (Paid Incomes) - (Paid Expenses).
> * **Metric:** Occupancy (Ocupação). **Window:** "This Week" (Mon-Sun) vs "This Month" (1st to 1st). **Formula:** (Hours Sold) / (Hours Available).
> * **Metric:** Avg Ticket (Ticket Médio). **Formula:** (Total Invoiced Revenue) / (Total Appointments Realized).
> * **Metric:** Forecast (Previsão). **Scope:** Current Month (Remaining).

## Context & Rules
*   **Project:** Grafono Dashboard.
*   **Non-Negotiables:**
    1.  **"Lucro Real" Definition:** Rename UI to **"Resultado Caixa"** or "Recebido Líquido". It strictly equals `SUM(Transaction WHERE status='PAID' AND flow='INCOME') - SUM(Transaction WHERE status='PAID' AND flow='EXPENSE')`.
    2.  **Date Boundaries:**
        *   **Month:** 1st 00:00:00 to Last Day 23:59:59.
        *   **Week:** Monday 00:00:00 to Sunday 23:59:59.
    3.  **Ticket Integrity:** Do NOT divide by "Scheduled" appointments. Only "Realized" (Realizado) count for actual ticket.
    4.  **Forecast:** Only include PENDING items due within the current month boundary.

## Formulas

### 1. Lucro Real (Cash Flow Result)
```typescript
const income = await db.transaction.aggregate({
    _sum: { amount: true },
    where: { 
        status: { in: ['PAID', 'PAGO', 'pago'] },
        flow: 'INCOME',
        paymentDate: { gte: startOfMonth, lte: endOfMonth }
    }
});
const expense = await db.transaction.aggregate({
    _sum: { amount: true },
    where: { 
        status: { in: ['PAID', 'PAGO', 'pago'] }, // Paid expenses only? Usually yes for Cash Flow.
        flow: 'EXPENSE',
        paymentDate: { gte: startOfMonth, lte: endOfMonth }
    }
});
return (income._sum.amount || 0) - (expense._sum.amount || 0);
```

### 2. Occupancy Rate (Taxa de Ocupação)
*   **Capacity:** Sum of all available slots in the period (Week or Month).
*   **Occupied:** Count of appointments causing a "busy" status in that period.
*   **Formula:** `(Occupied Hours / Capacity Hours) * 100`.

### 3. Average Ticket (Ticket Médio)
*   User specified: "Dividing number of appointments... by total value patient will pay".
*   Wait, standard is Value / Count. User wrote: *"...dividindo o número de atendimentos... pelo valor total"*.
*   *Correction Reference:* `Count / Value` = "Appointments per Real". This is inverted.
*   *Assumption:* User meant standard Ticket: `Total Value / Total Appointments`.
*   *Refined Formula:* `(Total Revenue Realized) / (Count of 'Realized' Appointments)`.

### 4. Forecast (Previsão)
```typescript
const generatedPending = SUM(Transactions WHERE status='PENDING' AND dueDate in Month);
const potentialAppointments = SUM(Appointments WHERE status='Agendado' AND date in Month AND Patient != Monthly);
return generatedPending + potentialAppointments;
```
