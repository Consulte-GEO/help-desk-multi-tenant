# Implementation Report · Implantação Consulte GEO v5.22.28

## Resumo executivo

**Painel de gestão `/admin`** entregue. Primeiro uso de Supabase Auth
no projeto. 2 usuários criados via Edge Function bootstrap idempotente.
Dashboard consolidado de submissions + tickets com features de gestão:
notas internas, locks "em análise por mim", prioridades, filtros, busca.

**Pipeline: 393 OK (+39) · Contraste: 89 OK · Build: ✓ 7.18s · zero
quebra do fluxo cliente · backend .NET intocado.**

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                       │
│  ┌────────────────┐    ┌──────────────────────────────────┐  │
│  │ /admin/login   │    │ /admin (AdminDashboardView)      │  │
│  │ AdminLoginView ├───→│  - lista de submissions/tickets  │  │
│  └────────────────┘    │  - filtros + stats               │  │
│         │              │  - drill-down: notas, lock, prio │  │
│         │              └──────────────────────────────────┘  │
│         ▼                          │                          │
│  authService.signIn       adminQueriesService                 │
│         │                          │                          │
└─────────┼──────────────────────────┼──────────────────────────┘
          │                          │
          │ Supabase Auth            │ PostgREST + RLS
          ▼                          ▼
┌──────────────────────────────────────────────────────────────┐
│ Supabase                                                       │
│  ┌────────────┐  ┌──────────────────────────────────────┐    │
│  │ auth.users │  │ admin_dashboard_items (view)         │    │
│  │ JWT com    │  │  ← setup_submissions                 │    │
│  │ is_admin   │  │  ← setup_tickets                     │    │
│  └────────────┘  │  ← setup_admin_priorities (join)     │    │
│         │        │  ← setup_admin_locks (join)          │    │
│         │        └──────────────────────────────────────┘    │
│         │        ┌──────────────────────────────────────┐    │
│         └───────→│ is_admin() — função SECURITY DEFINER │    │
│                  │ usada nas RLS policies               │    │
│                  └──────────────────────────────────────┘    │
│                  ┌──────────────────────────────────────┐    │
│                  │ Edge: admin-bootstrap                │    │
│                  │ shared-secret + service role key     │    │
│                  │ → cria thiago@ + atendimento@        │    │
│                  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Decisões registradas

### Por que Supabase Auth e não tabela própria

- Já está no projeto (mesma anon key, mesma URL)
- Hash bcrypt gerenciado pelo Supabase (zero código nosso de
  password hashing)
- JWT pronto que inclui `app_metadata` — perfeito para `is_admin`
- SDK Vue/JS já integrado (`@supabase/supabase-js`)
- Migração para .NET é trocar provider, não reescrever lógica

### Por que NÃO criar usuários via migration SQL

`auth.users` é uma tabela interna do Supabase com triggers,
constraints e contratos que podem mudar entre versões. INSERT direto
não é suportado oficialmente. O caminho idiomático é
`supabase.auth.admin.createUser()` que requer **Service Role Key** —
**que JAMAIS pode ir para o bundle do frontend**.

Por isso a **Edge Function `admin-bootstrap`**: isola a Service Role
Key no servidor, exige shared-secret no header `Authorization` para
prevenir abuso público, e é idempotente (rodar de novo não duplica).

### Por que shared-secret e não OIDC do próprio Supabase

A bootstrap é chamada **antes de qualquer usuário existir** — não há
como autenticar como admin. Shared-secret é o padrão pragmático para
endpoints de bootstrap (Stripe usa o mesmo padrão para webhooks).

### Por que `is_admin()` com whitelist hardcoded + JWT metadata

Defesa em profundidade:
- Caminho normal: JWT vem com `app_metadata.is_admin: true` (setado
  no bootstrap). `is_admin()` lê do JWT.
- Caminho de recuperação: se alguém perder o metadata por engano, o
  email ainda está na whitelist hardcoded. Não é vetor de ataque —
  só esses 2 emails estão na lista, e eles só conseguem entrar com a
  senha correta de qualquer forma.

Quando migrar para .NET, vira `[Authorize(Roles="Admin")]` com
mapeamento de claim → role no OpenIddict.

### Por que TTL de 4h no lock

Compromisso entre:
- Tempo razoável para tratar um chamado (não precisa renovar a cada
  30min)
- Não bloquear indefinidamente se alguém abandonar o navegador
- Sem job assíncrono pra limpar (a query da view já filtra
  `expires_at > now()`)

