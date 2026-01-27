# Integração Avançada de Skills

Este documento detalha como agentes integram e orquestram múltiplas skills.

---

## 🔗 Modelo de Integração

### Progressive Disclosure (Carregamento Progressivo)

Skills são carregadas em camadas para otimizar uso de contexto:

```
Camada 1: Metadata (~100 tokens)
├── name: pdf-processor
└── description: Processa e manipula PDFs...

Camada 2: Instruções (~2000-5000 tokens)
└── SKILL.md body completo

Camada 3: Recursos (sob demanda)
├── scripts/extract.py
├── references/api-docs.md
└── assets/templates/
```

### Ciclo de Vida de uma Skill no Agente

```
[Agente Recebe Tarefa]
         │
         ▼
[Scan: Qual skill resolve isso?]
         │
         ▼
[Match por description/triggers]
         │
         ▼
[Carregar SKILL.md body]
         │
         ▼
[Executar instruções da skill]
         │
    ┌────┴────┐
    ▼         ▼
[Scripts]  [References]
    │         │
    └────┬────┘
         ▼
[Gerar Output]
         │
         ▼
[Retornar ao Agente]
```

---

## 📋 Registro de Skills

### skills.yaml Completo

```yaml
# Registro central de skills do agente
version: "1.0"

# Categorias de skills
categories:
  document:
    description: "Skills para manipulação de documentos"
    skills:
      - name: docx
        source: anthropic  # built-in
        auto_load: true
        priority: high
        
      - name: pdf
        source: anthropic
        auto_load: true
        priority: high
        
      - name: xlsx
        source: anthropic
        auto_load: true
        priority: high
        
      - name: pptx
        source: anthropic
        auto_load: true
        priority: medium
        
  data:
    description: "Skills para análise de dados"
    skills:
      - name: data-analyzer
        source: custom
        path: ./skills/data-analyzer/
        auto_load: false
        triggers:
          - "analis"
          - "dados"
          - "gráfico"
          
  automation:
    description: "Skills para automação"
    skills:
      - name: ml-connector
        source: custom
        path: ./skills/ml-connector/
        auto_load: false
        config:
          api_key_env: ML_API_KEY
          rate_limit: 100/hour

# Configuração de carregamento
loading:
  strategy: lazy          # eager | lazy | on_demand
  max_concurrent: 3       # Máximo de skills simultâneas
  timeout_ms: 30000       # Timeout por skill
  retry_on_fail: true
  
# Fallbacks
fallbacks:
  - condition: "skill not found"
    action: invoke_skill_creator
  - condition: "skill timeout"
    action: notify_user
```

---

## 🎯 Padrões de Invocação

### Padrão 1: Invocação Direta

Quando o agente sabe exatamente qual skill usar:

```markdown
<thinking>
O usuário quer criar um relatório em PDF.
Skill necessária: pdf
Ação: create_pdf com template "report"
</thinking>

[Invocar skill: pdf]
Ação: create_pdf
Parâmetros:
  - template: report
  - data: {...}
  - output: relatorio.pdf
```

### Padrão 2: Invocação por Pipeline

Múltiplas skills em sequência:

```markdown
<thinking>
Tarefa: Analisar planilha e gerar apresentação
Pipeline necessário:
1. xlsx → ler dados
2. data-analyzer → processar
3. pptx → gerar slides
</thinking>

[Pipeline: xlsx → data-analyzer → pptx]

Step 1: xlsx.read_data("vendas.xlsx")
  Output: raw_data

Step 2: data-analyzer.analyze(raw_data)
  Output: insights

Step 3: pptx.create_presentation(insights)
  Output: apresentacao.pptx
```

### Padrão 3: Invocação Condicional

Escolha de skill baseada em condições:

```markdown
<thinking>
Arquivo recebido: documento.???
Preciso identificar o tipo antes de processar.
</thinking>

[Detectar tipo de arquivo]
IF extensão == .pdf THEN
  [Invocar skill: pdf]
ELSE IF extensão == .docx THEN
  [Invocar skill: docx]
ELSE IF extensão == .xlsx THEN
  [Invocar skill: xlsx]
ELSE
  [Perguntar ao usuário]
```

### Padrão 4: Invocação com Fallback

Quando skill principal pode falhar:

```markdown
<thinking>
Tentando processar PDF complexo.
Tenho skill principal e fallback.
</thinking>

TRY:
  [Invocar skill: pdf-advanced]
  
CATCH (error):
  [Log: pdf-advanced falhou]
  [Invocar skill: pdf-basic]
  
FINALLY:
  [Notificar resultado ao usuário]
```

