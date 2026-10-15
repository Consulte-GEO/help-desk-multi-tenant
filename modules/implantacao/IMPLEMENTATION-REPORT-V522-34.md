# Implementation Report · Implantação Consulte GEO v5.22.34

## Resumo executivo

3 features: notificação inversa (equipe → cliente) + badge ✓ Completo
+ animação CSS de expand/collapse. Pipeline: **494 OK (+18) ·
Contraste: 89 OK · Build: ✓ 8.19s**. 1 Edge Function nova,
1 migration nova (idempotente), zero dependência nova.

## Features entregues

### Feature 1 — Notificação inversa (equipe → cliente)

#### Arquitetura

```
[Equipe em /r/:token ou Admin em /admin escreve comentário PÚBLICO]
       │
       ▼ RPC add_review_comment_by_token / _as_admin
[Postgres grava comment + audit]
       │
       ▼ retorna {id, author, body, submission_id, ...}
       │
       ▼ frontend dispara fire-and-forget
[Edge Function notify-team-comment]
       │
       ├─ Valida submission_id (UUID v4)
       ├─ Resolve via SERVICE_ROLE_KEY:
       │   setup_tickets (ticket_number, client_access_token,
       │                  email_recipients, email_cc)
       │   setup_submissions (obra_nome, technical_json.metadata...)
       ├─ Monta email HTML/text com link /s/:client_access_token
       ├─ Resend POST /emails (to + cc)
       └─ Audit notify_client_team_comment_sent/_failed
       │
       ▼ Email no inbox do cliente (recipients + cc)
```

#### Decisões registradas

**Por que `notify-team-comment` em vez de só estender `notify-return`?**

`notify-return` é especificamente para devoluções (status muda).
Comentário não muda status, é uma interação independente. Funções
separadas têm responsabilidades claras:
- `notify-return`: aviso de devolução com motivo
- `notify-team-comment`: aviso de mensagem da equipe sem mudança
  de status

Templates de email são diferentes (cor, CTA, tom).

**Por que estender o RPC em vez de aceitar token na Edge Function?**

Considerei aceitar `access_token` (de equipe) e resolver o
`submission_id` na Edge Function:
- Vantagem: sem migration nova
- Desvantagem: ReviewView tem token, AdminDashboardView tem
  submission_id. Forçaria 2 caminhos diferentes na Edge Function

A migration 013 estende o RPC `add_review_comment_by_token` para
incluir `submission_id` no payload. AdminDashboardView já tem
submission_id na mão. Ambos os caminhos convergem para a mesma
Edge Function com mesmo payload.

**Por que só comentários públicos disparam?**

`setup_review_comments.internal_only = true` = notas internas
da equipe. Cliente não vê em `/s/:token`. Enviar email seria
contraditório:

```ts
if (input.internalOnly !== true && result.submission_id) {
  void sb.functions.invoke('notify-team-comment', {...});
}
```

`internalOnly === undefined` é tratado como `false` (público) —
padrão histórico da RPC.

**Por que destinatários vêm de `email_recipients + email_cc` do ticket?**

São os emails que o cliente original informou ao submeter o chamado
(via Etapa 7 — Fornecedores). Mesma lista que recebeu a confirmação
do submit e a devolução (se houver). Coerência total.

Se `email_recipients` estiver vazio (raro mas possível em testes),
retorna 422 sem enviar. Audit não registra (frontend só vê warning
no console).

**Por que `CLIENT_STATUS_URL_BASE` opcional com fallback?**

Em produção, é fácil esquecer de configurar uma env nova. Fallback:
```ts
function resolveStatusBase(): string {
  const explicit = envOptional('CLIENT_STATUS_URL_BASE');
  if (explicit) return explicit.replace(/\/$/, '');
  const review = envOptional('REVIEW_URL_BASE');
  if (review) return review.replace(/\/$/, '').replace(/\/r$/, '/s');
  return 'https://setup.consultegeo.org/s';
}
```

3 níveis: explícito → derivado → hardcoded de produção. Garante
funcionar mesmo sem config nova.

#### Limitações aceitas

- **Sem opt-out por cliente**: cliente recebe TODOS os comentários
  públicos da equipe. Se ficar ruidoso, próxima versão adiciona
  preference. Solução paliativa: equipe usa internal-only quando
  apropriado.
- **Sem batching**: cada comentário = 1 email. Se equipe postar 5
  comentários em rajada, cliente recebe 5 emails. Aceito — equipe
  típica não faz isso.
- **Sem retry on Resend failure**: fire-and-forget. Audit registra
  `_failed`; equipe pode reenviar manualmente via tela `/r/`.

### Feature 2 — Badge `✓` verde no card minimizado

#### Implementação

