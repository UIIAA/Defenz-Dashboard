---
name: agent-creator
description: |
  Cria agentes inteligentes que orquestram múltiplas skills para executar tarefas complexas. 
  Use quando precisar: (1) criar um novo agente especializado, (2) definir workflows multi-step, 
  (3) integrar skills existentes em um agente, (4) configurar agentes para plataformas como 
  Antigravity/Google, Claude Code, ou N8n. Este skill também invoca o skill-creator quando 
  novas skills são necessárias para o agente.
license: Apache-2.0
compatibility: Claude Code, Claude.ai, Antigravity/Google, N8n AI Agents
metadata:
  author: marcos-defenz
  version: "1.0"
  last_updated: "2026-01-23"
allowed-tools: Bash(git:*) Bash(python:*) Read Write
---

# Agent Creator

## 🎯 Propósito

Este skill transforma você em um Arquiteto de Agentes, capaz de criar agentes inteligentes que:
- Orquestram múltiplas skills de forma coordenada
- Executam workflows complexos de múltiplas etapas
- Se adaptam a diferentes plataformas (Antigravity, Claude Code, N8n)
- Delegam tarefas especializadas para sub-skills

## 📐 Arquitetura de um Agente

```
agent-name/
├── AGENT.md                    # Definição principal do agente
├── config/
│   ├── skills.yaml             # Skills que o agente pode invocar
│   ├── workflows.yaml          # Fluxos de trabalho definidos
│   └── platform-config.yaml    # Configurações por plataforma
├── skills/                     # Skills bundled (se necessário)
│   └── custom-skill/
│       └── SKILL.md
├── scripts/
│   └── orchestrator.py         # Lógica de orquestração (opcional)
└── references/
    └── decision-tree.md        # Árvore de decisão do agente
```

## 🔄 Ciclo de Criação de Agente

### Fase 1: Descoberta (Discovery)
Antes de criar qualquer agente, entenda profundamente:

```markdown
## Discovery Checklist
- [ ] Qual problema específico o agente resolve?
- [ ] Quais skills existentes podem ser reutilizadas?
- [ ] Quais novas skills precisam ser criadas?
- [ ] Em qual plataforma o agente vai operar?
- [ ] Qual o nível de autonomia desejado?
```

**Perguntas-chave para o usuário:**
1. "Descreva o workflow completo que o agente deve executar"
2. "Quais decisões o agente deve tomar automaticamente vs. perguntar?"
3. "Quais integrações externas são necessárias (APIs, MCPs)?"

### Fase 2: Mapeamento de Skills

Para cada capacidade do agente, identifique:

| Capacidade | Skill Existente? | Ação |
|------------|------------------|------|
| Criar documentos | ✅ docx/pptx/xlsx | Referenciar |
| Processar PDFs | ✅ pdf | Referenciar |
| Análise de dados | ⚠️ Parcial | Invocar skill-creator |
| Workflow específico | ❌ Não | Invocar skill-creator |

### Fase 3: Design do Agente

O AGENT.md segue uma estrutura específica:

```yaml
---
name: nome-do-agente
type: agent
version: "1.0"
description: |
  Descrição completa do que o agente faz e quando usá-lo.
  Inclua triggers claros para ativação.
skills:
  - skill-creator      # Para criar novas skills sob demanda
  - docx               # Documentos
  - pdf                # PDFs
  - xlsx               # Planilhas
workflows:
  - name: workflow-principal
    triggers: ["quando o usuário pedir X", "ao detectar Y"]
    steps: [descobrir, planejar, executar, validar]
platform:
  target: [claude-code, antigravity, n8n]
autonomy:
  level: medium        # low | medium | high
  ask_before: [delete, send, publish]
  auto_execute: [read, analyze, create_draft]
---

# Nome do Agente

## Persona
[Quem é o agente - sua especialidade e tom]

## Capacidades Core
1. [Capacidade 1]
2. [Capacidade 2]

## Workflow Principal
[Descrição detalhada do fluxo]

## Decision Tree
[Quando fazer o quê]

## Integração com Skills
[Como o agente invoca cada skill]
```

### Fase 4: Implementação

#### 4.1 Criar o AGENT.md
Use o template acima, preenchendo com as informações coletadas.

#### 4.2 Criar/Referenciar Skills
Para cada skill necessária:
- Se existe: adicione ao `skills.yaml`
- Se não existe: invoque o skill-creator

```markdown
## Invocando Skill Creator

Quando uma nova skill for necessária, use:

<thinking>
Preciso de uma skill para [funcionalidade].
Vou invocar o skill-creator com os seguintes parâmetros:
- Nome: [nome-da-skill]
- Propósito: [o que ela faz]
- Inputs esperados: [...]
- Outputs esperados: [...]
</thinking>

[Invocar skill-creator em: /ai_skills/00_Meta/skill_creator.md]
```

