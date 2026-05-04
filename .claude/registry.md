# Registro de Projeto — Estado e Histórico

> Este arquivo contém o estado atual e histórico do projeto. É atualizado pelo agente ao final de cada implementação.
> As **regras** sobre como atualizar este registro estão em `.claude/rules/08-registro-projeto.md`.

---

## Informações do Projeto

- **Nome:** PMA Weather Forecasting
- **Stack:** Python 3.10+, pandas, numpy, scikit-learn, LightGBM, Prophet, statsmodels, PyArrow, pytest
- **Repositório:** LukeSantossz/pma-weather-forecasting
- **Estrutura:** Pipeline de data science em notebooks sequenciais (01-07), módulo `src/` com utilitários (data_loader, preprocessing, parquet_io), `tests/` com 37 testes (pytest), dados em `data/raw/` e `data/processed/` (gitignored)

## Histórico de Implementações

> Registro de conclusões. Cada entrada representa uma task finalizada. O agente adiciona uma nova linha após cada task concluída. Nunca remova entradas anteriores.

| # | Data | Task | Complexidade | Escopo Alterado | Resultado | Observações |
|---|------|------|--------------|-----------------|-----------|-------------|
| 1 | 2026-05-03 | TASK-001 — Organizar repositório para apresentação profissional | major | 5 arquivos — documentação, metadados e regras | aprovado | Checklist agêntico: aplicado. Regra 12 (README guidelines) criada. |

## Estado da Codebase

> Atualizado a cada implementação ou verificação pós-pull. Reflete o snapshot mais recente do projeto.

- **Última atualização:** 2026-05-03
- **Último responsável:** Agente (Modo Desenvolvimento)
- **Branch ativa:** main
- **Dependências alteradas recentemente:** nenhuma
- **Testes passando:** sim — 37 testes (pytest)
- **Divergências externas pendentes:** nenhuma
- **Última task concluída:** TASK-001 — Organizar repositório para apresentação profissional

## Pendências Conhecidas

[nenhuma pendência registrada]

## Decisões Técnicas Relevantes

> Decisões tomadas durante implementações que afetam futuras tasks. Inclua justificativa breve.

1. **Adoção do sistema de governança `.claude/`** (2026-05-03): Regras 00-11 ativas para controle de qualidade de implementações com agentes de IA. Tasks em `tasks.md`, estado em `registry.md`.
2. **README orientado a recrutadores** (2026-05-03): Estrutura segue framework "GitHub como Ferramenta de Vendas" — contexto de negócio antes de detalhes técnicos, métricas reais, diagrama de arquitetura Mermaid, decisões de engenharia com justificativa.

## Padrões Recorrentes Observados

| Padrão | Frequência | Impacto | Ação Corretiva |
|--------|------------|---------|----------------|
| — | — | — | — |

---

## Notas de Sessão

> Espaço para anotações pontuais sobre contextos que influenciam futuras sessões.

- **2026-05-03:** Primeira sessão de desenvolvimento com sistema de regras ativo. Reconhecimento de codebase concluído. Métricas de forecast extraídas do notebook 06 e preenchidas no README.
