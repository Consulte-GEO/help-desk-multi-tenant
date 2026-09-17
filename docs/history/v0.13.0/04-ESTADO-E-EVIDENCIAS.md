# Help Desk v0.13.0 — Estado e evidências

**Entrega local, não publicada. M1 permanece aberto.** Base v0.12.0: `a0928abdff3b1bc01653c7af4a1b207af179d32e`. Branch `work/helpdesk-v0.13.0`. Logs desta rodada em `evidence/v013/`, UTC de 17/09/2026. O hash final do código está no manifesto externo e bundle.

## 1. Implementação

GET individual de chamado passa a devolver `available_actions` calculado com principal atual, regras existentes de política/workflow e o mesmo ticket/versão. Não há nova autorização de escrita, coluna, migration ou endpoint. A interface deixa de decidir transições/escrita de notas pelo papel do `/me` e passa a validar as orientações de cada detalhe. Permissões de leitura e escrita das notas permanecem independentes. Respostas de comandos, listas e reenvios preservam o formato anterior, sem disponibilidade antiga armazenada.

Carregamento do detalhe separa a conversa pública obrigatória das notas opcionais. Falha ou página inválida de notas limpa os itens privados antigos, apresenta aviso e desabilita a escrita de nota até atualizar; conversa pública permanece disponível. Falha na conversa pública ou no pacote de ações não é convertida em sucesso vazio. Respostas atrasadas são descartadas. Na atualização, controles ficam bloqueados sem mudar o canal/rascunho; nenhuma mutação é repetida.

API/interface **0.13.0**; schema esperado **0.9.0**. Oito migrations, 23 tabelas candidatas, 18 operações/14 caminhos. Todas as oito migrations anteriores preservadas por bytes e manifesto. Novo frontend requer backend 0.13.0: ausência de `available_actions` bloqueia o detalhe, sem fallback ao papel local. O GET mudou de schema `Ticket` para `TicketDetail` na OpenAPI; consumidores com validação estrita devem atualizar seu contrato.

## 2. Verificações executadas

| Verificação | Resultado e alcance | Evidência em `evidence/v013/` |
|---|---|---|
| Base antes das alterações | 753 testes aprovados | `00-baseline-tests.txt` |
| Suíte final Node | **789 aprovados; zero falhas, cancelados, ignorados e TODO** — 36 novos | `final-tests.txt` |
| HTTP real em loopback | **35 checks aprovados**, persistência em memória | `final-http-smoke.json`, `final-ui-attempt.txt` |
| Três testes novos de socket/loader | Incluídos nos 789; perfis e falhas controlados | `12-http-actions.txt` |
| Manifesto migrations | Oito arquivos íntegros; não executa SQL | `final-migrations.txt`, `migration-integrity.json` |
| TypeScript com dependências declaradas | **Falhou (2)**: tipos locais ausentes | `final-typecheck-standard.txt` |
| TypeScript suplementar | Aprovado com compilador/tipos globais já disponíveis | `final-typecheck-supplementary.txt` |
| `npm run verify` padrão | **Falhou (2)** depois de passar migrations e 789 testes, na checagem de tipos | `final-verify-standard.txt` |
| Contrato, sintaxe, build e scan | Aprovados no alcance abaixo | `final-contracts.txt`, `final-syntax.json`, `final-build.txt`, `final-secrets.txt` |
| Homologação/publicação | **Não aprovadas**; falta lock real | `final-homologation.txt`, `final-release-gate.txt` |

Os testes locais incluem domínio, handlers, sockets reais com dados sintéticos, estado puro e respostas controladas do driver. Não provam RLS, autenticação do provedor, Netlify ou DOM. A checagem OpenAPI é estrutural, não validação integral de conformidade. O build é de assets estáticos, não bundle das Functions. Scan por padrões não é auditoria de supply chain/pentest. Compilador global 5.8.3/Node22.16.0; tipos globais diferem dos fixados no manifesto.

