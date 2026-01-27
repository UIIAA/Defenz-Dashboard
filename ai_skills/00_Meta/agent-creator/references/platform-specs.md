# Especificações de Plataforma

Este documento detalha como configurar e deployar agentes em cada plataforma suportada.

---

## 🌐 Antigravity (Google)

### Visão Geral
Antigravity é a plataforma de agentes do Google que suporta o padrão Agent Skills.

### Configuração Requerida

```yaml
# antigravity-agent.yaml
apiVersion: antigravity.google/v1
kind: Agent
metadata:
  name: seu-agente
  namespace: default
spec:
  runtime: claude-sonnet-4
  
  # Definição do agente
  agent:
    name: ${AGENT_NAME}
    description: ${AGENT_DESCRIPTION}
    version: "1.0"
    
  # Skills disponíveis
  skills:
    registry:
      type: local
      path: ./skills/
    autoDiscover: true
    
  # Triggers de ativação
  triggers:
    - type: intent
      patterns:
        - "processe {documento}"
        - "analise {conteúdo}"
    - type: webhook
      endpoint: /api/trigger
    - type: schedule
      cron: "0 9 * * *"
      
  # Configuração de execução
  execution:
    maxSteps: 50
    timeoutSeconds: 300
    retryPolicy:
      maxRetries: 3
      backoffMultiplier: 2
      
  # Contexto e memória
  context:
    maxTokens: 128000
    persistAcrossSessions: true
    memoryType: conversation
    
  # Autonomia
  autonomy:
    level: medium
    requireApproval:
      - delete
      - send
      - publish
      - payment
    autoExecute:
      - read
      - analyze
      - draft
```

### Deploy no Antigravity

```bash
# 1. Autenticar
gcloud auth login
gcloud config set project seu-projeto

# 2. Preparar o pacote
zip -r agent-package.zip . -x "*.git*"

# 3. Deploy
gcloud antigravity agents deploy agent-package.zip \
  --name=seu-agente \
  --region=us-central1

# 4. Verificar status
gcloud antigravity agents describe seu-agente
```

### Endpoints do Antigravity

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/agents` | GET | Lista agentes |
| `/agents/{id}` | GET | Detalhes do agente |
| `/agents/{id}/invoke` | POST | Invocar agente |
| `/agents/{id}/skills` | GET | Skills do agente |
| `/docs/agent` | GET | Documentação |

### Integrações Nativas

- Google Drive (leitura/escrita)
- Google Docs/Sheets/Slides
- Gmail
- Calendar
- Cloud Storage
- BigQuery

---

## 💻 Claude Code

### Visão Geral
Claude Code é o ambiente de desenvolvimento com Claude integrado ao terminal.

### Estrutura de Arquivos

```
~/.claude/
├── skills/              # Skills globais
│   └── meu-agente/
│       └── AGENT.md
├── settings.json        # Configurações
└── history/             # Histórico de conversas
```

Ou no projeto:
```
projeto/
├── .claude/
│   └── skills/
│       └── meu-agente/
│           └── AGENT.md
```

### Configuração

```json
// ~/.claude/settings.json
{
  "skills": {
    "enabled": true,
    "autoLoad": true,
    "directories": [
      "~/.claude/skills",
      "./.claude/skills"
    ]
  },
  "agents": {
    "enabled": true,
    "defaultModel": "claude-sonnet-4-20250514"
  }
}
```

### Comandos Úteis

```bash
# Listar skills/agentes disponíveis
claude skills list

# Invocar agente específico
claude agent invoke meu-agente "tarefa aqui"

# Instalar skill/agente de repositório
claude skills install github.com/user/repo

# Atualizar skills
claude skills update
```

### Allowed Tools

No AGENT.md, especifique ferramentas permitidas:

```yaml
allowed-tools: Bash(git:*) Bash(python:*) Bash(npm:*) Read Write WebSearch
```

---

## 🔄 N8n

### Visão Geral
N8n é uma plataforma de automação workflow-based onde agentes operam como nodes AI.

### Estrutura do Workflow

```
[Trigger] → [AI Agent Node] → [Action Nodes] → [Output]
```

### Configuração do Node AI Agent

```json
{
  "node": "n8n-nodes-base.aiAgent",
  "parameters": {
    "model": "claude-sonnet-4",
    "systemPrompt": "{{ $json.agentPrompt }}",
    "temperature": 0.3,
    "maxTokens": 4096,
    "tools": {
      "enabled": true,
      "definitions": [
        {
          "name": "searchDatabase",
          "description": "Busca no banco de dados",
          "parameters": {
            "query": { "type": "string" }
          }
        }
      ]
    }
  },
  "credentials": {
    "anthropicApi": "anthropicCredential"
  }
}
```

### Importar Agente no N8n

1. **Criar workflow base:**
```json
{
  "name": "Meu Agente",
  "nodes": [
    {
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "agent-trigger",
        "method": "POST"
      }
    },
    {
      "name": "Load Agent Config",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "return { agentPrompt: 'seu-prompt-aqui' };"
      }
    },
    {
      "name": "AI Agent",
      "type": "n8n-nodes-base.aiAgent"
    }
  ]
}
```

2. **Converter AGENT.md para System Prompt:**
```javascript
// Code Node para converter
const fs = require('fs');
const yaml = require('yaml');

const agentMd = fs.readFileSync('./AGENT.md', 'utf-8');
const [_, frontmatter, content] = agentMd.split('---');
const config = yaml.parse(frontmatter);

return {
  name: config.name,
  systemPrompt: content.trim(),
  skills: config.skills || []
};
```

### Integrações Comuns

| Node | Uso com Agente |
|------|----------------|
| HTTP Request | Chamar APIs externas |
| Code | Lógica customizada |
| Switch | Decisões condicionais |
| Merge | Combinar dados |
| Set | Preparar dados |
| Gmail/Slack | Comunicação |

---

## 📊 Comparação de Plataformas

| Feature | Antigravity | Claude Code | N8n |
|---------|-------------|-------------|-----|
| Deploy | Cloud | Local | Cloud/Local |
| Skills Format | SKILL.md | SKILL.md | JSON/Code |
| Triggers | Intent/Webhook/Schedule | Manual/CLI | Webhook/Schedule/Manual |
| Integrações | Google Suite | Sistema de arquivos | 400+ nodes |
| Autonomia | Configurável | Alta | Via workflow |
| Custo | Por uso | Subscription | Grátis/Pago |
| Melhor para | Enterprise/Google | Desenvolvedores | Automação |

---

## 🚀 Quick Reference

### Deploy Rápido por Plataforma

**Antigravity:**
```bash
gcloud antigravity agents deploy ./agent-package.zip
```

**Claude Code:**
```bash
cp -r meu-agente ~/.claude/skills/
```

**N8n:**
```bash
# Via UI: Import workflow JSON
# Via CLI: n8n import:workflow --input=workflow.json
```
