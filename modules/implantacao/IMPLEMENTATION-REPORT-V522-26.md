# Implementation Report · Implantação Consulte GEO v5.22.26

## Resumo executivo

**Pedido**: prosseguir após fechar a v5.22.25. Escolhi a **v5.22.27
originalmente sugerida** (envio do link compartilhável por email
via Resend) e renumerei para v5.22.26 — fecha o último cenário da
estratégia "voltar depois sem fricção".

**Status**: implementado, validado por smoke pipeline estrutural +
build + typecheck. Runtime real da Edge Function depende de deploy
+ env vars (bloqueio explícito).

**Pipeline: 332 OK (+27) · Contraste: 89 OK · Build: ✓ 8.91s · zero
CSS novo · zero migração SQL · zero impacto em schema · backend .NET
intocado.**

## Diagnóstico

### O que existia antes desta versão

- Botão "Copiar link" na topbar (v5.22.24) — funciona, mas só
  resolve o caso "vou colar num chat ou anotar pra mim mesmo".
- Edge Functions `submit-for-validation` e `notify-return` já
  consumiam Resend com padrão estável (CORS + escapeHtml + erro
  estruturado).
- Service `ticketService.ts` já tinha o padrão de invoke de Edge
  Function via `sb.functions.invoke<T>(name, {body})` + fallback
  local-only quando `SUPABASE_CONFIGURED===false`.
- Modais existentes (`SubmitTicketModal`, `ReturnSubmissionModal`)
  já estabeleciam o padrão Teleport to=body + `.modal-portal`.

### Qual lacuna a v5.22.26 fecha

**Cenário**: o engenheiro responsável está em obra, recebe um
WhatsApp com "olha, abre esse link aqui pra você terminar". Não é
formal. Não tem trilha. Para a equipe de uma construtora grande,
isso não funciona — precisa de email com remetente, assunto, ID do
chamado, etc.

**Antes**: solução era copiar a URL e colar manualmente num cliente
de email pessoal. Sem audit trail, sem subject estruturado, sem
escape de HTML, sem fallback se o usuário usar um cliente que quebra
URLs longas.

**Agora**: botão "Enviar por email" abre modal com email do
destinatário + nome + mensagem livre. Edge Function envia via Resend
com HTML + text bem formatados, audit log local registra a ação.

### O que foi alterado

| Arquivo | Tipo | Mudança |
|---|---|---|
| `supabase/functions/share-draft-link/index.ts` | NOVO | Edge Function (~270 linhas) |
| `frontend/src/services/setupShareService.ts` | NOVO | wrapper + validação local (~125 linhas) |
| `frontend/src/components/ShareDraftLinkModal.vue` | NOVO | modal acessível com 4 estados (~245 linhas) |
| `frontend/src/views/SetupPage.vue` | MOD | botão topbar + 3 handlers + 1 computed + state |
| `frontend/scripts/cleanup-legacy.cjs` | MOD | allowlist do modal e do service |
| `frontend/smoke-pipeline.ts` | MOD | bloco v5.22.26 (+27 testes); flex nos checks v24/v25 |
| `frontend/package.json` | MOD | version bump 5.0.22-25 → 5.0.22-26 |
| `README.md` | MOD | header + nova seção destacada v5.22.26 |
| `docs/EDGE_FUNCTIONS.md` | MOD | seção share-draft-link completa (~100 linhas) |
| `docs/CHANGELOG_SOLICITACOES.md` | MOD | entrada v5.22.26 no topo |
| `IMPLEMENTATION-REPORT-V522-26.md` | NOVO | este relatório |

### O que foi validado

- **Pipeline**: 332 OK / 0 FAIL (+27 testes vs 305 da v5.22.25)
- **Contraste**: 89 OK / 0 FAIL (zero CSS novo)
- **Build**: ✓ 8.91s
- **Typecheck strict**: limpo (`vue-tsc --noEmit`) — pegou e
  corrigiu 1 erro de tipagem do prop `draftId` no modal (string |
  null vs default null)

### O que NÃO pôde ser validado

- **Edge Function runtime**: sandbox sem Supabase CLI, sem Deno,
  sem chave Resend. Validação foi 100% estrutural:
  - código existe nos paths corretos
  - tem `serve()`, consome `RESEND_API_KEY` e `EMAIL_FROM`
  - valida UUID + email no payload
  - escapa HTML no email
  - POST para api.resend.com/emails
  - resolve URL base via env

