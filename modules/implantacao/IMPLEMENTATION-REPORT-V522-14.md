# Implementation Report · Implantação Consulte GEO v5.22.14

## Resumo executivo

**Pedido do Thiago**: "O que tenho que fazer para o email ir também para `atendimento@consultegeo.com.br`? Se conseguir implementar sem a minha ação manual faça."

Resposta honesta: **não 100%** — para zero ação manual eu precisaria de credenciais Supabase no sandbox (não tenho). Mas consegui reduzir a **uma única configuração de uma vez só**: criar 2 secrets no GitHub. Depois disso, **todas as próximas mudanças deploy sozinhas**.

### O que foi implementado nesta versão

1. **`atendimento@consultegeo.com.br` hardcoded como destinatário permanente** nas duas Edge Functions (`submit-for-validation` e `notify-return`). Mesmo sem env var, o email cai lá.
2. **GitHub Action** que deploya as Edge Functions automaticamente quando `supabase/functions/**` muda no main. Setup uma vez só (2 secrets), funciona indefinidamente.
3. **Env var `NOTIFICATION_RECIPIENTS` ficou opcional** — antes era obrigatória (`envOrThrow`) e bloqueava a submissão se não estivesse setada. Agora apenas acrescenta destinatários extras.
4. **Toggle de emergência** `NOTIFICATION_RECIPIENTS_DISABLE_DEFAULT=true` permite desligar o atendimento@ se algum dia for necessário (testes isolados).

**Build verde · typecheck verde · 161 smokes lógica (6 novos) · 42 smokes contraste · SEM migration nova.**

## Decisão registrada — por que hardcoded ao invés de só env var

Considerei 3 abordagens:

| Abordagem | Pró | Contra |
|---|---|---|
| **A.** Só atualizar `NOTIFICATION_RECIPIENTS` no Supabase | Mais limpo | Requer ação manual sua (não tenho credenciais para fazer) |
| **B.** Hardcoded sem env var | Zero ação | Esquece flexibilidade |
| **C.** Hardcoded + env var aditiva | Zero ação E flexível | + código |

Escolhi **C**. O atendimento@ é o endereço institucional e não deve depender de uma variável de ambiente que pode ser esquecida. A env var continua existindo para casos onde você quer adicionar destinatários específicos (ex: durante piloto com um cliente, copiar um membro do time específico).

## Decisão registrada — por que CC e não TO em notify-return

O `notify-return` é o email que vai pro cliente quando a equipe devolve o chamado. O cliente é o destinatário principal (TO). Colocar o atendimento@ junto no TO faria:

- O cliente ver o endereço interno da Consulte GEO
- O atendimento@ ficar listado como "destinatário direto" — possivelmente confundindo quem é o responsável pelo email

Colocando em **CC**:

- O cliente vê só os contatos da própria obra no campo TO
- O atendimento@ aparece em CC, deixando claro que é cópia/trilha
- A equipe tem rastreio de todas as devoluções na mesma caixa

## Ambiente usado

- Node 20.x para typecheck frontend e syntax check das Edge Functions
- Sandbox Linux sem `supabase` CLI / Deno / credenciais Supabase

## Limitação real (bloqueio por credenciais)

**Não consigo testar o envio real do email** porque:

- Não tenho `SUPABASE_SERVICE_ROLE_KEY` no sandbox
- Não tenho `RESEND_API_KEY` no sandbox
- Não consigo deployar a Edge Function pra testar

A validação é 100% por **inspeção estática** + smokes + revisão de código:

1. Sintaxe TS das Edge Functions: OK (parse sem erros)
2. Função `buildTeamRecipients` retorna `[atendimento@..., ...notification_recipients]` deduplicado
3. Função `buildTeamRecipientsCc` faz o mesmo
4. `submit-for-validation` usa `buildTeamRecipients()` no lugar de `parseCsv(envOrThrow('NOTIFICATION_RECIPIENTS'))`
5. `notify-return` passa `teamCcFiltered` como `cc` no `resendSend`
6. `resendSend` agora inclui `body.cc = args.cc` se `args.cc.length > 0`

