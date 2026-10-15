# Interface compartilhada — Livro

Todas as telas usam a identidade da home: verde petróleo, fundo areia, superfícies claras e destaque suave para Nova Denúncia.

## Trocar as cores

Edite somente os tokens em `public/css/theme.css`. `--ui-primary` controla ações e links; `--ui-background` e `--ui-surface` controlam fundos; `--ui-sidebar` e seus tokens associados controlam a navegação; `--ui-accent` controla a ação de destaque. Os tokens danger, warning e success controlam mensagens sem alterar seu significado. Preserve o contraste ao trocar texto e fundo juntos.

As cores de status e origens são administradas em **Painel Administrativo → Cadastros e cores** e persistidas em `catalog_entries`. `color` define o texto e os indicadores; `backgroundColor` define o fundo do selo. Seus arquivos em `src/constants` expõem os dados carregados do banco. Tipos de relatório são operações internas, fixas em `src/constants/reportType.js`, e não são editáveis pelo administrador. Não duplique essas cores em seletores CSS.

## Componentes reutilizáveis

- `views/partials/header.ejs`: carrega tema e folhas compartilhadas.
- `views/partials/navbar.ejs`: abre o layout com sidebar e área de conteúdo.
- `views/partials/sidebar.ejs`: uma única definição de navegação para todo o projeto.
- `views/partials/adminTabs.ejs`: abas compartilhadas do painel, incluindo Escala; recebe `activeTab` e, opcionalmente, os endereços da visão geral e do atendimento com filtros.
- `views/partials/footer.ejs`: fecha o layout e carrega os scripts compartilhados.
- `views/partials/statusBadge.ejs`: selo de status. Exemplo: `<%- include('../partials/statusBadge.ejs', {status: DENUNCIATION_STATUS[denuncia.status] || {label: 'Desconhecido'}}) %>`.
- `views/partials/reportHistory.ejs`: histórico reutilizável com data, autor, texto e ações dos relatórios; recebe `reports` e `REPORT_DETAILS`.
- `views/partials/districtAutocomplete.ejs`: seleção de bairro com estilos compartilhados.
- A seleção de bairro usa `public/js/district-autocomplete.js`: sugestões com setas e Enter, identificação de bairro inválido e normalização para o nome cadastrado. O componente aceita `id`, `value`, `describedBy` e `invalid`.
- `views/partials/colorPicker.ejs`: quadrado de saturação e brilho, controle de matiz, RGB e hexadecimal, com suporte a teclado e toque. Recebe `pickerId`, `name`, `label` e `value`; a tela deve carregar `color-picker.css` e `color-picker.js` como módulo.

Use header, navbar, conteúdo e footer nessa ordem, uma vez por tela. Não feche manualmente os dois elementos do layout abertos por navbar. Nas telas existentes, a área principal mantém seus próprios formulários, modais e rotas.

`views/partials/pageHeading.ejs` define o cabe?alho de página: recebe `eyebrow`, `title`, `description`, `actionHref`, `actionLabel` e, opcionalmente, `actionPrimary`. Home e painel administrativo usam o mesmo componente. Use um ?nico h1 por página e h2 para suas seções; valores de indicadores não são títulos.

## CSS e comportamento

`style.css` define tipografia, campos, cartões e a base Bootstrap. `components.css` define sidebar, botões, modais, mensagens, status e tabelas reutilizáveis. `home.css`, `admin.css` e `schedule.css` contêm apenas regras específicas dessas telas. Evite cores literais em novas regras; use `var(--ui-...)`.

`public/js/ui.js` controla o menu no celular, destaca o destino atual e adapta tabelas com cabeçalhos simples para blocos rotulados quando há pouco espaço. As linhas adicionadas por paginação recebem os mesmos rótulos. Tabelas com células mescladas e o calendário mantêm sua estrutura e rolagem local, para preservar a associação entre colunas.

Use `btn-primary` para ações principais, `btn-outline-secondary` para ações auxiliares e `btn-danger` para exclusão. Os componentes Bootstrap existentes continuam compatíveis com o tema. Não use a cor como única indicação de status ou resultado.

