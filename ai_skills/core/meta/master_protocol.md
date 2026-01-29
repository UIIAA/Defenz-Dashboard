---
name: Master Agent Protocol
version: "2.0"
description: The PRIMARY directive for all AI Agents. Defines the mandatory workflow for selecting agents, loading skills, and executing tasks.
---

# Master Agent Protocol (MAP) v2.0

> **CRITICAL INSTRUCTION**: You must ALWAYS consult `REGISTRY.md` and this protocol before starting any complex task.

## 1. Registry-First Workflow

Before writing a single line of code, consult `ai_skills/REGISTRY.md` to:
1. **Identify** which agent fits the task (explorer, planner, builder, designer, reviewer, documenter).
2. **Load** the agent's AGENT.md from `core/agents/{id}/AGENT.md`.
3. **Load** the agent's required skills (core + project) as listed in the AGENT.md frontmatter.
4. **Invoke** using the correct `Task(subagent_type, model)` mapping from the registry.

## 2. Skill Map (Updated Paths)

| Task Type | Skill | Path |
| :--- | :--- | :--- |
| **Process / Governance** | Engineering Framework | `core/meta/engineering_framework.md` |
| **Backend Implementation** | Backend Deep | `project/tech_stack/backend_deep.md` |
| **Frontend / UI / UX** | Frontend Premium | `project/tech_stack/frontend_premium.md` |
| **Design Architecture** | Design Architecture | `project/tech_stack/design_architecture.md` |
| **Testing / QA** | Deep Testing | `core/skills/testing_deep.md` |
| **New Features** | Project Standards | `project/standards.md` |
| **Domain Logic** | Domain Skills | `project/domain/*` |
| **Skill Creation** | Skill Creator | `core/meta/skill_creator.md` |

### Core vs. Project Distinction

| Aspect | Core (`core/`) | Project (`project/`) |
| :--- | :--- | :--- |
| **Scope** | Universal, portable across projects | Specific to current project |
| **Contains** | Protocols, agent definitions, generic QA | Tech stack, domain logic, standards |
| **Modify?** | Rarely - evolves across all projects | Frequently - adapts per project |

## 3. Model Protocol

| Tier | Model | Role |
|------|-------|------|
| **Opus** | claude-opus-4-5 | ONLY the main chat. Architecture, synthesis, decisions. |
| **Sonnet** | claude-sonnet-4-5 | ALL execution agents (Task calls). |
| **Haiku** | claude-haiku-4 | Documentation, reports, simple queries. |

**Rule**: Opus NEVER runs inside a Task(). Sonnet is the default agent model. Haiku only for documenter.

## 4. The Golden Workflow (V-Model)

1. **Plan**: Understand requirements -> Consult REGISTRY.md -> Select agent -> Load skills.
2. **Act**: Invoke agent with composed prompt (AGENT.md + skills context).
3. **Verify**: Check output against requirements -> Build check -> Manual verification if needed.

## 5. Anti-Patterns

- **DO NOT** invent new UI styles. Use the Premium guidelines from `project/tech_stack/frontend_premium.md`.
- **DO NOT** leave "zombie code" (commented out blocks). Delete it.
- **DO NOT** assume database state. Always verify `schema.prisma` constraints.
- **DO NOT** execute destructive operations without explicit confirmation.
- **DO NOT** invoke Opus inside Task() calls. Use Sonnet or Haiku.
- **DO NOT** load skills not listed in the agent's AGENT.md frontmatter.

## 6. Agent Quick Reference

| Need | Agent | Command |
|------|-------|---------|
| Understand codebase | `explorer` | `Task(subagent_type="Explore", model="sonnet")` |
| Plan implementation | `planner` | `Task(subagent_type="Plan", model="sonnet")` |
| Write/modify code | `builder` | `Task(subagent_type="general-purpose", model="sonnet")` |
| Design UI/UX | `designer` | `Task(subagent_type="Super-designer", model="sonnet")` |
| Review/QA | `reviewer` | `Task(subagent_type="general-purpose", model="sonnet")` |
| Write docs/reports | `documenter` | `Task(subagent_type="general-purpose", model="haiku")` |

---
*If unsure which agent applies, default to `explorer` first to understand the context, then `planner` to define the approach.*
