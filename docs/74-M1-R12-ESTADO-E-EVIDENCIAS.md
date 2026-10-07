# Help Desk M1-R12 — Estado e evidências

**01/10/2026 — entrega local, não publicada, não homologada e não operacional. M1 aberto.**

## Base e escopo
GitHub reinspecionado: R9 integrado, 78bbb00112331531168ae24600604cb7f3148770. R10/R11 ainda locais. Bundle R8 fornecido + deltas R9 obtidos pelo conector + alterações R11 recuperaram o fingerprint exato 284f681dfe095b4ab7734d3baef73515f4c69084e52622c6a52f881b9996630a. O baseline passou nos 1.277 testes. Trata-se de recuperação de fonte executável, não da história ou documentação remota completa.

R12 implementa um cliente de aceitação de gravações básicas. Reutiliza os 28 controles R10 e acrescenta 18 verificações de capacidades/cobertura/criação/mensagem/prioridade/replay/conflitos/leituras finais. Cria somente recursos sintéticos em execução explicitamente autorizada, com executionId e chaves estáveis. Não muda o handler, domínio, RLS, schema ou endpoints.

## Resultados efetivamente obtidos nesta rodada
Caminhos relativos à pasta evidence/r12 do pacote.

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Baseline R11 | 1.277/1.277 aprovados, zero skips/cancelados/TODO | 01-baseline.log |
| Antes da implementação | 29 testes falharam por ausência do cliente | 02-write-red.log |
| Implementação inicial | 29/29 aprovados | 03-write-green-attempt.log |
| Primeira suíte completa | 1.306/1.306 aprovados | 04-full-tests.log |
| Revisão ampliada | 41/41 aprovados, incluindo socket, prazo real de 5 s e corpos hostis | 07-write-review.log |
| Coerência de cobertura | Novo teste falhou porque `resolved` com dois candidatos era aceito; após correção 42/42 passaram | 09-review-cardinality-red.log;10-write-final.log |
| Chave expirada | Novo teste falhou por falta de diagnóstico específico; após correção 43/43 passaram | 15-expiry-red.log;16-write-final.log |
| **Suíte completa final** | **1.320/1.320 aprovados**, 43 novos, zero falhas/cancelados/skips/TODO | 17-verify-final.log |
| Typecheck padrão/verify | **Falhou**, dependências/tipos locais ausentes. A etapa de aplicação do verify passou | 05-typecheck-standard.log;17-verify-final.log |
| Typecheck suplementar | TS2339 na variável env do teste reproduzido; corrigido com NodeJS.ProcessEnv. Saída 0 depois, com TypeScript 5.8.3 e tipos globais Node 25.1.0 | 06-typecheck-supplemental.log;08 e19-typecheck-supplemental*.log |
| npm ci | Interrompido por limite externo de 25 s, saída 124; nenhuma instalação aprovada | 11-install.log;11-install-exit.txt |
| npm audit | EAI_AGAIN no registry oficial; saída não capturada após timeout externo da chamada. Não aprovada | 12-audit.log;12-audit-exit.txt |
| PostgreSQL | 209 cenários existentes; **0 executados** nesta rodada. Docker ausente; sem servidor nativo disponível | 13-postgres.log |
| HTTP da demonstração | 35 checks aprovados, persistência em memória | 14-interface.log |
| Navegador | ERR_BLOCKED_BY_ADMINISTRATOR em page.goto; **0 checks aprovados** | 14-interface.log |
| Migrations/lock | 11 migrations preservadas e lock coerente; nenhuma execução SQL | 18-check-migrations.log;18-check-lock.log |
| Contratos/scan/build | 18 operações em verificação estrutural; scan heurístico; build somente frontend estático aprovado | 18-check-contracts.log;18-check-secrets.log;18-build.log |
| Gate | **Não aprovado**; não converter evidência histórica em aprovação R12 | 18-check-homologation.log |
| Plano do cliente | planned/none;28 + 18 etapas not_run, sem rede ou credenciais | 20-write-plan.json |
| Reaplicação | Duas variantes aplicadas em bases limpas, mesmos arquivos/fingerprint; suíte cumulativa 1.320/1.320 aprovada novamente | 25–28 e package-verification.json |

Os seis testes TLS reais herdados estão incluídos nos 1.320. Os 18 passos adicionais e 28 de preflight são cenários da aceitação, não testes somados separadamente aos 1.320 ou 209 testes SQL. A reprodução por socket usa HTTP loopback, handler real, identidades sintéticas e memória, e permanece marcada injected.

## Efeitos locais comprovados e limites
No modelo de referência, os testes demonstraram um ticket, uma mensagem e três eventos/três intenções de outbox, inclusive após perda de resposta depois da criação, mensagem e prioridade, seguida de nova invocação deliberada com as mesmas chaves. Os replays dentro da execução ocorrem somente depois de uma confirmação válida; falha incerta bloqueia os envios seguintes. O cliente recusa chave expirada sem criar chave alternativa.

Isso não prova locks/RLS, atomicidade PostgreSQL, entrega de outbox, política contratual privada, Function, autenticação hospedada, TLS do destino ou capacidade. Esses campos permanecem false. O relatório é um diagnóstico, não autorização de produção ou atestação independente.

## Revisões e correções
A revisão identificou: (a) tipo de env da fixture sem propriedade NODE_TEST_CONTEXT, corrigido sem relaxar tsconfig; (b) cardinalidade incoerente em resolved, recusada antes de gravações; (c) necessidade de diagnóstico seguro para idempotency_expired. Os testes antes/depois foram preservados. Utilizados os mesmos nomes de variáveis de sessão do R10 para evitar configuração paralela.

Revisão pelo próprio executor; **sem revisão independente, subagente ou pentest**. Fonte externa RFC 9110 fundamenta If-Match/412, não comprova o resultado de testes; fonte de comportamento de replay é o código existente do Help Desk.

## Riscos e continuidade
A origem imutável e environment=production são declarações, não prova de isolamento do backend. O operador precisa conferir o Supabase e os canais/consumidores de outbox do ambiente. Recursos sintéticos permanecem para auditoria; não há cleanup ou exclusão automática.

Nova invocação exige o mesmo JSON lógico, executionId, coverageId, principais e chaves, dentro da janela de idempotência ainda preservada pelo servidor. O cliente não prova que o cache não foi eliminado; após expiração/purga, mudança contratual ou perda de autorização, interromper e reconciliar manualmente antes de outro comando. Não alterar executionId para contornar erro. A resolução atual de cobertura/preflight pode bloquear recuperação após mudança de pré-requisitos; isso não muda o direito de replay histórico do produto.

Sem migrations/dependências/endpoints/permissões novos. API/interface 0.19.0, schema 0.18.0, 11 migrations e lock preservados. Piso de aplicação: 1.320; SQL: 209; HTTP/browser: 71. M2 não iniciado.

**Nenhum push, PR, merge, deploy, migration remota, alteração de usuários, grants, dados, buckets, MFA, segredos ou gate de produção. Nenhuma sessão/credencial remota foi lida ou utilizada.** As duas variantes de patch são alternativas. O fingerprint final e commit local estão no manifesto externo para evitar autorreferência.
