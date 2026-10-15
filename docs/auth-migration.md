# Autenticação: implantação em uma instalação existente

## Comando único recomendado

Depois do backup, com a aplicação em manutenção, execute:

```powershell
npm install
npm run auth:migrate
```

`authMigrationScript.js` usa a mesma conexão de banco da aplicação e carrega o `.env` existente. Pede o endereço do Livro, o e-mail institucional e, se ainda não houver contas, nome/username/senha da primeira Chefia. A senha fica oculta e precisa ser repetida. Informe o ID de um fiscal ativo para aproveitar seu cadastro; Enter cria um novo cadastro para a Chefia.

O comando cria as tabelas adicionais, as três responsabilidades iniciais, a primeira Chefia e o e-mail de recuperação. Depois de conferir que há uma Chefia ativa, salva `AUTH_ENABLED=true` no `.env`, preservando as demais configurações. A substituição do arquivo é atômica; se ele mudar durante a execução, o comando interrompe a ativação e pede nova execução. Nenhuma senha da Chefia é gravada no arquivo.

Ao repetir, não redefine senhas, não recria contas e não substitui um e-mail institucional já configurado. Se houver falha depois da criação das tabelas ou da Chefia, corrija a causa e execute novamente. A ativação fica para o final, sem exigir que todas as etapas anteriores sejam refeitas.

Depois da conclusão, reinicie o serviço com `npm start` ou pelo gerenciador utilizado e entre em `/auth/login`. Não é necessário executar `migrate:auth` e `auth:bootstrap` separadamente. O script não encerra um servidor existente. Se o serviço injeta `AUTH_ENABLED=false` no ambiente, altere-o para `true`: variáveis externas têm precedência sobre `.env`.

Os demais fiscais continuam com os mesmos IDs e recebem acesso pela Chefia em `/admin/access`, vinculando o cadastro existente. O comando não inventa usernames ou distribui senhas padrão a todos os usuários.

Configure SMTP no `.env` para que a recuperação por e-mail possa enviar mensagens. O login e o reset por outra Chefia funcionam independentemente do SMTP; o comando não envia um e-mail de teste. Para desenvolvimento local, o assistente admite APP_URL em HTTP somente em localhost e configura cookie sem Secure; produção exige HTTPS.

Para automação, forneça `APP_URL`, `AUTH_RECOVERY_EMAIL`, `BOOTSTRAP_USERNAME`, `BOOTSTRAP_NAME`, `BOOTSTRAP_PASSWORD` e, opcionalmente, `BOOTSTRAP_USER_ID` no ambiente e execute `npm run auth:migrate -- --non-interactive`. Os campos de bootstrap só são necessários enquanto não houver contas, e o e-mail só quando não estiver configurado. Forneça a senha por variável temporária, conforme o exemplo PowerShell abaixo, e remova-a após executar. Consulte `npm run auth:migrate -- --help`.

As seções seguintes detalham a preparação, o esquema e os comandos individuais, que continuam disponíveis para operações controladas.

## Resultado e compatibilidade

A atualização adiciona username/senha, sessões opacas Bearer, responsabilidades dinâmicas e recuperação da Chefia pelo e-mail institucional do setor. Não existe e-mail por usuário. A interface continua em EJS, com sessão em cookie; clientes da API usam `Authorization: Bearer <access_token>`.

**A migração não altera a tabela `users`, não renumera fiscais e preserva o conteúdo de denúncias, relatórios e atribuições.** As credenciais ficam em `auth_accounts`, vinculadas ao ID original de `users`. Um fiscal anterior continua existindo mesmo sem conta de login. A Chefia cria seu acesso escolhendo o cadastro existente, em vez de cadastrar o fiscal novamente. A atualização também adiciona `denunciations.created_by_user_id`, deixando o autor dos cadastros antigos desconhecido, e separa a edição de denúncias próprias da edição de todas as denúncias. Consulte `docs/permissions.md` para a conversão dos cargos existentes.

A autenticação só entra em vigor com `AUTH_ENABLED=true`. Sem essa configuração, o comportamento de acesso anterior é preservado e as rotas de autenticação ficam indisponíveis. Isso permite preparar a atualização antes da mudança de operação. **Uma instalação exposta deve ser ativada conforme a sequência abaixo; deixar a configuração desativada mantém o acesso livre anterior.**

