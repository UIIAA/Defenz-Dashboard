# Padrões de Decisão para Agentes

Guia de referência para implementar lógica de decisão em agentes.

---

## 🧠 Fundamentos de Decision Trees

### Anatomia de uma Decisão

```
[Estado Atual]
      │
      ▼
[Avaliar Condição]
      │
  ┌───┴───┐
  │       │
TRUE    FALSE
  │       │
  ▼       ▼
[Ação A] [Ação B ou próxima condição]
```

### Tipos de Condições

1. **Determinísticas**: Resultado único e previsível
2. **Probabilísticas**: Baseadas em confiança/scores
3. **Heurísticas**: Baseadas em regras aproximadas
4. **Interativas**: Requerem input do usuário

---

## 📋 Padrões de Decisão

### Padrão 1: Switch Simples

Para quando há categorias bem definidas.

```yaml
pattern: switch
name: "Classificação por Tipo"

input: documento
evaluate: documento.tipo

cases:
  - value: "contrato"
    action: processar_contrato
    skill: legal-analyzer
    
  - value: "fatura"
    action: processar_fatura
    skill: financial-processor
    
  - value: "relatório"
    action: processar_relatorio
    skill: report-analyzer
    
  - default:
    action: perguntar_usuario
```

**Diagrama:**
```
[Input: Documento]
        │
        ▼
    [Tipo?]
    ┌───┼───┐
    │   │   │
  Contrato Fatura Relatório
    │   │   │
    ▼   ▼   ▼
  [A] [B] [C]
```

---

### Padrão 2: Cadeia de Responsabilidade

Para quando múltiplos handlers podem processar.

```yaml
pattern: chain_of_responsibility
name: "Pipeline de Validação"

handlers:
  - name: syntax_validator
    can_handle: "sempre"
    action: validar_sintaxe
    pass_if: valido
    
  - name: schema_validator
    can_handle: "se sintaxe ok"
    action: validar_schema
    pass_if: conforme
    
  - name: business_validator
    can_handle: "se schema ok"
    action: validar_regras_negocio
    pass_if: aprovado
    
  - name: final_processor
    can_handle: "se todas validações ok"
    action: processar
    terminal: true
```

**Diagrama:**
```
[Input] → [Handler 1] → [Handler 2] → [Handler 3] → [Output]
              │              │              │
              ▼              ▼              ▼
           [Falha]       [Falha]       [Falha]
```

---

### Padrão 3: Estado com Transições

Para workflows complexos com múltiplos estados.

```yaml
pattern: state_machine
name: "Workflow de Aprovação"

initial_state: rascunho

states:
  rascunho:
    description: "Documento em elaboração"
    transitions:
      - event: submeter
        to: em_revisao
        guard: documento_completo
        
  em_revisao:
    description: "Aguardando revisão"
    transitions:
      - event: aprovar
        to: aprovado
        guard: revisor_autorizado
      - event: rejeitar
        to: rascunho
        action: notificar_autor
        
  aprovado:
    description: "Documento aprovado"
    transitions:
      - event: publicar
        to: publicado
        action: gerar_versao_final
        
  publicado:
    description: "Documento publicado"
    terminal: true
```

**Diagrama:**
```
[Rascunho] ─submeter─> [Em Revisão] ─aprovar─> [Aprovado] ─publicar─> [Publicado]
     ↑                      │
     └───────rejeitar───────┘
```

---

### Padrão 4: Scoring/Ranking

Para decisões baseadas em múltiplos critérios.

```yaml
pattern: scoring
name: "Seleção de Skill"

criteria:
  - name: relevance
    weight: 0.4
    evaluator: semantic_similarity
    
  - name: capability
    weight: 0.3
    evaluator: feature_match
    
  - name: performance
    weight: 0.2
    evaluator: historical_success_rate
    
  - name: cost
    weight: 0.1
    evaluator: token_estimate

threshold: 0.7  # Score mínimo para seleção
fallback: ask_user
```

**Diagrama:**
```
[Candidatos: Skill A, B, C]
            │
            ▼
    ┌───────────────┐
    │ Score Matrix  │
    │ A: 0.85 ✓     │
    │ B: 0.62       │
    │ C: 0.78 ✓     │
    └───────────────┘
            │
            ▼
    [Selecionar A (maior score)]
```