## 3. Regressões e revisão

- Disponibilidade no GET: 11 falhas e uma passagem na base; 12 aprovações após implementação (`01–02`).
- Módulo do detalhe: tentativa inicial falhou na importação ausente; não foi apresentada como 15 falhas comportamentais. Depois 15 testes passaram (`03–04`).
- Integração estática: dois checks falharam por IDs novos ausentes no HTML e módulo ausente nos assets. Corrigidos e aprovados (`05–06`). Não comprovam DOM.
- Canal do rascunho durante refresh: duas falhas reproduzidas; duas aprovações após separar pausa de troca de canal (`08–09`).
- Contrato GET versus snapshots: uma falha/duas passagens antes de atualizar o schema; três aprovações depois (`10–11`).
- Suíte de socket: falha de notas preserva só conversa pública; operador read-only não consulta notas nem escreve mesmo após alterar hints; revogação reduz ações sem alterar a versão (`12`).
- Primeiro smoke novo tentou `new → resolved`, caminho inválido. Corrigido o **cenário** para `new → open → resolved`, sem relaxar workflow (`20–21`).
- Unicode: um teste reproduziu recusa de leitura de texto válido com caracteres suplementares; limite alinhado à projeção de leitura existente e teste aprovado (`22–23`). Isso não altera o limite de escrita preexistente.
- Typecheck apontou indexação possivelmente indefinida em um fixture; corrigida antes da checagem suplementar final.

Revisão local do diff/contrato/limites, registrada em `local-review.md`. Não houve revisor independente, subagente, pentest, carga ou restore.

## 4. Bloqueado ou não executado

**Dependências:** `npm run deps:resolve` retornou `EAI_AGAIN registry.npmjs.org`, na resolução de `@netlify/functions`. Sem package-lock real, npm ci/audit ou árvore instalada revisada. Não houve registry alternativo ou alteração de política. Tentativa em `18-dependencies-attempt.txt`.

**PostgreSQL:** `npm run test:db:local` recusou Docker ausente antes de conectar. Continuam **125 cenários escritos, zero executados nesta rodada**, incluindo upgrade. Sem nova suíte SQL, migrations ou teste remoto substituto. Tentativa em `19-db-attempt.txt`.

**Navegador:** executor passou os 35 HTTP e bloqueou em `page.goto` com `ERR_BLOCKED_BY_ADMINISTRATOR`, antes das asserções. Há **35 verificações escritas: 30 principais (27 anteriores + 3 novas) e cinco humanas com provedor sintético**. Zero aprovadas nesta execução; a segunda suíte não foi alcançada pelo runner após a falha da primeira. Sem validação visual/teclado/mobile/CSP/CORS.

**Destino/operacional:** Auth real/pooler/TLS/IP/Functions, capacidade/latência, backup/restore, logs de ingresso e política de sessão continuam pendentes. Hints não eliminam a janela de JWT já emitido, não são garantia de que um comando posterior será aceito e não habilitam notificações/SLA/anexos/administração.

O gate agora exige no mínimo789/125/70 (locais/SQL/HTTP+browser) efetivamente aprovados sem skips. Nesta rodada o lock falhou e as etapas dependentes ficaram bloqueadas; não foram consideradas verdes por resultados locais separados. Relatório não assinado, sujeito à revisão.

## 5. Efeitos externos e próximo passo

Nenhuma escrita remota: sem push/PR/merge/deploy/migration, alteração de dados, usuário, segredo ou MFA. Não houve reinspeção de GitHub/Supabase/Netlify nesta rodada; as observações anteriores são históricas.

Prioridade permanece: dependências reais → PostgreSQL17/upgrade125 → Auth/pooler/Functions → navegador35 → capacidade/restore/revisão operacional. M1 aberto, M2 não iniciado. Esta entrega resolve divergências da interface do núcleo atual; não substitui essa homologação.
