# Implementation Report · Implantação Consulte GEO v5.22.48 (entrega V11)

Data: 10/08/2026 · Base: commit local `5993978` (V10/v5.0.22-47, ainda não publicada) sobre `4e5596e` (v5.0.22-46, no ar)

## Resumo executivo

Ciclo V11 = **execução do backlog do PK criado nesta data** — pela primeira vez com mudanças
aplicadas **diretamente em produção via MCP** (banco e Edge Functions), além dos itens de repo.
Três consertos de produção e dois de higiene:

1. **§1.2 RESOLVIDO — fluxo devolução/reenvio funciona.** As 3 RPCs que o frontend chama e não
   existiam no banco (`return_submission_with_comment`, `resubmit_by_client_token`,
   `update_technical_json_by_client_token`) foram criadas em produção. Descoberta importante no
   diagnóstico: a migration 009 do source **já tinha sido reescrita** (na V8) para o modelo real
   `setup_tickets.access_token`/`client_access_token` — todas as colunas que ela referencia existem
   no banco; ela apenas nunca havia sido aplicada. Aplicada com grants no padrão vivo do hardening
   (anon + authenticated + service_role) e com a atualização do `get_status_by_client_token`
   (superset estrito do corpo vivo: + `resubmitted_at`, + `technical_json` quando `devolvido`,
   + `editable`). **Smoke real executado no banco**: fluxo completo como role `anon` — devolução →
   `devolvido`+`editable`+JSON exposto → edição do cliente → reenvio → `em_validacao` + draft
   re-lockado + comentário criado — em transação com **rollback total** (nenhum dado persistiu;
   contagens conferidas antes/depois: 15/14/14/1 intactas).
2. **§1.3 RESOLVIDO — as 3 EFs `notify-*` estão deployadas.** `notify-return` v1,
   `notify-team-comment` v1, `notify-client-comment` v1 — todas ACTIVE com `verify_jwt=true`
   (mesmo modelo da `submit-for-validation`). Imports alinhados ao padrão vivo
   (`esm.sh/@supabase/supabase-js@2.45.4`). Integridade confirmada: corpo deployado baixado e
   **byte-idêntico** ao source (UTF-8/acentos preservados).
3. **§1.4 RESOLVIDO — advisory CRITICAL eliminado.** `external_cache` (tabela do app legado,
   0 linhas) agora tem RLS habilitada sem policies: anon/authenticated fechados; `service_role`
   bypassa (nenhuma EF de backend afetável). Advisors re-lidos após aplicar: o CRITICAL virou o
   INFO esperado (`rls_enabled_no_policy`).
4. **§2.8 RESOLVIDO — 5 WARN de `search_path` mutável zerados** (`format_ticket_number`,
   `setup_step_help_touch_updated_at` + 3 do legado, incluindo `handle_new_user` que roda no
   signup do Auth usado pelo `/admin` — `ALTER ... SET search_path` não muda comportamento).
5. **§2.1 + §2.2 RESOLVIDOS no repo** — `frontend/.env.example` criado; workflow
   `.github/workflows/deploy-edge-functions.yml` criado com **no-op seguro** (sem o secret
   `SUPABASE_ACCESS_TOKEN` ele avisa e termina verde; com o secret, deploya as 6 EFs vivas) +
   `supabase/config.toml` com `verify_jwt` por função (fonte do CLI/CI). Com isso **o smoke saiu
   de "589 OK / 1 FAIL deliberado" para `593 OK / 0 FAIL` — primeira suíte 100% verde do projeto.**

## Ambiente usado

Sandbox cloud + MCP Supabase (apply_migration, deploy_edge_function, execute_sql, get_advisors) —
primeiro ciclo com escrita direta em produção. Rede externa do container bloqueada (curl às EFs
retorna 000) — ver "Bloqueios reais".

## Arquivos criados