---

### Padrão 5: Árvore de Decisão Binária

Para diagnóstico ou troubleshooting.

```yaml
pattern: binary_tree
name: "Diagnóstico de Erro"

root:
  question: "O erro é de sintaxe?"
  yes:
    question: "É erro de JSON?"
    yes:
      action: fix_json_syntax
      skill: json-fixer
    no:
      question: "É erro de YAML?"
      yes:
        action: fix_yaml_syntax
        skill: yaml-fixer
      no:
        action: analyze_general_syntax
  no:
    question: "O erro é de lógica?"
    yes:
      action: debug_logic
      skill: logic-debugger
    no:
      question: "O erro é de runtime?"
      yes:
        action: analyze_runtime
        skill: runtime-analyzer
      no:
        action: escalate_to_user
```

**Diagrama:**
```
                    [Erro de sintaxe?]
                    /                \
                  Sim                Não
                  /                    \
          [Erro JSON?]            [Erro lógica?]
          /        \              /           \
        Sim        Não          Sim           Não
        /            \          /               \
   [Fix JSON]    [Erro YAML?] [Debug]      [Runtime?]
                  /       \                /       \
                Sim       Não            Sim       Não
                /           \            /           \
           [Fix YAML]  [Análise]  [Analyze]    [Escalar]
```

---

### Padrão 6: Consenso (Multi-Agent)

Para decisões que requerem múltiplas perspectivas.

```yaml
pattern: consensus
name: "Avaliação Multi-Perspectiva"

agents:
  - name: analyst
    role: "Analisar viabilidade técnica"
    weight: 0.3
    
  - name: risk_assessor
    role: "Avaliar riscos"
    weight: 0.3
    
  - name: cost_estimator
    role: "Estimar custos"
    weight: 0.2
    
  - name: timeline_planner
    role: "Planejar cronograma"
    weight: 0.2

consensus_rules:
  - type: majority
    threshold: 0.6
    action: proceed
    
  - type: unanimous_block
    on: high_risk
    action: escalate
    
  - type: deadlock
    action: request_human_decision
```

---

## 🎯 Escolhendo o Padrão Certo

| Cenário | Padrão Recomendado |
|---------|-------------------|
| Categorização simples | Switch Simples |
| Validação em etapas | Cadeia de Responsabilidade |
| Workflow com estados | Estado com Transições |
| Múltiplos critérios | Scoring/Ranking |
| Diagnóstico/FAQ | Árvore Binária |
| Decisão complexa | Consenso Multi-Agent |

---

## 💡 Boas Práticas

### 1. Sempre Tenha Fallback
```yaml
default_action: ask_user
fallback_message: "Não consegui determinar a melhor ação. Como você gostaria de proceder?"
```

### 2. Log de Decisões
```yaml
logging:
  level: decision
  include:
    - timestamp
    - input_state
    - evaluated_conditions
    - selected_path
    - confidence_score
```

### 3. Timeout em Decisões
```yaml
timeout:
  max_depth: 10  # Máximo de níveis na árvore
  max_time_ms: 5000  # Timeout total
  on_timeout: use_heuristic_default
```

### 4. Reversibilidade
```yaml
reversible_actions:
  - action: draft
    can_undo: true
    
  - action: publish
    can_undo: false
    require_confirmation: true
```

---

## 🔧 Implementação em AGENT.md

```markdown
## Decision Tree

### Entrada de Documento

```
[Documento Recebido]
        │
        ▼
   [Tipo conhecido?]
   /              \
 Sim              Não
  │                │
  ▼                ▼
[Processar]   [Analisar extensão]
                   │
              ┌────┴────┐
              │         │
          Suportada  Não suportada
              │         │
              ▼         ▼
          [Inferir]  [Perguntar]
```

### Regras de Decisão

1. **Prioridade de Skills**: pdf > docx > xlsx (por frequência de uso)
2. **Threshold de Confiança**: 0.8 para auto-ação, <0.8 para confirmação
3. **Fallback**: Sempre perguntar se incerto

### Condições de Escalação

- Erro após 3 tentativas → Perguntar usuário
- Skill não encontrada → Invocar skill-creator
- Timeout → Notificar e abortar
```
