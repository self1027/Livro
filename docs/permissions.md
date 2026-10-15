# Permissões e ações

Cada ação exige sua permissão específica. Consultar não concede edição; criar, editar e excluir relatórios são permissões independentes. Sem permissão de consulta, uma gravação concluída mostra confirmação em vez de redirecionar para uma tela proibida.

| Permissão | Ação autorizada isoladamente |
|---|---|
| `denunciations.read` | Listagem, busca, API de consulta e detalhes das denúncias. |
| `denunciations.create` | Formulário e cadastro de denúncia. |
| `denunciations.edit.own` | Formulário e gravação dos dados e situação das denúncias cadastradas pela própria pessoa, independentemente do responsável atual. |
| `denunciations.edit.all` | Edita qualquer denúncia, incluindo as próprias e as antigas sem autor identificado. Não exige `fiscal.all`. |
| `denunciations.assign` | Fila e troca do responsável por uma denúncia. |
| `denunciations.receive` | Disponibiliza pessoas do cargo para novas atribuições, com cadastro e acesso ativos. Não abre telas nem permite atribuir denúncias. |
| `reports.create` | Adiciona texto ou mudança de status à denúncia atribuída à pessoa. Exige responsável definido. |
| `reports.edit` | Abre e salva relatórios de sua autoria e gerencia seus protocolos e pendências SIVISA, inclusive após reatribuição. Editar um status histórico após reatribuição não altera a situação atual da denúncia. |
| `reports.delete` | Exclui relatórios de sua autoria, inclusive após reatribuição. Não concede edição. |
| `fiscal.area.own` | Própria área fiscal, filtros, paginação e PDF. |
| `fiscal.area.all` | Todas as áreas e PDFs, incluindo a própria área e cadastros inativos. Não concede operações sobre os registros. |
| `fiscal.all` | Amplia o alcance de criar acompanhamento e editar/excluir relatórios e SIVISA para outros fiscais. Exige também a permissão da operação. Não amplia a edição de denúncias nem abre áreas fiscais por si só. |
| `schedule.read` | Consulta da escala. |
| `schedule.manage` | Consulta e gravação da escala administrativa. |
| `catalogs.manage` | Consulta e gravação de categorias, cores e bairros. |
| `attendance.manage` | Consulta e gravação da configuração de atendimento. |
| `dashboard.read` | Painel de indicadores, filtros e exportações CSV/PDF. Não concede atribuição ou edição de relatórios. |
| `chat.use` | Conversas privadas das quais participa, envio individual, recebimento de anúncios e confirmação de leitura. |
| `chat.announce` | Envio coletivo por cargo ou pessoas e acompanhamento das leituras do anúncio; exige também `chat.use`. |

A autoridade máxima administra pessoas, contas, cargos, recuperação e auditoria e tem acesso às operações acima. Receber novas denúncias continua exigindo seleção explícita.

Conversas privadas continuam restritas aos dois participantes, inclusive para autoridade máxima. Anúncios e referências a denúncias não ampliam o acesso a outras conversas ou registros. A atualização `npm run migrate:auth` habilita recados para os cargos existentes e anúncios somente para autoridade máxima uma única vez; depois preserva as permissões alteradas. Consulte [recados.md](recados.md).

Os controles da interface e o servidor usam a mesma política de autoria e atribuição. O histórico inclui `reports.user_id`; o nome exibido e o texto do relatório não determinam sua autoria.

A autoria do cadastro fica em `denunciations.created_by_user_id`, preenchida com `req.auth.user.id` pelo servidor. O formulário não define nem altera esse campo. A troca de fiscal responsável altera apenas `user_id`. Registros anteriores à implantação permanecem com autor desconhecido; não se presume que o fiscal atribuído ou o autor do primeiro relatório tenha feito o cadastro. Esses registros exigem a edição de todas as denúncias. A tela de detalhes informa o autor quando conhecido.

`npm run migrate:auth` prepara a coluna e converte a antiga `denunciations.edit` uma única vez: cargos que também possuíam `fiscal.all` recebem `denunciations.edit.all`; os demais recebem `denunciations.edit.own`. Cargos sem a edição anterior não ganham essa permissão. A repetição não restaura permissões posteriormente removidas. A migração não presume autores nem muda as atribuições. Sem autenticação, `npm run migrate:denunciation-creators` prepara apenas a coluna; cadastros sem identidade autenticada continuam com autoria desconhecida.

Validação automatizada: `permissionMatrix.test.js` confronta cada permissão isolada com as rotas e os botões; `fiscalPermissions.test.js` verifica as áreas e PDFs; `authDb.test.js` verifica autoria real, reatribuição, gravações, recebimento e migrações em MySQL temporário.
