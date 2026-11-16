# Assinador SIVISA

Módulo do Livro que assina fichas no portal `sivisa.saude.sp.gov.br` a partir do navegador, com automação Playwright no servidor Linux. Diferente de **SIVISA pendentes** (protocolos em relatórios), este módulo executa login, senha eletrônica, fila de assinaturas e download do PDF oficial.

## Atualização de uma instalação existente

Com Node.js 22 ou superior:

```powershell
npm install
npx playwright install --with-deps chromium
npm run migrate:auth
npm run migrate:assinador
```

Defina no `.env` uma chave de 32 bytes em hex:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
ASSINADOR_VAULT_KEY=<64 hex>
ASSINADOR_PDF_DIR=   # opcional; padrão data/assinador/pdfs
ASSINADOR_MAX_PARALLEL=1
ASSINADOR_HEADED=false
ASSINADOR_PDF_TTL_MS=3600000
ASSINADOR_PDF_MAX_AGE_MS=86400000
ASSINADOR_PDF_SWEEP_MS=300000
ASSINADOR_STALL_MS=45000
```

## Resiliência (drawbacks assumidos)

- **Uma execução por vez** (`ASSINADOR_MAX_PARALLEL=1`).
- Em falha/instabilidade, o caminho feliz é **Retomar** (não Assinar do zero).
- Retry curto (até 3×) só em timeout/rede no portal; prévia PDF também retenta.
- Heartbeat `last_progress_at`: a UI avisa se ficar sem progresso (~45s).
- No boot, jobs `queued`/`running` órfãos viram **paused** para Retomar.
- PDF no servidor é temporário (TTL); baixe após concluir.
- Scout prefere o último fiscal que autenticou com sucesso neste processo.

`migrate:auth` concede `assinador.use` uma única vez aos cargos com `reports.edit` (e `assinador.manage` às autoridades máximas). Execuções seguintes preservam escolhas posteriores.

## Permissões

- `assinador.use`: abrir `/assinador`, iniciar Assinar/Retomar/Cancelar, acompanhar status e baixar o PDF das próprias execuções.
- `assinador.manage`: cadastrar/editar/excluir fiscais (login e senha eletrônica). Autoridades máximas também acompanham execuções de outros.

## Uso

1. Cadastre os fiscais com login e senha eletrônica do SIVISA.
2. Informe o protocolo / nº da ficha e clique em **Assinar**.
3. A página consulta o status a cada **200 ms** enquanto a execução estiver na fila ou em andamento.
4. Em falha ou cancelamento, prefira **Retomar**.
5. Em **Meu histórico**, consulte protocolos anteriores, retome execuções pausadas e baixe PDFs ainda válidos.

O servidor monta a fila a partir dos profissionais vinculados à ficha, valida contas, assina na ordem do portal e salva o PDF. Senhas ficam criptografadas (AES-256-GCM) com `ASSINADOR_VAULT_KEY`; nunca em texto puro.

Cada PDF recebe validade curta (`ASSINADOR_PDF_TTL_MS`, padrão 1 h) e limite absoluto (`ASSINADOR_PDF_MAX_AGE_MS`). Downloads renovam a validade até o limite. Após expirar, a API devolve HTTP 410 e o arquivo é removido pelo saneamento periódico.

## Painel administrativo

Quem possui `assinador.manage` abre **Painel → Assinador automatizado** (`/admin?view=assinador`) e vê volume, taxa de sucesso, assinaturas confirmadas, protocolos únicos e ranking dos operadores no período filtrado.

Eventos `assinador.job.*` e `assinador.signer.*` aparecem em **Usuários e acessos → Últimos eventos**.

## Verificação

```powershell
npm test -- tests/assinadorCore.test.js tests/assinadorMetrics.test.js tests/permissionMatrix.test.js
```
