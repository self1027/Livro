# Interface do Livro

O front-end mantém Express, EJS e Bootstrap 4.6.2. A paleta usa verde-floresta nas ações, verde-sálvia na navegação, cabeçalhos em verde claro e área de trabalho branca. O login tem um painel institucional verde escuro. A tipografia IBM Plex Sans é servida localmente, com licença em `public/fonts`.

A marca representa um livro aberto, com páginas preenchidas em verde e linhas claras. O arquivo `public/favicon/livro.svg` é compartilhado pelo favicon, navegação e apresentação do login, mantendo o mesmo desenho em todos os tamanhos.

## Decisões visuais

- A listagem responde “quais denúncias precisam de acompanhamento?”. O protocolo reúne número e ano; título, localização, origem, status e fiscal continuam disponíveis em todos os tamanhos.
- A navegação se recolhe até 1100px. As tabelas da listagem passam a registros em grade quando o espaço disponível diminui.
- O cadastro mantém as seções de identificação, localização e descrição. O login recebe uma apresentação institucional no desktop e formulário direto no celular.
- As cores cadastradas para origens e status continuam vindo do catálogo. A interface não calcula totais globais a partir de uma página: o contador indica somente registros exibidos e acompanha “Carregar mais”.
- O link “Pular para o conteúdo”, os estados de foco e os rótulos acessíveis apoiam a navegação por teclado. O movimento se limita ao feedback de pressão de botões e respeita `prefers-reduced-motion`.

## Organização

`public/css/theme.css` concentra cores, fontes e tokens de movimento. `style.css` define os componentes básicos; `components.css`, a navegação e a estrutura; `home.css` e `auth.css`, os layouts específicos. `views/partials/icon.ejs` contém os ícones SVG compartilhados.

## Skills aplicadas

Instaladas globalmente em `C:/Users/User/.codex/skills`:

- `design-motion-principles`: interações de ferramenta de trabalho, com Emil Kowalski como referência principal de contenção e Jakub Krehel para acabamento.
- `design-taste-frontend`: direção **Framed sheet**, seed `1723315413`. A direção inicial “Editorial greeting” foi substituída porque uma fila de denúncias precisa priorizar protocolos e acompanhamento, em vez de uma saudação. A moldura verde e o protocolo são os elementos específicos do Livro. A pedido do usuário, a paleta passou a aplicar mais verde na navegação, nos cabeçalhos e nas ações, ampliando o uso de cor previsto na direção original.
- `ui-ux-pro-max`: orientação de interface acessível para uso institucional. A estrutura existente de aplicação prevalece sobre a sugestão automática de landing page.

## Validação

- `npm test`: 75 testes aprovados, 2 integrações com MySQL ignoradas por não haver banco de teste isolado configurado.
- 47 verificações no Chrome: oito rotas/estados em 375, 390, 768, 1024 e 1440px, menus e Escape, paginação, falha de rede e tentativa seguinte, escape de conteúdo, permissões no estado vazio e movimento reduzido.
- Inspeção visual da listagem, cadastro e login, com dados de exemplo em um servidor local separado do banco. A nova paleta passou sem falhas de contraste na listagem e no login. O alerta de ícones em superfícies corresponde à personalização de avatar existente; o alerta de área colorida no login é esperado pelo painel verde solicitado pelo usuário.

As imagens, fixtures e scripts auxiliares da revisão ficam em `.taste-skill/`, ignorado pelo Git. Nenhum dado de exemplo foi adicionado às telas de produção.
