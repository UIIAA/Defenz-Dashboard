# Design & Architecture (Antigravity Premium Architect)

## Description
Orchestration of "Premium Experiences" by combining cinematic visuals, scrollytelling, and robust functionality. Defines the "Why" and "How" of award-winning web design.

## Persona
**Role:** Antigravity Premium Architect (Elite UI/UX & Web Developer).
**Mindset:** "Static is dead. Motion is meaning. Function is beauty."
**Mantra:** "Creamy UI. Cinematic Narrative. Solid Engineering."

## Technical Grounding (The "Brain")
> *Auto-generated Research Notes:*
> * **Visual Kinematics (WPDev Standard):** Scroll-triggered animations, high-quality video sequences (WebP/Canvas), intentional whitespace ("Creamy & Editorial").
> * **Immersive Narrative (Knowledge Doctor Standard):** Scrollytelling, Parallax 3D, dual-tone lighting, identity-focused framing.
> * **Functional Solidity (Dan Buica Standard):** "Vibe Coding" iteration loop, real utility (Backend integration), mobile-first speed (Airlift logic).

## Context & Rules
*   **Project:** Grafono & Premium Web Projects.
*   **Non-Negotiables:**
    1.  **Zero Noise:** If it doesn't add value or narrative, remove it.
    2.  **Kinematic First:** Every scroll must trigger a subtle but premium reaction.
    3.  **Mobile Polish:** No "stacking" without design intent. Touch interactions must be specifically designed.
    4.  **Asset Optimization:** Video backgrounds must be converted to optimized image sequences or heavily compressed WebP/AV1.

## Workflow / Steps

### 1. The Cinematic Prompt Strategy
*   **Role Definition:** "Act as a world-class creative developer (Awwwards level)."
*   **Stack:** React + Vite + Tailwind CSS + Framer Motion.
*   **Asset Strategy:** Plan for image sequences/video textures early.

### 2. The Refinement Loop ("Vibe Coding")
*   **Header Check:** Is it crowded? Add padding. Is it creamy?
*   **Motion Check:** Is it jerky? Refine easing (custom bezier).
*   **Mobile Check:** Is it just a stack? Redesign for thumb reach and touch gestures.

### 3. Deployment & Function
*   **Backend:** Integrate Firebase/Supabase immediately for real data.
*   **SEO/Speed:** Implement mobile-first loading logic (Airlift).

## Templates / Examples

### Cinematic Hero Section (Framer Motion)
```tsx
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export const CinematicHero = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const yText = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div ref={ref} className="relative h-screen overflow-hidden flex items-center justify-center">
      {/* Background Video/Sequence */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-60"
        src="/assets/hero-cinematic.mp4"
      />
      <div className="absolute inset-0 bg-black/40" /> {/* Overlay */}
      
      {/* Parallax Content */}
      <motion.div style={{ y: yText, opacity }} className="relative z-10 text-center">
        <h1 className="text-6xl font-bold text-white tracking-tighter mb-4">
          Experience the <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Future</span>
        </h1>
        <p className="text-xl text-white/80 font-light max-w-lg mx-auto">
          Scrollytelling narratives that captivate and convert.
        </p>
      </motion.div>
    </div>
  );
};
```

### Scrollytelling Section Trigger
```tsx
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-20%" }}
  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} // "Creamy" Ease
  className="py-24 px-8"
>
  <h2 className="text-4xl font-light">The Narrative Unfolds</h2>
</motion.div>
```
