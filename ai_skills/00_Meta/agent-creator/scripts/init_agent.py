#!/usr/bin/env python3
"""
Agent Initializer - Cria a estrutura base de um novo agente

Uso: python init_agent.py <nome-do-agente> [--platform=claude-code|antigravity|n8n]

Exemplo:
    python init_agent.py document-processor --platform=claude-code
    python init_agent.py ml-automation --platform=n8n
"""

import os
import sys
import argparse
from datetime import datetime

# ============================================================================
# TEMPLATES
# ============================================================================

AGENT_MD_TEMPLATE = '''---
name: {name}
type: agent
version: "1.0"
description: |
  {description}
  
  Use quando: [descreva os triggers de ativação]
skills:
  - skill-creator  # Para criar novas skills sob demanda
  # Adicione outras skills conforme necessário
workflows:
  - name: main-workflow
    triggers: ["trigger 1", "trigger 2"]
platform:
  target: [{platform}]
autonomy:
  level: medium
  ask_before: [delete, send, publish, update]
  auto_execute: [read, analyze, create_draft]
metadata:
  author: {author}
  created: "{created_date}"
  last_updated: "{created_date}"
---

# {title}

## 🎯 Propósito
[Descreva o propósito principal deste agente]

## 🤖 Persona
[Defina quem é este agente - sua especialidade, tom de comunicação, expertise]

## 📋 Capacidades Core
1. [Capacidade 1]
2. [Capacidade 2]
3. [Capacidade 3]

## 🔄 Workflow Principal

### Fase 1: Intake
- Receber input do usuário
- Validar requisitos
- Identificar qual workflow executar

### Fase 2: Processamento
- [Descreva o processamento principal]

### Fase 3: Output
- [Descreva como o resultado é entregue]

## 🧠 Árvore de Decisão

```
[Input Recebido]
      │
      ▼
[É tipo A?] ─── Sim ──→ [Workflow A]
      │
      Não
      │
      ▼
[É tipo B?] ─── Sim ──→ [Workflow B]
      │
      Não
      │
      ▼
[Perguntar ao usuário]
```

## 🔗 Skills Utilizadas

| Skill | Propósito | Quando Usar |
|-------|-----------|-------------|
| skill-creator | Criar novas skills | Quando capacidade não existe |
| [skill-2] | [propósito] | [trigger] |

## ⚙️ Configuração

Ver `config/` para:
- `skills.yaml` - Skills disponíveis
- `workflows.yaml` - Definição de workflows
- `platform-config.yaml` - Configurações da plataforma

## 📝 Exemplos de Uso

### Exemplo 1: [Cenário básico]
```
Usuário: [comando do usuário]
Agente: [resposta/ação do agente]
```

### Exemplo 2: [Cenário complexo]
```
Usuário: [comando do usuário]
Agente: [resposta/ação do agente]
```
'''

SKILLS_YAML_TEMPLATE = '''# Skills Registry para {name}
# Lista de skills que este agente pode invocar

skills:
  # Skills Built-in (sempre disponíveis)
  built_in:
    - name: skill-creator
      description: Cria novas skills quando necessário
      auto_invoke: false
      
  # Skills de Documento
  document:
    - name: docx
      description: Criação e edição de documentos Word
      auto_invoke: true
    - name: pdf
      description: Manipulação de PDFs
      auto_invoke: true
    - name: xlsx
      description: Criação e edição de planilhas
      auto_invoke: true
    - name: pptx
      description: Criação de apresentações
      auto_invoke: true
      
  # Skills Customizadas (adicione as suas)
  custom: []
  
# Configuração de carregamento
loading:
  strategy: on_demand  # on_demand | eager | lazy
  max_concurrent: 3
  timeout_seconds: 30
'''

WORKFLOWS_YAML_TEMPLATE = '''# Workflows para {name}
# Define os fluxos de trabalho que o agente pode executar

workflows:
  - name: main-workflow
    description: "Workflow principal do agente"
    version: "1.0"
    
    triggers:
      - pattern: "execute o workflow principal"
      - pattern: "processe"
      - intent: "main_action"
      
    steps:
      - id: start
        name: "Início"
        action: validate_input
        skill: null
        on_success: process
        on_failure: error_handler
        
      - id: process
        name: "Processamento"
        action: execute_main_logic
        skill: null  # ou nome da skill
        on_success: output
        on_failure: error_handler
        
      - id: output
        name: "Gerar Output"
        action: create_output
        skill: docx  # exemplo
        on_success: complete
        on_failure: error_handler
        
      - id: complete
        name: "Finalizar"
        action: notify_completion
        is_terminal: true
        
      - id: error_handler
        name: "Tratar Erro"
        action: handle_error
        is_terminal: true
        
    metadata:
      estimated_duration: "5-10 minutes"
      requires_user_input: false
'''

