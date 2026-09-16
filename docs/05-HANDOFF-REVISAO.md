# Continuidade — v0.6.0 / M1e ainda aberto

**Base:** v0.5.0 `cc13eb6a57aba4c6436324c24b3a3b88d55fbadd`. Branch `work/helpdesk-m1-v0.6.0`. Commit final no manifesto/bundle. Sem escrita ou nova inspeção remota. Antes de integrar, reinspecionar destinos e preservar trabalho concorrente.

Ler README, documentos 04 e 10, CHANGELOG e plano M1. API/interface 0.6.0, schema candidato **0.5.0**; seis migrations intactas. Não criar migration só para igualar a versão da interface. Os 451 testes locais não encerram o marco.

## Próxima execução, em ordem

1. Resolver dependências em ambiente autorizado: `npm run deps:resolve`. Revisar árvore/lock/integridades/origens/versões/alertas; repetir `npm ci --ignore-scripts`, `npm run verify`, `npm audit --audit-level=high`. Não usar tipos globais ou locks sintéticos como substitutos.
2. Executar os **60 cenários PostgreSQL** em banco descartável com as seis migrations e login restrito. Docker é padrão (`npm run test:db:local`). Sem Docker, usar PostgreSQL 17 instalado e usuário não root; exportar `HELPDESK_TEST_DB_ENGINE=native` e `HELPDESK_TEST_PG_BIN` absoluto. O runner nativo não foi homologado com servidor real: revisar seu ciclo e evidências, inclusive falhas e cleanup. Não usar Supabase remoto nem apagar schemas pré-existentes para fazer passar.
3. Validar fresh install e upgrade aplicáveis com dados fictícios, RLS/FKs/grants/helpers/search_path, command tags, rollback/pool/contextos, concorrência e timeouts. Corrigir causa de cada falha e acrescentar regressão. Verificar roles com o login real; os tests de doubles não provam essas propriedades.
4. Executar `npm run test:ui:local`: são 13 checks HTTP mais 14 de browser. A navegação desta sessão foi bloqueada. Verificar catálogo/guias, rascunhos e mudanças rápidas de sessão/ticket, teclado/foco/mobile. Não contornar políticas do ambiente.
5. Empacotar e executar Functions em homologação autorizada: pg instalado, metadados IP confiáveis, Auth humano/M2M, TLS/pooler, schema0.5.0 e observador real. Verificar que falhas de boot geram evento seguro e que o mesmo request não ganha observação duplicada. O tempo da fase HTTP não cobre toda a espera de cold start nem a transferência ao cliente.
6. Exportar somente mensagens JSON autorizadas e executar `npm run --silent logs:summary -- arquivo.jsonl`. Revisar rejeitados/ignorados e não tratar registros como requisições únicas. Não publicar o resumo global aos clientes. Testar falha do sink e medir custo/volume/perda antes de definir retenção e alertas. Não anunciar OpenTelemetry, durabilidade ou percentis exatos que não existem.
7. Executar `npm run homologate:local` e `npm run check:homologation`, revisar fontes/logs/contagens. O engine nativo explicitamente selecionado também é usado pelo executor agregado. Sucesso local não aprova destino, carga, restore ou publicação. Manter `HELPDESK_RELEASE_APPROVED` fechado até decisão explícita e verificações completas.
8. Homologar capacidade, restauração, retenção e demais decisões operacionais, então avaliar fechamento M1 e início M2. Backoffice, intakes, filas/participantes, SLA, anexos e worker continuam fora desta entrega.

## Revisão orientada aos arquivos

| Tema | Arquivos |
|---|---|
| Logs/correlação e vocabulário | `src/observability/http.ts`, `codes.ts`, `src/http/handler.ts` |
| Falha de inicialização e integração host | `src/infrastructure/hosted-handler.ts`, `runtime.ts`, `netlify/functions/api.mts` |
| Agregação segura | `src/observability/summary.ts`, `scripts/summarize-http-logs.ts` |
| Runner nativo | `scripts/native-postgres.mjs`, `test-db-native.mjs`, `test-db-local.mjs`, `test-db-docker.mjs` |
| Processos/cancelamento | `scripts/local-process.mjs` |
| Testes novos | `tests/m1e-observability.test.ts`, `m1e-summary.test.ts`, `m1e-native-postgres.test.ts`, `m1e-http-summary.test.ts` |
| Fontes/versão/gates | `src/version.ts`, `scripts/homologation-core.mjs`, package/OpenAPI |
| Evidências | `evidence/m1e/`, `evidence/homologation/latest.json` |

## Invariantes

Request ID é correlação, não autorização/identidade/garantia de unicidade. Lista fechada de logs; não copiar exceção, query, bearer, idempotency-key, IP, conteúdo ou IDs de recurso. Observer best-effort não muda transações. CLI offline não retém IDs, não é endpoint multitenant público e não é auditoria durável. Campos adicionais/objetos inválidos são rejeitados.

Runner nunca baixa binários, usa sudo, trust, herda URLs privadas ou tenta outro servidor. Só para/remove diretório próprio depois de confirmar propriedade/parada. Falha de cleanup preserva e reprova, mesmo com assertions SQL aprovadas. SIGKILL/crash pode impedir finally; nenhuma rotina garante limpeza nesse cenário. Inspecionar antes de qualquer remoção manual.

Os testes de runner usam comandos PostgreSQL controlados e diretórios temporários reais; não chamá-los de 60 testes SQL aprovados. Nenhum revisor independente/pentest/carga/restore atuou nesta entrega. O gate agregado ficou bloqueado por lock ausente, mesmo com o conjunto local passando.
