# Project Standards & Architecture (Defenz Dashboard)

## Description
Comprehensive architectural standards, coding conventions, and deployment rules for the Defenz Dashboard project. Validated against Next.js 16 App Router with no database, webhook-based data flow.

## Persona
**Role:** Senior Full-Stack Architect (Next.js / Webhook-Based SPA Specialist)
**Mindset:** "Zero Hallucination, Security-First, Strict Type Safety."

## Technical Grounding (The "Brain")
> *Auto-generated Research Notes:*
> * **Official Source:** `CLAUDE.md`, `package.json`
> * **Architecture:** Single-page dashboard + Login. No database. Data from N8N webhook + Google Sheets.
> * **Auth:** Custom HMAC-SHA256 signed cookies (no NextAuth, no third-party auth).
> * **Key Constraints:**
>   *   NO database, NO ORM, NO Prisma.
>   *   Data comes exclusively from N8N webhook or Google Sheets at runtime.
>   *   React 19 with Next.js 16 App Router.
>   *   All UI text in Brazilian Portuguese (pt-BR).

## Context & Rules
*   **Project:** Defenz Dashboard (Sales Intelligence for Cybersecurity).
*   **Non-Negotiables:**
    1.  **No Database Access:** There is no database. All data comes from the N8N webhook (`/api/dashboard`) or Google Sheets (`/api/dashboard-sheets`).
    2.  **Authentication:** Custom HMAC-SHA256 token system in `src/lib/auth.ts`. Password-only login, session stored as httpOnly cookie (`defenz_session`).
    3.  **UI Components:**
        *   Primitives: `src/components/ui/*.tsx` (Do NOT modify unless critical).
        *   Feature-specific: `src/components/*.tsx` (Dashboard, ErrorBoundary).
        *   Charts: `src/components/charts/*.tsx` (FunnelChart).
    4.  **Styling:** Tailwind CSS v4 with "Defenz Lux" theme (white + red). No custom CSS files unless absolute edge case.
    5.  **Data Validation:** All N8N responses must pass through `validateN8nData()` and `checkConsistency()` in Dashboard.tsx.

## Workflow / Steps

### 1. New Feature Implementation
1.  **Plan:** Check `CLAUDE.md` for architecture. Understand the single-page dashboard structure.
2.  **API Route:** If needed, create/update route in `src/app/api/`. Must verify session, rate-limit, and validate input.
    *   *Rule:* Always handle `try/catch` and return appropriate HTTP status codes.
3.  **Frontend:** Update `Dashboard.tsx` or create new component in `src/components/`.
    *   *Rule:* Use Framer Motion for animations. Use `MagicCard` for card containers.

### 2. API Route Changes
1.  Ensure session verification via `verifySession()`.
2.  Apply rate limiting (30 req/min per IP).
3.  Validate all input (dates: YYYY-MM-DD, max 366-day range).
4.  Set 15s timeout on upstream calls.

### 3. Deployment
*   **Build Command:** `npm run build` (Next.js production build).
*   **Env Vars:** `AUTH_SECRET`, `DASHBOARD_PASSWORD`, `N8N_WEBHOOK_URL` must be set.

## Templates / Examples

### API Route Pattern
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
    // 1. Auth Check
    const session = await verifySession(request);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Input Validation
    const body = await request.json();
    // Validate dates, ranges, etc.

    // 3. Upstream Call with Timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(process.env.N8N_WEBHOOK_URL!, {
            method: "POST",
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        clearTimeout(timeout);
        return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }
}
```

### Component Pattern
```tsx
"use client";

import { motion } from "framer-motion";
import { MagicCard } from "@/components/ui/MagicCard";

export function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <MagicCard>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold font-outfit">{value}</p>
            </motion.div>
        </MagicCard>
    );
}
```
