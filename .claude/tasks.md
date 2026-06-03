# TASKS.md — Registro de Tasks para Implementação

> **Este arquivo é o ponto de entrada obrigatório para qualquer implementação.**
> Nenhum agente de IA pode modificar a codebase sem uma task formalmente registrada aqui.
> Consulte `.claude/rules/00-trava-seguranca.md` para as regras completas.

---

## Como Usar

1. Copie o template da Seção "Template de Task" abaixo.
2. Preencha todos os campos obrigatórios (marcados com `!`).
3. Adicione a task preenchida na Seção "Tasks Ativas".
4. Inicie a sessão com o agente informando o modo de operação desejado (Desenvolvimento, Review ou Tutor).
5. Ao concluir, mova a task para "Tasks Concluídas" com o resultado preenchido.

---

## Template de Task

```markdown
### TASK-[NNN]
- **Status:** pendente | em andamento | concluída | descartada | revertida
- **Modo:** desenvolvimento | review | tutor
- **Complexidade:** patch | minor | major
- **Data de criação:** [YYYY-MM-DD]

#### Objetivo (!obrigatório)
[Descreva de forma direta o que precisa ser feito. Uma frase clara.
Teste: se alguém ler apenas esta linha, entende o que será entregue?]

#### Contexto (!obrigatório)
[Por que essa mudança é necessária? Qual problema resolve?
Se houver link de issue, PR, ou card de projeto, inclua aqui.]

#### Escopo Técnico (!obrigatório)
- **Arquivos/módulos envolvidos:** [listar os arquivos ou áreas que serão tocados]
- **Dependências necessárias:** [novas dependências ou "nenhuma"]
- **Impacto em funcionalidades existentes:** [descrever ou "nenhum"]

#### Critérios de Aceite (!obrigatório)
[Liste as entregas concretas que definem a task como concluída.
Cada critério deve ser verificável — sim ou não, passou ou não passou.]
- [ ] [Critério 1]
- [ ] [Critério 2]
- [ ] [Critério 3]

#### Restrições (opcional)
[Limitações técnicas, de tempo, de escopo, ou decisões já tomadas que o agente deve respeitar.
Ex: "Não alterar o módulo X", "Manter compatibilidade com a versão Y", "Não adicionar dependências novas".]

#### Referências (opcional)
[Links de documentação, PRs anteriores, issues relacionadas, artigos técnicos relevantes.]

#### Log de Andamento (atualizado pelo agente)
> Registro cronológico do progresso da task. O agente adiciona uma entrada a cada sessão em que a task for trabalhada, incluindo sessões onde houve travamento ou interrupção. Nunca remova entradas anteriores.

| Data | Sessão | Ação Realizada | Status ao Final |
|------|--------|----------------|-----------------|
| —    | —      | —              | —               |

#### Resultado (preenchido ao concluir)
- **Data de conclusão:** [YYYY-MM-DD]
- **Branch:** [nome da branch utilizada]
- **Commit(s):** [hash ou mensagem]
- **Avaliação pós-implementação:** [aprovado / aprovado com ressalvas / reprovado]
- **Observações:** [notas relevantes para futuras tasks]
```

### Classificação de Complexidade

A complexidade determina o nível de cerimônia na avaliação pós-implementação (ver `.claude/rules/04-avaliacao-pos.md`):

| Nível | Quando usar | Exemplos |
|-------|-------------|----------|
| **patch** | Mudança trivial, sem risco de efeito colateral | Renomear variável, corrigir typo, ajustar espaçamento, remover import não utilizado |
| **minor** | Mudança localizada em um módulo, risco baixo | Implementar função isolada, corrigir bug em um arquivo, adicionar teste |
| **major** | Mudança estrutural, múltiplos arquivos, risco de impacto em cascata | Nova feature com múltiplos módulos, refatoração arquitetural, migração de dependência |

---

## Tasks Ativas

> Tasks em andamento ou pendentes de implementação. O agente só pode trabalhar em tasks listadas aqui.
> **Regra de ordenação:** A primeira task listada é a task ativa. O agente trabalha nela até conclusão, descarte ou bloqueio explícito pelo usuário. Para mudar a prioridade, o usuário reordena as tasks nesta seção.

### TASK-004
- **Status:** concluída
- **Modo:** desenvolvimento
- **Complexidade:** minor
- **Data de criação:** 2026-06-02