| Arquivo | Papel |
|---|---|
| `.github/workflows/deploy-edge-functions.yml` | CI de deploy das 6 EFs vivas; no-op seguro sem secret |
| `supabase/config.toml` | `verify_jwt` por função (fonte do CLI; espelho do estado vivo) |
| `frontend/.env.example` | placeholder das 4 VITE_* (critério de aceite §20 do projeto) |
| `supabase/migrations/20260810_024_setup_return_resubmit_client_json_rpcs.sql` | espelho "JÁ APLICADA" da migration das 3 RPCs |
| `supabase/migrations/20260810_025_harden_search_path_and_external_cache_rls.sql` | espelho "JÁ APLICADA" da higiene de advisors |

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/notify-team-comment/index.ts` · `notify-client-comment/index.ts` | supabase-js `2.45.0` → `2.45.4` (paridade com as EFs que comprovadamente bootam) |
| `supabase/migrations/20260519_009_setup_return_submission.sql` | nota "APLICADA em 10/08 via 024 — não reaplicar isoladamente" |
| `docs/EDGE_FUNCTIONS.md` | seção "Estado em produção · 10/08/2026" (inventário vivo + notify-* deployadas) |
| `frontend/package.json` | 5.0.22-47 → **5.0.22-48** |

## Arquivos removidos

Nenhum.

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `apply_migration setup_return_resubmit_client_json_rpcs` | OK | ledger 22 → 23 |
| Smoke SQL do fluxo (role anon, rollback) | **SMOKE_OK** | devolução→edição→reenvio completo; dados intactos |
| `deploy_edge_function` ×3 (notify-*) | OK | ACTIVE, sha `22d844f2…`/`f1d53a74…`/`9dbc4c12…`; corpo re-baixado byte-idêntico |
| `apply_migration harden_search_path_and_external_cache_rls` | OK | ledger 23 → 24 |
| `get_advisors security` (antes/depois) | 55 → 56 lints | CRITICAL eliminado; 5 WARN search_path zerados; +3 WARN esperados (grants das RPCs novas); INFO novo = estado correto |
| `npm run build` / `typecheck` | OK | 5,4 s / 0 erros |
| `npm run smoke` | **593 OK / 0 FAIL** | o 1 FAIL histórico (workflow ausente) morreu |
| `smoke:contrast` / `smoke:xlsx` | 89 OK / exit 0 | |
| intake / similarity / implantacao-import | 27/27 · 21/21 · 21/21 | sem regressão |
| `npm audit --omit=dev` | 0 vulnerabilidades | |
| Validação YAML do workflow | OK | pyyaml |

## Implementado com sucesso

- Fluxo devolução/reenvio/edição-do-cliente operacional em produção (RPCs + EF de email).
- Emails de comentário (equipe→cliente e cliente→equipe) e de devolução deployados.
- Advisory CRITICAL zerado; search_path mutável zerado; `.env.example`; CI de EFs com gate de secret.
- Ledger e source reconciliados para as mudanças desta data (espelhos 024/025 marcados).

## Parcialmente implementado

- **Boot das 3 `notify-*` não exercitado por invocação real** — a rede externa do sandbox é
  bloqueada (curl retorna 000) e o banco não tem `pg_net` para invocar de dentro. Mitigantes:
  deploy ACTIVE confirmado, corpo byte-idêntico ao source, e os imports são exatamente os da
  `submit-for-validation` que roda em produção desde 07/08. **Validação manual (1 min):** comentar
  num chamado de teste em `/s/:token` e conferir se o email chega em atendimento@ — ou conferir
  `setup_audit_events` (`notify_*_sent`/`notify_*_failed`, que as EFs gravam).

## Não implementado (continua no backlog)

- §1.1 Publicar V10+V11 (é do Thiago — push bloqueado; zips v11 englobam a v10).
- §2.3 reconciliar ledger 005–015 · §2.4 destino do legado Supabase (5 views ERROR restantes são
  dele) · §2.5 xlsxStyleLite vs xlsx-js-style · §2.7 `auth_leaked_password_protection` (painel).

## Regressões evitadas

- `get_status_by_client_token`: versão aplicada é superset estrito do corpo vivo (comparados
  antes de aplicar — gotcha GeoCon de re-derivar do corpo vivo).
- Grants das RPCs novas seguem o padrão vivo do hardening (não só `anon` como no arquivo original).
- Workflow com comandos de deploy explícitos (o smoke confere cada função nominalmente).
- `laudo-vision`/`admin-bootstrap` ficaram FORA do CI (sem chamador — não reintroduzir código morto).

## Bloqueios reais

### Bloqueios por ambiente
- Rede externa do container bloqueada → invocação HTTP real das EFs impossível daqui; `pg_net`
  não instalado (e não foi instalado só para smoke). Ver "Parcialmente implementado".
- Push ao GitHub segue bloqueado (proxy da sessão) — entrega via zips.

### Bloqueios por credenciais
- CI de EFs só ativa quando o Thiago criar o secret `SUPABASE_ACCESS_TOKEN` (instruções no
  cabeçalho do workflow). Sem ele o job é no-op verde.

## Pendências que exigem ação manual

1. Publicar os zips **v11** no GitHub (englobam a V10; mesma deleção via `git rm` do
   `setupSubmissionService.ts` continua valendo — INSTRUCOES.md).
2. Teste de 1 minuto dos emails: comentar num chamado (visão cliente e visão equipe) e devolver
   uma submissão de teste; conferir os 3 emails / audit events.
3. Criar `SUPABASE_ACCESS_TOKEN` nos secrets do GitHub (ativa o CI de EFs).
4. Decidir §2.4 (legado Supabase) — zera os 5 ERROR restantes dos advisors.

## Como validar localmente

`cd frontend && npm ci && npm run smoke` (agora 593/0). Fluxo devolução: com um ticket de teste,
`/r/:token` → Devolver com comentário → `/s/:token` mostra editable → editar → Reenviar.

## Como publicar no Netlify / configurar Supabase

Netlify: inalterado (push → build). Supabase: **nada a aplicar** — migrations 024/025 já estão em
produção (espelhos no repo são registro; não reaplicar).

## Como migrar futuramente para .NET 8 + SQL Server

As 3 RPCs mapeiam 1:1 para os endpoints já previstos em `docs/ENDPOINTS.md`
(`POST /submissions/{id}/return`, `POST /submissions/{id}/resubmit`,
`PUT /submissions/{id}/technical-json` do cliente) — o contrato jsonb de entrada/saída documentado
nos corpos das funções é a especificação.

## Próximo ciclo recomendado

1. Publicar v11 + validar emails em produção (item 2 acima).
2. Decidir destino do legado Supabase (§2.4) — última fonte de ERROR nos advisors.
3. Exportação R02 ida-e-volta (wizard exporta no formato que importa).