Template:
```html
<span
  v-if="!isExpanded(c.id) && !concretoIncompleto(c).incompleto"
  class="badge-completo"
  title="Tudo preenchido"
  role="status"
  aria-label="Concreto completo"
>
  ✓
</span>
```

Reusa o computed `concretoIncompleto()` da v5.22.32 — se `.incompleto`
for false, mostra ✓.

CSS:
```css
.badge-completo {
  display: inline-flex;
  width: 22px; height: 22px;
  background: #d1fae5;
  color: #14532d;
  border: 1px solid #6ee7b7;
  border-radius: 50%;
}
```

#### Decisões registradas

**Por que verde-claro discreto e não verde-Bootstrap-success?**

Cards minimizados completos são o **estado normal** num wizard
funcionando bem. Verde berrante competiria com elementos mais
importantes (avisos, erros, CTAs). Verde-pastel sinaliza sem gritar.

**Por que só `✓` em vez de `✓ Completo`?**

Espaço horizontal no header é limitado quando o título do traço
é longo. Símbolo único + tooltip funciona melhor que texto.

**Por que not show quando expandido?**

Quando expandido, o usuário já vê os campos preenchidos. Badge
seria ruído. Mesma lógica da v32 para `⚠ Falta info`.

### Feature 3 — Animação CSS expand/collapse

#### Implementação

Template:
```html
<transition
  name="card-body-expand"
  @before-enter="onBeforeEnter"
  @enter="onEnter"
  @after-enter="onAfterEnter"
  @before-leave="onBeforeLeave"
  @leave="onLeave"
>
  <div v-show="isExpanded(c.id)" class="card-body">
    <!-- ... -->
  </div>
</transition>
```

Hooks JS (sequência ao abrir):
```ts
onBeforeEnter(el) { el.style.height = '0'; }
onEnter(el, done) {
  requestAnimationFrame(() => {
    el.style.height = `${el.scrollHeight}px`;
    el.addEventListener('transitionend', done);
  });
}
onAfterEnter(el) { el.style.height = ''; }  // libera 'auto'
```

CSS:
```css
.card-body-expand-enter-active,
.card-body-expand-leave-active {
  transition: height 0.25s ease, opacity 0.2s ease;
  overflow: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .card-body-expand-enter-active,
  .card-body-expand-leave-active {
    transition: opacity 0.1s ease;  /* só fade rápido */
  }
}
```

#### Decisões registradas

**Por que JS hooks em vez de CSS-only `max-height`?**

CSS-only com `max-height: 9999px` funciona, mas:
1. Velocidade da animação varia conforme conteúdo (300ms para
   conteúdo pequeno vira 30ms; para conteúdo grande, 1500ms)
2. Precisa adivinhar teto absurdo — quebra se conteúdo crescer
3. `transitionend` dispara no tempo do max-height, não do real

JS hooks medem `scrollHeight` em tempo real — animação sempre
250ms independente do tamanho.

**Por que `requestAnimationFrame`?**

Vue só remove `height: 0` quando o navegador já pintou esse estado
inicial. Sem rAF, o setter de `${scrollHeight}px` acontece síncrono
e a transição não dispara — vai direto para o estado final.

**Por que `prefers-reduced-motion`?**

Padrão de acessibilidade (WCAG 2.3.3). Pessoas com vestibular
disorders, enxaqueca, etc. configuram no SO. Respeitar é mandatório
para apps profissionais.

## Arquivos novos

