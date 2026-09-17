# Help Desk v0.18.0 — Estado e evidências

**Entrega local, não publicada. M1 permanece aberto.** Base v0.17.0: `07dc51f263fbf2dcd49f4605bec0c1a43d57e2ca`. Branch `work/helpdesk-v0.18.0`. Execuções em17/09/2026; logs em UTC. O hash final da entrega está no manifesto externo e no bundle Git.

## 1. Implementado nesta rodada

R18-01: `addNote` deixa de exigir UPDATE na leitura do pai para um operador com tickets:read/notes:write. Migration011 substitui o bloqueio do helper privado de conversa por NO KEY UPDATE, sem expansão de acesso. R18-02: INSERT e UPDATE do Store exigem confirmação explícita do tipo do comando e de uma linha; UPDATE0 válido mantém412, resposta inválida gera503 e interrompe antes do COMMIT. Nenhuma nova tela, endpoint ou dependência.

API/interface/schema candidato **0.18.0**. Onze migrations,25 tabelas,18operações/14caminhos. Dez migrations anteriores preservadas byte a byte; a011 é candidata não aplicada. Detalhes/razões/fontes em documento22.

## 2. Resultados executados

Todos os caminhos são relativos ao repositório. Logs da rodada em `evidence/v018/`.

| Verificação | Resultado e alcance | Evidência |
|---|---|---|
| Base reproduzida antes de alterar | 982 testes aprovados | `00-baseline-tests.txt` |
| Suíte local final | **1002 aprovados;0falhas/cancelados/ignorados/TODO** —20novos | `final-tests.txt`, extraído da execução final do verify |
| Três novos casos HTTP/driver controlado | Incluídos nos1002, não testes de PG | `06-http-and-guards-green.txt` |
| Smoke HTTP da demonstração | **35 checks aprovados**, persistência em memória | `12-ui-attempt.txt` |
| Integridade das migrations | 11arquivos conferidos;10anteriores intactos | `final-migrations.txt`, `migration-integrity.json` |
| TypeScript suplementar | Aprovado com tipos/compilador disponíveis globalmente | `final-typecheck-supplementary.txt` |
| Verificação padrão com manifesto | **Falhou, código2**, após migrations/1002testes;tipos/dependências locais ausentes | `final-verify-standard.txt`, `verify-exit.json` |
| OpenAPI estrutural | 18operações e referências verificadas; não conformance integral | `final-contracts.txt` |
| Sintaxe JS/MJS e AST Python | 28arquivos verificados | `final-syntax.json` |
| Build | Assets estáticos aprovados, **não** bundle de Functions | `final-build.txt` |
| Scan heurístico | Sem padrão reconhecido de segredo; não pentest/audit de dependências | `final-secrets.txt` |
| Homologação agregada/publicação | **Não aprovadas**;lock falhou, etapas dependentes blocked | `final-homologation.txt`, `final-release-gate.txt`, `evidence/homologation/latest.json` |

A suíte local contém regras, sockets reais, estado puro, integridade de arquivos e doubles. **Não prova SQL, RLS, triggers, locks, Supabase Auth, Netlify ou DOM.** O fake novo modela apenas o protocolo e a interseção de policies relevante ao caso de nota. Confirmações de banco controladas não são confirmação de banco real.

O teste HTTP que suprime o INSERT do recibo verifica503, erro seguro, ROLLBACK, ausência de COMMIT e nenhum estado parcial. Depois uma tentativa explícita com a mesma chave cria uma nota, e o replay não duplica. Nenhuma requisição envia essa falha ao servidor real.

## 3. Falhas reproduzidas e ajustes

- Regressores iniciais:17testes,14falhas/3passagens na base. Após correção:17passagens. Logs `02-regressions-red.txt`, `03-regressions-green.txt`.
- Primeira execução completa:999testes,992passagens e7falhas por contagem/versão do schema desatualizadas nos testes. Atualizados somente esses valores; hashes/permissões preservados. Log `04-full-suite-first.txt`.
- Ao acrescentar3HTTP, um assert usou o campo incorreto add_message em vez do reply existente. Corrigido o teste, não a API. `05-http-and-guards.txt` e `06-http-and-guards-green.txt`.
- Revisão dos cenários SQL alinhou duas expectativas à regra documentada de USING: linha filtrada não precisa lançar42501. As novas assertions exigem zero linhas e estado inalterado; ainda não executadas.
- Revisão do diff registrada em `local-review.md`. Não houve revisor independente/subagente.

## 4. Tentativas bloqueadas

**Registry:** `npm run deps:resolve` falhou EAI_AGAIN ao consultar registry.npmjs.org. Nenhum lock real, instalação limpa ou auditoria foi concluída. Não houve proxy/registry alternativo ou alteração de política. Evidência `10-dependencies-attempt.txt`.

**PostgreSQL:** `npm run test:db:local` recusou Docker indisponível antes de conectar (`11-db-attempt.txt`). O ambiente não possui servidor PostgreSQL instalado. Não houve fallback remoto nem troca de usuário/política. São **196 cenários escritos:180principais+16upgrade;9novos**. Zero executados contra servidor nesta sessão. A consulta, ACL, compatibilidade de locks, concorrência e upgrade ainda não estão comprovados.

**Navegador:** depois dos35checksHTTP, Playwright bloqueou em page.goto com ERR_BLOCKED_BY_ADMINISTRATOR, antes das asserções. Permanecem36checks escritos sem aprovação; a suíte humana seguinte não foi alcançada. Nenhuma aprovação visual/mobile/teclado/CSP/CORS.

**Runtime/operação:** Auth humano/M2M, pooler/TLS, driver instalado, IP/Functions, carga, retenção, logs do provedor, restauração e revisão independente pendentes. M1 não foi encerrado; R14-04/05/06 continuam candidatos em banco.

Os gates1002/196/71 exigem testes efetivamente aprovados sem skips. Não foram reduzidos ou substituídos por mocks. A aprovação futura local não autoriza produção automaticamente.

## 5. Efeitos externos e recuperação

**Nenhuma inspeção ou escrita remota nesta rodada.** Sem push/PR/merge/deploy, migration remota, mudança de dados, contas, segredos, MFA ou infraestrutura cobrada. As leituras históricas não são afirmação do estado atual. Reinspecionar destinos antes de integrar.

O pacote contém código acumulado, patch e bundle para recuperação. O log da recuperação e verificação do bundle é anexado ao pacote depois do commit, sem alterar a árvore testada. Versões anteriores dos documentos04/05 foram preservadas em docs/history.