Lock soft: se outro admin precisar e o TTL ainda não expirou, vê
quem está com ele e pode pedir liberação manual.

### Por que view consolidada `admin_dashboard_items`

Alternativa era 2 queries no client (submissions + tickets) + merge.
View server-side:
- Uma query única
- Filtros funcionam em ambos os tipos
- Ordenação correta no Postgres
- RLS herda das tabelas-fonte (não precisa reaplicar)

Custo: cache da view não é trivial; para volume alto pode virar
materialized view ou RPC com paginação. Hoje o limit é 500 — ok para
o estado atual do protótipo.

### Por que validar `is_admin` pós-signIn

`signIn` do Supabase devolve qualquer usuário válido. Sem checar
`is_admin` localmente, um usuário comum (se existisse) poderia ter
sessão "válida" e ficaria preso em `/admin` com guard barrando, sem
mensagem clara.

`authService.signIn` chama `auth.signOut()` imediatamente se o
usuário não for admin — limpa sessão e devolve `usuario_sem_permissao_admin`
para o caller (AdminLoginView mostra mensagem traduzida).

## Arquivos criados

| Arquivo | Linhas | Função |
|---|---|---|
| `supabase/migrations/20260521_011_admin_panel.sql` | ~230 | 3 tabelas + view + função + RLS |
| `supabase/functions/admin-bootstrap/index.ts` | ~190 | Cria usuários idempotente |
| `frontend/src/services/authService.ts` | ~165 | signIn/signOut/restore |
| `frontend/src/services/adminQueriesService.ts` | ~280 | Listing + notas + locks + prio |
| `frontend/src/views/AdminLoginView.vue` | ~130 | Login |
| `frontend/src/views/AdminDashboardView.vue` | ~580 | Dashboard |
| `IMPLEMENTATION-REPORT-V522-28.md` | (este) | |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `frontend/src/router/index.ts` | +2 rotas + guard `beforeEach` |
| `frontend/scripts/cleanup-legacy.cjs` | +2 views + 2 services na allowlist |
| `frontend/smoke-pipeline.ts` | bloco v5.22.28 (+39 testes); flex check v27 |
| `frontend/package.json` | bump 5.0.22-27 → 5.0.22-28 |
| `README.md` | header + seção destacada |
| `docs/CHANGELOG_SOLICITACOES.md` | entrada v5.22.28 no topo |

## Validações executadas

| Validação | Resultado |
|---|---|
| Baseline v5.22.27 (clonado) | 354 OK |
| `vue-tsc --noEmit` | ✅ limpo |
| Pipeline | **393 OK / 0 FAIL** (+39) |
| Contraste | **89 OK / 0 FAIL** (zero CSS novo no design system) |
| Build | **✓ 7.18s** |

## Bloqueios reais

### Por ambiente

- **Sandbox sem Supabase**: não pude testar o fluxo end-to-end
  (criar usuários via Edge → fazer signIn → ver dashboard com dados
  reais). Toda validação foi estrutural.
- **Sandbox sem browser headless**: não pude validar:
  - Login realmente faz redirect
  - Guard de rota não deixa entrar em `/admin` sem auth
  - Stats atualizam ao filtrar
  - Notas aparecem após adicionar

### Por credenciais

- **`SUPABASE_SERVICE_ROLE_KEY`**: necessário para a Edge Function
  bootstrap. O Thiago precisa configurar no Dashboard antes de
  chamar.
- **`ADMIN_BOOTSTRAP_SECRET`**: o Thiago precisa gerar um token
  aleatório (ex.: `openssl rand -hex 32`) e setar como secret antes
  do primeiro bootstrap.

## Pendências manuais (em ordem de execução)

### Antes do primeiro login

1. **Configurar secrets** no Supabase Dashboard:
   ```bash
   supabase secrets set ADMIN_BOOTSTRAP_SECRET="$(openssl rand -hex 32)" \
                       --project-ref yglcnirbnbwjqpvalqif
   # SUPABASE_SERVICE_ROLE_KEY já existe (Dashboard > Settings > API)
   ```

2. **Aplicar migration**:
   ```bash
   # Via Dashboard SQL Editor, colar conteúdo de
   # supabase/migrations/20260521_011_admin_panel.sql
   # OU via CLI:
   supabase db push --project-ref yglcnirbnbwjqpvalqif
   ```

3. **Deploy da Edge Function**:
   ```bash
   supabase functions deploy admin-bootstrap \
                       --project-ref yglcnirbnbwjqpvalqif \
                       --no-verify-jwt
   ```