#### 4.3 Definir Workflows

```yaml
# workflows.yaml
workflows:
  - name: processo-completo
    description: "Workflow end-to-end para..."
    
    triggers:
      - pattern: "processa o arquivo"
      - pattern: "analise e gere relatório"
    
    steps:
      - id: intake
        action: "Receber e validar input"
        skill: null
        next: analyze
        
      - id: analyze
        action: "Analisar conteúdo"
        skill: data-analyzer
        next: decide
        
      - id: decide
        action: "Decidir próximo passo"
        type: decision
        conditions:
          - if: "dados completos"
            next: generate
          - else:
            next: ask_user
            
      - id: generate
        action: "Gerar output"
        skill: docx
        next: validate
        
      - id: validate
        action: "Validar resultado"
        skill: null
        output: true
```

## 🔌 Configuração por Plataforma

### Para Antigravity/Google

```yaml
# platform-config.yaml (Antigravity)
platform: antigravity
version: "2026-01"

agent_config:
  name: "${AGENT_NAME}"
  description: "${AGENT_DESCRIPTION}"
  
  capabilities:
    - skill_invocation
    - workflow_execution
    - context_management
    
  triggers:
    - type: intent
      patterns: ${TRIGGER_PATTERNS}
    - type: schedule
      cron: "${CRON_EXPRESSION}"
      
  context:
    max_tokens: 128000
    persist_across_sessions: true
    
  skills_registry:
    source: local
    path: "./skills/"
    auto_discover: true
    
  execution:
    max_steps: 50
    timeout_seconds: 300
    retry_policy:
      max_retries: 3
      backoff: exponential
```

### Para Claude Code

```yaml
# platform-config.yaml (Claude Code)
platform: claude-code
location: ~/.claude/skills/

skills_config:
  auto_load: true
  progressive_disclosure: true
  
allowed_tools:
  - Bash
  - Read
  - Write
  - WebSearch
```

### Para N8n

```yaml
# platform-config.yaml (N8n)
platform: n8n
node_type: ai_agent

workflow_integration:
  trigger_nodes: [webhook, schedule, manual]
  output_nodes: [set, httpRequest, gmail]
  
ai_config:
  model: claude-3-sonnet
  temperature: 0.3
  system_prompt: "${AGENT_SYSTEM_PROMPT}"
```

## 🧠 Padrões de Orquestração

### Padrão 1: Sequencial
```
[Skill A] → [Skill B] → [Skill C] → Output
```

### Padrão 2: Paralelo com Merge
```
[Skill A] ─┬─→ [Skill C] → Output
[Skill B] ─┘
```

### Padrão 3: Condicional
```
[Análise] → Decision Tree → [Skill X] ou [Skill Y]
```

### Padrão 4: Loop com Feedback
```
[Execute] → [Validate] → OK? → Output
                ↓ NO
            [Adjust] → [Execute]
```

## 📋 Template de Inicialização Rápida

Para criar um novo agente rapidamente, execute:

```python
# scripts/init_agent.py
"""
Uso: python init_agent.py <nome-do-agente>
"""
import os
import sys

AGENT_TEMPLATE = '''---
name: {name}
type: agent
version: "1.0"
description: |
  [Descreva o que este agente faz]
skills: []
workflows: []
platform:
  target: [claude-code]
autonomy:
  level: medium
  ask_before: [delete, send, publish]
---

# {title}

## Persona
[Defina a persona do agente]

## Capacidades
1. [Capacidade 1]

## Workflow Principal
[Descreva o workflow]
'''

def create_agent(name):
    base_path = f"./{name}"
    os.makedirs(f"{base_path}/config", exist_ok=True)
    os.makedirs(f"{base_path}/skills", exist_ok=True)
    os.makedirs(f"{base_path}/scripts", exist_ok=True)
    os.makedirs(f"{base_path}/references", exist_ok=True)
    
    title = name.replace("-", " ").title()
    
    with open(f"{base_path}/AGENT.md", "w") as f:
        f.write(AGENT_TEMPLATE.format(name=name, title=title))
    
    print(f"✅ Agente '{name}' criado em {base_path}/")
    print(f"📝 Próximo passo: Edite {base_path}/AGENT.md")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python init_agent.py <nome-do-agente>")
        sys.exit(1)
    create_agent(sys.argv[1])
```

## 🔗 Integração com Skill Creator

Quando o agente precisar de uma nova skill, siga este protocolo:

### Protocolo de Delegação para Skill Creator

