# Interface do Livro

O front-end mantém Express, EJS e Bootstrap 4.6.2 e segue o modelo **Supabase** indicado no catálogo [awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design). O arquivo original está em `DESIGN.md`, importado com `npx --yes getdesign@latest add supabase --out ./DESIGN.md`. O repositório é um catálogo de referências de design, sem uma skill instalável.

A interface aplica o canvas branco, os tons neutros, os botões de 6px com esmeralda `#3ecf8e` e texto escuro, os títulos de peso 500 e a fonte Inter recomendada pelo [modelo](https://getdesign.md/supabase/design-md). A fonte é servida localmente em WOFF2, com licença em `public/fonts/OFL-Inter.txt`. Links e foco usam verde mais escuro para manter o contraste; tabelas e navegação usam tamanhos compactos próprios de uma aplicação de trabalho.

A marca representa um livro aberto, com páginas preenchidas em verde e linhas claras. O arquivo `public/favicon/livro.svg` é compartilhado pelo favicon, navegação e apresentação do login, mantendo o mesmo desenho em todos os tamanhos.

## Decisões visuais

- A listagem responde “quais denúncias precisam de acompanhamento?”. O protocolo reúne número e ano; título, localização, origem, status e fiscal continuam disponíveis em todos os tamanhos.
- A navegação tem 232px, fundo neutro e divisor simples. O cabeçalho oferece uma busca funcional por número de protocolo, ligada à rota `/buscar` e disponível apenas para quem pode consultar denúncias. O menu se recolhe até 1100px.
- A listagem fica em um painel com título, contador e tabela. No celular, os registros apresentam título, protocolo, status e demais campos em uma grade compacta, preservando todas as informações.
- O cadastro mantém as seções de identificação, localização e descrição. O login usa um formulário centralizado em fundo branco, com a marca do Livro e sem painel promocional.
- As cores cadastradas para origens e status continuam vindo do catálogo. A interface não calcula totais globais a partir de uma página: o contador indica somente registros exibidos e acompanha “Carregar mais”.
- O link “Pular para o conteúdo”, os estados de foco e os rótulos acessíveis apoiam a navegação por teclado. O movimento se limita ao feedback de pressão de botões e respeita `prefers-reduced-motion`.

## Organização

`public/css/theme.css` concentra cores, fontes e tokens de movimento. `style.css` define os componentes básicos; `components.css`, a navegação e a estrutura; `home.css` e `auth.css`, os layouts específicos. `views/partials/icon.ejs` contém os ícones SVG compartilhados.

## Skills aplicadas

Instaladas globalmente em `C:/Users/User/.codex/skills`:

- `design-motion-principles`: interações de ferramenta de trabalho, com Emil Kowalski como referência principal de contenção e Jakub Krehel para acabamento.
- `design-taste-frontend`: verificação em navegador e revisão das capturas. A direção visual é o modelo Supabase selecionado do catálogo solicitado pelo usuário; os sorteios anteriores de estilo não determinam mais a interface.
- `ui-ux-pro-max`: orientação de interface acessível para uso institucional. A estrutura existente de aplicação prevalece sobre a sugestão automática de landing page.

## Validação

- `npm test`: 80 testes aprovados, 2 integrações com MySQL ignoradas por não haver banco de teste isolado configurado.
- 47 verificações no Chrome: oito rotas/estados em 375, 390, 768, 1024 e 1440px, menus e Escape, paginação, falha de rede e tentativa seguinte, escape de conteúdo, permissões no estado vazio e movimento reduzido.
- Busca global verificada no Chrome em desktop e celular: envio real de protocolo numérico, rejeição de texto inválido, respeito à permissão de consulta e carregamento da Inter.
- Gráfico de finalizações verificado em desktop e celular: três séries, valores acessíveis e ausência de erros JavaScript.
- Inspeção visual da listagem e login em 1440, 768 e 390px, com dados de exemplo em um servidor local separado do banco. Nenhuma falha de contraste. Os avisos restantes correspondem à personalização de avatar existente e aos textos de rodapé e metadados com 11–12px.

As imagens, fixtures e scripts auxiliares da revisão ficam em `.taste-skill/`, ignorado pelo Git. Nenhum dado de exemplo foi adicionado às telas de produção.

## Gráficos e indicadores administrativos

O projeto continua em Express/EJS com JavaScript, sem React. O Bklit foi avaliado, mas seus componentes exigem React; a integração foi descartada conforme a orientação do usuário. A skill `bklit-ui` ficou instalada globalmente como referência, sem adicionar componentes ou dependências React ao aplicativo.

Chart.js 4.5.1 é uma dependência npm e é servido localmente, com licença MIT em `public/vendor/chartjs/`. `npm run assets:charts` sincroniza o bundle com a versão do lockfile e também roda antes de `npm start`. Não há CDN nos gráficos. A configuração segue a [documentação de acessibilidade](https://www.chartjs.org/docs/latest/general/accessibility.html) e de [animações](https://www.chartjs.org/docs/latest/configuration/animations.html): valores e links em HTML, rótulos nos canvases, movimento curto e animações desativadas quando há preferência por movimento reduzido.

Em Distribuições, a evolução mensal mantém as três séries de denúncias distintas por mês: criadas, com texto registrado e finalizadas no histórico. O eixo parte de zero, as linhas são retas e formas/tracejados distinguem as séries além da cor. Somente registros permitem navegação pela data de criação; relatório e finalização têm datas próprias. Barras horizontais comparam bairros, status, faixas de idade e origens. As tabelas/listas preservam valores completos e consultas por teclado, inclusive quando os gráficos não carregam.

Os novos indicadores usam as denúncias criadas no período e os demais filtros atuais, antes da seleção de filas:

- **Abertas com fiscal:** abertas atribuídas / total de abertas, arredondado em percentual. Não mede produtividade individual.
- **Idade mediana das abertas:** mediana de dias de calendário em São Paulo entre criação e hoje; pode terminar em meio dia quando a amostra é par. As faixas são operacionais, sem representar prazos legais.
- **Abertas sem relatório textual:** ausência de relatório do tipo 1 no histórico atual. Mudanças de status não contam como texto. A fila `noText`, sua paginação e exportações usam a mesma definição.
- **Até o primeiro relatório:** mediana entre criação e o primeiro texto disponível, considerando abertas e finalizadas da seleção. O texto pode ter sido incluído após o período filtrado. Datas inválidas, anteriores à criação ou futuras são excluídas, assim como denúncias sem texto. A amostra aparece no indicador; a quantidade sem texto deve ser lida em conjunto, pois esta mediana não representa o tempo de espera de toda a fila.
- **Origem dos registros:** quantidade por canal do catálogo; valores ausentes ou desconhecidos permanecem como origem não informada.

Ausência de amostra aparece como traço, enquanto zero dias é uma observação válida. O primeiro texto é consultado apenas para Distribuições ou para a fila sem texto, evitando trabalho adicional nas outras abas.

Em Ações e SIVISA, a rosca compara categorias mutuamente exclusivas: com SIVISA, aguardando, não cabe e sem classificação. Elas somam o total de ações, sem misturar o número de protocolos, que pode ser maior. O clique preserva autor, período e demais filtros e abre o detalhamento existente.

Validação desta alteração: testes de cálculos, datas, ausência de amostra, consulta de texto, fila/exportação e navegação dos gráficos; 11 cenários no Chrome em 1440, 768, 390 e 375px, incluindo estados vazios, movimento reduzido e bloqueio do script de gráficos. Os dados do navegador são fixtures, sem acesso ao banco de produção.