As migrações de autenticação e permissões exigem execução explícita de `npm run migrate:auth` ou do assistente acima. Com autenticação ativada, a inicialização verifica as tabelas e a existência de uma Chefia ativa; se faltar algo, encerra com erro, sem abrir as rotas. A inicialização pode preparar as colunas auxiliares de autoria de denúncia e agrupamento de relatórios, sem atribuir autores a registros antigos.

## Novas tabelas

A identificação em **Minha conta** permite escolher um ícone masculino ou feminino e uma das seis cores de fundo. As preferências ficam nos campos `avatar_icon` e `avatar_color` de `auth_accounts`, disponíveis para qualquer pessoa com sessão regular. Ao atualizar uma instalação anterior, execute `npm run migrate:auth` antes de reiniciar; os novos campos são adicionados com valores padrão e a repetição preserva as escolhas salvas.

| Tabela | Finalidade |
|---|---|
| `auth_roles` | Responsabilidades: nome, autoridade máxima e permissões JSON |
| `auth_accounts` | Username único, hash de senha, responsabilidade, habilitação, troca obrigatória e vínculo único com `users.id`; `inspector` permanece apenas para compatibilidade com a migração anterior |
| `auth_sessions` | Hash dos tokens, conta, família, tipo, expiração, CSRF e marca de renovação consumida |
| `auth_resets` | Hash de link de recuperação, conta e expiração |
| `auth_settings` | Registro único `id=1`: e-mail do setor e marcador da criação inicial das responsabilidades |
| `auth_audits` | Autor, ação, destino e detalhes administrativos; nunca senhas ou tokens |

As tabelas usam os timestamps padrão do Sequelize, `createdAt` e `updatedAt`. As contas possuem chaves estrangeiras para `users` e `auth_roles`; sessões e links apontam para a conta. Não há exclusão de usuários ou responsabilidades nesta interface: desabilite a conta ou retire permissões, preservando referências.

## Preparação

1. Reserve uma janela de manutenção e identifique a versão anterior para retorno.
2. Faça backup consistente do MySQL e dos arquivos de configuração/dados, incluindo `src/data/attendance.json`. Confira a restauração em uma base de homologação antes de atualizar produção.
3. Anote os totais de `users`, `denunciations` e `reports`, os IDs dos fiscais e algumas denúncias com responsáveis e relatórios antigos. Esses dados precisam permanecer iguais logo após a migração.
4. Use Node.js 22 ou superior e execute `npm install` na versão atualizada. O hash de senha usa scrypt nativo; o envio de e-mail usa Nodemailer.
5. Copie `.env.example` para `.env` e preencha os valores reais. Não versione o arquivo. Os comandos `npm start`, `npm run migrate:auth` e `npm run auth:bootstrap` carregam `.env`, quando existir. Processos iniciados por outra ferramenta precisam receber essas mesmas variáveis ou usar `node --env-file=.env ...`.

| Configuração | Uso |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Mesma base da instalação existente; confirme o nome antes de migrar |
| `AUTH_ENABLED=false` | Preparação; só trocar para `true` após criar a Chefia |
| `AUTH_COOKIE_SECURE=true` | Cookies enviados apenas por HTTPS |
| `APP_URL=https://...` | Endereço externo fixo usado nos links; nunca obtido do cabeçalho Host |
| `TRUST_PROXY=true` | Somente quando houver um proxy reverso confiável diretamente à frente do Node |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Servidor remetente; porta 587 com STARTTLS obrigatório ou 465 com TLS |
| `NODE_ENV=production` | Em produção, a aplicação recusa cookies inseguros ou APP_URL sem HTTPS |

O destino de recuperação não é uma variável SMTP: será preenchido pela Chefia em **Usuários e acessos**. Homologação local em HTTP pode usar `AUTH_COOKIE_SECURE=false`, com `NODE_ENV` diferente de `production`. A recuperação por e-mail exige APP_URL HTTPS mesmo em homologação.

Os valores legados de conexão continuam como fallback em `database.js` para não quebrar a instalação existente. Configure as variáveis de banco explicitamente no servidor atualizado.

## Executar a migração

Com a aplicação em manutenção e `AUTH_ENABLED=false`:

```powershell
npm run migrate:auth
```

O comando exige que `users` já exista e cria somente as seis tabelas novas. Não utiliza `alter`, `force`, exclusão de tabelas ou atualização em massa dos registros anteriores. Precisa de permissão de criação de tabelas, índices e chaves estrangeiras. A conta usada pelo servidor pode ter permissões mais restritas após a migração.