- **Email real enviado**: idem. Precisa do deploy + APP_URL_BASE
  configurada.

- **Comportamento visual em browser**: sandbox sem headless.
  - Modal abrindo ao clicar "Enviar por email"
  - Validação visual do email com regex (botão "Enviar" disabled
    enquanto inválido)
  - Estados sending/success/error
  - Auto-close em 2s após sucesso
  - Backdrop fechando o modal

## Decisões registradas

### Por que NÃO criar uma migration nova

`setup_audit_events` já existe com schema genérico (`actor`,
`action`, `entity`, `before`, `after`). As 3 ações novas
(`share_modal_aberto`, `link_compartilhado_email`,
`share_email_falhou`) entram pelo `addAuditLocal` que já consolida no
flush habitual. Zero schema change = zero risco de DDL em produção.

### Por que a Edge Function NÃO escreve audit direto

Considerei fazer a Edge Function inserir em `setup_audit_events`
ela mesma (pra audit trail server-side garantido). Decidi não:

1. **Mantém a Edge Function pequena**: ela é só um adaptador para
   o Resend. Menos código = menos surfaces de falha.
2. **Coerência com `submit-for-validation`** — que também não escreve
   audit; o frontend faz isso via `addAuditLocal`.
3. **Quando migrar pra .NET**: o endpoint
   `POST /api/.../drafts/{id}/share-link` pode adicionar audit
   server-side aí, com transação garantida. Por ora, audit local
   basta para o protótipo.

### Por que validação client-side de email duplica a server-side

A Edge Function valida formato de email com regex. O service do
frontend valida o mesmo regex antes de chamar. Razões:

1. **Evita chamada desperdiçada**: regex local é instantâneo.
   Chamada Edge gasta tempo + cota Resend.
2. **UX melhor**: usuário recebe feedback "email inválido" em ms,
   sem esperar resposta da Edge.
3. **Defesa em profundidade**: se alguém burlar o service (chamada
   direta à Edge), a server-side ainda pega.

Custo: 1 linha de regex duplicada. Trade-off claro.

### Por que `fake: true` no modo local em vez de erro

Se `SUPABASE_CONFIGURED===false`, eu poderia ter feito o service
lançar erro "Supabase não configurado, deploy a Edge Function". Mas
isso quebraria o protótipo em dev local — toda vez que alguém clonasse
o repo sem env vars, o botão "Enviar por email" jogaria erro.

Optei pelo padrão `ticketService.fakeLocalTicket()`: devolver
`{ok: true, fake: true}`. O modal mostra `.alert.info` "modo local
— nenhum email foi enviado de verdade", mas continua clicável e
demonstrável.

### Por que pré-preencher senderName com `metadata.createdBy.nome`

