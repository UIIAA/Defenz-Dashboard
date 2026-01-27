# 🚀 Manual Rápido: Agent Creator para Antigravity

## O que é este Manual

Este documento fornece tudo que você precisa para criar e deployar agentes no Antigravity/Google usando o padrão Agent Skills.

---

## 📋 Checklist de Criação de Agente

```
□ 1. Definir propósito claro do agente
□ 2. Listar skills necessárias
□ 3. Criar skills faltantes (via skill-creator)
□ 4. Definir workflows
□ 5. Configurar triggers
□ 6. Definir níveis de autonomia
□ 7. Gerar arquivos de configuração
□ 8. Testar localmente
□ 9. Deploy no Antigravity
```

---

## 🏗️ Estrutura Obrigatória

```
meu-agente/
├── AGENT.md                 # OBRIGATÓRIO: Definição do agente
├── config/
│   ├── skills.yaml          # Skills disponíveis
│   ├── workflows.yaml       # Fluxos de trabalho
│   └── platform-config.yaml # Config do Antigravity
├── skills/                  # Skills customizadas (se houver)
└── references/              # Documentação de apoio
```

---

## 📝 Template AGENT.md Mínimo

```yaml
---
name: nome-do-agente
type: agent
version: "1.0"
description: |
  Descrição completa do agente.
  Use quando: [triggers de ativação]
skills:
  - skill-creator
  # adicione outras skills
platform:
  target: [antigravity]
autonomy:
  level: medium
  ask_before: [delete, send]
  auto_execute: [read, analyze]
---

# Nome do Agente

## Persona
[Quem é o agente]

## Workflow Principal
[O que ele faz]
```

---

## 🔧 Configuração Antigravity

### Arquivo: config/platform-config.yaml

```yaml
platform: antigravity
version: "2026-01"

agent_config:
  name: "meu-agente"
  
  capabilities:
    - skill_invocation
    - workflow_execution
    - context_management
    
  triggers:
    - type: intent
      patterns: ["processe", "analise"]
      
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
```

---

## 🔄 Criando Skills para o Agente

### Quando o agente precisa de uma skill nova:

1. **Verifique se já existe** em `config/skills.yaml`
2. **Se não existe**, use o skill-creator:

```markdown
<agent_to_skill_creator>
REQUISIÇÃO DE NOVA SKILL
========================
Agente: meu-agente
Skill necessária: nome-da-skill
Descrição: o que ela faz
Triggers: quando usar
Inputs: o que recebe
Outputs: o que produz
</agent_to_skill_creator>
```

3. **Após criar**, adicione ao `skills.yaml`:

```yaml
skills:
  custom:
    - name: nome-da-skill
      path: ./skills/nome-da-skill/
      auto_invoke: true
```

---

## 📊 Workflows

### Estrutura de Workflow

```yaml
workflows:
  - name: workflow-principal
    triggers:
      - "processe o arquivo"
      - "analise e gere relatório"
      
    steps:
      - id: inicio
        action: validar_input
        next: processar
        
      - id: processar
        action: executar_logica
        skill: skill-necessaria
        next: finalizar
        
      - id: finalizar
        action: gerar_output
        output: true
```

---

## 🚀 Deploy no Antigravity

### 1. Preparar o Pacote

```bash
# Na raiz do agente
zip -r agente-package.zip . -x "*.git*" -x "*.DS_Store"
```

### 2. Deploy

```bash
# Via gcloud (se disponível)
gcloud antigravity agents deploy agente-package.zip \
  --name=meu-agente \
  --region=us-central1

# Ou via API
curl -X POST https://antigravity.google/api/v1/agents \
  -H "Authorization: Bearer $TOKEN" \
  -F "package=@agente-package.zip"
```

### 3. Verificar

```bash
gcloud antigravity agents describe meu-agente
```

---

## 🔗 Invocando o Agente

### Via Intent
O agente é invocado automaticamente quando detecta patterns nos triggers.

### Via API
```bash
curl -X POST https://antigravity.google/api/v1/agents/meu-agente/invoke \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input": "sua mensagem aqui"}'
```

### Via Webhook
Configure webhook trigger no `platform-config.yaml` e chame:
```bash
curl -X POST https://antigravity.google/api/agents/meu-agente/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"payload": "dados"}'
```

---

## ⚡ Exemplos Rápidos

### Exemplo 1: Agente de Documentos

```yaml
---
name: document-processor
description: Processa e analisa documentos automaticamente
skills: [pdf, docx, xlsx, skill-creator]
platform:
  target: [antigravity]
---

# Document Processor

## Workflow
1. Receber documento
2. Identificar tipo (PDF/DOCX/XLSX)
3. Invocar skill apropriada
4. Gerar análise
5. Retornar relatório
```

### Exemplo 2: Agente de E-commerce

```yaml
---
name: ml-automation
description: Automatiza operações no Mercado Livre
skills: [ml-connector, xlsx, skill-creator]
platform:
  target: [antigravity, n8n]
---

# ML Automation

## Workflow
1. Monitorar novas perguntas
2. Preparar respostas
3. Gerar relatório diário
```

---

## 🔍 Troubleshooting

| Problema | Solução |
|----------|---------|
| Skill não encontrada | Verificar `skills.yaml` |
| Agente não responde | Checar triggers em `platform-config.yaml` |
| Timeout | Aumentar `timeout_seconds` |
| Erro de permissão | Verificar `autonomy.ask_before` |

---

## 📚 Referências Completas

- `SKILL.md` - Documentação completa do Agent Creator
- `references/platform-specs.md` - Especificações por plataforma
- `references/skill-integration.md` - Integração avançada
- `references/decision-patterns.md` - Padrões de decisão
- `scripts/init_agent.py` - Inicializador automático

---

## 🎯 Comandos Úteis

```bash
# Criar novo agente
python scripts/init_agent.py meu-agente --platform=antigravity

# Validar configuração
# (futuro: skills-ref validate ./meu-agente)

# Empacotar para deploy
zip -r agente.zip meu-agente/

# Deploy
gcloud antigravity agents deploy agente.zip
```

---

**Dica Final**: Comece simples! Crie um agente com 1-2 skills, teste, e vá adicionando complexidade gradualmente.
