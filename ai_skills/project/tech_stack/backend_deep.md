# Deep Backend Engineering (The "Senior" Standard)

## Description
Advanced patterns for High-Performance, Secure, and Scalable Backend logic in a Next.js Serverless + Neon (Postgres) environment. Extends `engineering_framework`.

## Persona
**Role:** Senior Backend Engineer (Performance & Security Specialist)
**Mindset:** "Trust nothing. Optimize everything. One query allows, two queries annoy, N+1 destroys."
**Mantra:** "The database is the bottleneck. The network is unreliable."

## Technical Grounding (The "Brain")
> *Auto-generated Research Notes:*
> * **Environment:** Vercel Serverless (Stateless, 10s timeout default).
> * **Database:** Neon Serverless Postgres (Pooler required, latency sensitive).
> * **ORM:** Prisma (Risk of generic queries fetching too much data).
> * **Consistency:** Eventual consistency is the enemy. Atomic Transactions (`$transaction`) are mandatory for multi-step mutations.

## Context & Rules
*   **Project:** Grafono.
*   **Non-Negotiables:**
    1.  **The "Select" Rule:** NEVER use `findMany` without a `select` clause. Fetching `*` (all columns) is forbidden for production tables.
    2.  **The Atomic Rule:** If you mutate >1 table (e.g., Create Patient + Log History), use `db.$transaction`.
    3.  **The Zod Rule:** Every Server Action MUST validate `input` via Zod before touching the DB.
    4.  **Error Codes:** Return specific `{ error: "INVALID_PHONE" }` codes, not just "Something went wrong".

## Workflow / Steps

### 1. "The Query Diet" (Read Optimization)
*   **Constraint:** Reduce payload size.
*   **Action:** Verify generated SQL (visualize in head).
*   **Bad:** `include: { appointments: true }` (Fetches all fields).
*   **Good:** `select: { appointments: { select: { date: true } } }`.

### 2. "Atomic Mutations" (Write Safety)
*   **Scenario:** Charging a credit card + Updating Balance.
*   **Pattern:**
    ```typescript
    await db.$transaction(async (tx) => {
        await tx.payment.create(...);
        await tx.user.update(...);
    });
    ```

### 3. "Defensive Drive" (Security)
*   User ID manipulation? -> Always derive `userId` from Session, never from Client Input.
*   Rate Limit? -> Check limits in sensitive actions (Login, Payment).

## Templates / Examples

### The "Deep" Server Action (Atomic & Validated)
```typescript
"use server";

import { db } from "@/lib/db";
import { z } from "zod";
import { auth } from "@/lib/auth"; // Hypothetical helper

const InputSchema = z.object({
    amount: z.number().positive(),
    patientId: z.string().uuid()
});

export async function processPayment(rawInput: unknown) {
    // 1. Auth Check (Layer 0)
    const session = await auth();
    if (!session) return { error: "UNAUTHORIZED" };

    // 2. Validation (Layer 1)
    const result = InputSchema.safeParse(rawInput);
    if (!result.success) return { error: "INVALID_INPUT", details: result.error.flatten() };
    
    const { amount, patientId } = result.data;

    try {
        // 3. Atomic Execution (Layer 2)
        return await db.$transaction(async (tx) => {
            // Check precondition
            const patient = await tx.patient.findUnique({ 
                where: { id: patientId }, 
                select: { id: true, balance: true } // Strict Select
            });
            if (!patient) throw new Error("PATIENT_NOT_FOUND");

            // Execute Logic
            const transaction = await tx.transaction.create({
                data: { amount, patientId, type: "INCOME" }
            });

            await tx.patient.update({
                where: { id: patientId },
                data: { balance: { increment: amount } }
            });

            return { success: true, transactionId: transaction.id };
        });
    } catch (e: any) {
        // 4. Controlled Failure (Layer 3)
        if (e.message === "PATIENT_NOT_FOUND") return { error: "PATIENT_NOT_FOUND" };
        console.error("Critical Payment Failure:", e);
        return { error: "INTERNAL_ERROR" };
    }
}
```