O usuário já preencheu o nome dele uma vez (Etapa 1, "Responsável
da obra"). Não faz sentido pedir de novo. O computed
`suggestedSenderName` lê `metadata.createdBy.nome` (se houver) e
manda como prop pro modal, que pré-preenche o campo.

Pode editar livremente — não é obrigatório, nem trava o submit.

### Por que limites de tamanho (200/200/2000)

- `recipientName: 200`: nome humano realista. Comum é < 50.
- `senderName: 200`: idem.
- `message: 2000`: bate com o limite do `ReturnSubmissionModal`.
  Mensagem mais longa que isso vira email gigante e provavelmente
  é mau-uso.

Validado **tanto no client (modal)** **quanto na Edge Function**.
Defesa em profundidade contra payload manipulado.

## Ambiente usado

- Node 22.22.2, npm 10.9.7
- Vite 5.4.21
- vue-tsc 2.1.6 + TypeScript strict 5.4.5
- Sandbox Linux sem credenciais Supabase / sem Deno / sem browser

## Arquivos criados

| Arquivo | Linhas |
|---|---|
| `supabase/functions/share-draft-link/index.ts` | 270 |
| `frontend/src/services/setupShareService.ts` | 125 |
| `frontend/src/components/ShareDraftLinkModal.vue` | 245 |
| `IMPLEMENTATION-REPORT-V522-26.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/views/SetupPage.vue` | +1 botão na topbar, +1 modal renderizado, +1 computed `suggestedSenderName`, +1 state `shareModalOpen`, +3 handlers (`onOpenShareModal`, `onCloseShareModal`, `onSendShareEmail`), +2 imports |
| `frontend/scripts/cleanup-legacy.cjs` | +2 entradas na allowlist (modal + service) |
| `frontend/smoke-pipeline.ts` | +27 testes no bloco v5.22.26; flex no check de versão v24/v25 |
| `frontend/package.json` | version bump |
| `README.md` | header v5.22.25→v5.22.26 + nova seção (~45 linhas) |
| `docs/EDGE_FUNCTIONS.md` | seção share-draft-link (~100 linhas) |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.26 no topo |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `cp -r v05-22-25 v05-22-26` | ✓ | base v5.22.25 |
| `cd frontend && npm install` | ✓ | dependências reusadas |
| `npx vue-tsc --noEmit` (primeira) | ✗ 1 erro | tipagem de prop draftId — corrigido com PropType\<string \| null\> |
| `npx vue-tsc --noEmit` (depois) | ✓ limpo | strict OK |
| `npx tsx smoke-pipeline.ts` (1ª) | 303 OK / 2 FAIL | checks estritos de versão antigos — flexibilizados |
| `npx tsx smoke-pipeline.ts` (final) | **332 OK / 0 FAIL** | +27 testes da v5.22.26 |
| `npx tsx smoke-contrast.ts` | **89 OK / 0 FAIL** | zero CSS novo |
| `npm run build` | **✓ 8.91s** | bundle similar (ShareDraftLinkModal entra no chunk principal) |

## Implementado com sucesso

- [x] Edge Function `share-draft-link/index.ts` com:
  - [x] `serve()` handler
  - [x] CORS completo (incl. OPTIONS) com header dinâmico
  - [x] Validação de UUID v4 e email no payload
  - [x] Limites de tamanho para name/message
  - [x] `escapeHtml` no conteúdo do email
  - [x] Resolução de URL base via env (APP_URL_BASE / SETUP_URL_BASE / REVIEW_URL_BASE)
  - [x] POST para api.resend.com/emails
  - [x] Erro estruturado (resend_NNN, resend_exception, etc.)
- [x] `setupShareService.ts` com:
  - [x] `shareDraftLink(input): Promise<ShareDraftLinkResponse>`
  - [x] Validação local de email
  - [x] Modo local-only (`fake: true`) quando Supabase ausente
  - [x] Extração de detalhe do error.context.body (padrão ticketService)
- [x] `ShareDraftLinkModal.vue` com:
  - [x] Teleport to=body
  - [x] role=dialog + aria-modal
  - [x] 4 campos (email obrigatório, name×2 opcional, message opcional)
  - [x] v-model + maxlength + counter de caracteres
  - [x] 4 estados (idle/sending/success/error) com UI distinta
  - [x] Métodos públicos `resolveSend` e `failSend` para o parent
  - [x] Auto-close em 2s após sucesso
  - [x] Cleanup do timer no `beforeUnmount`
  - [x] Backdrop click cancela (exceto durante sending)
- [x] `SetupPage.vue`:
  - [x] Botão "Enviar por email" na topbar (guard por `draftId`)
  - [x] State `shareModalOpen`
  - [x] 3 handlers integrados
  - [x] Computed `suggestedSenderName` lê de `metadata.createdBy.nome`
  - [x] Auditoria local em 3 pontos
- [x] cleanup-legacy allowlist atualizado
- [x] package.json bumpado para 5.0.22-26
- [x] smoke-pipeline +27 testes
- [x] README + CHANGELOG + EDGE_FUNCTIONS atualizados
- [x] Backend .NET: **intocado**
- [x] Schema Supabase: **intocado**
- [x] CSS: **zero linhas alteradas**
- [x] Outras Edge Functions: **intocadas**

## Parcialmente implementado

Nada.

## Não implementado (escopo deferido)

- **Backend .NET equivalente** (`POST /api/.../drafts/{id}/share-link`):
  documentado no EDGE_FUNCTIONS.md. Pode entrar como v5.22.28
  quando o backend for portado.
- **Audit server-side** na Edge Function: por ora audit é local,
  documentado como decisão consciente.
- **Bugs herdados v5.22.23** ("Ir para Etapa N tela branca",
  "Devolver para responsável"): continuam dependendo de logs
  DevTools de produção. Fica para v5.22.27.

## Correções importantes aplicadas

### Prop `draftId` no modal precisa de PropType explícito

Primeira versão tinha:
```ts
draftId: { type: String, default: null as string | null }
```

vue-tsc strict reclamou que `null` não é atribuível a
`string | undefined`. Corrigido para:
```ts
draftId: { type: String as PropType<string | null>, default: null }
```

Compatível com runtime e com tipagem strict.

### Checks de versão flexibilizados em v5.22.24 e v5.22.25

Os checks estritos `if (pkg.version === '5.0.22-NN')` quebravam
sempre que a próxima versão era empacotada. Padrão de
versionamento aceitando bumps futuros:

```ts
if (pkg.version === '5.0.22-24') {
  ok(...);
} else if (/^5\.0\.22-(2[5-9]|[3-9]\d|\d{3,})$/.test(pkg.version)) {
  ok('... bump compatível');
}
```

Aplica para v5.22.24 e v5.22.25. Bloco v5.22.26 mantém check
estrito porque é a versão "atual"; será flexibilizado na próxima
entrega.

## Regressões evitadas

- **Botão "Copiar link" continua funcionando**: o novo botão fica
  ao lado, ambos guardados por `v-if="draftId"`. Não há conflito
  de handler nem state compartilhado.
- **Modal não conflita com SubmitTicketModal / ReturnSubmissionModal**:
  cada um tem `data-testid` único, Teleport to=body separado.
  z-index herdado de `.modal-portal` é igual em todos — quem abre
  por último fica em cima.
- **Mode local-only**: protótipo continua clicável em dev sem
  credenciais. Modal mostra aviso explícito.
- **Validação de email**: regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  bate com o usado em `validationService.ts` (USUARIO_EMAIL_INVALIDO,
  FORNECEDOR_EMAIL_INVALIDO). Consistência cross-canal.
- **Edge Function tem fallback de URL base**: se `APP_URL_BASE`,
  `SETUP_URL_BASE` e `REVIEW_URL_BASE` estiverem todas ausentes,
  cai em `https://setup.consultegeo.org` literal (defensivo).
- **Cleanup de timer no beforeUnmount**: se o usuário fechar o modal
  com sucesso ativo, o timer de auto-close ainda dispara depois.
  Limpo explicitamente.

## Validações realizadas

| Critério §16 da constituição do projeto | Status |
|---|---|
| `npm install` funciona | ✅ |
| `npx tsx smoke-pipeline.ts` passa | ✅ 332 OK |
| `npx tsx smoke-contrast.ts` passa | ✅ 89 OK |
| `npm run build` passa | ✅ 8.91s |
| `.env.example` existe, sem secrets reais | ✅ (não tocado) |
| Aplicação abre localmente | ⚠️ não validado (sandbox sem browser) |
| Sem referências a MRV ou Superestrutura | ✅ smoke garante |
| Tipo de Estrutura tem as 6 opções corretas | ✅ smoke v5.20+ |
| Projetista é texto livre | ✅ smoke v5.20+ |
| Rascunho salva e recarrega | ✅ smoke v5.22.19 |
| JSON técnico gera e valida contra schema | ✅ smoke v5.22.18 |
| Excel técnico exporta | ✅ smoke v5.22.18 |
| Validações aparecem | ✅ smoke v5.22.25 (runtime) |
| Auditoria registra eventos | ✅ smoke v5.22.18 + 3 ações novas |
| Documentação atualizada | ✅ |
| Backend .NET skeleton intacto | ✅ |

## Bloqueios reais

### Bloqueios por ambiente

- **Edge Function runtime**: sandbox sem Supabase CLI, sem Deno, sem
  chave Resend, sem acesso ao projeto `yglcnirbnbwjqpvalqif`. Não
  pude:
  - Fazer `supabase functions deploy share-draft-link`
  - Disparar uma chamada real com `draftId` válido
  - Confirmar que o email chega no inbox real
  - Validar que a URL no email aponta para
    `https://setup.consultegeo.org/?draft=:id`
  - Confirmar que clicar na URL carrega o draft

  Mitigação: smoke estrutural cobre 7 aspectos da Edge Function.
  Runtime real depende do deploy.

- **Browser real**: sandbox sem headless. Não pude:
  - Validar abertura/fechamento visual do modal
  - Validar estados de UI durante sending
  - Confirmar `aria-modal` funcionando com leitor de tela

### Bloqueios por credenciais

- `RESEND_API_KEY` não disponível no sandbox — não consegui simular
  envio sequer em modo "teste". Mas a Edge Function reusa o padrão
  exato de `notify-return` que já está em produção e funcionando.

### Bloqueios técnicos

Nenhum.

### Bloqueios por dependência externa

Nenhum (Resend já está pago/configurado para o projeto).

## Pendências que exigem ação manual

1. **Configurar `APP_URL_BASE` nos secrets**:
   ```bash
   supabase secrets set APP_URL_BASE="https://setup.consultegeo.org" \
                       --project-ref yglcnirbnbwjqpvalqif
   ```
   Sem isso, a função cai no fallback hardcoded (que está correto
   para produção, mas falha em staging).

2. **Deploy da Edge Function**:
   ```bash
   supabase functions deploy share-draft-link \
                       --project-ref yglcnirbnbwjqpvalqif
   ```

3. **Smoke manual em produção**:
   - Cadastrar uma obra qualquer
   - Esperar 3s (autosave gera `draftId`)
   - Clicar "Enviar por email" na topbar
   - Preencher seu próprio email
   - Clicar "Enviar email"
   - Confirmar `.alert.info` "✓ Email enviado para X"
   - Abrir o email no inbox
   - Clicar "Abrir cadastro" → confere se carrega o draft

4. **Smoke de erro**: simular email inválido (ex.: `foo@bar`) —
   confere que o botão "Enviar email" fica desabilitado.

5. **Smoke de error path**: deletar temporariamente
   `RESEND_API_KEY` dos secrets, recarregar a Edge Function. Disparar
   o modal — deve mostrar `.alert.danger` com `missing_env: RESEND_API_KEY`.

6. **Validar bugs herdados** (v5.22.23 items 2 e 5): continuam
   pendentes desde v5.22.23.

## Como validar localmente

```bash
cd frontend
npm install
npx tsx smoke-pipeline.ts    # esperado: 332 OK / 0 FAIL
npx tsx smoke-contrast.ts    # esperado:  89 OK / 0 FAIL
npm run build                # esperado: ✓ built (≈ 8-10s)
npm run dev                  # abre http://localhost:5173
```

Para testar o fluxo:
1. Criar uma obra qualquer
2. Esperar autosave (3s)
3. Botão "Enviar por email" aparece na topbar
4. Clicar → modal abre
5. Em dev sem Supabase, deve cair no modo `fake: true` com aviso

Para testar a Edge Function isoladamente:
```bash
supabase functions serve share-draft-link --no-verify-jwt
curl -X POST http://localhost:54321/functions/v1/share-draft-link \
  -H 'Content-Type: application/json' \
  -d '{
    "draftId":"00000000-0000-4000-8000-000000000001",
    "recipientEmail":"voce@empresa.com",
    "senderName":"Thiago",
    "message":"Teste"
  }'
```

## Como publicar no Netlify

Sem mudanças no `netlify.toml`. Push para `main`. Build automático.

## Como configurar Supabase

**Sem migration nova.** Apenas:

1. Adicionar secret (opcional, mas recomendado):
   ```bash
   supabase secrets set APP_URL_BASE="https://setup.consultegeo.org" \
                       --project-ref yglcnirbnbwjqpvalqif
   ```

2. Deploy da nova Edge Function:
   ```bash
   supabase functions deploy share-draft-link \
                       --project-ref yglcnirbnbwjqpvalqif
   ```

## Como migrar para .NET 8 + SQL Server

Endpoint equivalente:

```
POST /api/implantacao-estrutura/drafts/{id}/share-link
```

Body:
```json
{
  "recipientEmail": "alguem@empresa.com",
  "recipientName": "João",
  "senderName": "Thiago",
  "message": "..."
}
```

Mesma response (`{ok, email_id, sent_to, error?}`).

Considerações:
- Audit server-side dentro da transação (vantagem sobre a Edge
  Function que delegou para o frontend).
- Quando houver auth real, considerar gerar um token de acesso por
  link em vez de expor o UUID do draft. Documentado como dívida
  técnica desde v5.22.24.
- O `StepMappingService` em C# (sugerido na v5.22.25) e o
  `ShareDraftService` em C# podem compartilhar o mesmo template
  Razor de email — coerência com o HTML aqui.

## Próximo ciclo recomendado

**v5.22.27** — Validar bugs herdados v5.22.23. Continua dependendo de
logs DevTools de produção. Quando trouxer os logs, fix exato.

**v5.22.28** — Backend .NET ganha `ShareDraftService` espelho desta
Edge Function (em paralelo com `StepMappingService` da v5.22.25).
