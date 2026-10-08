# Consulte GEO — CG-02a: medição e ciclo de vida de fixtures

Registro de implementação pré-CI, 08/10/2026. Plano de referência: anexo do usuário «Help Desk Consulte GEO — plano de implantação», CG-01–CG-21. Esta fatia cobre somente os dois primeiros itens de CG-02; CG-02 não está concluído.

## Base inspecionada

Repositório Consulte-GEO/help-desk-multi-tenant, branch padrão codex/m1-reproducibilidade, SHA 796face60367e2573d112b7ae42d570055474348. O deploy de produção 6ac807ef1d6686000887ce64 do site helpdesk-consultegeo foi consultado no Netlify e aponta para esse SHA. API 0.27.0/schema 0.19.0 preservados. PR22 já integrado; não reaplicar sua entrega.

A continuidade canônica informa atendimento fechado, HD-P03/M1 operacional pendentes, sem aceite hosted de Auth, capacidade ou restore. Evidências anteriores são históricas e não aprovam esta fonte nova.

## Correções

1. `runBoundedWorkload` passa a verificar cada leitura contra a leitura imediatamente anterior de todos os workers daquela execução, não só contra a admissão ou início da mesma tarefa. Sequência `0,10,20,15,25` rejeita antes de executar a segunda tarefa. NaN/infinito continuam recusados; leitura igual continua permitida. Histórico não é global entre execuções. Após fatal, nenhuma tarefa nova é admitida e os trabalhos já admitidos são aguardados.
2. Os dois cenários SQL existentes passam pelo mesmo `withCapacityFixture`: fingerprint antes de adquirir a fixture; a factory mantém responsabilidade pelo cleanup de setup parcial; após retornar, o wrapper encerra seu pool em `finally`, aguardando o encerramento exatamente uma vez. Falha de fingerprint não adquire pool; erro de cenário ou cleanup não vira aprovação.

Sem mudanças em runtime, endpoints, contratos de produto, dependências, lock, migrations, SQL de domínio, grants, fatores Auth, providers ou gates. O helper é exclusivamente do harness de testes e não cria runner hosted alternativo.

## Evidências locais desta implementação

Fonte local: recorte de arquivos conferidos por Git blob SHA, não clone completo. Git direto estava indisponível por DNS; GitHub conectado foi usado para leitura e gravação da branch. Node 22.16.0.

- Baseline: 10/10 testes focais existentes aprovados.
- RED clock: 18 casos, 16 aprovados e 2 falhas `Missing expected rejection`, reproduzindo retrocesso entre tarefas e entre workers.
- GREEN clock: 18/18 aprovados.
- RED fixture: extração sem alteração de comportamento do fluxo antigo; 6 casos, 2 aprovados e 4 falhas por ordem/aquisição indevida.
- GREEN conjunto: 24/24 aprovados, nenhum skip; 14 regressões novas mais 10 casos preservados. Sintaxe do scenario SQL e `git diff --check` aprovados.

Comando focal: `node --experimental-strip-types --test --test-reporter=tap tests/capacity-report.test.ts tests/capacity-clock.test.ts tests/capacity-fixture.test.ts`.

Suíte integral, typecheck, contratos, migrations, secret-scan, build, audit, PostgreSQL17 e browser não foram executados neste recorte. Devem ser comprovados pelo workflow existente, na fonte desta branch. Resultado posterior deve ser associado ao run/attempt/artefato/digest/fingerprint, sem editar contagens ou reaproveitar o resultado de PR22.

## Bloqueios e continuidade

CG-01 permanece sem contrato Novo GEO verificado. A especificação complementar não foi recuperada no caminho consultado `docs/superpowers/specs/2026-10-08-helpdesk-consultegeo-design.md`; isso não demonstra inexistência em outro local ou no workspace do autor. Não inventar issuer, endpoints, identidade pairwise, owners, políticas ou coorte.

CG-02 ainda exige ajuste/verificação do aviso QR, política de acesso/contingência, assurance administrativo sem impedir setup legítimo, gates integrais e preflight/read atuais. Os scopes de Thiago continuam `contexts:resolve` e `tickets:read`; esta entrega não os amplia.

Antes de integrar: revisão independente da branch, inspeção do diff e da base, CI oficial e importação de evidências pelo fluxo existente. Este executor realiza autorrevisão, não uma revisão independente. Não fazer merge/deploy para contornar um gate pendente. Nenhum piloto/conta/categoria é liberado por este documento.
