---
name: Master Agent Protocol
description: The PRIMARY directive for all AI Agents working on GraFono. Defines the mandatory workflow for selecting and applying specialized skills.
---

# 🛡️ Master Agent Protocol (MAP) v1.0

> **CRITICAL INSTRUCTION**: You must ALWAYS consult this protocol before starting any complex task.

## 1. 🧠 Context Awareness & Skill Selection
Before writing a single line of code, you MUST scan the `ai_skills` directory and select the relevant frameworks for the task at hand.

### 🗺️ Skill Map (When to use what)

| Task Type | Support Skill | Path |
| :--- | :--- | :--- |
| **Process / Governance** | **Engineering Framework** | `00_Meta/engineering_framework.md` |
| **Backend Implementation** | **Backend Deep** | `01_Tech_Stack/backend_deep.md` |
| **Frontend / UI / UX** | **Frontend Premium** | `01_Tech_Stack/frontend_premium.md` (Verify existence) |
| **Testing / QA** | **Deep Testing** | `01_Tech_Stack/testing_deep.md` (Verify existence) |
| **New Features** | **Project Standards** | `00_Meta/project_standards.md` |
| **Domain Logic** | **Fonoaudiologia** | `02_Domain_Fono/*` |

### ⚖️ Core Distinctions: Framework vs. Skill
It is crucial to understand the difference between the **Engineering Framework** and the **Backend Deep** skill:

| Feature | 🏛️ Engineering Framework (`00_Meta`) | ⚙️ Backend Deep (`01_Tech_Stack`) |
| :--- | :--- | :--- |
| **Focus** | **Process & Governance** | **Code & Implementation** |
| **Question** | "Is this task complex? Do I need a plan?" | "How do I write this safe & fast?" |
| **Tools** | SDD Score, Implementation Plans, V-Model | Transaction patterns, Zod validation, Prisma queries |
| **When to use** | **START** of every task (Planning Phase) | **DURING** coding (Execution Phase) |

## 2. 🏗️ The Golden Workflow (from Engineering Framework)
You must adhere to the **V-Model** defined in the Engineering Framework:
1.  **Plan**: Understand requirements -> Select Skills -> Create `implementation_plan.md`.
2.  **Act**: Implement changes -> Check side-effects.
3.  **Verify**: Run tests -> Build check -> Manual verification plan.

## 3. 🚫 Anti-Patterns (Dos & Don'ts)
*   **DO NOT** invent new UI styles. Use the "Premium" guidelines (Pill tabs, Shadcn, Tailwind).
*   **DO NOT** leave "zombie code" (commented out blocks). Delete it.
*   **DO NOT** assume database state. Always verify `schema.prisma` constraints (like `@unique`).
*   **DO NOT** execute potentially destructive SQL/Shell without explicit confirmation or safe flags.

## 4. 📝 Documentation
*   Every major change must be reflected in `task.md` (Progress).
*   Every completed feature must be documented in `walkthrough.md` (Evidence).

---
*If you are unsure which skill applies, default to `engineering_framework.md` for safety and structure.*
