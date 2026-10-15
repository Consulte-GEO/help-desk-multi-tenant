# Implementation Report · Implantação Consulte GEO v5.22.30

## Resumo executivo

3 features de produtividade do painel `/admin`. Pipeline:
**435 OK (+16) · Contraste: 89 OK · Build: ✓ 9.01s**. Zero
dependência nova. Zero migration. Apenas 1 Edge Function nova.

## Features entregues

### Feature 1 — Quick prioridade + highlight visual de rows

#### O que apareceu

- Coluna "Prioridade" da tabela agora é `<select>` editável direto
- Mudança no select → `setPriority()` sem abrir drill-down
- Linhas urgentes/altas com borda lateral colorida e fundo suave
- Linhas implantadas com texto riscado em cinza

#### Decisões registradas

**Por que dropdown inline e não botões?**
- 4 estados (baixa/média/alta/urgente) + remover não cabem em botões
- `<select>` é nativo, acessível (teclado), zero JS
- `@click.stop` impede que clicar no select abra o drill-down

**Por que atualização otimista local?**
- Reload completo do listing após cada mudança seria caro
- `item.priority = value` é reativo (Vue 3) — UI atualiza
- `computeStats(this.items)` mantém os 4 stat cards corretos
- Em caso de falha, `event.target.value = item.priority` reverte UI

**Por que `row-done` riscado em vez de oculto?**
- Implantados às vezes precisam ser consultados (auditoria, repetir
  análise)
- Riscado + cinza = "fechado" mas presente, padrão UX comum em
  todo-lists / Kanban

### Feature 2 — Filtros novos no header

#### O que apareceu

- Toggle "Meus em análise" (checkbox estilizado como pill)
- Dois inputs date (from / to) com validação cruzada
- Botão "Limpar" (disabled quando sem filtros ativos)

#### Decisões registradas

**Por que "meus em análise" é client-side?**
- O lock é uma faceta independente da query principal
- Filtrar no SQL exigiria mudar `listDashboardItems` para aceitar
  `locked_by_email`
- Volume típico < 500 itens → filter local é instantâneo
- Mantém o backend simples

**Por que `fromDate`/`toDate` ISO completo (`T00:00:00`/`T23:59:59`)?**
- O field é `updated_at` (timestamptz). Comparar com `YYYY-MM-DD`
  faz cast implícito mas perde precisão.
- `T00:00:00` no `from` e `T23:59:59` no `to` = dia inteiro,
  inclusivo, no fuso local do navegador.

**Por que botão "Limpar" só fica disabled quando sem filtros?**
- Disabled visual sinaliza "não tem nada pra limpar"
- Sem `hasActiveFilters`, o botão ficaria sempre habilitado e
  clicar com tudo já zerado faria reload desnecessário

### Feature 3 — Notificação de comentário do cliente

#### Arquitetura

```
[Cliente em /s/:token escreve comentário]
       │
       ▼ ClientStatusView.onAddClientComment()
[ticketService.addClientComment]
       │
       ▼ 1. RPC add_review_comment_by_client_token (await)
[Postgres grava comment + audit]
       │
       ▼ 2. void sb.functions.invoke('notify-client-comment', ...)
       │       └─ fire-and-forget, .catch(console.warn)
       │
       ▼ 3. return comment ao cliente (independente da Edge Function)
       │
   (em paralelo)
       │
       ▼ Edge Function notify-client-comment
       │  - Valida token (UUID v4)
       │  - Resolve ticket via SERVICE_ROLE_KEY:
       │    setup_tickets + setup_submissions
       │  - Monta email HTML/text com link /r/:token (equipe)
       │  - Resend POST /emails
       │  - Audit notify_team_client_comment_sent/_failed
       │
       ▼ Email no inbox de atendimento@ + NOTIFICATION_RECIPIENTS
```

#### Decisões registradas

**Por que Edge Function resolve dados via service role?**
- Frontend cliente em `/s/:token` NÃO tem `submission_id` exposto
  (RPC `get_status_by_client_token` retorna só o necessário ao
  cliente: nome da obra, status, etc.)
- Alternativa A: adicionar `submission_id` ao retorno da RPC →
  exige migration nova + expõe ID interno ao cliente
- Alternativa B: passar token + body para Edge Function que resolve
  via service role → escolhida
- Bônus: cliente não pode forjar `ticket_number` alheio no payload

**Por que `void` + `.catch()` em vez de `await` + `try/catch`?**
- Email é "nice to have" — comentário JÁ está persistido pela RPC
- Bloquear o retorno por causa de Resend latency/outage seria UX
  pior
- `void` é sintaxe TypeScript explícita: "intencional, não await"
- `.catch()` impede unhandled promise rejection que o Vue 3 pode
  promover a erro de render

**Por que link `/r/:token` (equipe) e não `/s/:token` (cliente)?**
- Admin/equipe responde no `/r/:token` (ferramenta mais rica)
- Cliente token é só para o próprio cliente
- A Edge Function tem ambos via service role; escolhe o de equipe

**Por que `NOTIFICATION_RECIPIENTS` é opcional?**
- Default `atendimento@consultegeo.com.br` cobre o caso comum
- Adicionar emails extras (ex.: `thiago@...,gerente@...`) é trivial
- Sem essa env, ainda funciona — diferente de obrigar configuração

#### Limitações conhecidas