4. **Bootstrap dos usuários**:
   ```bash
   curl -X POST https://yglcnirbnbwjqpvalqif.supabase.co/functions/v1/admin-bootstrap \
        -H "Authorization: Bearer $ADMIN_BOOTSTRAP_SECRET" \
        -H "Content-Type: application/json"
   ```
   Resposta esperada (anote as senhas!):
   ```json
   {
     "ok": true,
     "users": [
       { "email": "thiago@consultegeo.com.br",
         "password": "<SENHA GERADA>",  // 20 chars
         "created": true },
       { "email": "atendimento@consultegeo.com.br",
         "password": "<SENHA GERADA>",
         "created": true }
     ]
   }
   ```

5. **Push do frontend** para main → Netlify build automático.

6. **Acesso**: `https://setup.consultegeo.org/admin/login`

### Smoke tests manuais em produção

1. **Login com senha errada** → deve mostrar "E-mail ou senha
   incorretos"
2. **Login com email não-admin** → deve mostrar "Este e-mail não tem
   permissão"
3. **Login com Thiago + senha correta** → redireciona pra `/admin`
4. **Tentar acessar `/admin` sem login** → redireciona pra
   `/admin/login?to=/admin`
5. **F5 em `/admin` logado** → permanece em `/admin` (restoreSession
   funciona)
6. **Filtrar por status** → reload da query
7. **Buscar "TST"** → filtra na busca
8. **Clicar em uma linha** → drill-down aparece com 0 notas
9. **Adicionar nota** → aparece na lista, com seu email + timestamp
10. **Apagar nota** → confirm + some
11. **Definir prioridade alta** → badge atualiza no listing
12. **Tomar lock** → cadeado aparece com seu email
13. **Liberar lock** → cadeado some
14. **Logout** → volta pra `/admin/login`
15. **Outra aba do navegador** → faz signOut → primeira aba detecta
    via `onAuthStateChange` e desloga

### Sugestões de melhoria de gestão (não implementadas, propostas)

| Sugestão | Prioridade | Esforço estimado |
|---|---|---|
| **Export Excel do listing** | Alta | Médio (~3h) |
| **Notificação por email quando nova submission entra** | Média | Médio (~4h, Edge Function nova) |
| **Histórico de mudanças por chamado** (timeline via `setup_audit_events`) | Alta | Médio (~5h) |
| **Atribuir a outro admin** (delegar) | Média | Pequeno (~2h) |
| **Limitar listing a "meus chamados"** (filtro pessoal) | Baixa | Pequeno |
| **Bulk actions** (selecionar várias e definir prioridade) | Média | Médio |
| **Dashboard de produtividade** (chamados fechados / semana, tempo médio) | Baixa | Grande (~1d) |
| **Comentário no chamado visível para o cliente** | Alta | Médio (~4h, integra com ClientStatusView) |

## Sugestão imediata: priorizar 3 melhorias

Para fechar o ciclo do painel, recomendo na próxima versão:

**v5.22.29 — Refinamentos do painel** (3 features de alto ROI):
1. Export Excel do listing (uso típico de gestão)
2. Histórico de mudanças por chamado (já tem audit, falta visualizar)
3. Comentário visível para o cliente (link com ClientStatusView)

Esses 3 itens transformam o painel de "MVP de gestão" para
"ferramenta de trabalho diária" sem necessidade de mais features
arquiteturais.

## Como migrar para .NET 8 + SQL Server

- `authService` → consumer de `POST /api/auth/login` retornando JWT
- `adminQueriesService` → consumer de
  `GET /api/admin/dashboard-items`, `POST /api/admin/notes`, etc.
- `is_admin()` Postgres → `[Authorize(Roles="Admin")]` C#
- Tabelas `setup_admin_*` → migrate direto para SQL Server, mesma
  estrutura (sem RLS, controle de acesso via authorization)
- View `admin_dashboard_items` → SQL Server view ou CQRS read model
- Edge `admin-bootstrap` → comando `dotnet run --bootstrap-admins`
  ou seed do EF Core

## Próximo ciclo recomendado

**v5.22.29** — Refinamentos do painel (export Excel + histórico +
comentário cliente). Vide tabela acima.

Em paralelo, ainda pendentes desde v5.22.27:
- Validar correção dos bugs herdados (`onNext`, `WizardFooter`)
- Validar a11y dos 3 modais (focus trap, ESC)
