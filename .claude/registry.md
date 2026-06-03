# Registro de Projeto — Estado e Histórico

> Este arquivo contém o estado atual e histórico do projeto. É atualizado pelo agente ao final de cada implementação.
> As **regras** sobre como atualizar este registro estão em `.claude/rules/08-registro-projeto.md`.

---

## Informações do Projeto

- **Nome:** PMA Weather Forecasting
- **Stack:** Python 3.10+, pandas, numpy, scikit-learn, LightGBM, Prophet, statsmodels, PyArrow, pytest
- **Repositório:** LukeSantossz/weather-forecast
- **Estrutura:** Pipeline de data science em notebooks sequenciais (01-07), módulo `src/` com utilitários (data_loader, preprocessing, parquet_io), `tests/` com 37 testes (pytest), dados em `data/raw/` e `data/processed/` (gitignored)

## Histórico de Implementações

> Registro de conclusões. Cada entrada representa uma task finalizada. O agente adiciona uma nova linha após cada task concluída. Nunca remova entradas anteriores.

| # | Data | Task | Complexidade | Escopo Alterado | Resultado | Observações |
|---|------|------|--------------|-----------------|-----------|-------------|
| 1 | 2026-05-03 | TASK-001 — Organizar repositório para apresentação profissional | major | 5 arquivos — documentação, metadados e regras | aprovado | Checklist agêntico: aplicado. Regra 12 (README guidelines) criada. |
| 2 | 2026-05-03 | TASK-002 — Configurar CI/CD com GitHub Actions | minor | 2 arquivos — .github/workflows/ci.yml, README.md (badge) | aprovado | Checklist agêntico: aplicado. Matrix Python 3.10 + 3.11, cache pip. |
| 3 | 2026-05-03 | TASK-003 — Corrigir teste missing columns | patch | 1 arquivo — tests/test_data_loader.py | aprovado | Bug pre-existente revelado pelo CI. |
| 4 | 2026-06-02 | TASK-004 — Alinhar URLs do repositório ao remote real | minor | 2 arquivos — README.md, registry.md | aprovado | Nome canônico confirmado: weather-forecast. Outputs de notebooks fora de escopo. |
| 5 | 2026-06-02 | TASK-005 — Ativar e validar git hooks de enforcement | minor | config local (core.hooksPath) + governança | aprovado | Ativação por-clone, não versionável. commit-msg/pre-commit/pre-push validados. |

## Estado da Codebase

> Atualizado a cada implementação ou verificação pós-pull. Reflete o snapshot mais recente do projeto.

- **Última atualização:** 2026-06-02
- **Último responsável:** Agente (Modo Desenvolvimento)
- **Branch ativa:** docs/readme-portfolio-template
- **Dependências alteradas recentemente:** nenhuma
- **Testes passando:** sim — 37 testes (pytest)
- **Divergências externas pendentes:** nenhuma
- **Hooks de enforcement:** ativos nesta clone (`core.hooksPath=.claude/hooks`) — ativação por-clone
- **Última task concluída:** TASK-005 — Ativar e validar git hooks de enforcement

## Pendências Conhecidas

[nenhuma pendência registrada]

## Decisões Técnicas Relevantes

> Decisões tomadas durante implementações que afetam futuras tasks. Inclua justificativa breve.

1. **Adoção do sistema de governança `.claude/`** (2026-05-03): Regras 00-11 ativas para controle de qualidade de implementações com agentes de IA. Tasks em `tasks.md`, estado em `registry.md`.
2. **README orientado a recrutadores** (2026-05-03): Estrutura segue framework "GitHub como Ferramenta de Vendas" — contexto de negócio antes de detalhes técnicos, métricas reais, diagrama de arquitetura Mermaid, decisões de engenharia com justificativa.
3. **Adoção do template `readme_model.md`** (2026-06-02): README reestruturado para a ordem canônica do template de portfólio (What It Does → What It Is → Tech Stack → Architecture → Engineering Decisions → Results → Getting Started → Project Structure → Project Status → Known Issues). Regra 12 reescrita para refletir o novo padrão. Seções sem respaldo no projeto (API Reference, Contributing, License) omitidas por não haver artefatos correspondentes. Métricas reais preservadas dos notebooks.
4. **Ativação dos git hooks de enforcement** (2026-06-02): `core.hooksPath` aponta para `.claude/hooks`. Validados commit-msg (Conventional Commits, sem body/co-autoria), pre-commit (lê `.claude/enforcement.conf` para debug logs), pre-push (não-bloqueante, só avisa sobre formato de branch) e post-merge. A ativação é config local por-clone — cada desenvolvedor deve rodar `git config core.hooksPath .claude/hooks` ao clonar o repositório.

## Padrões Recorrentes Observados

| Padrão | Frequência | Impacto | Ação Corretiva |
|--------|------------|---------|----------------|
| — | — | — | — |

---

## Notas de Sessão

> Espaço para anotações pontuais sobre contextos que influenciam futuras sessões.

- **2026-05-03:** Primeira sessão de desenvolvimento com sistema de regras ativo. Reconhecimento de codebase concluído. Métricas de forecast extraídas do notebook 06 e preenchidas no README.
- **2026-06-02:** Atualização de documentação (sem código) a partir do template `readme_model.md`. README e regra 12 alinhados ao novo padrão de portfólio. Conflito entre o template e a regra 12 anterior reportado e resolvido com o usuário: optou-se por reescrever ambos. Seções não-aplicáveis omitidas a pedido do usuário.