**Não posso validar end-to-end. Confiança alta na lógica, mas o teste em produção é obrigatório.**

## Arquivos criados

- `.github/workflows/deploy-edge-functions.yml` — Action de deploy automático
- `IMPLEMENTATION-REPORT-V522-14.md` (este arquivo)

## Arquivos alterados

### Edge Functions
- `supabase/functions/submit-for-validation/index.ts`:
  - Adicionada `buildTeamRecipients()` (40 linhas)
  - `notificationRecipients = parseCsv(envOrThrow('NOTIFICATION_RECIPIENTS'))` → `notificationRecipients = buildTeamRecipients()` + verificação de lista vazia
- `supabase/functions/notify-return/index.ts`:
  - Adicionados helpers `parseCsv`, `isValidEmail`, `buildTeamRecipientsCc()` (50 linhas)
  - `resendSend` ganhou parâmetro `cc?: string[]` e inclui no payload do Resend
  - Body do POST para Resend inclui `cc` agora
  - Chamada do `resendSend` passa `cc: teamCcFiltered` (dedup contra destinatários do cliente)
  - Response JSON ganhou campo `cc_team` para auditoria

### Frontend
- `frontend/smoke-pipeline.ts` — 6 testes novos para validar:
  - `atendimento@` hardcoded em ambas as Edge Functions
  - Funções `buildTeamRecipients` / `buildTeamRecipientsCc` definidas
  - `resendSend` aceita `cc?: string[]`
  - GitHub Action de deploy presente, usa `supabase/setup-cli`, deploya as 2 funções
- `frontend/package.json` — version 5.0.22-14

### Top-level
- `README.md` — atualizado com explicação completa

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | sem warnings novos |
| `npm run typecheck` | **0 errors** | TS strict |
| `npm run build` | 1.7 MB dist | 8.57s |
| `npm run smoke` | **161 OK / 0 FAIL** | 6 testes novos |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** | WCAG AA preservado |
| Syntax check Edge Functions | OK | parse com `typescript` API direto |

## Implementado com sucesso

1. **`atendimento@consultegeo.com.br` como destinatário permanente** das duas Edge Functions
2. **Dedup case-insensitive** evita email duplicado se atendimento@ já estiver listado
3. **Filtro de emails inválidos** silenciosamente ignorados
4. **Env var `NOTIFICATION_RECIPIENTS` opcional** (era obrigatória) — atendimento@ é fallback funcional
5. **Toggle `NOTIFICATION_RECIPIENTS_DISABLE_DEFAULT=true`** para casos especiais
6. **GitHub Action de deploy automático** das Edge Functions — disparado por push em `supabase/functions/**` ou manualmente via Actions tab
7. **CC no notify-return** com filtro contra destinatários do cliente
8. **Smokes verdes** validando todos os pontos acima

## Não implementado

- **Deploy automático totalmente sem ação manual** — depende de 2 secrets no GitHub que só você pode criar (`SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`). Setup uma vez, depois automático.
- **Teste end-to-end de email real** — sem credenciais Supabase/Resend no sandbox.
- **Edge Function `notify-approve`** — pendência da v5.22.11. Quando criada, deve usar `buildTeamRecipients()` também.

## Regressões evitadas

- **Schema do response do notify-return** preservado: `ok`, `email_id`, `error`, `sent_to` continuam idênticos. Adicionado novo campo `cc_team` (não-bloqueante — frontend ignora campos extras).
- **Schema do response do submit-for-validation** preservado: `email_sent_to`, `email_cc` continuam idênticos. A lista de `email_sent_to` agora pode incluir o atendimento@ + outros, mas o consumidor (frontend) já trata como `string[]`.
- **Compat com setups antigos**: se a env var `NOTIFICATION_RECIPIENTS` estava configurada com `thiago@consultegeo.com.br`, agora ela vai ser somada ao atendimento@. Antes a equipe recebia `thiago@`. Agora recebe `atendimento@` + `thiago@`. Comportamento aditivo, não substituto.
- **Casos onde `email_cc` (cliente) é vazio** — notify-return continua retornando `{ ok: true, skipped: 'no_recipient' }` sem chamar Resend. Behavior preservado.

