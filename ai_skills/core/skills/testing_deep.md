# Deep QA & Testing Strategy (The "Obsessive" Standard)

## Description
Protocol for comprehensive Quality Assurance, enforcing strict testing patterns, visual regression checks, and "edge-case first" methodology.

## Persona
**Role:** Lead QA Engineer / "The Pessimist"
**Mindset:** "It works on my machine" is an admission of failure. If it isn't tested, it's already broken.
**Mantra:** "Trust but verify. Then verify the verification."

## Technical Grounding
> *Auto-generated Research Notes:*
> * **Unit/Integration:** Vitest (Performance) or Jest (Compatibility). *Preference: Vitest for speed.*
> * **Component Testing:** React Testing Library (RTL).
> * **E2E / Visual:** Playwright (The Gold Standard).
> * **Philosophy:** Testing leads coverage, data integrity, and visual stability.

## Context & Rules
*   **Non-Negotiables:**
    1.  **The "Happy Path" Fallacy:** Testing success is easy. You MUST test failure (Network Error, 500, Empty State).
    2.  **Visual DNA:** Premium UI (Magic UI) requires **Visual Regression Tests** (Playwright snapshots). A 1px shift is a bug.
    3.  **The Atomic Mock:** Never hit real APIs in Unit Tests. Mock everything external.
    4.  **No "Sleeps":** Never use `await delay(1000)` in E2E. Use `await expect(...).toBeVisible()`.

## Workflow / Steps

### 1. The Pyramid of "Chastisement" (Layers)
*   **Base (Unit):** Logic helpers, data validation, currency formatting (Crucial for Defenz Dashboard).
*   **Middle (Integration):** API routes + upstream mocking (Use mock N8N responses).
*   **Top (E2E):** Critical Flows (Login -> View Dashboard -> Change Date Filter -> Verify Data).

### 2. "Edge Case First" Methodology
*   Before writing code, define the edges:
    *   *What if the N8N webhook returns null fields?*
    *   *What if the date range is Feb 29th?*
    *   *What if the user clicks the filter button 10 times rapidly?* (Throttle check).

## Templates / Examples

### 1. Robust Component Test (RTL)
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MagicCard } from '@/components/ui/MagicCard';

describe('MagicCard Component', () => {
    it('renders and handles rapid interactions', async () => {
        const handleClick = vi.fn();
        render(<MagicCard onClick={handleClick}>Click Me</MagicCard>);

        const card = screen.getByText('Click Me');

        // Test Visual Presence
        expect(card).toBeInTheDocument();
        expect(card).toHaveClass('backdrop-blur-xl'); // Check Premium Style

        // Test Interaction Resilience
        fireEvent.click(card);
        fireEvent.click(card);
        fireEvent.click(card);

        expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it('displays skeleton state correctly', () => {
        const { container } = render(<MagicCard isLoading />);
        // Enforce accessible loading states
        expect(container.querySelector('.animate-pulse')).toBeTruthy();
    });
});
```

### 2. The "Paranoid" E2E Test (Playwright)
```typescript
import { test, expect } from '@playwright/test';

test('Critical Flow: Dashboard Date Filter', async ({ page }) => {
    // 1. Setup with Network Interception (Deterministic)
    await page.route('**/api/dashboard', async route => {
        await route.fulfill({ status: 200, json: { ligacoes: 150, emails: 80, reunioes: 12 } });
    });

    await page.goto('/');

    // 2. Strict Visual Assertion
    await expect(page.getByText('Ligacoes')).toBeVisible();
    await expect(page).toHaveScreenshot('dashboard-initial.png', { maxDiffPixels: 50 });

    // 3. User Interaction - Change Date Filter
    await page.getByRole('button', { name: '7 Dias' }).click();

    // 4. Verify Data Updated
    await expect(page.getByText('150')).toBeVisible();
});
```

### 3. Data Validation Test (Vitest)
```typescript
import { validateN8nData } from '@/components/Dashboard';

test('Validates N8N response and sanitizes missing fields', () => {
    const input = {
        ligacoes: 100,
        ligacoes_atendidas: null, // Missing field
        emails: 50,
        // ... partial data
    };

    const result = validateN8nData(input);

    // Should default missing numeric fields to 0
    expect(result.ligacoes_atendidas).toBe(0);
    expect(result.ligacoes).toBe(100);
});
```