Na primeira execução, cria **Fiscal**, **Administrativo** e **Chefia**. Execuções posteriores não redefinem permissões nem recriam responsabilidades que foram renomeadas. O marcador `roles_seeded` é gravado junto com a configuração inicial, em transação.

### Atualizar o recebimento de denúncias por cargo

Execute `npm run migrate:auth` antes de reiniciar uma instalação anterior a esta mudança. O comando acrescenta o marcador `role_receiving_migrated` em `auth_settings` e converte a antiga opção individual `inspector` na permissão `denunciations.receive` do cargo. Se um cargo tinha pessoas com e sem recebimento, cria uma variação com recebimento e move somente as contas correspondentes, preservando as demais permissões. Não altera IDs de pessoas, denúncias, relatórios ou responsáveis antigos. Repetir o comando não desfaz decisões posteriores sobre o recebimento.

A permissão de recebimento deve ser selecionada explicitamente, inclusive para cargos com autoridade máxima. Novas atribuições exigem conta habilitada, cadastro ativo e cargo com essa permissão. Pessoas sem conta continuam visíveis em **Usuários e acessos**, com acesso ao histórico e criação de conta vinculada, mas não recebem novas atribuições até terem acesso configurado.

O MySQL não permite desfazer todo DDL por transação. Se o processo for interrompido entre tabelas, corrija a causa e execute o mesmo comando novamente; a criação é repetível. Não ative o servidor antes da conclusão. O comando não tenta corrigir manualmente uma tabela de autenticação já existente com estrutura diferente: nesse caso, compare o esquema e prepare uma migração específica.

Confira os totais e os vínculos antigos anotados anteriormente. **Nenhum username ou senha padrão é criado para os fiscais.**

## Criar a primeira Chefia

O bootstrap é uma operação de console, sem cadastro público. Só funciona enquanto não houver nenhuma conta em `auth_accounts`. Pode aproveitar o ID de um fiscal existente ou criar um novo cadastro para a Chefia.

Exemplo PowerShell, sem colocar a senha no histórico do terminal:

```powershell
$env:BOOTSTRAP_USERNAME = 'chefia.inicial'
$env:BOOTSTRAP_NAME = 'Nome da Chefia'
# Opcional: ID real de um fiscal ativo existente. Omitir cria um novo cadastro.
# $env:BOOTSTRAP_USER_ID = '17'
$bootstrapSecret = Read-Host 'Senha inicial (15 a 128 caracteres)' -AsSecureString
$env:BOOTSTRAP_PASSWORD = [System.Net.NetworkCredential]::new('', $bootstrapSecret).Password
try {
    npm run auth:bootstrap
    if ($LASTEXITCODE -ne 0) { throw 'Bootstrap não concluído. Verifique a mensagem.' }
} finally {
    Remove-Item Env:BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:BOOTSTRAP_USERNAME -ErrorAction SilentlyContinue
    Remove-Item Env:BOOTSTRAP_NAME -ErrorAction SilentlyContinue
    Remove-Item Env:BOOTSTRAP_USER_ID -ErrorAction SilentlyContinue
    $bootstrapSecret = $null
}
```

O cadastro escolhido precisa estar ativo. A primeira Chefia não recebe novas denúncias por padrão: selecione a permissão de recebimento em seu cargo, caso também atue na fiscalização. Nenhuma senha aparece na saída do comando. Use uma senha pessoal definitiva para a primeira Chefia; as contas posteriores recebem senha temporária com troca obrigatória.

O bootstrap não redefine uma Chefia já cadastrada. A recuperação posterior acontece pelo e-mail do setor ou por outra Chefia.

## Ativar e preparar os demais acessos

