# Recados, anúncios e notificações

O Livro mantém uma conversa privada por dupla de pessoas, vinculada aos IDs de `users`. Alterar nome, username ou cargo não cria outra conversa. O histórico permanece quando uma conta é desativada; novos envios exigem destinatário ativo e habilitado a usar recados.

## Atualização de uma instalação existente

Com Node.js 22 ou superior, na mesma base configurada no `.env`:

```powershell
npm run migrate:auth
npm run migrate:chat
npm start
```

A primeira migração adiciona o marcador `chat_permissions_migrated` e concede `chat.use` aos cargos existentes uma única vez. `chat.announce` é concedida inicialmente apenas aos cargos de autoridade máxima. Execuções seguintes preservam escolhas posteriores. A segunda migração cria as tabelas e os índices do chat, sem alterar denúncias ou relatórios. Não é necessária outra variável de ambiente.

## Permissões e público

- `chat.use`: lista de pessoas habilitadas, conversas próprias, envio individual, recebimento de anúncios e leitura.
- `chat.announce`: distribuição coletiva e acompanhamento dos destinatários; exige também `chat.use`.
- Mesmo uma autoridade máxima só consulta conversas das quais participa. O servidor verifica os participantes em cada consulta e gravação.
- Referências a denúncias exigem `denunciations.read`, sem conceder edição ou ampliar o acesso do destinatário.

Na primeira versão, os públicos coletivos são os **cargos cadastrados**, além de todas as pessoas habilitadas ou pessoas escolhidas individualmente. Não se deduz o setor a partir da permissão de receber denúncias. A tela exibe o nome de cada cargo e as pessoas alcançadas. Cargos sobrepostos ou seleções repetidas não duplicam mensagens.

Cada anúncio registra os destinatários resolvidos no momento do envio e insere uma mensagem com a tag Anúncio na conversa privada de cada um com o remetente. As respostas são individuais. Alterar cargos posteriormente não muda destinatários nem a contagem original. O autor pode consultar a leitura de cada destinatário.

## Leitura e atualização automática

O contador na navegação representa mensagens recebidas ainda não visualizadas, e não o número de conversas. O polling não confirma leitura. O navegador envia apenas IDs de mensagens recebidas que estiveram visíveis na conversa, com a página em foco; o servidor valida a autoria, a conversa e registra a primeira data de leitura.

O cliente consulta notificações aproximadamente a cada 10 segundos e a conversa aberta a cada 3 segundos, buscando mensagens novas e recibos de leitura separadamente. O histórico anterior é paginado. Uma consulta aguarda a anterior terminar, usa timeout e aumenta o intervalo em falhas. Foco e recuperação de conexão antecipam uma atualização. As rotas do chat evitam o carregamento dos catálogos das telas de denúncia, e o middleware não calcula a contagem SIVISA em cada requisição de API.

Abas compartilham atualizações e estado da conversa visível. Web Locks, quando disponível, coordena as consultas globais; uma concessão curta em localStorage é o fallback. Identificadores já recebidos são guardados por pessoa para evitar repetir avisos após navegação, e o alerta do sistema usa uma tag estável por mensagem. Nenhum texto de recado é persistido no localStorage. O polling respeita a revogação da sessão e a troca obrigatória de senha.

## Avisos do Windows

O botão Ativar notificações pede autorização ao navegador apenas após o clique. A permissão negada não impede o contador interno. Em acesso pela rede, use HTTPS; localhost é tratado como contexto confiável pelos navegadores compatíveis. O clique no aviso abre a conversa. Mensagens anteriores ao primeiro uso preenchem o contador sem disparar uma sequência de alertas antigos.

Os temporizadores podem ser atrasados pelo navegador em segundo plano. Esta implementação requer ao menos uma página do Livro aberta; não inclui Web Push para entrega com todas as páginas fechadas. Restrições do sistema operacional também podem impedir a exibição do aviso externo, mantendo os recados disponíveis no Livro.

## Verificação

```powershell
npm test
npm run test:chat:db
```

A suíte SQL cria e remove apenas sua própria base temporária, sem inserir mensagens de teste na base operacional. Os testes de navegador simulam timers, conectividade e permissões para verificar atualização de contadores, repetição de avisos e sessão.