#### Objetivo (!obrigatório)
Alinhar as URLs do repositório no README e no registry ao remote real `LukeSantossz/weather-forecast`.

#### Contexto (!obrigatório)
O README (badge de CI, comando de clone, raiz da árvore em Project Structure) e o `registry.md` (campo Repositório) referenciam `LukeSantossz/pma-weather-forecasting`, mas o remote configurado é `LukeSantossz/weather-forecast`. Consequência: o badge de CI pode não renderizar e o comando de clone aponta para um repositório que pode não existir. Divergência pré-existente detectada na sessão de 2026-06-02 (reestruturação do README).

#### Escopo Técnico (!obrigatório)
- **Arquivos/módulos envolvidos:** `README.md` (badge CI, URL de clone, `cd`, raiz da árvore em Project Structure), `.claude/registry.md` (campo Repositório)
- **Dependências necessárias:** nenhuma
- **Impacto em funcionalidades existentes:** nenhum — apenas documentação

#### Critérios de Aceite (!obrigatório)
- [x] Todas as URLs/referências apontam para o remote real `LukeSantossz/weather-forecast`
- [x] Badge de CI renderiza corretamente
- [x] Nenhuma referência remanescente a `pma-weather-forecasting` (no escopo: README e registry)

#### Restrições (opcional)
Confirmar com o usuário qual é o nome canônico antes de aplicar — pode haver rename planejado de `weather-forecast` para `pma-weather-forecasting`. Se for o caso, o sentido da correção se inverte (renomear o repo, não as URLs).

#### Log de Andamento (atualizado pelo agente)

| Data | Sessão | Ação Realizada | Status ao Final |
|------|--------|----------------|-----------------|
| 2026-06-02 | — | Task registrada a partir de divergência detectada na reestruturação do README | pendente |
| 2026-06-02 | 2 | Usuário confirmou nome canônico `weather-forecast`. README (4 ocorrências) e registry (campo Repositório) corrigidos | concluída |

#### Resultado (preenchido ao concluir)
- **Data de conclusão:** 2026-06-02
- **Branch:** docs/readme-portfolio-template
- **Commit(s):** fix(docs): align repository URLs to actual remote
- **Avaliação pós-implementação:** aprovado
- **Observações:** Ocorrências de `pma-weather-forecasting` em outputs de `notebooks/*.ipynb` (caminhos locais antigos) ficaram fora de escopo — documentadas para eventual limpeza de outputs.

### TASK-005
- **Status:** concluída
- **Modo:** desenvolvimento
- **Complexidade:** minor
- **Data de criação:** 2026-06-02

#### Objetivo (!obrigatório)
Ativar e validar os git hooks de enforcement já presentes em `.claude/hooks/`.

#### Contexto (!obrigatório)
Os scripts `commit-msg`, `pre-commit`, `pre-push` e `post-merge` existem em `.claude/hooks/`, mas `core.hooksPath` não está configurado — o git usa o diretório padrão `.git/hooks` e o enforcement da regra 09 não roda. Detectado na sessão de 2026-06-02. A regra 09.3 prevê a ativação via `git config core.hooksPath .claude/hooks`.

#### Escopo Técnico (!obrigatório)
- **Arquivos/módulos envolvidos:** configuração git (`core.hooksPath`), scripts em `.claude/hooks/`, possível `.claude/enforcement.conf`
- **Dependências necessárias:** bash, git, grep, sed (já disponíveis — hooks stack-agnósticos)
- **Impacto em funcionalidades existentes:** passa a validar commits/push de todos os desenvolvedores — risco de bloquear fluxos se algum hook estiver mal calibrado

#### Critérios de Aceite (!obrigatório)
- [x] `core.hooksPath` aponta para `.claude/hooks`
- [x] `commit-msg` rejeita mensagem fora do formato `type(scope): subject` e aceita mensagem válida
- [x] `pre-commit` detecta debug logs em arquivos staged
- [x] `pre-push` valida o formato da branch sem bloquear em caso de dúvida (regra 09.2)
- [x] Nenhum hook bloqueia por falso positivo em fluxo legítimo

#### Restrições (opcional)
Hooks devem permanecer stack-agnósticos (bash puro) e não-bloqueantes em caso de dúvida (regra 09.2). Não alterar a lógica dos scripts existentes além do necessário para validação.

