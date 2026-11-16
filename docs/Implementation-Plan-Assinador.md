# Implementation Plan: Assinador SIVISA no Livro

**Branch alvo:** `sistema-completo` (`C:\www\Livro`)  
**Referência standalone:** `C:\www\sivisa-assinador\node-version`  
**Especificação / contexto:** este documento + `docs/assinador.md` + contratos `docs/ui-style.md` / `docs/frontend.md` / `docs/permissions.md`

---

## Overview

Integrar o Assinador SIVISA como **módulo nativo do Livro** (mesmo shell EJS, tokens verdes, botões Bootstrap mapeados, CSRF/`auth.js`, permissões por cargo), reaproveitando o esqueleto já existente em `src/assinador/*` + `views/assinador/` e trazendo do `node-version` o que ainda falta ou está melhor (TTL de PDF, robustez de login/print).

Cada execução fica **amarrada ao usuário Livro** (`assinador_jobs.requested_by`). Histórico e download: o operador só vê o que **ele** enfileirou; `assinador.manage` / `role.maximum` podem ver tudo. No admin: métricas de auditoria (assinaturas automatizadas, top automatizadores, sucesso/falha, volume por período).

---

## Specification Link

- Ops atual: `docs/assinador.md`
- UI: `docs/ui-style.md`, `docs/frontend.md`
- Permissões: `docs/permissions.md`
- Protótipo validado: `C:\www\sivisa-assinador\node-version` (Playwright, evidência, TTL PDF)

---

## Technical Approach

### Arquitetura

| Camada | Decisão |
|--------|---------|
| UI | Manter EJS Livro (`header` → `navbar` → `main.assinador-page` → `footer`), CSS em tokens `--ui-*`, botões `.btn-primary` / `.btn-outline-*`, status `#assinador-status` (sem toast genérico) |
| API | Continuar `/assinador` + `/api/assinador/*` no `assinadorController` (padrão Chat), **não** montar o `public/` do node-version como UI |
| Motor | Worker Playwright já em `src/assinador/`; portar fixes/TTL do `node-version` para cá |
| AuthZ | `assinador.use` / `assinador.manage` no registry + `routePermission` + form de cargos |
| Escopo | Jobs sempre com `requested_by = req.auth.user.id`; listagens filtradas |
| Métricas | Novo bloco/aba admin (Chart.js como SIVISA), agregando `assinador_jobs` |
| Auditoria | `auth_audits` em start/finish/signer CRUD (espelhar `sivisa.saved`) |

### Contrato de frontend (obrigatório)

1. Partials: `header` → `navbar` → `pageHeading` → conteúdo → `footer`
2. CSS: `theme.css` tokens; página em `assinador.css` (sem inventar paleta)
3. Fetch: `credentials: 'same-origin'` + CSRF via `auth.js` (enviar `X-CSRF-Token` nos POST JSON — alinhar ao chat)
4. Permissão na view: `data-can-manage`, esconder CRUD se `!can('assinador.manage')`
5. Nav: link em `sidebar.ejs` com `navAllowed('assinador.use')`

### Modelo de dados (já existe; evoluir)

- `assinador_signers` — catálogo compartilhado (manage)
- `assinador_jobs` — por usuário; índices `requested_by`, `status`
- Evoluções sugeridas:
  - `pdf_expires_at` / artefato id (TTL como no node-version)
  - opcional `signatures_count` denormalizado para métricas rápidas
  - janitor de PDF no boot + intervalo

### Permissões

| Key | Quem | O que |
|-----|------|--------|
| `assinador.use` | Fiscal/ops (seed: quem tem `reports.edit`) | Abrir módulo, Assinar/Retomar/Cancelar, ver **próprio** histórico, baixar **próprios** PDFs |
| `assinador.manage` | Chefia / maximum | CRUD fiscais + ver jobs de todos + métricas detalhadas |

---

## Phases

### Fase 0 — Alinhar base (wiring)

- [ ] Registrar `assinador.use` / `assinador.manage` em `src/auth/permissions.js` (+ descriptions)
- [ ] Seed único em `migrateAuth.js` (padrão `chat_permissions_migrated`): `use` → cargos com `reports.edit`; `manage` → `maximum`
- [ ] Grupo **Assinador** em `views/partials/accessRoleForm.ejs`
- [ ] `routePermission` para `/assinador` e `/api/assinador/*` em `middleware.js`
- [ ] Montar `assinadorRouter` em `src/index.js` (ordem compatível com `protectRoutes`/CSRF)
- [ ] Scripts `migrate:assinador` + `playwright` em `package.json`; documentar `ASSINADOR_*` no `.env.example`
- [ ] Link na `sidebar.ejs`
- [ ] Testes em `permissionMatrix.test.js`

### Fase 1 — Paridade com node-version (motor)

