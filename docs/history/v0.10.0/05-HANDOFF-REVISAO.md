# Continuidade — Help Desk v0.10.0

Base `fbed9dccfaaf6c388d1ddc24673cfdc6f8afc55e`; branch `work/helpdesk-v0.10.0`. Sem escrita remota. Ler README, documentos 04/14, CHANGELOG e `supabase/migrations.manifest.json`. O último GitHub consultado retornou vazio; antes de integrar, reinspecionar destinos e preservar alterações concorrentes.

## Prioridade
1. Executar `npm run deps:resolve` com registry autorizado. Revisar lock, versões, integridades, licenças e alertas. Repetir npm ci, verify e audit. Não fabricar lock nem substituir a dependência declarada pelos tipos globais.
2. `npm run check:migrations`: oito arquivos intactos, schema candidato 0.9.0. Divergência não deve ser corrigida regenerando o manifesto indiscriminadamente. Revisar o diff e a procedência.
3. Executar `npm run test:db:local` com PostgreSQL17 descartável. Docker padrão; native exige binários locais autorizados e usuário não root. Os runners agora executam rls.test.ts e upgrade.test.ts serialmente. **119 cenários escritos, não aprovados.**
4. Revisar o ensaio de upgrade em banco separado `helpdesk_upgrade_test`, nunca em schema já populado para fazer passar. O teste não apaga um banco preexistente. Confirmar preservação exata dos snapshots, mensagens, notas, outbox e cache, assigned_to null e atribuição posterior. Não confundir isso com restauração de backup.
5. Revisar `DATABASE_SECURITY_QUERY` e o contrato com PostgreSQL real: tipos/assinaturas, search_path, owner, privilégios efetivos por coluna e grant option, triggers diferidos, policies e constraints. Os 11 testes de drift devem recusar e restaurar cada alteração. Não remover asserts para aprovar uma configuração inesperada.
6. Homologar driver/pooler/TLS/Auth/Functions e medir custo/latência do boot. Guard é pontual, não compara corpos de funções ou expressões. Manter revisão de migrations/RLS e avaliação de `public.rls_auto_enable()` separadas. Não adicionar auto-repair ao boot.
7. `npm run test:ui:local`: 28 HTTP + 25 browser, sendo browser ainda bloqueado nesta entrega. Não contornar políticas locais. Confirmar fluxos anteriores, rascunhos, duas sessões concorrentes, foco e mobile.
8. Rodar homologate:local e check:homologation; revisar relatórios/logs/fingerprint. Mínimos 679 locais/119 SQL/53 UI; números escritos não são aprovações. Resolver critérios operacionais/destino e aprovação explícita antes de HELPDESK_RELEASE_APPROVED.

## Arquivos prioritários
- `src/infrastructure/database-security.ts` e `database-security-contract.ts`: consulta somente de catálogo e inventário do desenvolvedor; 13 indicadores obrigatórios.
- `scripts/migration-files.ts`, `check-migrations.ts`, manifesto: limites, links, hashing e mesmos bytes usados para SQL.
- `supabase/tests/upgrade.test.ts`: configuração local, banco novo separado, SQL de fixture antigo sem assigned_to, comparação, replay e privacidade.
- `supabase/tests/rls.test.ts`: loader antes do driver e cenários reais de desvios com restauração em finally.
- Runners Docker/native, package scripts, CI e pisos do gate.

## Invariantes
API/interface 0.10.0, schema0.9.0. Não criar migration cosmética. Sem nova permissão/endpoint/dado remoto. Contrato/hash são revisáveis, não assinados; não certificam SQL ou semântica. Readiness não lê valores de credenciais e não impede um administrador de alterar permissões depois do boot. Responsibility continua sem conceder acesso, eventos internos não saem ao cliente e replay continua devolvendo o snapshot original.

679 testes locais usam também doubles; 119 SQL/25 browser não aprovados. Houve revisão local, não revisão independente/pentest/carga/restore. O pacote e o commit não autorizam publicação.
