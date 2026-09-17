# Continuidade — Help Desk v0.14.0

Base `c94e49dc1066ffc89bfd444395d80e696e748daa`. Branch `work/helpdesk-v0.14.0`; commit final no manifesto externo/bundle. Leia README/AGENTS e docs 04/18. Código acumulado local, não o site publicado.

## Próximo resultado prioritário

Resolver dependências reais → PostgreSQL 17/upgrade → configuração de escopos/invariantes → Auth/pooler/Functions → navegador/capacidade. Não usar outra feature para declarar M1 encerrado.

1. Reinspecionar os três destinos antes de qualquer integração. Leituras desta rodada: GitHub vazio; cinco schemas Supabase consultados sem tabelas e ledger sem migrations; Netlify no deploy antigo. Sem writes.
2. `npm run deps:resolve`; revisar versões/origens/integridade/licenças/alertas; `npm ci --ignore-scripts`, `npm run verify`, `npm audit --audit-level=high`. A tentativa atual falhou EAI_AGAIN; nenhum lock criado.
3. `npm run check:migrations` e `npm run test:db:local`. Oito migrations inalteradas, schema 0.9.0, 125 cenários SQL escritos. Docker padrão/native somente instalado autorizado e não root; nunca banco remoto de fallback. Fresh/upgrade e roles reais, sem apagar dados existentes.
4. Revisar SQL da consulta de cache: SELECT escalar deve produzir uma linha com record NULL para miss ou um JSON da migration 008. Não relaxar esse contrato para fazer mocks passarem; adaptar somente se o comportamento real documentado divergir.
5. Conferir guards de replay: namespace, objeto, resultado da operação, contrato imutável, ator/corpo; históricos sem assignedTo e JSONB com ordem de chaves diferente. Desvio vira503, não cache miss/segunda escrita. Reenvio original não é GET atual.
6. Definir e testar R14-04/05/06 do documento18: scopes humanos granulares não configuráveis hoje, replay SQL de notas exige leitura, nem toda escrita tem trigger correspondente de evento/outbox. Não chamar perfis sintéticos de perfis configurados no provedor.
7. Validar Auth real com orçamento64 KiB decodificados, UTF-8, mesmo sinal5000ms, compressão, metadata grande e cancelamento. Sem promover JWT metadata, sem desativar MFA ou ampliar timeout para encobrir problema.
8. UI:35 HTTP +35 browser escritos. Navegador bloqueado nesta entrega; não contornar política. Transações e efeitos do erro de replay devem ser homologados no ambiente autorizado.
9. `npm run homologate:local`/`check:homologation`: piso868 locais/125 SQL/70 UI são APROVAÇÕES exigidas, não quantidades já aprovadas. Sucesso local não aprova produção, residência/RPO/RTO, restore, carga ou publicação.

## Arquivos prioritários
- `src/application/replay-result.ts`, `helpdesk.ts`: validação por operação, antes de devolver o snapshot.
- `src/infrastructure/idempotency-lookup.ts`, `postgres.ts`: null explícito versus retorno incompatível.
- `src/infrastructure/auth-response.ts`, `authentication.ts`: leitura limitada do JSON de identidade.
- `tests/review-replay-integrity.test.ts`, `review-replay-http.test.ts`, `review-auth-response.test.ts`.
- docs 18, inventário e regressões em `evidence/v014/`.

## Invariantes
Não corrigir/delete cache na requisição, não trocar key nem repetir work diante de corrupção. Callback de escrita nunca executa em replay. Valor histórico não recebe available_actions. Alterações futuras de campos hoje imutáveis precisam versionar a validação. Verificação não é assinatura de histórico nem prova contra banco/runtime comprometidos. Auth ID e principal distintos; metadata não autoriza.

868 testes locais incluem doubles; 125 SQL/35 browser não homologados. Sem revisão independente, pentest, carga ou restore. Nenhum push, PR, merge, deploy, migration remota, segredo, MFA ou conta alterados. API 0.14/schema 0.9, oito migrations e nenhuma nova dependência ou endpoint.
