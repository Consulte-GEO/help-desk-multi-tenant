# Tarefa executável — integrar e validar Help Desk M1-R4

## Objetivo
Integrar o pacote R2+R3+R4 sem regredir trabalho concorrente e avançar na homologação técnica do M1. Não iniciar M2, não reconstruir módulos já implementados e não confundir aprovação local com operação real.

## Entrada obrigatória
Leia PROJECT_HELP_DESK.md, README.md, AGENTS.md, docs04/05 atuais, manifest.json e docs34–38 do pacote. Base remota consultada:b9481b9fabde2fd9c442e44099bc17608b59571a, branch codex/m1-reproducibilidade. Confirme HEAD agora; essa observação pode ter ficado antiga.

## Restrições
Sem autorização explícita atual: não fazer push/PR/merge/deploy, aplicar migrations remotas, alterar dados/usuários/MFA/secrets/buckets ou criar recurso pago. Não usar service_role/postgres como login de request. Não ligar HELPDESK_RELEASE_APPROVED para contornar testes. Não editar migrations históricas, criar lock sintético, usar outro registry ou transformar bloqueio de navegador em aprovação.

## 1. Identificar e integrar
```bash
git status --short
git branch --show-current
git rev-parse HEAD
```
Preserve mudanças não commitadas. Crie/use branch revisável, fora de uma árvore compartilhada em uso. Inspecione o manifesto e use só uma variante:
```bash
# Somente quando ainda não recebeu R2/R3 e as preimages correspondem:
git apply --check /caminho/do/pacote/patches/helpdesk-m1-r2-r3-r4.patch
git apply /caminho/do/pacote/patches/helpdesk-m1-r2-r3-r4.patch

# Alternativa, apenas sobre o R3 exato entregue:
git apply --check /caminho/do/pacote/patches/helpdesk-m1-r4-only.patch
git apply /caminho/do/pacote/patches/helpdesk-m1-r4-only.patch
```
Os blocos são ALTERNATIVOS. Não usar ambos. Divergência exige revisão do código, não ajuste artificial de hash. Não copiar README/AGENTS/docs04/05 históricos sobre o remoto.

## 2. Revisão do comportamento
Arquivos focais: src/infrastructure/transaction.ts; testes m1-transaction-events e helper; três testes M1-R4 em supabase/tests/rls.test.ts; scripts/homologation-core.mjs.

Aceite: evento fatal não encerra Node com erro bruto; após a falha não há novas consultas/callback/reconexão; COMMIT não confirmado permanece resultado desconhecido; COMMIT confirmado não é repetido por evento posterior; referência emprestada vencida não acessa a próxima conta; um listener por cliente; erros SQL comuns e rollback confirmado preservam comportamento anterior. Liberação real e casos PostgreSQL ainda precisam de prova.

## 3. Dependências e baseline integrado
```bash
openssl version
npm ci --ignore-scripts
npm run check:lock
npm run check:migrations
npm run verify
npm audit --audit-level=high
```
Esperado para fonte inalterada do pacote:1.133 Node;11 migrations iguais;typecheck/contratos/scan/build aprovados e audit concluído. 1.133 inclui 6TLS, não somar esses seis novamente. Se alterar código, crie teste RED→GREEN, execute regressões e atualize a evidência real; contagem mínima não dispensa cobertura.

## 4. Banco e navegador
```bash
npm run test:db:local
npm run test:tls:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```
Banco: PostgreSQL17 novo/descartável,207 casos (191 principais+16upgrade),zero skips. Docker padrão; native só com binários autorizados e usuário não root. Nenhum Supabase remoto como fallback. A interrupção de backend dos testes M1-R4 usa PID da conexão própria da fixture, não PID descoberto de outro serviço.

HTTP/browser:35+36=71. Sessão sintética do browser não equivale a Auth real. Preserve tentativas falhas, saídas, hashes, screenshots efetivamente capturados e fingerprint da fonte. Gate deve reprovar fonte nova com evidência antiga.

## 5. Próximo gate conectado, somente com autorização atual
Validar pg/TLS/descarte e runtime dentro da Function; login humano, renovação/expiração/revogação, M2M e isolamento de contas. Não solicitar que o usuário cole senhas ou chaves no chat. O diagnóstico privado permanece inofensivo por padrão:
```bash
npm run --silent runtime:preflight
# Somente contra destino previamente autorizado e configuração segura no ambiente:
npm run --silent runtime:preflight -- --connect
```
Esses comandos não homologam por si sós a Function, Auth, capacidade ou produção. Depois completar carga/abuso, restauração, governança e revisão independente.

## 6. Entrega
Atualize handoff/backlog e os docs04/05 atuais sem apagar histórico. Informe branch/base/commit,arquivos,migrations,API,testes escritos/executados,dependências,browser,TLS/pg,efeitos externos e limitações. Produza pacote/manifesto rastreável. Separe IMPLEMENTADO,TESTADO_LOCALMENTE,SQL_EXECUTADO,BROWSER_EXECUTADO,DEPLOYADO,HOMOLOGADO,OPERACIONAL. Falta de autorização para operações externas não impede preparar e testar a integração local.