PLATFORM_CONFIG_TEMPLATE = '''# Configuração de Plataforma para {name}
# Plataforma alvo: {platform}

platform: {platform}
version: "1.0"

# Configurações específicas por plataforma
{platform_specific_config}

# Configurações gerais
general:
  debug_mode: false
  log_level: info
  
  execution:
    max_steps: 50
    timeout_seconds: 300
    
  retry_policy:
    max_retries: 3
    backoff_type: exponential
    initial_delay_ms: 1000
    
# Limites e quotas
limits:
  max_tokens_per_request: 128000
  max_file_size_mb: 50
  max_concurrent_skills: 3
'''

PLATFORM_CONFIGS = {
    'claude-code': '''
# Claude Code específico
claude_code:
  location: ~/.claude/skills/
  
  skills_config:
    auto_load: true
    progressive_disclosure: true
    
  allowed_tools:
    - Bash
    - Read  
    - Write
    - WebSearch
    - Computer
    
  context:
    persist_history: true
    max_history_turns: 50
''',
    'antigravity': '''
# Antigravity/Google específico
antigravity:
  api_version: "2026-01"
  
  agent_config:
    name: "{name}"
    capabilities:
      - skill_invocation
      - workflow_execution
      - context_management
      - tool_use
      
  context:
    max_tokens: 128000
    persist_across_sessions: true
    
  skills_registry:
    source: local
    path: "./skills/"
    auto_discover: true
    validation: strict
''',
    'n8n': '''
# N8n específico
n8n:
  node_type: ai_agent
  
  workflow_integration:
    trigger_nodes:
      - webhook
      - schedule
      - manual
    output_nodes:
      - set
      - httpRequest
      - gmail
      - spreadsheet
      
  ai_config:
    model: claude-sonnet-4-20250514
    temperature: 0.3
    max_tokens: 4096
    
  credentials:
    anthropic_key: "{{$credentials.anthropicApi}}"
'''
}

DECISION_PATTERNS_TEMPLATE = '''# Padrões de Decisão para {name}

## Padrão 1: Sequencial Simples
Quando o processamento é linear sem bifurcações.

```
[Input] → [Validate] → [Process] → [Output]
```

**Usar quando:**
- Processo bem definido
- Sem variações baseadas em conteúdo
- Output único esperado

---

## Padrão 2: Branch por Tipo
Quando diferentes tipos de input requerem diferentes processamentos.

```
[Input] → [Classify] ─┬─ Tipo A → [Process A] ─┬─→ [Output]
                      ├─ Tipo B → [Process B] ─┤
                      └─ Tipo C → [Process C] ─┘
```

**Usar quando:**
- Input pode ter múltiplos formatos
- Cada formato tem processamento específico
- Output pode ser unificado

---

## Padrão 3: Loop com Validação
Quando o resultado precisa atender critérios de qualidade.

```
[Input] → [Process] → [Validate] ─── Pass ──→ [Output]
              ↑            │
              │           Fail
              │            │
              └─ [Adjust] ←┘
```

**Usar quando:**
- Qualidade é crítica
- Pode haver iterações
- Critérios de aceitação claros

---

## Padrão 4: Paralelo com Merge
Quando múltiplas operações independentes podem ocorrer.

```
        ┌─→ [Process A] ─┐
[Input] ┼─→ [Process B] ─┼─→ [Merge] → [Output]
        └─→ [Process C] ─┘
```

**Usar quando:**
- Operações são independentes
- Resultado precisa combinar múltiplas fontes
- Performance é importante

---

## Padrão 5: Hierárquico (Sub-Agents)
Quando a complexidade justifica delegação.

```
[Main Agent]
      │
      ├─→ [Sub-Agent A] → [Result A] ─┐
      ├─→ [Sub-Agent B] → [Result B] ─┼─→ [Synthesize] → [Output]
      └─→ [Sub-Agent C] → [Result C] ─┘
```

**Usar quando:**
- Tarefas muito especializadas
- Contextos separados são benéficos
- Escala é necessária

---

## Matriz de Decisão

| Cenário | Padrão Recomendado |
|---------|-------------------|
| Processamento simples | Sequencial |
| Múltiplos formatos de input | Branch por Tipo |
| Requisitos de qualidade altos | Loop com Validação |
| Performance crítica | Paralelo com Merge |
| Alta complexidade | Hierárquico |
'''

# ============================================================================
# FUNÇÕES PRINCIPAIS
# ============================================================================

