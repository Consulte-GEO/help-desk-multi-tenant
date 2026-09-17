# Help Desk v0.9.0 — Estado e evidências

**Entrega local; M1 aberto; não publicada.** Base v0.8.0: `ce9a49e0e7616fc8a4a6425c478d6218499bd177`. Branch `work/helpdesk-v0.9.0`. Commit final no manifesto externo/bundle. Logs em UTC, 16/09/2026.

## Implementação
Assumir para si ou liberar responsabilidade de um chamado; liberação administrativa de outro, nunca tomada silenciosa. Motivo privado, versão, idempotência, disputa entre agentes e no-op. Responsabilidade não concede acesso. Histórico interno sem evento externo; DTO da equipe não expõe principalID. Interface com motivo separado, retry estável e atualização explícita de conflitos. Projeções antigas/novas validadas.

API/interface/schema candidato0.9.0. Oito migrations, 23 tabelas, 18 operações/14 caminhos. Migration008 adiciona coluna nullable, guards, evento, narrow grant e extensão do cache. Sete anteriores intactas por bytes/hash. Nenhuma função ou migration executada remotamente.

## Resultados
| Verificação | Resultado | Evidência |
|---|---|---|
| Base | 569 passagens antes de alterações | m1h/00-baseline-tests.txt |
| Local final | **635 passagens, zero falhas/cancelados/skips**, 66 novas | m1h/final-tests.txt |
| HTTP loopback | **28 checks**, dados fictícios em memória | m1h/11-ui-attempt.txt; final-http-smoke.json |
| Tipagem suplementar | Passou com tipos/compilador globais | m1h/final-typecheck-environment.txt |
| OpenAPI estrutural | 18 operações/14 caminhos | m1h/final-contracts.txt |
| Sintaxe/IDs HTML | JS/Python válidos; IDs literais resolvem, sem duplicados | m1h/static-checks.json |
| Build | Assets somente, não Functions | m1h/final-build.txt |
| Scanner heurístico | Nenhum padrão reconhecido; não auditoria integral | m1h/final-secrets.txt |
| Migrations001–007 | Mesmos bytes/hashes da base | m1h/migration-integrity.json |
| npm run verify padrão | **Falhou (2)**, dependências/tipos locais ausentes | m1h/16-manifest-verify-attempt.txt |
| Homologação agregada/publicação | **Recusadas**, lock ausente bloqueia etapas | m1h/final-homologation.txt; final-release-gate.txt |

Caminhos acima relativos à pasta evidence. A suíte usa memória, estado puro e doubles do driver além de asserções estruturais. Nenhuma contagem local deve ser somada a SQL/browser escritos. A corrida entre agentes foi executada em memória com serialização local; locks/disputa em instâncias distintas dependem dos testes PostgreSQL pendentes.

A tipagem suplementar usou `--typeRoots /opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/node_modules/@types`. Não é npm ci dos tipos fixados no manifesto. Não omitir a falha do comando padrão.

## Regressões e revisão
Comando:38 falhas→38 passagens. UI/contrato:9 falhas/12 passagens→21 passagens. Projeção de evento:5 falhas/2 passagens→7 passagens. Logs red/green em m1h/01–05 e12–13.

Revisão identificou snapshot antigo sem assignedTo, aceitação de razão malformada/coerção de action na projeção e fixtures de versão/tipos desatualizados. Corrigidos com regressões. Declarações JS agora expõem operações nullable; testes antigos receberam asserts explícitos, não remoção de expectativas. Detalhes em m1h/local-review.md.

## Não homologado
**Dependências:** nova tentativa EAI_AGAIN registry.npmjs.org, sem lockfile, npm ci ou audit. Registro m1h/14-dependencies-attempt.txt.

**PostgreSQL:** Docker/servidor ausentes; runner recusou antes de conectar. **100 casos escritos, zero executados**, 18 novos. Sem parser SQL/servidor instalado; sentinelas não validam sintaxe/semântica do PL/pgSQL. Grants, RLS, FK, triggers, locks, no-op, reautorização e upgrade continuam candidatos. m1h/15-database-attempt.txt.

**Browser:** **25 checks escritos, zero aprovados**, três novos. HTTP28 passou, depois ERR_BLOCKED_BY_ADMINISTRATOR em page.goto. Sem certificação visual/teclado/390px ou E2E DOM. m1h/11-ui-attempt.txt.

**Destino/operacional:** Auth/pooler/TLS/IP/Functions, capacidade, restore e revisão independente pendentes. Não houve inspeção remota nesta rodada. Nenhum push/PR/merge/deploy/migration, dado/segredo/MFA alterado.

## Continuidade
Revisar árvore real de dependências → instalar/testar PostgreSQL17 fresh+upgrade001–007→008 → runtime/Auth/Functions → browser25 → capacidade/restauração/revisão. Gate atualizado:635 locais/100 SQL/53 HTTP+browser. A recusa esperada do gate não é aprovação de subsistema. M2, filas, participantes, SLA, anexos, worker e suporte incorporado não foram entregues.
