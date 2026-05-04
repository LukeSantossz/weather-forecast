# 12. Diretrizes de README — Estrutura Obrigatória

> **Referência:** Framework "GitHub como Ferramenta de Vendas".
> O README é o ponto de entrada para recrutadores e avaliadores técnicos. Deve comunicar competência em menos de 30 segundos de leitura.

## 12.1 Princípio

O README não é documentação interna — é uma peça de comunicação técnica. Ele deve responder três perguntas em ordem: (1) qual problema este projeto resolve, (2) como resolve, (3) quais resultados entrega.

## 12.2 Estrutura Obrigatória

Todo README do projeto deve conter, nesta ordem, os 4 elementos fundamentais:

### Elemento 1 — Header

- **Badges:** status do projeto, linguagem, testes (shields.io).
- **Título:** nome do projeto — claro, sem siglas inexplicadas.
- **Tagline:** uma frase que descreve o problema resolvido e o resultado principal. Foco no impacto, não na ferramenta. Exemplo: "Predicting daily temperatures across 211 countries with 0.19°C RMSE" em vez de "Weather forecasting with Python".

### Elemento 2 — Business Context (Contexto de Negócio)

- **Problema real:** descrever o cenário de negócio onde o projeto se aplica (ex: planejamento agrícola, otimização energética).
- **Resultado mensurável:** métrica principal com valor concreto (ex: "0.19°C RMSE — 75% improvement over baseline").
- **Escopo dos dados:** volume, cobertura geográfica, período temporal.

Regra: se o contexto de negócio não mencionar quem se beneficia da solução, reescreva.

### Elemento 3 — Architecture Diagram (Diagrama de Arquitetura)

- Diagrama Mermaid renderizável no GitHub (flowchart LR ou TB).
- Mostra os pipelines principais e o fluxo de dados de ponta a ponta.
- Sem detalhes de implementação internos — nível de abstração correto é "caixas e setas".
- Deve ser compreensível por alguém que não leu o código.

### Elemento 4 — Engineering Decisions (Decisões de Engenharia)

- Tabela com formato: `Decisão | Alternativa considerada | Por que esta abordagem`.
- Cada linha demonstra pensamento crítico — o que foi escolhido, o que foi descartado, e por quê.
- Foco em trade-offs reais, não em justificativas genéricas.

## 12.3 Seções Complementares

Além dos 4 elementos obrigatórios, incluir conforme aplicável:

- **Results & Metrics:** tabelas com métricas de performance (preenchidas com valores reais, nunca placeholders).
- **How to Run:** prerequisites, setup em poucos comandos, como rodar testes.
- **Project Structure:** árvore de diretórios com comentários breves.

## 12.4 Restrições

- **Idioma:** inglês (público internacional).
- **Tom:** profissional, direto, sem emojis.
- **Métricas:** sempre valores reais extraídos dos notebooks/testes. Nunca usar placeholders ("-", "TBD", "TODO") em versões commitadas.
- **Seções institucionais** (PM Accelerator, programas acadêmicos, etc.) devem ser referenciadas em seção separada no final do README ou omitidas se não agregarem valor técnico ao leitor-alvo (recrutador/avaliador).
- **Tamanho:** o README deve ser escaneável. Se ultrapassar 200 linhas, avalie se há informação que pertence a documentação separada.