#### Referências (opcional)
Regra 09 (`.claude/rules/09-enforcement.md`), em especial 09.3 (instalação via TASK-000).

#### Log de Andamento (atualizado pelo agente)

| Data | Sessão | Ação Realizada | Status ao Final |
|------|--------|----------------|-----------------|
| 2026-06-02 | — | Task registrada a partir de divergência detectada na reestruturação do README | pendente |
| 2026-06-02 | 2 | `core.hooksPath` ativado. Hooks validados: commit-msg (rejeita inválido/co-autoria, aceita válido), pre-commit (detecta `print(`), pre-push (apenas avisa) | concluída |

#### Resultado (preenchido ao concluir)
- **Data de conclusão:** 2026-06-02
- **Branch:** docs/readme-portfolio-template
- **Commit(s):** chore(hooks): record enforcement hooks activation
- **Avaliação pós-implementação:** aprovado
- **Observações:** `enforcement.conf` e os scripts já estavam versionados — só faltava a ativação. `git config core.hooksPath .claude/hooks` é config local por-clone, **não versionável**: cada desenvolvedor (e o usuário) deve executá-la uma vez. Não foi necessário criar `enforcement.conf` (já existente e completo para Python).

### TASK-003
- **Status:** concluida
- **Modo:** desenvolvimento
- **Complexidade:** patch
- **Data de criacao:** 2026-05-03

#### Objetivo (!obrigatório)
Corrigir teste `test_raises_on_missing_columns` que falha no CI por incompatibilidade de mensagem de erro com pandas.

#### Contexto (!obrigatório)
O teste cria um CSV sem a coluna `last_updated`, mas `pd.read_csv(parse_dates=["last_updated"])` levanta ValueError antes da validacao do projeto. O teste deve usar um CSV com `last_updated` mas sem `temperature_celsius` para testar a validacao do codigo, nao do pandas. Bug pre-existente revelado pelo CI (TASK-002).

#### Escopo Tecnico (!obrigatório)
- **Arquivos/modulos envolvidos:** `tests/test_data_loader.py`
- **Dependencias necessarias:** nenhuma
- **Impacto em funcionalidades existentes:** nenhum — correcao de teste

#### Criterios de Aceite (!obrigatório)
- [x] Teste `test_raises_on_missing_columns` passa no CI
- [x] 37+ testes passando
- [x] Logica do teste verifica a validacao do projeto, nao do pandas

#### Resultado (preenchido ao concluir)
- **Data de conclusao:** 2026-05-03
- **Branch:** feat/TASK-001-organizar-repositorio
- **Commit(s):** fix(tests): correct missing columns test to validate project logic
- **Avaliacao pos-implementacao:** aprovado
- **Observacoes:** Bug pre-existente — teste validava comportamento do pandas em vez da logica do projeto.

### TASK-002
- **Status:** concluida
- **Modo:** desenvolvimento
- **Complexidade:** minor
- **Data de criação:** 2026-05-03

#### Objetivo (!obrigatório)
Configurar CI/CD com GitHub Actions para execucao automatizada de testes a cada push e PR.

#### Contexto (!obrigatório)
O projeto possui 37 testes (pytest) mas nenhuma automacao de CI. Configurar GitHub Actions antes do merge da branch feat/TASK-001 para que a PR ja rode os testes automaticamente.

#### Escopo Tecnico (!obrigatório)
- **Arquivos/modulos envolvidos:** `.github/workflows/ci.yml`, `README.md` (badge de CI)
- **Dependencias necessarias:** nenhuma (GitHub Actions nativo)
- **Impacto em funcionalidades existentes:** nenhum — apenas adiciona automacao

#### Criterios de Aceite (!obrigatório)
- [x] Workflow `.github/workflows/ci.yml` criado e funcional
- [x] Pipeline roda `pytest tests/ -v` em Python 3.10 e 3.11
- [x] Badge de CI adicionado ao README
- [x] Nenhum arquivo de codigo (`src/`, `tests/`, `notebooks/`) foi alterado

#### Restricoes
- Nao alterar arquivos em `src/`, `tests/`, `notebooks/` ou `data/`.
- Testes devem rodar sem dados reais (ja sao auto-contidos via fixtures).