| Arquivo | Linhas |
|---|---|
| `supabase/functions/notify-team-comment/index.ts` | ~310 |
| `supabase/migrations/20260521_013_review_comment_returns_submission.sql` | ~135 |
| `IMPLEMENTATION-REPORT-V522-34.md` | (este) |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/services/ticketService.ts` | `addReviewComment` dispara notify para comentários não-internos |
| `frontend/src/services/adminQueriesService.ts` | `addReviewCommentAsAdmin` dispara notify |
| `frontend/src/components/Step4Concretos.vue` | badge ✓ + `<transition>` + hooks JS |
| `frontend/src/styles/design-system.css` | `.badge-completo` + classes de transition + reduced-motion |
| `.github/workflows/deploy-edge-functions.yml` | deploy notify-team-comment |
| `frontend/smoke-pipeline.ts` | +18 testes; flex check v33 |
| `frontend/package.json` | bump 5.0.22-34 |
| `README.md` | seção destacada v5.22.34 |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.34 |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.33 | 476 OK |
| `vue-tsc --noEmit` | ✅ limpo |
| Pipeline | **494 OK / 0 FAIL** (+18) |
| Contraste | **89 OK / 0 FAIL** |
| Build | **✓ 8.19s** |

## Bloqueios

### Por ambiente

- Não testei Edge Function deployando em Supabase real
- Não testei email saindo via Resend
- Não testei animação visualmente (sem browser headless)
- Não testei migration 013 aplicando em prod

### Smoke tests críticos em produção

#### A. Migration 013

1. Aplicar `20260521_013_review_comment_returns_submission.sql`
   no SQL Editor → Run
2. Validar:
   ```sql
   select pg_get_function_result(oid) from pg_proc
    where proname = 'add_review_comment_by_token';
   -- deve retornar 'jsonb'
   ```

#### B. Edge Function

3. Deploy: `supabase functions deploy notify-team-comment --no-verify-jwt`
4. Verificar Dashboard → Edge Functions → notify-team-comment ACTIVE

#### C. Notificação equipe → cliente em `/r/:token`

5. Em uma aba: `/r/:access_token` de um chamado (equipe)
6. Escrever comentário público (NÃO marcar "interno")
7. Enviar → confirmação aparece
8. Email chega em ~5s para destinatários do ticket original
9. Email tem botão "Abrir chamado" com link `/s/:client_access_token`
10. Audit `notify_client_team_comment_sent` aparece em
    Histórico do drill-down em `/admin`

#### D. Notificação admin → cliente pelo painel

11. `/admin` → drill-down de um chamado → aba "Comentários ao cliente"
12. Escrever mensagem + enviar
13. Cliente recebe email com mesmo template

#### E. Internal-only NÃO dispara

14. `/r/:token` → escrever comentário marcado como "interno" (se
    o UI permitir; senão validar via console.log do invoke)
15. NÃO deve disparar email
16. Audit NÃO registra `notify_client_team_comment_sent`

#### F. Badge ✓ verde

17. Etapa 3 (Concretos): preencher 1 concreto completamente +
    adicionar padrão de moldagem + minimizar
18. Badge **verde com ✓** aparece ao lado da descrição
19. Apagar a aplicação → badge muda para **laranja ⚠ Falta info**

#### G. Animação expand/collapse

20. Etapa 3: clicar "Expandir" em um concreto
21. Card-body desliza para baixo suavemente (~250ms)
22. Clicar "Minimizar" → desliza para cima suavemente
23. Configurar `prefers-reduced-motion: reduce` no SO/browser
24. Repetir 20-22: agora só faz fade rápido, sem altura animando

## Pendências manuais

### Antes de usar a v5.22.34

1. **Aplicar migration 013**:
   ```bash
   # Via SQL Editor: cole 20260521_013_review_comment_returns_submission.sql → Run
   # OU CLI:
   supabase db push --project-ref yglcnirbnbwjqpvalqif
   ```

2. **Deploy da Edge Function nova**:
   ```bash
   supabase functions deploy notify-team-comment \
                       --project-ref yglcnirbnbwjqpvalqif \
                       --no-verify-jwt
   ```
   OU push para `main` → GitHub Action

3. **(Opcional)** Configurar `CLIENT_STATUS_URL_BASE`:
   ```bash
   supabase secrets set CLIENT_STATUS_URL_BASE="https://setup.consultegeo.org/s" \
                       --project-ref yglcnirbnbwjqpvalqif
   ```
   Sem isso, fallback infere de REVIEW_URL_BASE substituindo /r → /s.
   Em produção, isso deve dar certo automaticamente.

4. **Push do frontend** → Netlify

5. **Smoke tests** A-G acima.

## Como migrar para .NET 8

Mesmo padrão das outras Edge Functions:
- Endpoint `POST /api/notifications/team-comment`
- Service `ITeamCommentNotificationService` com método
  `NotifyClientAsync(Guid submissionId, string commentBody, string teamAuthor)`
- Reuso do `ResendClient` do blueprint anterior
- Audit via EF Core

## Próximo ciclo recomendado

Dependendo do feedback de uso:

**Features extras candidatas** (pendentes da minha sugestão original):
- **Bulk actions no painel /admin**: selecionar várias linhas com
  checkbox + setar prioridade em lote
- **Atalhos de teclado**: ↑/↓ entre concretos minimizados; Esc
  fecha o expandido; Enter expande o focado
- **Auto-refresh do listing /admin** a cada N segundos (toggle)
- **Preferências de notificação por usuário** (opt-out fino)

**Refinamentos UX**:
- Animação CSS também em outras telas do wizard (Estruturas, Peças)
- Drag-to-reorder de concretos
- Quick-edit inline na descrição do traço (sem expandir)

Sobre os bugs herdados v5.22.27 — sem logs DevTools até hoje. Se
ainda apareciam em produção, a v32-34 não mexeu na infraestrutura
do wizard exceto Step4Concretos.