1. Configure `AUTH_ENABLED=true`, HTTPS, cookie seguro e as variáveis do processo de serviço. Reinicie usando `npm start` ou o gerenciador de processos da instalação.
2. Acesse `/auth/login` e entre como a primeira Chefia.
3. Em `/admin/access`, salve o e-mail institucional confirmando sua senha atual. Verifique SMTP e a entrega de uma recuperação de teste antes de encerrar a manutenção. Alterar o e-mail invalida os links pendentes e gera auditoria.
4. Crie uma segunda Chefia para permitir recuperação entre chefes. A troca da senha temporária é obrigatória antes de administrar o sistema.
5. Para cada fiscal anterior, em **Criar acesso**, escolha **Vincular a uma pessoa existente**, informe nome/username, cargo e senha temporária. O cargo deve ter **Receber denúncias para fiscalização** selecionado para permitir novas atribuições. Não use **Criar novo cadastro** para substituir um fiscal anterior: isso criaria outro ID.
6. Para Administrativo ou Chefia que não recebam denúncias, escolha um cargo sem a permissão de recebimento. Alterações nas permissões de um cargo valem para todas as pessoas vinculadas a ele.
7. Entregue as credenciais temporárias individualmente e confira o primeiro acesso. Não existe envio de senha por e-mail.
8. Atualize integrações que consultam `/api/denuncias` ou PDFs: após a ativação, essas rotas exigem autenticação. Encerrar a janela de manutenção exige que os usuários necessários já tenham recebido acesso.

Um usuário entra apenas quando sua conta está habilitada **e** seu cadastro original `users.ativo` está ativo. Ambos são gerenciados em **Usuários e acessos**, junto com nome, username, senha e o botão **Ver denúncias**. Habilitar a conta não reativa automaticamente um cadastro desativado. A antiga aba Fiscais foi removida; suas rotas redirecionam para a gestão unificada sem executar gravações antigas.

## Responsabilidades e permissões

As responsabilidades são cadastráveis e renomeáveis. A marca **Autoridade máxima**, e não o nome da responsabilidade, concede administração de contas/permissões e recuperação por e-mail. Várias responsabilidades podem possuir essa autoridade; todas seguem a mesma política de Chefia.

As permissões são um catálogo fixo de ações implementadas, agrupadas por módulo. Criar uma responsabilidade não cria automaticamente novas ações de backend. Uma responsabilidade sem permissões pode entrar e alterar a própria senha, mas não acessa módulos.

| Inicial | Acesso |
|---|---|
| Fiscal | Consultar/cadastrar e receber denúncias, área própria, acompanhamento e edição de relatórios próprios e escala |
| Administrativo | Todas as permissões operacionais inicialmente; sem gestão de credenciais ou responsabilidades |
| Chefia | Todas as operações e administração de acessos |

`fiscal.area.own` permite consultar somente a própria área fiscal, com filtros e PDF. `fiscal.area.all` permite consultar todas as áreas, inclusive a própria e as de cadastros inativos, sem conceder edição de registros de outras pessoas. A primeira é o padrão do Fiscal; a segunda é o padrão da Chefia e está incluída na autoridade máxima.

`fiscal.all` amplia somente o trabalho em registros de outros fiscais, em conjunto com as permissões específicas de edição e acompanhamento. Sem ela, criar acompanhamento e editar os dados da denúncia dependem de atribuição ao próprio fiscal. Editar ou excluir um relatório depende da autoria, inclusive depois da troca do responsável. Alterar um relatório histórico de status após reatribuição preserva a situação atual da denúncia. Consultar a listagem geral continua dependendo de `denunciations.read`.

Na atualização, execute `npm run migrate:auth`. A migração acrescenta o marcador `fiscal_area_permissions_migrated` e substitui `fiscal.read` por acesso à própria área ou a todas, preservando o alcance de consulta anterior. Repetir o comando não restaura permissões removidas posteriormente. A escolha de outra área e o PDF validam essas permissões no servidor.

A proteção é aplicada antes de todos os controladores, incluindo aliases como `/atribuir`, `/usuario/registrar`, `/bairros` e exports. Rotas não catalogadas são recusadas. Uma nova rota precisa de uma regra explícita em `routePermission`; ocultar um botão não substitui autorização.

A última Chefia ativa não pode perder autoridade ou ser desativada, incluindo pela tela antiga de edição do fiscal. As alterações críticas usam transação e um bloqueio no registro único de configurações, para evitar duas desativações simultâneas.

## Senhas, tokens e recuperação