#### Log de Andamento (atualizado pelo agente)

| Data | Sessao | Acao Realizada | Status ao Final |
|------|--------|----------------|-----------------|
| 2026-05-03 | 1 | Reconhecimento concluido — testes auto-contidos, sem .github/ existente | em andamento |
| 2026-05-03 | 1 | Workflow ci.yml criado, badge adicionado ao README | concluida |

#### Resultado (preenchido ao concluir)
- **Data de conclusao:** 2026-05-03
- **Branch:** feat/TASK-001-organizar-repositorio
- **Commit(s):** ci(tests): add GitHub Actions workflow
- **Avaliacao pos-implementacao:** aprovado
- **Observacoes:** Testes auto-contidos via fixtures, sem dependencia de dados reais. Cache pip configurado. Matrix Python 3.10 + 3.11.

## Tasks Concluidas

> Tasks finalizadas. Movidas para ca apos conclusao e atualizacao do Registro de Projeto (`registry.md`). Nunca remova entradas — o historico e cumulativo.

### TASK-001
- **Status:** concluida
- **Modo:** desenvolvimento
- **Complexidade:** major
- **Data de criacao:** 2026-05-03

#### Objetivo
Reorganizar o repositorio para apresentacao profissional a recrutadores internacionais, seguindo o framework "GitHub como Ferramenta de Vendas".

#### Resultado
- **Data de conclusao:** 2026-05-03
- **Branch:** feat/TASK-001-organizar-repositorio
- **Commit(s):** 16adbc0 — feat(docs): reorganize repo for professional presentation
- **Avaliacao pos-implementacao:** aprovado
- **Observacoes:** Metricas de forecast extraidas do notebook 06. Diagrama Mermaid validado. Secao PMA removida. Regra 12 (README guidelines) criada. Nenhum arquivo de codigo alterado.

---

## Tasks Descartadas

> Tasks que foram canceladas ou substituídas antes da implementação. Registre o motivo.

[nenhuma task descartada]

---

## Regras de Preenchimento

1. **O campo Objetivo deve caber em uma frase.** Se não cabe, a task é grande demais — quebre em subtasks.
2. **Uma task deve ser completável em uma sessão de desenvolvimento.** Se a estimativa de implementação excede uma sessão, ou se a task afeta mais de 10 arquivos, ela deve ser decomposta em subtasks independentes. Cada subtask recebe seu próprio TASK-NNN e segue o fluxo completo. O campo Contexto da subtask deve referenciar a task mãe.
3. **Critérios de Aceite são obrigatórios e verificáveis.** "Funcionar corretamente" não é critério. "Retornar status 200 para inputs válidos e 400 para inputs inválidos" é.
4. **Escopo Técnico deve listar arquivos concretos.** "Algumas telas" não serve. "src/screens/LoginScreen.tsx, src/services/authService.ts" serve.
5. **Uma task por implementação.** Se durante o desenvolvimento surgir necessidade de outra mudança fora do escopo, registre uma nova task — não expanda a atual.
6. **Tasks não são retroativas.** Código já implementado sem task registrada deve ser revisado (Modo Review) e documentado antes de prosseguir com novas tasks.
7. **O resultado é preenchido pelo agente** ao final da implementação, junto com a atualização do Registro de Projeto.
8. **Complexidade é obrigatória.** Toda task deve ser classificada como `patch`, `minor` ou `major`. Na dúvida, classifique para cima (minor em vez de patch, major em vez de minor). A classificação determina o nível de cerimônia da avaliação pós-implementação.
9. **A ordem na seção Tasks Ativas define prioridade.** A primeira task é a ativa. O agente não pula para a segunda sem que a primeira esteja concluída, descartada ou explicitamente pausada pelo usuário.
10. **O Log de Andamento é obrigatório para tasks `minor` e `major`.** O agente registra uma entrada a cada sessão em que trabalhar na task, incluindo interrupções e travamentos. Tasks `patch` podem omitir o log. O log captura o progresso intermediário; a conclusão final é registrada no Resultado da task e no Histórico de Implementações do `registry.md`.
11. **Tasks revertidas não são deletadas.** Ao reverter uma implementação, a task original recebe status `revertida` com nota explicativa, e uma nova task `fix` ou `revert` é criada referenciando a original.
