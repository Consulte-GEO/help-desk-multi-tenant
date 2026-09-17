# Help Desk v0.17.0 — Estado e evidências

**Entrega local, não publicada. M1 aberto.** Base: v0.16.0, commit `35426e0d90753902e977c71f0717c9c37302bedd`. Branch `work/helpdesk-v0.17.0`. Os logs desta rodada usam UTC de17/09/2026. Commit final no manifesto externo/bundle.

## Implementado

Leitura temporal PostgreSQL sem conversão inicial para Date, UTC com três/seis dígitos, limites de calendário/era, ordenação nativa e cursores sem perda. Comparador comum na aplicação e interface, desempate determinístico de IDs, mesma representação temporal exata para verificação do instante imutável em recibos, preservando formatos históricos com offset. Assets e fingerprint abrangem o módulo shared. Nenhuma migration, grant, endpoint ou dependência nova.

**API/interface0.17.0; schema0.16.0; dez migrations intactas;25 tabelas;18 operações/14 caminhos.** O helper de SQL foi revisado, não homologado em servidor. R14-04/05/06 continuam candidatos anteriores, não receberam aprovação de PostgreSQL.

## Verificações realizadas

| Verificação | Resultado / alcance | Evidência em `evidence/v017/` |
|---|---|---|
| Base v0.16 antes da alteração | 950 testes aprovados | 00-baseline-tests.txt |
| Suíte local final | **982 aprovados, zero falhas/cancelados/skips/TODO;32 novos** | final-tests.txt |
| HTTP com precisão | Quatro testes por socket, incluídos nos982; dados sintéticos | 08-local-precision-suite.txt e final-tests.txt |
| Smoke normal de HTTP | **35 checks aprovados**; assets shared incluídos | 16-ui-attempt.txt |
| Migrations | Dez verificadas e iguais por bytes à base | final-migrations.txt; migration-integrity.json |
| TypeScript suplementar | Aprovado com compilador/tipos globais | final-typecheck-supplementary.txt |
| TypeScript/verify padrão | **Falharam** por dependências/tipos locais ausentes e erros de checagem decorrentes; verify passou982 testes antes da checagem | final-typecheck-standard.txt; final-verify-standard.txt |
| OpenAPI estrutural |18 operações, referências e sentinelas verificadas; não conformidade integral | final-contracts.txt |
| Sintaxe/build/scan |28 arquivos JS/MJS/Python verificados, assets gerados; scan heurístico sem padrão reconhecido | final-syntax.json; final-build.txt; final-secrets.txt |
| Homologação agregada/publicação | **Não aprovadas**; lock ausente e etapas dependentes bloqueadas | final-homologation.txt; final-release-gate.txt |

Node22.16.0/tsc5.8.3; tipos globais não são os fixados no manifesto. Checagem suplementar não equivale a npm ci. Os testes locais incluem lógica real, memória, respostas controladas do driver e estado puro, não RLS, locks, DOM ou provedor real.

## Regressões e revisão

13 cenários iniciais falharam antes da correção e passaram depois (02/03). Revisão acrescentou dois defeitos de desempate de ID, reproduzidos e corrigidos (11/12); uma proteção de intervalo na projeção SQL candidata (13/14, sentinela estrutural); e dois casos de comparação histórica de calendário/offset (17/18).

O primeiro conjunto completo passou961 de963. As duas falhas adicionais eram um fixture de estado com data abreviada sem fração e a sentinela da cláusula ORDER BY antiga. O fixture foi alinhado ao formato de fio vigente e a sentinela passou a exigir a coluna qualificada para evitar ordenar pelo alias textual. As expectativas de isolamento e resultados não foram retiradas (04/06).

Um teste novo presumiu indevidamente retorno do validador `asserts`; corrigido para verificar ausência de erro e preservação do objeto (07/08). As novas chamadas de testes SQL foram conferidas contra os métodos reais da aplicação e o schema das tabelas antes da checagem suplementar. A aprovação do compilador não comprova execução SQL.

Houve revisão local do diff e consulta a documentação primária. Não houve revisor independente, subagente, pentest, carga ou restauração.

## Bloqueado ou não executado

**Dependências:** `deps:resolve` retornou EAI_AGAIN no registry oficial (01-dependencies.txt). Sem package-lock real, npm ci, audit ou árvore revisada. Nenhuma dependência adicionada ou registry/política alterados. A tentativa de obter fonte oficial PostgreSQL não produziu instalação ou servidor; não foi usada para aprovar testes.

**PostgreSQL:** Docker e servidor instalados não disponíveis. Runner recusou antes de conectar (19-db-attempt.txt). **187 cenários escritos, zero executados nesta rodada**:173 principais+14upgrade. Os oito novos cenários não foram somados aos982 testes aprovados. Não foi usado Supabase remoto como alternativa, nem alterada exigência de usuário do runner nativo.

**Navegador:** Playwright retornou ERR_BLOCKED_BY_ADMINISTRATOR em page.goto após os35 HTTP. **36 checks browser escritos, zero aprovados**:31 principais+cinco humanos sintéticos. A segunda suíte não foi alcançada pelo runner. Sem screenshot aprovado, inspeção visual, teclado/mobile, CSP/CORS ou E2E do provedor.

**Destino/operação:** Supabase Auth, pooler/TLS/IP, Functions, planos/custo das consultas com RLS, capacidade, logs e restauração continuam pendentes. O build gera apenas frontend estático.

O gate exige982/187/71 aprovações efetivas (local/SQL/HTTP+browser), mas permaneceu bloqueado. Mesmo aprovação local futura não libera o destino ou produção. Não reclassificar estágios para superar a ausência de infraestrutura.

## Efeitos externos e próximo marco

Nenhuma inspeção ou escrita remota nesta rodada. Sem push/PR/merge/deploy, migrations remotas, alteração de dados, conta, segredo ou MFA. Metadados históricos dos destinos não são afirmação atual.

Próximo resultado: dependências reais → PostgreSQL17/187 cenários e upgrade → revisar planos/precisão com papel real → Auth/pooler/Functions → browser36 → capacidade/restore/revisão. M1 aberto e backoffice M2 não iniciado. Novas leituras não recuperam microssegundos que já tenham sido descartados em cursores antigos; reiniciar coleções na atualização.