- Senhas: 15 a 128 caracteres, scrypt com salt individual, N=131072/r=8/p=1. No máximo duas derivações simultâneas por processo, para controlar memória. Parâmetros seguem a alternativa scrypt da [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Bearer de acesso: 15 minutos. Renovação: 8 horas, com rotação de token; um token de renovação reutilizado encerra sua família, incluindo o acesso recém-emitido. A expiração de 8 horas é contada a partir de cada emissão.
- Navegador: cookie `livro_session`, HttpOnly/Secure/SameSite=Strict, com sessão de 8 horas. Não armazena tokens no localStorage.
- Formulários EJS recebem CSRF no servidor, inclusive sem JavaScript. O script compartilhado acrescenta o cabeçalho CSRF nas mutações fetch da mesma origem. APIs autenticadas por Bearer não usam CSRF de cookie.
- Logout encerra a família atual. Troca/reset de senha e edição de conta encerram todas as sessões daquela conta. Desativar o cadastro também impede autenticação. Permissões e responsabilidade são consultadas no servidor em cada requisição; não há permissões antigas gravadas no token.
- Usuários abaixo da autoridade máxima: Chefia define senha temporária e o próximo acesso exige troca.
- Chefia: informa username em `/auth/recover`; o link vai apenas ao e-mail institucional configurado. Link vinculado à conta, com 20 minutos de validade e uso único. Um chefe pode redefinir outro pelo painel, sem e-mail.
- Respostas de login/recuperação não revelam a existência de conta. O envio usa [Nodemailer SMTP](https://nodemailer.com/smtp). Ainda é necessário validar credenciais e entrega no servidor real.
- Login, renovação, senha e recuperação têm limite compartilhado de 15 tentativas por IP a cada 15 minutos, em memória. Reiniciar o processo reinicia o contador. Esta versão pressupõe um único processo; antes de usar várias instâncias, adote limitação compartilhada ou no proxy.

O servidor exige somente o token de acesso no cabeçalho, nunca o refresh token. O cliente precisa guardar os dois tokens em armazenamento apropriado, substituir o refresh token após cada renovação e evitar renovações paralelas com o mesmo token.

## API e verificação

A especificação dos endpoints está em `docs/auth.yaml`, integrada ao Swagger em `/docs`; quando a autenticação está ativada, a documentação também exige Chefia. Login/renovação são públicos; `/api/auth/me`, `/api/auth/password` e `/api/auth/logout` usam Bearer ou sessão autenticada.

```powershell
npm test
npm run test:auth:db
```

A suíte padrão não precisa de MySQL e pula o teste de integração. A segunda cria uma base temporária com nome aleatório `livro_auth_test_<hex>`, usa somente essa base e a remove ao finalizar. O usuário de teste precisa de CREATE/DROP DATABASE. Não modifica `livro_visa` e não envia e-mails reais: o transporte SMTP é simulado. Para usar configurações de `.env` nos testes MySQL: `node --env-file=.env scripts/testAuthDb.js`.

O teste MySQL cobre repetição da migração, preservação de IDs/vínculos, autoridade independente do nome, contas que não são fiscais, efeito imediato de permissões, CSRF, acesso por Bearer, autoria real dos relatórios, rotação/reutilização, reset entre chefes, expiração/uso único e proteção da última Chefia, incluindo duas desativações simultâneas.

Antes de liberar produção, confira também HTTPS/cookies no navegador, acesso de um Fiscal, acesso de Administrativo, atualização de um registro antigo, logout e entrega real na caixa institucional. A base operacional não é migrada nem a autenticação ativada apenas pela instalação do código.

## Retorno e manutenção

Se a implantação falhar, mantenha a janela de manutenção, pare a versão nova e volte ao código/configuração anteriores. As tabelas de autenticação são adicionais e podem permanecer na base. Não apague `users`, `denunciations` ou `reports`. Se houver alterações em dados após a atualização, não restaure cegamente um backup anterior: avalie quais gravações precisam ser preservadas.

**Não use `AUTH_ENABLED=false` como retorno silencioso em um serviço exposto:** essa configuração reabre o acesso livre anterior. O retorno deve ocorrer sob manutenção ou com controle de acesso externo.

Se já foram criadas contas administrativas com novos registros em `users`, uma versão antiga poderá listá-las como fiscais, pois desconhece a marca `inspector`. Considere esse efeito antes de retornar. A migração em si não cria essas contas.

Inclua as seis tabelas nos backups. Monitore falhas SMTP sem registrar links/tokens. Sessões expiradas e links vencidos permanecem inválidos mesmo antes da limpeza; programe limpeza periódica desses registros, preservando a auditoria. Tokens de renovação consumidos precisam permanecer até sua expiração para detectar reutilização.