## Verificação

O cadastro de denúncias usa `denunciation-form.css` e `denunciation-form.js` para agrupar identificação, localização e descrição. Os valores digitados são devolvidos no contexto `form` quando há erro; `fieldErrors` fornece as mensagens junto aos campos. Duplicidade oferece um link separado para o registro existente. A validação de campos obrigatórios também ocorre no servidor.

A visualização usa `denunciation-detail.css` e `denunciation-detail.js`. Os dados são apresentados como texto e listas de definição; o histórico aparece do mais recente ao mais antigo, com autor e data. A área de acompanhamento aceita texto, mudança de status ou ambos, e fica desabilitada enquanto não houver fiscal atribuído. Mensagens de resultado são definidas pelo servidor.

A área do fiscal usa `fiscal.css` e `fiscal.js`: seleção pesquisável de fiscais ativos, filtro dinâmico por status, quantidade de registros exibidos e exportação PDF nos filtros atuais. A entrada padrão mostra todos os status. Trocar o status atualiza a lista sem recarregar a página e reinicia a paginação em 50 registros. Requisições anteriores são canceladas e respostas antigas são descartadas. O endereço e o link do PDF acompanham o filtro aplicado; voltar/avançar no navegador restaura o filtro. A paginação permite tentar novamente após falha e as linhas novas preservam a adaptação da tabela ao celular. Sem JavaScript, o formulário GET e o link para a próxima página continuam disponíveis.

A escala é consultada em `/escala`, sem modal, script ou células de edição. O painel abre a escala atual na aba Escala (`/admin/schedule`), com navegação entre meses, edição de semanas e dias e visualização de anotações. `schedule.js` renderiza o calendário em ambos os modos; `schedule-editor.js` é carregado apenas no painel. Gravações usam `/admin/schedule/week` e `/admin/schedule/day`; as antigas rotas `/escala/semana` e `/escala/dia` rejeitam operações. O roteador administrativo está montado separadamente em `src/index.js`, permitindo aplicar middleware de login e autorização nessa montagem quando a autenticação for integrada.

A gestão de pessoas fica em **Usuários e acessos** (`/admin/access`): nome, username, senha, situação, vínculo com cargos e **Ver denúncias**, inclusive para cadastros antigos sem conta. Cada permissão tem uma descrição abaixo; **Receber denúncias para fiscalização** pertence ao cargo e substitui a antiga opção individual. A aba Fiscais foi removida e suas rotas redirecionam para a gestão unificada; os POST antigos usam HTTP 303 e não gravam. A aba **Atribuição** (`/admin/assignments`) mantém `admin-staff.css` e `admin-staff.js`, fila de 25 denúncias por página e busca local. A seleção de responsável mostra somente pessoas com cadastro e acesso ativos e cargo com recebimento habilitado.

Confira teclado, foco, contraste e zoom. A navegação deve recolher no celular; títulos e ações podem quebrar linha. Textos longos devem permanecer legíveis sem ampliar a página horizontalmente. O calendário possui rolagem dentro de seu próprio bloco.

## Autenticação e acessos

`auth/index.ejs` reutiliza o layout para login, troca de senha e recuperação. `admin/access.ejs` concentra contas, responsabilidades, permissões e e-mail institucional; `accessRoleForm.ejs` reutiliza o formulário de responsabilidade. `auth.css` contém somente as regras dessas telas e usa os tokens do tema. O cabeçalho de página aceita ação opcional.

Com autenticação ativa, `can` e `canPath` controlam os atalhos visíveis. A sidebar e as abas mostram somente os módulos permitidos; o backend continua verificando as rotas e os registros. A área Usuários e acessos exige autoridade máxima. Formulários POST recebem CSRF ao renderizar no servidor e `auth.js` protege as mutações fetch da mesma origem. Não inclua tokens Bearer ou senhas em atributos HTML.

O procedimento de implantação em bases existentes está em `auth-migration.md`.
