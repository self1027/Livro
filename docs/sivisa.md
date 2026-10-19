# SIVISA por relatório de acompanhamento

Um relatório textual representa uma ação e pode receber vários protocolos SIVISA. Cada protocolo tem vínculo exclusivo com um relatório. Os campos são estruturados; números já escritos em textos antigos não são importados automaticamente.

## Situações

- **Cabe SIVISA — ainda não registrado:** aplicável e sem protocolos; gera lembrete para o autor.
- **SIVISA registrado:** existe pelo menos um protocolo. O primeiro remove o lembrete; outros podem ser adicionados depois.
- **Não cabe SIVISA:** sem protocolos e dispensado explicitamente.
- **Sem classificação anterior à implantação:** relatório textual antigo ainda não revisado. Não gera cobrança retroativa.

O status da denúncia não interfere: uma denúncia finalizada pode ter pendência SIVISA. Mudanças automáticas de status são sempre “não cabe SIVISA” e não contam como ações na produtividade. Texto e mudança de status enviados juntos geram dois registros, com SIVISA vinculado somente ao texto.

Remover o último protocolo mantém o relatório aplicável e faz a pendência voltar. Marcar explicitamente “não cabe SIVISA” encerra essa pendência sem protocolo. Uma classificação de dispensa não pode coexistir com protocolos.

## Uso e permissões

No formulário **Atualizar acompanhamento**, marque **Não cabe SIVISA** somente para dispensar a ação. Com a opção desmarcada e sem protocolos, o relatório textual fica automaticamente com SIVISA pendente. Informar um protocolo regulariza a ação automaticamente. Podem ser incluídos vários protocolos, cada um com observação opcional de até 500 caracteres. O formulário **Gerenciar SIVISA** usa a mesma regra.

A observação pode ser salva sem preencher o protocolo, inclusive em ações dispensadas. Ela permanece disponível no histórico e na edição, mas não conta como protocolo nem remove uma pendência. Ao preencher um protocolo na mesma linha posteriormente, a observação fica vinculada a ele. Observações SIVISA exigem um relatório textual; um envio somente de status não pode recebê-las.

O histórico mostra a situação e os protocolos. **Gerenciar SIVISA** abre um formulário separado que preserva o texto do relatório. Esta ação e a lista **SIVISA pendentes** exigem `reports.edit`; a autoria é validada, inclusive após reatribuição da denúncia. `fiscal.all` amplia o alcance, em conjunto com a permissão de edição. O menu e a própria área fiscal mostram um lembrete das pendências do autor.

Na criação, `reports.create` permite registrar a classificação e os protocolos da nova ação. Alterar protocolos posteriormente exige edição. Consultar outras áreas não concede essa edição.

## Dados, migração e concorrência

Execute `npm run migrate:sivisa` para preparar uma instalação existente. O comando é repetível, cria `report_sivisa` e `report_sivisa_protocols` e adiciona a coluna JSON `report_sivisa.notes` para observações sem protocolo caso ainda não exista. Não altera textos, autores, responsáveis ou status anteriores. A inicialização normal também prepara essas tabelas e a coluna, conforme a política de sincronização dos modelos operacionais do projeto.

Os protocolos são normalizados removendo espaços e convertendo letras para maiúsculas, preservando zeros à esquerda e pontuação. O índice único no banco impede vínculos duplicados mesmo com gravações simultâneas. Gravações do acompanhamento e dos vínculos ocorrem em transação; uma duplicidade desfaz a operação inteira. Excluir o relatório remove seus vínculos por chave estrangeira com cascata.

Com autenticação ativa, cada gravação SIVISA também registra na auditoria quem a realizou, quando, o relatório e a classificação/lista de protocolos resultante. O autor da ação continua sendo a referência da produtividade.

## Integração

`POST /denuncias/:id/adicionar-relatorio` recebe os campos adicionais:

```json
{
  "description": "Inspeção sanitária de retorno realizada.",
  "sivisa_state": "registered",
  "sivisa_protocol": ["01.000917/26", "01.001096/26"],
  "sivisa_note": ["Notificação completa neste SIVISA", ""]
}
```

`sivisa_state` aceita `pending`, `registered` ou `not_applicable`. Omitir o campo ou enviá-lo vazio equivale a `pending`: sem protocolos, gera pendência; com protocolos, a ação fica registrada. O checkbox HTML envia `not_applicable` somente quando marcado. O valor explícito `registered` continua exigindo pelo menos um protocolo na criação. Os campos de protocolo e observação aceitam uma string ou arrays correspondentes. Formulários HTML usam nomes repetidos. A lista admite até 100 protocolos por relatório, com até 64 caracteres cada. Informar protocolo em `pending` regulariza automaticamente a ação.

`GET/POST /relatorio/:id/sivisa` consulta ou substitui a classificação e a lista completa de protocolos. Na edição, `registered` com lista vazia resulta em pendência. Uma lista vazia em `not_applicable` dispensa a ação.

`GET /sivisa/pendencias?page=1` lista até 25 pendências por página, somente do usuário autenticado, em ordem das mais antigas.

## Indicadores

O painel apresenta ações textuais, relatórios com ao menos um SIVISA, protocolos, pendências, dispensas e anteriores sem classificação. Também apresenta esses valores por autor da ação, inclusive autores inativos. Reatribuir a denúncia não transfere produtividade ou pendências.

O intervalo de datas dos indicadores SIVISA usa a data de registro do relatório. O filtro de fiscal usa o autor. Ano do protocolo da denúncia, bairro, origem, situação e status continuam filtrando a denúncia relacionada. Por isso estes totais podem diferir da carga atualmente atribuída ao fiscal.

“Com SIVISA” significa ao menos um protocolo; não afirma que todos os registros possíveis da ação foram concluídos. Os testes em MySQL temporário cobrem múltiplos protocolos, duplicidade, concorrência, rollback, exclusão, reatribuição, pendências em denúncias finalizadas e migração repetida.
