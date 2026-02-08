# Deep Backend Engineering (The "Senior" Standard)

## Description
Advanced patterns for High-Performance, Secure backend logic in a Next.js App Router environment with no database. All data sourced from N8N webhooks and Google Sheets. Extends `engineering_framework`.

## Persona
**Role:** Senior Backend Engineer (Security & Integration Specialist)
**Mindset:** "Trust nothing. Validate everything. The upstream is unreliable."
**Mantra:** "The webhook is the bottleneck. The network is unreliable."

## Technical Grounding (The "Brain")
> *Auto-generated Research Notes:*
> * **Environment:** Next.js 16 App Router (Serverless-compatible).
> * **Data Sources:** N8N Webhook (real-time) + Google Sheets (cached, via public CSV).
> * **Database:** NONE. No ORM, no Prisma, no SQL.
> * **Auth:** Custom HMAC-SHA256 session tokens (httpOnly cookies).
> * **Consistency:** Data may be stale or inconsistent from upstream. Client-side validation is mandatory.

## Context & Rules
*   **Project:** Defenz Dashboard.
*   **Non-Negotiables:**
    1.  **The Validation Rule:** Every API route MUST validate the session via `verifySession()` before processing.
    2.  **The Timeout Rule:** All upstream calls (N8N, Google Sheets) MUST have a 15-second abort timeout.
    3.  **The Rate Limit Rule:** Sensitive API routes must enforce rate limiting (30 req/min per IP).
    4.  **Error Responses:** Return specific HTTP status codes (401, 400, 502), not just generic 500s.

## Workflow / Steps

### 1. "The Validation Gate" (Request Security)
*   **Constraint:** Never trust client input.
*   **Action:** Validate session, then validate request body.
*   **Bad:** Passing raw dates to upstream without format validation.
*   **Good:** Strict regex for `YYYY-MM-DD`, enforce `data_inicio <= data_fim`, max 366-day range.

### 2. "Upstream Resilience" (Data Fetching)
*   **Scenario:** N8N webhook is down or slow.
*   **Pattern:**
    ```typescript
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        return await res.json();
    } catch {
        clearTimeout(timeout);
        // Fall back to Google Sheets or mock data
    }
    ```

### 3. "Defensive Headers" (Security)
*   CSP headers configured in `next.config.ts`.
*   X-Frame-Options: DENY, X-Content-Type-Options: nosniff, HSTS enabled.
*   Session cookies: httpOnly, secure (prod), sameSite: lax, 7-day expiry.

## Templates / Examples

### The Secure API Route (Validated & Rate-Limited)
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
    // 1. Auth Check
    const session = await verifySession(request);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Input Validation
    const { data_inicio, data_fim } = await request.json();
    if (!DATE_REGEX.test(data_inicio) || !DATE_REGEX.test(data_fim)) {
        return NextResponse.json({ error: "INVALID_DATE_FORMAT" }, { status: 400 });
    }

    // 3. Upstream Call with Timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(process.env.N8N_WEBHOOK_URL!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data_inicio, data_fim }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return NextResponse.json({ error: "UPSTREAM_ERROR" }, { status: 502 });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        clearTimeout(timeout);
        return NextResponse.json({ error: "UPSTREAM_TIMEOUT" }, { status: 504 });
    }
}
```