---

## 🔄 Comunicação entre Skills

### Via Contexto Compartilhado

```yaml
# shared-context.yaml
context:
  session_id: "abc123"
  
  # Dados compartilhados entre skills
  shared_data:
    user_preferences:
      language: "pt-BR"
      format: "detailed"
    
    current_task:
      type: "report_generation"
      status: "in_progress"
      
    intermediate_results:
      - skill: xlsx
        output: { rows: 150, columns: 12 }
      - skill: data-analyzer
        output: { insights: [...] }
```

### Via Eventos

```python
# Skill A emite evento
emit_event("data_ready", {
    "source": "xlsx",
    "data_type": "sales_data",
    "location": "/tmp/data.json"
})

# Skill B escuta evento
@on_event("data_ready")
def handle_data(event):
    if event.data_type == "sales_data":
        process_sales(event.location)
```

---

## 🛠️ Criando Novas Skills sob Demanda

### Protocolo de Delegação para Skill Creator

Quando o agente precisa de uma skill que não existe:

```markdown
## Requisição para Skill Creator

<agent_to_skill_creator>
NOVA SKILL NECESSÁRIA
=====================

Agente: ${AGENT_NAME}
Contexto: ${PORQUE_PRECISA}

Especificação:
  Nome: ${SKILL_NAME}
  Descrição: ${O_QUE_FAZ}
  
  Triggers:
    - "${TRIGGER_1}"
    - "${TRIGGER_2}"
    
  Interface:
    Inputs:
      - nome: data
        tipo: object
        required: true
    Outputs:
      - nome: result
        tipo: object
        
  Requisitos:
    - Plataforma: ${PLATFORM}
    - Dependências: ${DEPS}
    - Scripts necessários: ${SIM/NAO}
    
  Exemplos de Uso:
    - Input: ${EXEMPLO_INPUT}
      Expected Output: ${EXEMPLO_OUTPUT}
</agent_to_skill_creator>
```

### Fluxo Completo

```
[Agente detecta necessidade]
         │
         ▼
[Verifica se skill existe]
         │
    ┌────┴────┐
    │         │
  Existe    Não existe
    │         │
    ▼         ▼
[Usar]    [Criar spec]
              │
              ▼
        [Invocar skill-creator]
              │
              ▼
        [Skill criada]
              │
              ▼
        [Registrar em skills.yaml]
              │
              ▼
        [Usar nova skill]
```

---

## 📊 Monitoramento de Skills

### Métricas a Coletar

```yaml
metrics:
  per_skill:
    - name: invocation_count
      description: "Quantas vezes a skill foi invocada"
      
    - name: success_rate
      description: "Taxa de sucesso"
      
    - name: avg_execution_time
      description: "Tempo médio de execução"
      
    - name: token_consumption
      description: "Tokens consumidos"
      
  aggregated:
    - name: most_used_skills
    - name: failure_hotspots
    - name: context_efficiency
```

### Dashboard de Skills

```
┌─────────────────────────────────────────────┐
│ Skills Dashboard - Agente: document-analyst │
├─────────────────────────────────────────────┤
│                                             │
│ Top Skills (últimas 24h):                   │
│ ├── pdf: 45 invocações (98% sucesso)        │
│ ├── xlsx: 32 invocações (100% sucesso)      │
│ └── docx: 28 invocações (96% sucesso)       │
│                                             │
│ Tempo Médio por Skill:                      │
│ ├── pdf: 2.3s                               │
│ ├── xlsx: 1.8s                              │
│ └── docx: 1.2s                              │
│                                             │
│ Tokens Consumidos: 45,230                   │
│ Skills Criadas: 2 (via skill-creator)       │
│                                             │
└─────────────────────────────────────────────┘
```

---

## ⚠️ Troubleshooting

### Problemas Comuns

| Problema | Causa Provável | Solução |
|----------|----------------|---------|
| Skill não encontrada | Nome incorreto | Verificar skills.yaml |
| Timeout | Skill muito pesada | Aumentar timeout ou otimizar |
| Conflito de skills | Duas skills para mesmo trigger | Definir prioridades |
| Context overflow | Muitas skills carregadas | Usar lazy loading |
| Resultado inconsistente | Falta de validação | Adicionar step de validação |

### Debug Mode

```yaml
# Ativar debug para skills
debug:
  enabled: true
  log_level: verbose
  
  trace:
    - skill_invocation
    - context_changes
    - intermediate_outputs
    
  output:
    destination: ./logs/skills.log
    format: json
```