- [ ] Portar correções de login (settle / evaluateSafe) e print (download + request fallback)
- [ ] TTL de PDF (`ASSINADOR_PDF_TTL_MS`, max age, sweep); 410 se expirado
- [ ] Garantir fila/evidência/500 ms iguais ao protótipo validado
- [ ] CSRF nos POSTs do `public/js/assinador.js`

### Fase 2 — Específico por usuário (histórico)

- [ ] `GET /api/assinador/jobs?limit=&offset=&status=` — default `requested_by = eu`
- [ ] Com `assinador.manage` ou `maximum`: query `scope=all` (opcional `user_id=`)
- [ ] `GET /api/assinador/jobs/:id` e PDF: 404 se não for dono (exceto manage)
- [ ] UI: seção **Meu histórico** (tabela `.ui-responsive-table`) — protocolo, status, confirmações, data, ações Retomar/PDF
- [ ] Manter fluxo por protocolo (`latest`) sem misturar jobs de outros usuários no poll

### Fase 3 — Painel administrativo / auditoria

- [ ] Serviço `summarizeAssinador(jobs, users, filters)` espelhando SIVISA/`adminMetrics`
- [ ] Aba ou painel em `/admin` (permission `dashboard.read` + ideally manage): cards + Chart.js
  - Assinaturas automatizadas (jobs `done` no período)
  - Taxa de sucesso vs falha/cancelado
  - Top automatizadores (`requested_by`)
  - Protocolos únicos / assinaturas confirmadas (soma `confirmed`)
  - Tempo mediano start→finish
  - Série mensal (como `monthChart`)
- [ ] Tabelas acessíveis em `<details class="admin-chart-details">`
- [ ] `auth_audits`: `assinador.job.started`, `assinador.job.finished`, `assinador.signer.saved`, `assinador.signer.deleted`
- [ ] Filtros de período reutilizando querystring do admin

### Fase 4 — Polish e verificação

- [ ] Copy/UX alinhados a `ui-page-heading` / alerts Livro
- [ ] Preview portal (poll de frame ou log-only — decidir; WS opcional se encaixar no stack atual)
- [ ] `npm test` (core + permissions + métricas)
- [ ] Smoke: Assinar protocolo real com usuário A; usuário B não vê job/PDF de A
- [ ] Atualizar `docs/assinador.md` (wiring real, histórico, admin, TTL)

---

## Dependencies

1. Auth ligado (`AUTH_ENABLED`) e cargos editáveis em `/admin/access`
2. Chromium Playwright no host (`npx playwright install --with-deps chromium`)
3. `ASSINADOR_VAULT_KEY` (32 bytes hex)
4. MariaDB com migrate assinador
5. Chart.js já vendorado (`npm run assets:charts`)
6. Decisão de produto: preview JPEG ao vivo no Livro (nice-to-have) vs só log/fila (MVP)

---

## Risks

| Risco | Mitigação |
|-------|-----------|
| `protectRoutes` 403 se rota não mapeada | Fase 0: `routePermission` + montagem correta |
| POST JSON sem CSRF | Alinhar header como `auth.js` / chat |
| PDF sensível acumulando | TTL + janitor (Fase 1) |
| Vazamento cross-user | Testes de escopo em service + controller |
| Playwright pesado / 1 job por vez | Manter `ASSINADOR_MAX_PARALLEL=1`; fila por job na tabela |
| Portal SIVISA instável (timeout/rede) | Retry curto só em rede; heartbeat `last_progress_at`; UX Retomar-first; reclaim no boot |
| Duplicar motor (Livro vs node-version) | Fonte da verdade = Livro; node-version como laboratório |
| Seed sobrescrever cargos | Flag one-shot como chat |

---

## Acceptance criteria

1. Usuário com `assinador.use` abre `/assinador` no layout Livro (sidebar + tokens verdes).
2. Cargo sem permissão recebe 403; admin configura permissões na UI de cargos.
3. Job grava `requested_by`; histórico e PDF só do próprio usuário (manage vê todos).
4. Assinar/Retomar/Cancelar + PDF com TTL funcionam como no protótipo.
5. Admin mostra métricas: volume, sucesso/falha, top automatizadores, série temporal.
6. Eventos de auditoria aparecem em `/admin/access` (últimos eventos).

---

## Estimativa (ordem)

| Fase | Esforço relativo |
|------|------------------|
| 0 Wiring | P |
| 1 Motor/TTL/CSRF | M |
| 2 Histórico por usuário | M |
| 3 Admin + audits | M |
| 4 Polish/testes/docs | P |

---

## Próximo passo sugerido

Implementar **Fase 0 + Fase 2 mínima** (wiring + listagem `mine`) e em seguida TTL/admin, ou pedir execução fase a fase neste chat.
