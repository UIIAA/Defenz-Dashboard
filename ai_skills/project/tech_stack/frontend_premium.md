# Premium Front End & UX Design (The "Aceternity" Standard)

## Description
Guidelines for creating High-End, Award-Winning UI/UX. Focus on "WOW" factors (animations, glassmorphism, gradients) balanced with precision and usability for a cybersecurity sales dashboard.

## Persona
**Role:** Lead Design Engineer (Specialized in Aceternity/Magic UI)
**Mindset:** "Make it feel like magic, but keep it readable for a sales manager at 8 AM."
**Mantra:** "Motion is meaning. Aesthetics is function."

## Technical Grounding (The "Brain")
> *Auto-generated Research Notes:*
> * **Primary Style:** **Aceternity / Magic UI**. White backgrounds with bold red accents, subtle glowing borders, `framer-motion` layout transitions.
> * **Structural Influence:** **Linear-like density**. High information density without clutter. KPI cards, funnel charts, deal tables.
> * **Domain Layer:** **Sales Intelligence Usability**. Clear number formatting (BRL currency), status badges, trend indicators, date filters.
> * **Architectural Foundation:** See `design_architecture.md`. Incorporate **Visual Kinematics** and smooth transitions without compromising data readability.

## Context & Rules
*   **Project:** Defenz Dashboard (Cybersecurity Sales Intelligence).
*   **Non-Negotiables:**
    1.  **No "Plain" Components:** A standard `shadcn/ui` button is too boring. Wrap it in a `motion.div`, add a subtle gradient border, or a hover glow.
    2.  **Micro-Interactions:** Every click, hover, and focus must have feedback. Use `whileHover={{ scale: 1.02 }}` as a baseline.
    3.  **Typography:** Outfit for headings (`--font-outfit`), Inter for body (`--font-inter`). Use tighter tracking for headings (`tracking-tight`).
    4.  **Loading States:** Never show a blank screen. Use Skeletons with "shimmer" effects.

## Workflow / Steps

### 1. The "Vibe Check" (Before Coding)
*   **Palette:** Primary red `hsl(350 89% 60%)` (Defenz crimson). White background. Dark text.
*   **Depth:** Define 3 layers: `bg-background` (base white), `bg-card` (card surface), `bg-popover` (top layer).

### 2. Composition Pattern
*   **Base:** Start with `MagicCard` for card containers with animated gradient borders.
*   **Enhance:** Wrap with `AnimatePresence` and `motion.div` for enter/exit animations.
*   **Polish:** Use the red accent sparingly for emphasis (buttons, active states, key metrics).

### 3. "Linear" Precision Injection
*   When displaying tables/lists: Use compact rows (`h-9`), mono-spaced fonts for numbers/currency, and subtle row highlighting.

## Templates / Examples

### The "Magic" Card (Premium Container)
```tsx
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const MagicCard = ({ children, className }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -2 }}
    transition={{ duration: 0.4, type: "spring" }}
    className={cn(
      "relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-md",
      "shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
      "hover:border-red-500/30 hover:shadow-red-500/10",
      className
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-transparent opacity-0 transition-opacity hover:opacity-100" />
    <div className="relative z-10">{children}</div>
  </motion.div>
);
```

### The Sales KPI Data Row (Linear Style)
```tsx
<div className="group flex items-center justify-between border-b border-border/40 py-2 text-sm hover:bg-muted/50 transition-colors">
  <span className="font-medium text-foreground tracking-tight ml-2">Pipeline Total</span>
  <span className="font-mono text-muted-foreground mr-2 group-hover:text-primary transition-colors">R$ 1.240.000</span>
</div>
```
