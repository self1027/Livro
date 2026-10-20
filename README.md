# Livro · demonstração de portfólio

Demo pública do sistema de gestão da Vigilância Sanitária de Andradina, desenvolvida por Murilo Dias. A branch `demo` reutiliza **os templates EJS, CSS, JavaScript, fontes e imagens da `main`**, sem redesenhar a interface. Referência desta atualização: `0794f5f`.

Ao entrar, qualquer pessoa pode escolher **Iniciar tour guiado**, **Assistir automaticamente** ou **Entrar e explorar**, sem cadastro ou senha. O guia possui 23 etapas, pausa, retomada e restauração dos dados. A reprodução automática avança a cada 6,5 segundos enquanto a aba está visível.

## O que experimentar

- Denúncia já preenchida, validação de campos e bairros e protocolo sequencial por ano.
- Atribuição a fiscais habilitados, carteiras de fiscalização e filtros dinâmicos.
- Vistoria, mudança de status, histórico com autoria, edição e exclusão de relatórios.
- Pendências SIVISA, vários protocolos por ação e observações com ou sem protocolo.
- Conclusão da denúncia e atualização de totais, filas, carga por fiscal e evolução mensal.
- Busca combinada por protocolo, endereço, bairro, origem, status e fiscal.
- Gráficos interativos, ações por autor, atividade recente e exportação dos filtros atuais.
- Escala semanal, exceções por dia, anotações e configuração do atendimento.
- Bairros, status, origens e cores; pessoas, cargos e permissão para receber denúncias.
- Recados locais, referência a denúncias, anúncios e histórico de conversas.

O CSV é baixado diretamente. O PDF abre um relatório em outra janela; use **Imprimir / Salvar como PDF** nessa janela.

## Executar

Node.js 22 ou superior:

```sh
npm ci
npm run dev
```

Para gerar e conferir a versão estática:

```sh
npm run build
npm run preview
```

O Vercel usa o build Vite e o diretório `dist`. `vercel.json` mantém o fallback para `index.html`, inclusive em acessos diretos como `/denuncias/new`, `/admin` e `/recados`. Não há banco de dados, variáveis de ambiente ou backend para configurar.

## Dados e limites da demonstração

Os 48 registros iniciais, pessoas, endereços e relatórios são fictícios. As datas são relativas ao primeiro acesso, para os indicadores continuarem úteis. As alterações ficam na chave `livro-demo-v2` do armazenamento local de cada navegador. **Restaurar dados** reinicia registros e configurações. A demo requer JavaScript e armazenamento local disponível para manter alterações entre páginas; falhas de gravação aparecem na tela.

Contas e cargos são simulações locais; senhas digitadas são descartadas. Não há autenticação real, envio de e-mails, mensagens a pessoas reais ou sincronização entre visitantes. Autorizações de produção continuam sendo responsabilidade do backend da `main`. A fila SIVISA da demo mostra as pendências de toda a equipe, para permitir exploração sem login.

## Como a interface é reaproveitada

`vite.config.js` compila os EJS originais em um script clássico durante o build, preservando seus includes e escape de conteúdo. `src/demo/render.js` resolve os includes no navegador. `pages.js` entrega os mesmos contextos às telas; `store.js`, `actions.js` e `api.js` substituem as operações de servidor por dados locais. Cálculos de métricas, filtros e validação SIVISA são reutilizados da `main`.

Os arquivos originais em `views/` e nos diretórios de ativos de `public/` permanecem idênticos à `main`. O guia fica em `src/demo/tour.js` e `public/demo.css`. jQuery e Font Awesome são servidos localmente; os URLs externos dos templates são adaptados em tempo de execução, sem alterar os originais. Chart.js e as fontes já são locais na `main`.

Para atualizar novamente a interface a partir da `main`, revise os contratos de dados junto dos templates:

```sh
git restore --source=main -- views public/css public/js public/fonts public/favicon public/vendor public/docs
npm test
npm run test:browser
```

## Verificação

```sh
npm test
npx playwright install chromium
npm run test:browser
```

Os testes Node exercitam o ciclo da denúncia, métricas por data e autoria, persistência, permissões de recebimento, configurações, segurança do CSV e renderização dos templates reais. O Playwright testa o build de produção, o roteiro completo, reprodução e pausa, formulários, exportações, controles administrativos e telas de 375/390px. Capturas e traces ficam em `test-results/`, fora do Git.

Workflow guiado pela skill [Ponytail](https://github.com/DietrichGebert/ponytail): reutilizar componentes e regras existentes, manter as adaptações isoladas e testar o comportamento que pode quebrar.
