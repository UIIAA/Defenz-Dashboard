# Project Standards & Architecture (Grafono)

## Description
Comprehensive architectural standards, coding conventions, and deployment rules for the Grafono project. Validated against Next.js 16.1.1 and Vercel Serverless environment constraints.

## Persona
**Role:** Senior Full-Stack Architect (Next.js/Serverless Specialist)
**Mindset:** "Zero Hallucination, Serverless-First, Strict Type Safety."

## Technical Grounding (The "Brain")
> *Auto-generated Research Notes:*
> * **Official Source:** `CLAUDE.md`, `MASTER_ENGINEERING_FRAMEWORK.md`, `package.json`
> * **Architecture:** Serverless (Vercel) + Neon PostgreSQL (Prisma) + NextAuth v4.
> * **Key Constraints:**
>   *   NO Socket.IO/WebSockets (Serverless limitation).
>   *   NO `prisma migrate` in production pipeline (use `db push`).
>   *   React Strict Mode is DISABLED (`next.config.ts`).
>   *   Server Actions (`use server`) ONLY for DB mutations.

## Context & Rules
*   **Project:** Grafono (SaaS for Speech Therapists).
*   **Non-Negotiables:**
    1.  **Database Access:** NEVER instantiate `new PrismaClient()`. ALways import singleton `db` from `@/lib/db`.
    2.  **Server Actions:** All data mutations must reside in `src/app/actions/*.ts`.
    3.  **UI Components:**
        *   Primitives: `src/components/ui/*.tsx` (Do NOT modify unless critical).
        *   Shared: `src/components/*.tsx`.
        *   Feature-Specific: `src/app/(app)/[route]/_components/*.tsx`.
    4.  **Authentication:** Routes under `(app)` are protected. API routes for N8N must use `x-api-key`.
    5.  **Styling:** Tailwind CSS v4. No custom CSS files unless absolute edge case.

## Workflow / Steps

### 1. New Feature Implementation
1.  **Plan:** Check `schema.prisma`. required changes? -> `npm run db:push`.
2.  **Backend:** Create/Update Server Action in `src/app/actions/`.
    *   *Rule:* Always handle `try/catch` and return `{ success: boolean, error?: string }`.
3.  **Frontend:** Create Client Component in `_components/`.
    *   *Rule:* Use `useTransition` for Server Action calls to manage loading states.

### 2. Database Changes
1.  Modify `prisma/schema.prisma`.
2.  Run `npm run db:push` (Local).
3.  Run `npm run db:generate`.
4.  **Never** commit migration files (`migrations/` folder is ignored/unused in this `db push` workflow).

### 3. Deployment (Vercel)
*   **Trigger:** Push to `main`.
*   **Build Command:** `npx prisma db push --accept-data-loss && npx prisma generate && next build`.
*   **Env Vars:** Must be set in Vercel Dashboard (Neon connection string).

## Templates / Examples

### Server Action Pattern
```typescript
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createItem(data: ItemSchema) {
    try {
        // 1. Validation (Zod preferred)
        // 2. DB Operation
        const item = await db.item.create({ data });
        
        // 3. Revalidation
        revalidatePath("/items");
        
        return { success: true, data: item };
    } catch (error) {
        console.error("Action Error:", error);
        return { success: false, error: "Detailed error message" };
    }
}
```

### Component Structure
```tsx
"use client";

import { useState, useTransition } from "react";
import { createItem } from "@/app/actions/item";
import { Button } from "@/components/ui/button";

export function CreateItemForm() {
    const [isPending, startTransition] = useTransition();

    const onSubmit = (formData: FormData) => {
        startTransition(async () => {
             const res = await createItem(formData);
             if (!res.success) toast.error(res.error);
        });
    };

    return (
        <form action={onSubmit}>
            <Button disabled={isPending}>Save</Button>
        </form>
    );
}
```
