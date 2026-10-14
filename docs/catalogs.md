# Cadastros administráveis

Acesse **Painel Administrativo → Cadastros e cores** (`/admin/catalogs`). É possível adicionar e renomear status e origens de denúncias, além de editar suas cores de texto e fundo. As alterações alimentam formulários, listagens, métricas, gráficos e exportações sem reiniciar a aplicação.

A categoria **Bairros** (`/admin/catalogs?kind=district`) reúne cadastro, busca, edição e exclusão de bairros. Usa a tabela e os serviços de bairros existentes, sem adicionar campos de cor. `/bairros` redireciona para essa seção; as operações de gravação continuam compatíveis e retornam ao painel com a mensagem de resultado.

## Banco e migração

`catalog_entries` armazena categoria (`status` ou `sender`), nome, slug, cores e classificação. Há índice único para categoria/slug.

Execute `npm run migrate:catalogs` para criar a tabela e inserir as 11 opções iniciais. A aplicação também inicializa os cadastros antes de abrir a porta HTTP. A operação é idempotente: não sobrescreve opções editadas e não altera denúncias ou relatórios existentes. Valores originais de status e origem são preservados.

Os dados iniciais estão em `src/data/catalogDefaults.json`. O banco é a fonte das opções editáveis. `catalogRegistry.js` fornece os mapas usados pelos imports de compatibilidade, atualizados antes de cada requisição. Se a leitura falhar, a aplicação informa indisponibilidade.

## Identificadores e classificação

Novas opções recebem slug automaticamente, em maiúsculas e com underscores, sem acentos. Colisões recebem sufixos numéricos. Renomear mantém o slug para preservar as referências existentes. O slug não é editável. Slugs legados, inclusive `OUTRO_ORGÃO`, são preservados.

Status novos podem ser classificados como pendentes, em andamento ou finalizados; essa classificação alimenta métricas e consultas de denúncias abertas. O status inicial e o final original mantêm sua classificação automática. Cores e nomes continuam editáveis.

## Tipos de relatório internos

Os tipos de relatório continuam fixos no backend: `STATUS_CHANGE = 0` e `TEXT = 1`, definidos em `src/constants/reportType.js`. A aplicação escolhe o tipo conforme a operação. Os formulários não permitem selecionar ou alterar esse tipo, e as rotas administrativas rejeitam a categoria `report`.

Entradas dessa categoria criadas pela migração anterior permanecem no banco, mas são ignoradas pela aplicação. Sua presença ou alteração não modifica os tipos internos nem seus comportamentos. Denúncias e relatórios históricos não são alterados.

## Validação e componente de cor

O servidor valida nomes, categoria, classificação e cores RGB hexadecimais de seis dígitos. O seletor mostra uma prévia e a relação de contraste entre texto e fundo. Setas ajustam saturação/brilho; Shift aumenta o passo. RGB e hexadecimal podem ser digitados diretamente.

`npm test` cobre geração e estabilidade do slug, colisões, validação, integração às métricas, conversões RGB/HSV, painel administrativo e proteção dos tipos internos de relatório.