```markdown
<agent_to_skill_creator>
REQUISIÇÃO DE NOVA SKILL
========================
Agente Solicitante: [nome-do-agente]
Contexto: [por que esta skill é necessária]

Especificação da Skill:
- Nome: [nome-da-skill]
- Descrição: [o que ela faz]
- Triggers de Ativação: [quando usar]
- Inputs: [o que recebe]
- Outputs: [o que produz]
- Dependências: [outras skills ou ferramentas]

Requisitos Técnicos:
- Plataforma: [claude-code | antigravity | n8n]
- Nível de Complexidade: [low | medium | high]
- Precisa de Scripts?: [sim | não]
</agent_to_skill_creator>
```

## 📖 Exemplos Completos

### Exemplo 1: Agente de Análise de Documentos

```yaml
---
name: document-analyst
type: agent
version: "1.0"
description: |
  Analisa documentos (PDF, DOCX, XLSX), extrai insights, 
  e gera relatórios estruturados. Use quando tiver múltiplos
  documentos para processar ou precisar de análise cross-document.
skills:
  - pdf
  - docx
  - xlsx
  - data-analyzer
workflows:
  - name: full-analysis
    triggers: ["analise estes documentos", "extraia insights de"]
platform:
  target: [claude-code, antigravity]
autonomy:
  level: medium
  ask_before: [delete, overwrite]
  auto_execute: [read, analyze, summarize]
---

# Document Analyst

## Persona
Sou um analista de documentos sênior, especializado em extrair 
valor de grandes volumes de documentação. Minha abordagem é 
metódica: primeiro entendo a estrutura, depois identifico padrões, 
e finalmente sintetizo insights acionáveis.

## Workflow Principal

### 1. Intake
- Receber lista de documentos
- Identificar tipos (PDF, DOCX, XLSX)
- Criar índice de processamento

### 2. Processamento por Tipo
```
PDF  → [pdf skill] → Texto extraído
DOCX → [docx skill] → Conteúdo estruturado
XLSX → [xlsx skill] → Dados tabulares
```

### 3. Análise Cross-Document
- Identificar temas comuns
- Detectar inconsistências
- Mapear relacionamentos

### 4. Síntese
- Gerar relatório executivo
- Criar visualizações (se XLSX disponível)
- Produzir recomendações

## Integração com Skills

| Fase | Skill | Ação |
|------|-------|------|
| Intake | - | Listagem e classificação |
| PDF | pdf | `extract_text()`, `get_metadata()` |
| DOCX | docx | `read_content()`, `get_structure()` |
| XLSX | xlsx | `read_data()`, `get_formulas()` |
| Análise | data-analyzer | `find_patterns()`, `correlate()` |
| Output | docx | `create_report()` |
```

### Exemplo 2: Agente de Automação Mercado Livre

```yaml
---
name: ml-automation-agent
type: agent
version: "1.0"
description: |
  Automatiza operações no Mercado Livre: gestão de anúncios,
  respostas a perguntas, monitoramento de vendas. Use para
  qualquer tarefa relacionada à operação de e-commerce no ML.
skills:
  - ml-api-connector    # Conexão com API do ML
  - ml-listing-manager  # Gestão de anúncios
  - ml-qa-responder     # Respostas automáticas
  - xlsx                # Relatórios em planilha
workflows:
  - name: daily-ops
    triggers: ["rotina diária ml", "check mercado livre"]
platform:
  target: [n8n, claude-code]
autonomy:
  level: low
  ask_before: [respond, update_price, pause_listing]
  auto_execute: [read, analyze, prepare_draft]
---

# ML Automation Agent

## Persona
Sou um operador de e-commerce especializado em Mercado Livre,
com foco em eficiência operacional e atendimento de qualidade.

## Workflow: Rotina Diária

### Morning Check (08:00)
1. Verificar novas perguntas → Preparar respostas
2. Checar vendas da noite → Gerar relatório
3. Monitorar estoque → Alertar itens baixos

### Continuous Monitoring
- Novas perguntas: preparar draft de resposta
- Vendas: registrar e atualizar planilha
- Mensagens: categorizar por urgência

### Evening Report (18:00)
1. Consolidar métricas do dia
2. Gerar relatório em XLSX
3. Identificar ações para amanhã
```

## 🚀 Quick Start

Para criar seu primeiro agente:

1. **Execute o inicializador:**
   ```bash
   python scripts/init_agent.py meu-primeiro-agente
   ```

2. **Edite o AGENT.md gerado:**
   - Defina a persona
   - Liste as skills necessárias
   - Descreva o workflow

3. **Verifique skills existentes:**
   - Se todas existem: prossiga
   - Se faltam: invoque skill-creator

4. **Configure a plataforma:**
   - Crie `config/platform-config.yaml`
   - Ajuste para seu ambiente

5. **Teste o agente:**
   - Execute em ambiente de dev
   - Valide cada step do workflow
   - Ajuste conforme necessário

## 📚 Referências

- Ver `references/decision-patterns.md` para padrões de decisão
- Ver `references/platform-specs.md` para detalhes de cada plataforma
- Ver `references/skill-integration.md` para integração avançada
