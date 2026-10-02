# Help Desk M1-R16 — Estado e evidências

**Data:** 01/10/2026. **Implementado e testado localmente. Não publicado, homologado ou operacional. M1 aberto.**

Base remota consultada: R9 `78bbb00112331531168ae24600604cb7f3148770`. Fonte local R15 recuperada do pacote com SHA-256 `22c08fc0dd95347dd4900989fc9f83a5aad34ab82564d7d935d5e3635d1f1638`; seus 320 arquivos inventariados foram conferidos. Fingerprint executável R15: `41cef90c7d1013cff2eeed333f99dbe4d7e6d910dc5ca63dbf7ee6e67da9d1ae`. A reconstrução tem história Git local própria, não a história completa upstream. Commit final e fingerprint no manifesto externo.

## Entrega e alcance
A suíte de gravações R15 não reexaminava o estado humano depois das recusas M2M, nem verificava a coleção privada de notas do chamado recém-criado pela integração. A reprodução controlada inseriu efeitos por uma identidade autorizada de teste, mantendo respostas 403/404 para o cliente. A suíte antiga aprovou resultados com nota ou mensagem persistidas e com timestamp alterado. Isso é um ponto cego da aceitação, não um bypass constatado na autorização do Help Desk.

R16 acrescenta quatro GETs finais no modo M2M: notas vazias e completas pelo agente A; chamado, mensagens e timeline públicos humanos inalterados após as recusas. Comparações canônicas vivem somente na memória e não entram no relatório. `available_actions` é consultivo e não entra no snapshot. Qualquer divergência ou indisponibilidade reprova/interrompe, sem correção automática.

O plano M2M tem 43 etapas, das quais 39 anteriores e 4 novas leituras; os 28 controles R10 permanecem separados. Modo humano continua com 18. Hash da mesma configuração, chaves, identidades, intenções de gravação e ordem dos passos anteriores foram comparados com R15 e permanecem iguais. Nenhuma autorização antiga substitui autorização atual de execução.

## Verificações desta rodada
Caminhos relativos a `evidence/m1-r16/`. As evidências herdadas ficam em pastas distintas e não são aprovações deste código.

| Verificação | Resultado efetivo | Arquivo |
|---|---|---|
| Fonte R15 | Fingerprint igual ao manifesto | 01-source-fingerprint.txt |
| Baseline R15 | 1.364/1.364, sem skips | 05-baseline.log; 05-baseline.exit |
| RED | 11 testes falharam antes da correção; três deles demonstram aprovação falsa do cliente antigo | 10-red.log; 10-red.exit |
| GREEN focal novo | 11/11 aprovados | 11-green.log; 11-green.exit |
| Regressão de gravações | 71 testes Node aprovados; são subconjunto da aplicação, NÃO os 71 checks HTTP/browser do gate | 12-focused-regression.log |
| Suíte completa | 1.375/1.375, 11 novos, zero falhas/cancelamentos/skips/TODO | 13-final-tests.log; 22-verify.log |
| Instalação padrão | Não aprovada; interrompida após 15 s de tentativa sem conclusão | 06-install.json; 06-install.log |
| TypeScript padrão | Exit 2, TS2688: tipos locais node/pg ausentes | 07-typecheck.log; 22-verify.log |
| PostgreSQL | 209 cenários existentes, zero executados; Docker ausente, sem fallback remoto | 08-postgres.log; 08-postgres.json |
| Audit | Exit 1; EAI_AGAIN no registry oficial | 09-audit.log; 09-audit.json |
| Interface | 35 HTTP em memória passaram; browser bloqueado antes das asserções por ERR_BLOCKED_BY_ADMINISTRATOR | 14-interface.log; 14-interface.exit |
| TypeScript suplementar | Exit 0 com TypeScript 5.8.3 e tipos globais Node 25.1.0 | 15-typecheck-supplemental.log; 15-typecheck-supplemental.exit |
| Migrations | 11 arquivos íntegros; nenhum SQL executado | 16-migrations.log |
| Lock | Coerência aprovada e bytes preservados | 17-lock.log; integration-verification.json |
| Contratos | Verificação estrutural de 18 operações aprovada; não conformidade OpenAPI integral | 18-contracts.log |
| Build | Somente frontend estático aprovado | 19-build.log |
| Segredos | Scan heurístico sem padrão reconhecido; não pentest | 20-secrets.log |
| Gate | Não aprovado: ausência de evidência completa para a fonte nova | 21-gate.log |
| `verify` | 1.375 testes passaram, mas comando terminou em exit 2 no typecheck padrão | 22-verify.log; 22-verify.exit |
| Planos R15 x R16 | Configuração/hash/chaves/passos anteriores preservados nos modos M2M, legado e false | 23-plan-compatibility.json |
| Integração em fontes limpas | Variantes sobre R9 e R15 conferidas por hashes/fingerprint; suíte na variante cumulativa: 1.375/1.375 | integration-verification.json; 24-clean-tests.log |

Os 6 testes TLS de loopback herdados e o socket HTTP de gravações M2M estão incluídos nos 1.375. O handler é real, mas autenticação e persistência desses percursos são sintéticas. As 4 novas leituras não são somadas como testes PostgreSQL.

## Tentativas e revisão
Uma primeira execução do baseline foi interrompida pelo limite de 45 s da chamada de ferramenta antes de emitir resumo (`02-baseline.log`); ela NÃO foi usada como aprovação. A execução completa posterior está em `05-baseline.log`. Uma tentativa de alocar sessão de streaming da ferramenta foi recusada pelo ambiente antes de executar; a execução seguinte foi capturada em arquivo e acompanhada nesta mesma sessão.

A correção passou nas 11 regressões na primeira implementação. O comando de apresentação terminou com status 1 somente porque o `grep` final não encontrou falhas; o exit do teste salvo em `11-green.exit` é 0 e o resumo TAP comprova 11/11. Duas expectativas antigas de comprimento 39 foram atualizadas para 43 sem retirar asserções. O mínimo da aplicação no gate aumentou de 1.364 para 1.375; os demais gates não foram afrouxados.

Revisados escopo das identidades, ausência de mutações extras, reenvio com mesmas chaves, tratamento de coleções incompletas, snapshot estável, falha de rede e ausência de dados privados no relatório. Revisão pelo próprio executor; não houve revisão independente ou pentest.

## Limites e estado remoto
Leituras finais não provam ausência universal de efeitos: registros de outra conta inacessíveis, audit/outbox privados, efeitos transitórios, concorrência e atomicidade continuam dependentes de SQL/observação independente. Divergência não prova causalidade; pode decorrer de mudança concorrente e exige reconciliação. Uma resposta 403/404 registrada como `outcome: rejected` descreve a recusa HTTP, não comprova inexistência de escrita.

Não houve inspeção de dados hospedados, teste autenticado remoto, alteração de usuário, dado, segredo, gate ou migration, push/PR/merge/deploy. Netlify e Supabase não foram reinspecionados nesta rodada; seus estados históricos não são apresentados como atuais. O GitHub foi consultado somente para confirmar base e handoff.

API/interface 0.19.0; schema 0.18.0; 11 migrations, lockfile, core, permissões e dependências preservados. M2 não iniciado. O pacote é para integração e revisão, não upload direto no Netlify.
