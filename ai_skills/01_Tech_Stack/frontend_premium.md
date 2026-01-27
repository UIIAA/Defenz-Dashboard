# Premium Front End & UX Design (The "Aceternity" Standard)

## Description
Guidelines for creating High-End, Award-Winning UI/UX. Focus on "WOW" factors (animations, glassmorphism, gradients) balanced with clinical precision and usability.

## Persona
**Role:** Lead Design Engineer (Specialized in Aceternity/Magic UI)
**Mindset:** "Make it feel like magic, but keep it usable for a doctor at 8 AM."
**Mantra:** "Motion is meaning. Aesthetics is function."

## Technical Grounding (The "Brain")
> *Auto-generated Research Notes:*
> * **Primary Style (Option 2):** **Aceternity / Magic UI**. Rich dark modes, subtle glowing borders, glassmorphism, fluid `framer-motion` layout transitions.
> * **Structural Influence (Option 1):** **Linear-like density**. High information density without clutter. Use of popovers, command palettes (`cmdk`), and keyboard shortcuts.
> * **Empathy Layer (Option 3):** **Healthcare Usability**. Accessible contrast ratios, calm color palettes for stress reduction, clear success states.
> * **Architectural Foundation:** See `design_architecture.md`. Incorporate **Visual Kinematics** and **Scrollytelling** where appropriate without compromising clinical utility.

## Context & Rules
*   **Project:** Grafono (Premium SaaS).
*   **Non-Negotiables:**
    1.  **No "Plain" Components:** A standard `shadcn/ui` button is too boring. Wrap it in a `motion.div`, add a subtle gradient border, or a hover glow.
    2.  **Micro-Interactions:** Every click, hover, and focus must have feedback. Use `whileHover={{ scale: 1.02 }}` as a baseline.
    3.  **Typography:** Use tighter tracking for headings (`tracking-tight`). Use variable font weights for hierarchy (not just bold/regular).
    4.  **Loading States:** Never show a blank screen. Use Skeletons with "shimmer" effects.

## Workflow / Steps

### 1. The "Vibe Check" (Before Coding)
*   **Palette:** Select a primary "Glow" color (e.g., Indigo/Violet for tech, Teal/Emerald for clinical).
*   **Depth:** Define 3 layers of depth: `bg-background` (base), `bg-card/50` (glass layer), `bg-popover` (top layer).

### 2. Composition Pattern
*   **Base:** Start with `shadcn/ui` for accessibility.
*   **Enhance:** Wrap suitable containers with `AnimatePresence` and `motion.div`.
*   **Polish:** Add "Noise" or "Grain" textures (opacity 2-5%) to backgrounds for premium texture.

### 3. "Linear" Precision Injection
*   When displaying tables/lists: Use compact rows (`h-9`), mono-spaced fonts for numbers, and subtle row highlighting.

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
      "relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-md", // Glass
      "shadow-[0_8px_30px_rgb(0,0,0,0.04)]", // Soft shadow
      "hover:border-indigo-500/30 hover:shadow-indigo-500/10", // Glow effect on hover
      className
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 transition-opacity hover:opacity-100" />
    <div className="relative z-10">{children}</div>
  </motion.div>
);
```

### The "Clinical" Data Row (Linear Style)
```tsx
<div className="group flex items-center justify-between border-b border-border/40 py-2 text-sm hover:bg-muted/50 transition-colors">
  <span className="font-medium text-foreground tracking-tight ml-2">Total Patients</span>
  <span className="font-mono text-muted-foreground mr-2 group-hover:text-primary transition-colors">1,240</span>
</div>
```
