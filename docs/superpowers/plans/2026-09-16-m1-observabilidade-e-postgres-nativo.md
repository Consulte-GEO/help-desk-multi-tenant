# M1 — Observabilidade HTTP e executor PostgreSQL nativo

**Base:** v0.5.0 `cc13eb6a57aba4c6436324c24b3a3b88d55fbadd`.
**Objetivo:** avançar HD-104 (diagnóstico seguro) e HD-102 (execução local sem Docker), sem migrations adicionais ou escrita remota.
**Arquitetura:** preservar API/domínio/SQL. Observações usam lista fechada de campos e rotas; falhas de inicialização recebem a mesma correlação que a resposta. O executor nativo cria um cluster novo e descartável com binários explicitamente informados e não substitui silenciosamente Docker.

## Restrições
- Sem push, merge, deploy, alteração de segredo/MFA ou banco remoto.
- Não declarar PostgreSQL/Auth/Functions/browser aprovados por testes com doubles.
- Não registrar body, bearer, IP, nomes, query, UUID do recurso, idempotency-key ou texto bruto de exceção.
- Nenhum endpoint público de métricas globais. Resumo operacional é CLI offline.
- Nenhum downloader, alteração de política de rede/navegador, `sudo`, `trust` ou conexão remota no executor.
- Seis migrations anteriores e schema 0.5.0 preservados.

## Entrega A — diagnóstico HTTP efetivo
Arquivos: `src/observability/http.ts`, `summary.ts`, `src/http/handler.ts`, `src/infrastructure/hosted-handler.ts`, `runtime.ts`, `netlify/functions/api.mts`, `scripts/summarize-http-logs.ts`.
Testes: `tests/m1e-observability.test.ts`, `tests/m1e-summary.test.ts`.
1. Reproduzir ausência de rota/código nos eventos e aceitação de identificador composto só por hífens.
2. Padronizar eventos, tempo monotônico, rotas e códigos limitados. Descartar campos livres.
3. Cobrir falhas de inicialização e cache/retry da fábrica do runtime sem duplicar observação da API.
4. Falha síncrona ou assíncrona do observer não altera a resposta nem gera rejeição não tratada.
5. CLI agrega contagens e histograma por rota/método, sem armazenar identificadores nem estimar percentil exato.
Comandos: `node --experimental-strip-types --test tests/m1e-observability.test.ts tests/m1e-summary.test.ts`; `npm test`.

## Entrega B — PostgreSQL 17 nativo, explícito e descartável
Arquivos: `scripts/native-postgres.mjs`, `scripts/test-db-native.mjs`, `scripts/test-db-local.mjs`, `scripts/local-process.mjs`, `package.json`.
Testes: `tests/m1e-native-postgres.test.ts` e regressão de cancelamento de processo.
1. Testar engine inválido, caminho relativo, root/Windows, versões incompatíveis e herança de variáveis PG/produção.
2. Verificar binários `initdb`, `pg_ctl`, `psql` instalados (17); criar pasta própria 0700, senha SCRAM aleatória e porta loopback.
3. Criar somente `helpdesk_test` no cluster próprio; executar os 60 testes SQL existentes com login restrito.
4. Confirmar propriedade antes de parar/apagar; parada malsucedida preserva diretório e falha. SIGINT/SIGTERM cancela apenas subprocessos próprios.
5. Registrar limitações quando binários/driver faltarem. Sem sucesso fictício ou fallback remoto.
Comandos: `npm run test:db:native`; `HELPDESK_TEST_DB_ENGINE=native HELPDESK_TEST_PG_BIN=/caminho/17/bin npm run test:db:local`.

## Validação e entrega
Executar baseline, ciclos red/green, suíte completa, typecheck disponível, contratos, build, scanner e HTTP local. Tentar npm/dependências, banco nativo/Docker e browser uma vez sem contornar bloqueios. Preservar resultados reais. Gerar pacote completo, patch, bundle Git e documentação atualizada. M1 continua aberto até homologação real.

## Resultado de execução
A entrega de diagnóstico e resumo offline foi implementada, incluindo regressões em HTTP real de loopback e CLI. O runner nativo foi implementado e testado com comandos PostgreSQL controlados. Seu caminho real recusou na configuração, sem iniciar servidor. Os 451 testes locais e 13 checks HTTP passaram; homologação real não passou. Nenhuma migration foi criada. Detalhes e comandos efetivos em documentos 04, 05, 10 e evidence/m1e/.