def create_directory_structure(base_path: str) -> None:
    """Cria a estrutura de diretórios do agente."""
    directories = [
        base_path,
        os.path.join(base_path, 'config'),
        os.path.join(base_path, 'skills'),
        os.path.join(base_path, 'scripts'),
        os.path.join(base_path, 'references'),
        os.path.join(base_path, 'assets'),
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
        print(f"  📁 Criado: {directory}")


def create_agent_file(base_path: str, name: str, platform: str, description: str, author: str) -> None:
    """Cria o arquivo AGENT.md principal."""
    title = name.replace('-', ' ').title()
    created_date = datetime.now().strftime('%Y-%m-%d')
    
    content = AGENT_MD_TEMPLATE.format(
        name=name,
        title=title,
        description=description if description else f"Agente {title}",
        platform=platform,
        author=author,
        created_date=created_date
    )
    
    file_path = os.path.join(base_path, 'AGENT.md')
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  📝 Criado: {file_path}")


def create_config_files(base_path: str, name: str, platform: str) -> None:
    """Cria os arquivos de configuração."""
    config_path = os.path.join(base_path, 'config')
    
    # skills.yaml
    skills_content = SKILLS_YAML_TEMPLATE.format(name=name)
    with open(os.path.join(config_path, 'skills.yaml'), 'w', encoding='utf-8') as f:
        f.write(skills_content)
    print(f"  ⚙️ Criado: config/skills.yaml")
    
    # workflows.yaml
    workflows_content = WORKFLOWS_YAML_TEMPLATE.format(name=name)
    with open(os.path.join(config_path, 'workflows.yaml'), 'w', encoding='utf-8') as f:
        f.write(workflows_content)
    print(f"  ⚙️ Criado: config/workflows.yaml")
    
    # platform-config.yaml
    platform_specific = PLATFORM_CONFIGS.get(platform, PLATFORM_CONFIGS['claude-code'])
    if platform == 'antigravity':
        platform_specific = platform_specific.format(name=name)
    
    platform_content = PLATFORM_CONFIG_TEMPLATE.format(
        name=name,
        platform=platform,
        platform_specific_config=platform_specific
    )
    with open(os.path.join(config_path, 'platform-config.yaml'), 'w', encoding='utf-8') as f:
        f.write(platform_content)
    print(f"  ⚙️ Criado: config/platform-config.yaml")


def create_reference_files(base_path: str, name: str) -> None:
    """Cria os arquivos de referência."""
    references_path = os.path.join(base_path, 'references')
    
    # decision-patterns.md
    decision_content = DECISION_PATTERNS_TEMPLATE.format(name=name)
    with open(os.path.join(references_path, 'decision-patterns.md'), 'w', encoding='utf-8') as f:
        f.write(decision_content)
    print(f"  📚 Criado: references/decision-patterns.md")


def create_gitkeep_files(base_path: str) -> None:
    """Cria arquivos .gitkeep em diretórios vazios."""
    empty_dirs = ['skills', 'scripts', 'assets']
    
    for dir_name in empty_dirs:
        gitkeep_path = os.path.join(base_path, dir_name, '.gitkeep')
        with open(gitkeep_path, 'w') as f:
            f.write('')


def main():
    parser = argparse.ArgumentParser(
        description='Cria a estrutura base de um novo agente',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Exemplos:
  python init_agent.py document-processor
  python init_agent.py ml-automation --platform=n8n
  python init_agent.py data-analyst --platform=antigravity --author="Marcos"
        '''
    )
    
    parser.add_argument('name', help='Nome do agente (usar-hifens-assim)')
    parser.add_argument('--platform', '-p', 
                       choices=['claude-code', 'antigravity', 'n8n'],
                       default='claude-code',
                       help='Plataforma alvo (default: claude-code)')
    parser.add_argument('--description', '-d',
                       default='',
                       help='Descrição breve do agente')
    parser.add_argument('--author', '-a',
                       default='marcos-defenz',
                       help='Autor do agente')
    parser.add_argument('--output', '-o',
                       default='.',
                       help='Diretório de output (default: atual)')
    
    args = parser.parse_args()
    
    # Validar nome
    if not args.name.replace('-', '').isalnum():
        print("❌ Erro: Nome deve conter apenas letras, números e hífens")
        sys.exit(1)
    
    if args.name.startswith('-') or args.name.endswith('-'):
        print("❌ Erro: Nome não pode começar ou terminar com hífen")
        sys.exit(1)
    
    base_path = os.path.join(args.output, args.name)
    
    if os.path.exists(base_path):
        print(f"❌ Erro: Diretório '{base_path}' já existe")
        sys.exit(1)
    
    print(f"\n🚀 Criando agente: {args.name}")
    print(f"   Plataforma: {args.platform}")
    print(f"   Autor: {args.author}")
    print()
    
    create_directory_structure(base_path)
    create_agent_file(base_path, args.name, args.platform, args.description, args.author)
    create_config_files(base_path, args.name, args.platform)
    create_reference_files(base_path, args.name)
    create_gitkeep_files(base_path)
    
    print()
    print(f"✅ Agente '{args.name}' criado com sucesso!")
    print()
    print("📋 Próximos passos:")
    print(f"   1. Edite {base_path}/AGENT.md com os detalhes do agente")
    print(f"   2. Configure as skills em {base_path}/config/skills.yaml")
    print(f"   3. Defina os workflows em {base_path}/config/workflows.yaml")
    print(f"   4. Ajuste a plataforma em {base_path}/config/platform-config.yaml")
    print()


if __name__ == '__main__':
    main()