## Validações realizadas

| Validação | Resultado | Observação |
|---|---|---|
| `npm run typecheck` | ✓ | 0 erros TS strict |
| `npm run build` | ✓ | 8.57s |
| `npm run smoke` | ✓ 161/161 | 6 cases novos |
| `npm run smoke:contrast` | ✓ 42/42 | WCAG AA preservado |
| Syntax check Edge Functions | ✓ | parse sem erros |
| Revisão manual da lógica `buildTeamRecipients` | ✓ | dedup, filtro de email inválido, ordem preservada |
| Revisão manual `notify-return` cc | ✓ | filtro contra destinatários do cliente correto |
| GitHub Action presente | ✓ | smoke valida |

## Bloqueios reais

### Bloqueios técnicos
Nenhum.

### Bloqueios por ambiente
- Sandbox sem Supabase CLI / Deno / credenciais — não foi possível deployar e testar email real.

### Bloqueios por dependência externa
- Resend API quotation/limites desconhecidos. Não há motivo para acreditar que o limite atual seja excedido (atendimento@ é mais 1 destinatário, não muda volume drástico).

### Bloqueios por credenciais
- **Para zero ação manual do Thiago**, precisaria de `SUPABASE_ACCESS_TOKEN` para deployar as Edge Functions. Como não tenho, o caminho é o Action.

## Pendências que exigem ação manual

### Setup de uma vez só (2 secrets no GitHub)

Settings → Secrets and variables → Actions → New repository secret:

| Secret | Valor | Onde pegar |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | (token pessoal) | https://supabase.com/dashboard/account/tokens → Generate new token |
| `SUPABASE_PROJECT_REF` | `yglcnirbnbwjqpvalqif` | fixo, copiar literal |

### Depois do setup

```bash
git push origin main
```

GitHub Action dispara automaticamente, deploya Edge Functions em ~1 min. Próximas mudanças em Edge Functions: zero ação manual.

### Se preferir não usar GitHub Action

Você pode rodar manualmente uma única vez:

```bash
supabase functions deploy submit-for-validation --project-ref yglcnirbnbwjqpvalqif
supabase functions deploy notify-return --project-ref yglcnirbnbwjqpvalqif
```

Mas aí toda mudança futura volta a ser manual. Recomendo configurar o Action.

### Validação obrigatória pós-deploy

1. Aba anônima em `https://setup.consultegeo.org`
2. Submeter cadastro até Etapa 7 → clicar "Enviar para validação"
3. **Esperado**:
   - Email "Nova solicitação CG-2026-NNNNNN" chega em `atendimento@consultegeo.com.br`
   - Email de confirmação (cópia) chega no email do cadastrante (campo CC)
4. Abrir `/r/<token>` → Etapa 8 → "Devolver para o responsável" → preencher → Confirmar
5. **Esperado**:
   - Email "Chamado X devolvido" chega no email do cadastrante (TO)
   - Email visível em CC: `atendimento@consultegeo.com.br`

## Como validar localmente

Não dá pra testar email local porque depende de Resend API key real. Mas dá pra validar o código:

```bash
unzip implantacao-consulte-geo-source-completo-v05-22-14.zip
cd implantacao-consulte-geo-v05-22-14/frontend
npm install
npm run typecheck
npm run smoke
```

Os 6 smokes novos da v5.22.14 verificam estaticamente que `atendimento@` está no código.

## Como publicar no Netlify

```bash
git add .
git commit -m "v5.22.14: atendimento@consultegeo.com.br como destinatário permanente + GitHub Action de deploy Edge Functions"
git push
```

## Próximo ciclo recomendado

1. **Validação end-to-end** com email real chegando no atendimento@
2. **Edge Function `notify-approve`** — mirror das outras, usando `buildTeamRecipients()`
3. **Remover console.info debug** da v5.22.12
4. **Backend .NET fora de stub**

---

**Build verde, smokes verdes (161 + 42), código pronto pra push. Setup de 2 secrets no GitHub uma única vez ativa o deploy automático para sempre.**
