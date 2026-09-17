# Continuidade — Help Desk v0.15.0

Base `503f1b0d3db59cb373d492bf7434d908ce6522dd`; branch `work/helpdesk-v0.15.0`. Ler README, AGENTS e documentos 04 e 19. Nenhuma escrita ou inspeção remota foi realizada nesta rodada. O código local não deve ser confundido com o site publicado. Reinspecionar os destinos antes de integrar e preservar alterações concorrentes.

## Ordem de execução

### 1. Resolver dependências e conferir procedência
Executar `npm run deps:resolve` no registry autorizado. Revisar lockfile, versões, origens, integridades, alertas e licenças. Repetir `npm ci --ignore-scripts`, `npm run verify` e `npm audit --audit-level=high`. Não utilizar tipos globais ou lockfile sintético como aprovação.

Executar `npm run check:migrations`: as migrations 001–008 permanecem intactas, e a 009 possui seu hash no manifesto. O backend 0.15.0 exige schema 0.15.0. Não publicar apenas HTML contra o schema 0.9.0.

### 2. Homologar PostgreSQL e upgrade
Executar `npm run test:db:local` em PostgreSQL 17 descartável, com o login restrito real. Há 146 cenários: 136 principais e dez de upgrade. Docker é o padrão; o executor nativo exige instalação local autorizada e usuário não root. Não usar banco remoto como alternativa, nem apagar banco preexistente para fazer a suíte passar.

Revisar a migration 009 por inteiro: defaults, lista de capacidades, nulos, duplicatas, chaves estrangeiras, tipos dos triggers, lock consultivo, revisão esperada, `session_user`, `search_path`, setter `SECURITY INVOKER` e privilégios. HTTP, clientes e manutenção não podem consultar o histórico ou invocar setter, getter ou guard. A revisão operacional deve preceder qualquer provisionamento de pessoa real.

Na instalação nova, pessoas e vínculos precisam de perfil explícito; a ausência representa uma lista vazia. No upgrade, a carga inicial cria uma versão por relação humana ativa e preserva as cinco capacidades legadas. A mesma pessoa pode ter teto diferente por workspace, não por conta. Reativar um relacionamento exige revisar o teto existente. A prontidão espera 24 tabelas, 31 funções e 12 triggers, sem reparo automático.

### 3. Conferir autorização e recibos
Confirmar `resolve_human` e `has_scope` utilizando o mesmo getter. Retirar escrita de um administrador também deve retirar as ações correspondentes. Identidade Supabase e principal interno continuam sendo IDs diferentes. Novo vínculo não pode criar permissões implicitamente.

No perfil que apenas escreve notas, conferir primeira criação, recibo próprio e reenvio. A coleção de notas deve continuar inacessível. Após revogar a escrita, o reenvio deve ser negado. Nenhuma operação é repetida, nenhum prazo de cache é estendido e nenhuma permissão geral de leitura é concedida. Não acrescentar `INSERT RETURNING` como atalho sem avaliar seu requisito de leitura.

### 4. Validar o plano de provisionamento

```bash
npm run --silent scopes:plan -- examples/human-scope-change.json
```

A saída é somente um plano parametrizado. Não carrega driver, abre conexão ou executa SQL. O executor administrativo aprovado precisa vincular os parâmetros e confirmar o COMMIT. Se a confirmação for perdida, consultar a revisão e o histórico antes de uma nova execução. O UUID de correlação não implementa idempotência administrativa. Não criar um endpoint de concessão de permissões sem o desenho de administração, autorização e auditoria do M2.

### 5. Homologar destino e operação
Validar Auth, pooler, TLS, IP confiável, driver e Functions reais. Medir o custo de consultar a revisão atual e de executar a carga inicial. As verificações de catálogo não comprovam a semântica. Os testes locais não configuraram operadores no Supabase.

Executar a interface: 35 verificações HTTP e 35 de navegador. Testar os novos perfis no backend homologado, além de rascunhos, conflitos, sessão humana, foco, teclado e mobile. O navegador ainda não foi aprovado; não contornar a política de navegação do ambiente.

Resolver R14-06, capacidade, restauração e governança antes da produção. `homologate:local` e `check:homologation` exigem 905/146/70 aprovações efetivas, respectivamente locais, SQL e HTTP/navegador, sem falhas ou testes ignorados. Mesmo esse resultado não libera o destino nem a produção. Manter `HELPDESK_RELEASE_APPROVED` fechado até decisão explícita.

## Revisão dirigida

| Arquivos | Foco |
|---|---|
| `src/domain/scopes.ts`, `principal-validation.ts` | Contrato denso de capacidades e resposta de identidade validada. |
| `src/application/human-scope-change.ts`, `scripts/plan-human-scopes.ts` | Plano sem execução, parâmetros explícitos e leitura limitada. |
| `supabase/migrations/20260917000900_human_scope_versions.sql` | Configuração privada, ausência sem privilégios, revisão, histórico e reenvio de notas. |
| `src/infrastructure/database-security*.ts` | Inventário, permissões esperadas e quantidade de tabelas. |
| `supabase/tests/rls.test.ts`, `upgrade.test.ts` | Provisionamento explícito dos fixtures novos, testes antigos preservados e 146 cenários ainda não executados. |
| `tests/v015-*`, `evidence/v015/` | 37 novos testes locais, ciclos de falha/correção e limitações da evidência. |

## Invariantes

Recibo não é coleção; responsabilidade não concede acesso; capacidade não substitui vínculo ou papel. O runtime não administra seu próprio perfil. Nenhum segredo entra no plano ou no cliente. Ausência de perfil nega capacidades, e a carga legada não se repete automaticamente. Histórico append-only não protege contra um administrador de banco comprometido.

M1 continua aberto. M2 e R14-06 não foram entregues. Não existe aprovação de PostgreSQL, Auth, navegador real ou produção nesta sessão.
