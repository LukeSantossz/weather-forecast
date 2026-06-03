# 12. Diretrizes de README — Estrutura Obrigatória

> **Referência:** Template `readme_model.md` (raiz do projeto) — padrão de portfólio.
> O README é o ponto de entrada para recrutadores e avaliadores técnicos. Deve comunicar competência em menos de 30 segundos de leitura. O `readme_model.md` é a fonte canônica desta estrutura; esta regra a formaliza como obrigatória.

## 12.1 Princípio

O README não é documentação interna — é uma peça de comunicação técnica. Ele deve responder, nesta sequência: o que o projeto faz, o que ele é, com o que foi construído, como foi pensado (arquitetura e decisões), o que entrega (resultados) e em que estado está (status e limitações).

## 12.2 Ordem Canônica (não reordenar)

O README segue a ordem abaixo. Seções marcadas **[opcional]** entram apenas se agregarem sinal real; vazias ou não-aplicáveis, devem ser **removidas** (não deixe placeholders nem seções esqueléticas).

1. **Header** — badges, título com subtítulo de uma linha, tagline.
2. **What It Does** — uma frase de propósito + lista curta de funcionalidades (o que o sistema consegue fazer).
3. **What It Is** — classificação inequívoca do artefato (web app, CLI, library, data pipeline, research codebase, etc.) + contexto de negócio (qual problema e para quem).
4. **Tech Stack** — tabela `Layer | Technology`. Só o que é estruturalmente relevante.
5. **Architecture** — [opcional, alto valor] diagrama Mermaid renderizável no GitHub, apenas se o fluxo for não-trivial. Para script simples, remover.
6. **Engineering Decisions** — tabela `Decision | Alternative considered | Why this approach`. Mínimo 3 linhas; cada uma com trade-off real.
7. **Results** — [opcional] tabela comparativa com baseline destacado em negrito. Incluir apenas com números defensáveis e reais; sem dados, remover.
8. **Getting Started** — Prerequisites, Installation, Running, Tests.
9. **API Reference** — [opcional] apenas para projetos que expõem REST/CLI. Para libs vira "Usage". Remover se não aplicável.
10. **Project Structure** — árvore enxuta, comentários só nos diretórios com intenção arquitetural.
11. **Project Status** — estado declarado (`complete | MVP complete | in development`), com checklist Done/Pending quando em progresso.
12. **Known Issues & Limitations** — **obrigatória**. Limitações reais com honestidade técnica: o que é + causa raiz ou condição em que deixa de ser problema.
13. **Contributing** — [opcional].
14. **License** — [opcional]; incluir apenas se houver arquivo de licença real no repositório.

## 12.3 Elementos de Maior Valor

Quatro pontos carregam o peso da avaliação técnica e devem receber atenção redobrada:

- **Tagline (Header):** uma frase com o número de maior impacto na primeira linha. Foco no resultado, não na ferramenta. Ex.: "Predicting daily temperatures across 211 countries with 0.19 °C RMSE" em vez de "Weather forecasting with Python".
- **Architecture:** nível de abstração "caixas e setas"; compreensível por quem não leu o código.
- **Engineering Decisions:** a seção que prova raciocínio de trade-off. A coluna "Alternative considered" demonstra exploração do espaço de soluções. Cada linha deve refletir uma escolha com custo real.
- **Known Issues & Limitations:** recrutadores toleram deficiência sinalizada e punem deficiência descoberta. Liste limitações sem pedidos de desculpa.

## 12.4 Badges

Badge comunica **saúde**, nunca dívida. Regras:

- Nunca anuncie coverage baixo, status "yellow" ou qualquer métrica que destaque fraqueza.
- Se o CI não está verde, omita o badge de CI até estar.
- Ordem sugerida: linguagem(ns) → framework principal → CI → license.

## 12.5 Restrições

- **Idioma:** inglês (público internacional).
- **Tom:** profissional, direto, sem emojis.
- **Métricas:** sempre valores reais extraídos dos notebooks/testes. Nunca usar placeholders ("-", "TBD", "TODO") em versões commitadas.
- **Seções ausentes ou não-aplicáveis:** se uma etapa do modelo não se aplica ao projeto, simplesmente não a inclua — não deixe seção vazia nem placeholder.
- **Seções institucionais** (PM Accelerator, programas acadêmicos, etc.): referenciadas em seção separada no final ou omitidas se não agregarem valor técnico ao leitor-alvo.
- **Tamanho:** o README deve ser escaneável. Se ultrapassar 200 linhas, avalie se há informação que pertence a documentação separada.
- **Limpeza do template:** ao partir de `readme_model.md`, remova todos os comentários HTML (`<!-- ... -->`) e placeholders (`{...}`) antes de publicar.
