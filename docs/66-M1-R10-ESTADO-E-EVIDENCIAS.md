# Help Desk M1-R10 — Estado e evidências

**Data local:** 30/09/2026, America/Sao_Paulo. Os logs desta execução usam UTC e avançam para 01/10/2026; não são execuções de dias diferentes no horário local.
**Entrega local:** cliente de aceitação hospedada implementado; não implantado nem executado com autenticação hospedada. **M1 aberto.**

## Base correta
Upstream consultado: `78bbb00112331531168ae24600604cb7f3148770`, nas branches `codex/m1-reproducibilidade` e `codex/m1-r9-integracao`. O R9 já integrou os incrementos anteriores. **Não reaplicar patches R2–R8.**

Os documentos upstream63/64 registram CI36592018825, código25d75cf, com1202 testes de aplicação,209 PostgreSQL17 e71 HTTP/browser aprovados. A consulta ao job109487249530 confirmou completed/success e todas as etapas bem-sucedidas. Não executei esse CI; é evidência anterior da base.

Netlify consultado via conector: site9781cd85-7dc1-4ef5-868b-947e389a9d4d, deploy6abbdecfeefd99000864e661, ready, commit78bbb001, contexto production, Functionapi Node22. O último smoke registrado no handoff upstream era503/release_gate_closed. Não obtive resposta HTTP atual da aplicação nesta rodada, não inspecionei valores de segredos e não reafirmo esse smoke histórico como medição atual.

A fonte executável R9 foi recuperada do bundle R8 mais deltas lidos no GitHub. Fingerprint de todos os caminhos de código/configuração/testes: `972674dad13427f3d71d6103e60772dd9e0979da5cf27c91adadf2393ba22581`, igual ao upstream. O master PROJECT foi recuperado com blob Git exato `bee5fb2d7deaeae947d29d0af21bf8a680dc0509`. Essa recuperação não contém toda a história/documentação atual do remoto; por isso a entrega é um **patch incremental R10-only**, sem substituir README/AGENTS/evidências históricas.

## O que mudou
Cliente TypeScript e CLI que usam somente rotas existentes; exemplo de configuração sem credenciais; 28 cenários; 39 testes de regressão; especificação e continuidade. O CLI padrão produz plano sem rede. Execução exige origem imutável confirmada, quatro tokens distintos e fixture sintética previamente provisionada. Rejeita chaves permanentes de integração, JWTs privilegiados, origem mutável/ambígua, corpo acima de64KiB e respostas inseguras. Timeout5s, sem retries ou redirects. Relatório sem corpos, tokens ou texto privado. Falhas interrompem novos envios; etapas restantes ficam bloqueadas.

Alterei o piso da suíte de aplicação do gate local de1200 para1241 para acompanhar a regressão atual. A aprovação histórica do R9 não é copiada para o novo fingerprint. O relatório da suíte hospedada NÃO é aceito como substituto dos gates PostgreSQL/browser.

Nenhum endpoint, permissionamento, migration, dependência ou modelo de domínio novo. API/interface0.19.0; schema0.18.0;11 migrations e lockfile preservados. Não houve alteração dos guards de runtime, do gate de produção ou da política de autoria.

## Verificações desta rodada
As evidências ficam em `evidence/` do pacote, fora do relatório canônico de homologação da aplicação.

| Verificação | Resultado | Evidência |
|---|---|---|
| Baseline R9 recuperado |1202/1202 aprovados |01-baseline.log |
| Regressão nova |39/39 aprovados |09-reviewed-green.log; final-tests.log |
| Aplicação completa |1241/1241 aprovados; sem skips/cancelamentos/TODO |10-full-tests.log; final-tests.log |
| CLI padrão |Plano, transporte none,28 checks not_run; sem rede |23-plan.json |
| Handler real + memória |28/28 cenários; transporte injected; sem homologação |24-injected-handler-report.json |
| Socket HTTP local |Incluído nos39; handler real e identidades sintéticas |final-tests.log |
| TLS local herdado |6 testes em loopback incluídos nos1241, sem prova pg/Function |final-tests.log |
| Instalação padrão |Não concluída; interrupção pelo limite externo da ferramenta |11-install.log;11-install-outcome.txt |
| Typecheck padrão |Não aprovado; tipos locais ausentes, além de diagnósticos iniciais posteriormente corrigidos |12-typecheck.log; final-typecheck-standard.log |
| Typecheck suplementar |Aprovado com TS5.8.3 e tipos globais Node25.1.0; não substitui lock/Node22types |16-typecheck-supplemental-final.log |
| Lock/migrations |Coerência e11 hashes aprovados; nenhum SQL executado |17-check-lock.log;17-check-migrations.log |
| Contratos/secrets |Estrutural18 operações e scan heurístico aprovados; não pentest |17-check-contracts.log;17-check-secrets.log |
| Build |Somente frontend estático aprovado, sem empacotar Function |18-build.log |
| PostgreSQL desta entrega |209 cenários existentes;0 executados nesta rodada, Docker ausente |19-postgres.log |
| Interface herdada |35HTTP em memória aprovados; navegador bloqueado por ERR_BLOCKED_BY_ADMINISTRATOR |22-ui.log |
| npm audit |Falhou EAI_AGAIN registry.npmjs.org |21-audit.log |
| Gate local do R10 |Não aprovado; não usar evidências antigas para liberá-lo |20-gate.log |
| Patch e cópia limpa |Resultado final registrado no manifesto e verification.json |verification.json; reapplied-tests.log |
| Hosted Function/Auth/M2M do R10 |Não executado; sem destino de homologação autorizado/sessões fornecidas |remote-state.json |

## Falhas e revisão preservadas
Os dois primeiros ensaios falharam ainda na preparação da fixture por uma Idempotency-Key menor que16 caracteres. Não foram contabilizados como prova da ausência da funcionalidade. Depois de corrigir a fixture, a ausência do módulo foi reproduzida; quatro testes negativos inicialmente capturavam qualquer rejeição, e foram ajustados para exigir o carregamento prévio do módulo.

O primeiro cliente confundiu a flag booleana internal_notes de capabilities com conteúdo privado. Outro teste esperava acesso M2M a um chamado humano, contrariando a política real; a fixture foi corrigida com um chamado de autoria da integração. Nenhuma regra do produto foi relaxada. A revisão acrescentou teste que falhou por falta de cancelamento de um corpo recusado pelos headers; o descarte foi corrigido e a regressão repetida. O deadline de corpo incompleto foi efetivamente exercitado por5s.

O typecheck também encontrou problemas locais de narrowing de unknown e da variável de ambiente tipada na fixture. Foram corrigidos e o typecheck suplementar terminou com saída0; não transformar isso em aprovação da instalação travada.

Revisão pelo mesmo executor; sem revisor independente, pentest, carga, restore ou teste de navegador hospedado.

## Efeitos externos e próximo passo
Somente leituras de metadados GitHub/Netlify. Sem push,PR,merge,deploy,migrations,provisionamento ou alteração de dados/usuários/segredos/gate. Os testes de domínio em memória e HTTP local usam dados sintéticos. GET hospedado pode incrementar contadores técnicos; somente leitura de domínio não é promessa de zero escrita técnica.

Próximo passo: integrar R10 sobre R9, repetir CI padrão, preparar sob autorização um destino de homologação com as quatro sessões e a fixture especificada e executar as28 verificações. Mesmo passando, login/refresh/logout, emissão/revogação M2M, mutações/idempotência hospedadas, conexão pg/TLS observada na Function, carga/restore e aceite continuam pendentes. M2 permanece posterior ao M1.
