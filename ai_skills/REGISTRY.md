# AI Skills Registry v2.0

> **Single Source of Truth** for all agents, models, and skills in this system.
> Read this file FIRST before invoking any agent or loading any skill.

---

## Model Protocol

| Tier | Model ID | Role | When to Use |
|------|----------|------|-------------|
| **Opus** | `claude-opus-4-5` | Chat principal | Architecture decisions, engineering governance, complex synthesis, user-facing reasoning |
| **Sonnet** | `claude-sonnet-4-5` | Execution agents | All Task-based agents: explore, plan, build, design, review |
| **Haiku** | `claude-haiku-4` | Lightweight tasks | Documentation, reports, simple lookups, formatting |

### Rules
- Opus is NEVER used inside a `Task()` call. It runs only as the main conversation model.
- Sonnet is the DEFAULT for all `Task(subagent_type, model="sonnet")` invocations.
- Haiku is used ONLY for `documenter` agent and trivial queries via `Task(model="haiku")`.

---

## Agent Catalog

| ID | Name | Model | `Task(subagent_type)` | Core Skills | Project Skills | Purpose |
|----|------|-------|-----------------------|-------------|----------------|---------|
| `explorer` | Codebase Explorer | Sonnet | `Explore` | master_protocol, engineering_framework | -- | Navigate and understand codebases |
| `planner` | Architecture Planner | Sonnet | `Plan` | master_protocol, engineering_framework, skill_creator | standards | Design implementation strategies |
| `builder` | Implementation Builder | Sonnet | `general-purpose` | master_protocol, engineering_framework | backend_deep, frontend_premium, standards | Write and modify code |
| `designer` | UI/UX Designer | Sonnet | `Super-designer` | master_protocol | design_architecture, frontend_premium | Premium visual design |
| `reviewer` | Engineering Lead | Sonnet | `general-purpose` | master_protocol, engineering_framework, testing_deep | standards | Code review, QA governance |
| `documenter` | Report Writer | **Haiku** | `general-purpose` | master_protocol | -- | Documentation, reports, summaries |

### Agent Invocation Pattern

```
1. Read REGISTRY.md -> identify which agent fits the task
2. Load agent definition: core/agents/{id}/AGENT.md
3. Load core skills: core/meta/{skill}.md or core/skills/{skill}.md
4. Load project skills: project/**/{skill}.md (if applicable)
5. Compose prompt with all loaded context
6. Invoke: Task(subagent_type="{mapping}", model="{model}", prompt="{composed}")
```

---

## Skills Catalog

### Core Skills (Portable)

| Skill | File | Type | Used By |
|-------|------|------|---------|
| Master Protocol | `core/meta/master_protocol.md` | Meta | ALL agents |
| Engineering Framework | `core/meta/engineering_framework.md` | Meta | explorer, planner, builder, reviewer |
| Skill Creator | `core/meta/skill_creator.md` | Meta | planner |
| Testing Deep | `core/skills/testing_deep.md` | QA | reviewer |

### Project Skills (Grafono-specific)

| Skill | File | Type | Used By |
|-------|------|------|---------|
| Project Standards | `project/standards.md` | Architecture | planner, builder, reviewer |
| Design Architecture | `project/tech_stack/design_architecture.md` | Frontend | designer |
| Frontend Premium | `project/tech_stack/frontend_premium.md` | Frontend | builder, designer |
| Backend Deep | `project/tech_stack/backend_deep.md` | Backend | builder |
| Financial Logic | `project/domain/financial_logic.md` | Domain | builder |
| Regras Clinicas | `project/domain/regras_clinicas.md` | Domain | builder |
| Fluxos N8N | `project/domain/fluxos_n8n.md` | Domain | builder |

---

## Directory Structure

```
ai_skills/
├── REGISTRY.md                    # THIS FILE - source of truth
│
├── core/                          # PORTABLE - copy to any project
│   ├── meta/
│   │   ├── master_protocol.md     # MAP v2.0
│   │   ├── engineering_framework.md
│   │   └── skill_creator.md
│   │
│   ├── agents/
│   │   ├── explorer/AGENT.md
│   │   ├── planner/AGENT.md
│   │   ├── builder/AGENT.md
│   │   ├── designer/AGENT.md
│   │   ├── reviewer/AGENT.md
│   │   └── documenter/AGENT.md
│   │
│   └── skills/
│       └── testing_deep.md
│
└── project/                       # PROJECT-SPECIFIC
    ├── standards.md
    │
    ├── tech_stack/
    │   ├── design_architecture.md
    │   ├── frontend_premium.md
    │   └── backend_deep.md
    │
    └── domain/
        ├── financial_logic.md
        ├── regras_clinicas.md
        └── fluxos_n8n.md
```

---

## Portability Guide

To use this system in a new project:

1. **Copy** the entire `core/` directory (no changes needed)
2. **Copy** `REGISTRY.md`
3. **Create** a new `project/` directory with project-specific skills
4. **Update** the "Project Skills" section in REGISTRY.md
5. Agent definitions in `core/agents/` remain unchanged