- **Resend rate limit**: se cliente comentar 100x em 1min, alguns
  emails podem ser perdidos. Aceito — UX do cliente não muda.
- **Sem opt-out**: o admin recebe notificação de todo comentário
  do cliente. Se chegar a ser ruidoso, próxima versão pode adicionar
  preference por usuário (`setup_admin_preferences` table).
- **Notification só do cliente → equipe**: cliente NÃO recebe email
  quando equipe responde. Esse caminho já existe via `notify-return`
  (devolução com motivo); para comentários da equipe, fica para
  v5.22.31 se houver demanda.

## Arquivos criados

| Arquivo | Linhas | Função |
|---|---|---|
| `supabase/functions/notify-client-comment/index.ts` | ~340 | Edge Function de notificação |
| `IMPLEMENTATION-REPORT-V522-30.md` | (este) | |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/services/ticketService.ts` | `addClientComment` dispara notify fire-and-forget; `notifyTeam` flag opcional |
| `frontend/src/views/AdminDashboardView.vue` | 3 features de UI: quick priority, filtros, highlight (+~220 linhas) |
| `frontend/smoke-pipeline.ts` | +16 testes (bloco v5.22.30); flex check v29 |
| `frontend/package.json` | bump 5.0.22-29 → 5.0.22-30 |
| `.github/workflows/deploy-edge-functions.yml` | deploy de notify-client-comment |
| `README.md` | header + seção destacada |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.30 |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.29 (clonado) | 419 OK |
| `vue-tsc --noEmit` | ✅ limpo |
| Pipeline | **435 OK / 0 FAIL** (+16) |
| Contraste | **89 OK / 0 FAIL** |
| Build | **✓ 9.01s** |
| Re-validação no /tmp limpo | (a fazer ao empacotar) |

## Bloqueios reais

### Por ambiente

- **Sandbox sem Supabase real**: não testei end-to-end:
  - Edge Function deployando sem erro
  - Service role key resolvendo o ticket
  - Email saindo via Resend
  - Audit gravando
- **Sandbox sem browser headless**: não pude validar:
  - Quick priority salvando corretamente após mudança
  - Filtros combinados (mineOnly + período + busca) funcionando
  - Highlight visual renderizando como esperado
  - Linha riscada de "implantado" sendo legível com leitor de tela

## Pendências manuais

### Antes de usar a v5.22.30

1. **Deploy da Edge Function nova**:
   ```bash
   supabase functions deploy notify-client-comment \
                       --project-ref yglcnirbnbwjqpvalqif \
                       --no-verify-jwt
   ```
   OU push para `main` e deixe o GitHub Action rodar (workflow
   atualizado).

2. **(Opcional) Configurar NOTIFICATION_RECIPIENTS**:
   ```bash
   supabase secrets set NOTIFICATION_RECIPIENTS="thiago@consultegeo.com.br,atendimento@consultegeo.com.br" \
                       --project-ref yglcnirbnbwjqpvalqif
   ```
   Sem isso, default é só `atendimento@consultegeo.com.br`.

### Smoke tests críticos em produção

1. **Quick priority**:
   - Selecionar prioridade direto na linha → não abre drill-down
   - Badge sumiu de prioridade; agora é dropdown
   - Linha urgente fica com borda vermelha + bg avermelhado

2. **Filtros novos**:
   - Toggle "Meus em análise" → mostra só itens com lock seu
   - Date `from` 2026-05-01 + `to` 2026-05-21 → filtra período
   - `to` < `from` é bloqueado pelo `min` HTML
   - Botão "Limpar" zera tudo + reload

3. **Notificação por email**:
   - Cliente em `/s/:token` adiciona comentário
   - Confirmação aparece imediatamente (`Mensagem enviada à equipe`)
   - Email chega em ~5s no inbox de atendimento@
   - Audit `notify_team_client_comment_sent` registrado (visível
     na aba Histórico do drill-down em `/admin`)
   - Console do browser sem erros

4. **Fire-and-forget validation**:
   - Bloquear Resend (firewall) temporariamente
   - Cliente comenta → confirmação aparece normal
   - Email não chega (esperado)
   - Audit `notify_team_client_comment_failed` registrado
   - **Sem mensagem de erro ao cliente** — UX preservada

## Como migrar para .NET 8

Mesmo padrão das outras Edge Functions:
- Endpoint `POST /api/notifications/client-comment`
- Service `IClientCommentNotificationService` com método
  `NotifyTeamAsync(Guid clientAccessToken, string bodyPreview)`
- Reuso do `ResendClient` do blueprint anterior
- Audit via EF Core (não trigger Postgres)

## Próximo ciclo recomendado

Dependendo do feedback de uso:

**Features extras candidatas**:
- Notificação inversa: cliente recebe email quando equipe comenta
  (`notify-team-comment` espelhando `notify-client-comment`)
- Bulk actions: selecionar várias linhas com checkbox + setar
  prioridade em lote
- "Reabrir lock" se TTL passou (admin volta a marcar
  automaticamente)
- Quick action "marcar como visto" (limpa indicador de novo
  comentário)
- Auto-refresh do listing a cada N segundos (toggle)

**Pendências antigas que continuam abertas**:
- Validar correção dos bugs herdados v5.22.27 (`onNext`, "Devolver")
  em produção — sem logs DevTools, segue sem repro
- Validar a11y dos 3 modais (focus trap, ESC)

A escolha depende do que aparecer ao usar a v5.22.30 em produção.
