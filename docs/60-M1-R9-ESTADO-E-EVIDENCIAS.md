# Help Desk M1-R9 — Estado e evidências

**29/09/2026. Entrega local; M1 aberto. Não publicada, não homologada e não operacional.**

Base local R8: `ebb598af29a187c20d71d7395edabe3b722eebd0`. Remoto observado: branch `codex/m1-reproducibilidade`, commit `b9481b9fabde2fd9c442e44099bc17608b59571a`. Branch desta rodada: `work/m1-r9-validacao`. Commit final no manifesto externo. Recuperação local via bundle, não história upstream completa.

## Implementação
No gate existente, `validateReport` e `verifyLogs` passam a exigir uma entrada por etapa, o arquivo `<etapa>.log` correto e um único diretório de execução. A conferência física recusa redirecionamento por links simbólicos intermediários. Sem novo comando, dependência, endpoint, permissão ou mudança de atendimento. API/interface 0.19.0, schema 0.18.0, 11 migrations e lockfile preservados.

A reprodução sintética tinha hashes e contagens consistentes mas caminhos de execuções diferentes. O CLI existente aprovou esse relatório antes da correção. Também foi reproduzida a aceitação de log de instalação em lugar de auditoria. Isso demonstra uma insuficiência de validação local; não comprova incidente ou publicação indevida no destino. O relatório não passa a ser uma atestação assinada e a correção não detecta toda cópia/fabricação deliberada dos bytes e metadados.

## Verificações nesta rodada
Evidências próprias em `evidence/m1-r9-20260929/`; verificações pós-commit/pacote em `verification/` do ZIP.

| Verificação | Resultado e limite | Log |
|---|---|---|
| Pacote R8 de entrada | SHA-256 externo coincide; 1.323 itens do inventário conferidos | 18-review.json |
| Baseline | 1.192 Node aprovados | 01-baseline.log |
| Regressão antes da correção | 8 testes: 7 falhas por aceitação indevida e 1 controle aprovado | 02-red.log |
| Regressão após a correção | 8 aprovados, incluídos na suíte completa | 03-green.log |
| Aplicação final | **1.200 aprovados, 8 novos; zero falhas, cancelamentos, skips ou TODO** | 04-regression.log |
| Instalação travada | **Não concluída**; comando interrompido no limite externo de 15s e processo próprio encerrado. Nenhum registry alternativo usado | 05-install.log; checks.json |
| TypeScript padrão | Falhou, código 2; definições locais de Node/pg ausentes | 06-typecheck.log |
| Migrations | 11 arquivos conferidos, nenhum SQL executado | 07-migrations.log |
| Lockfile | Coerência aprovada; bytes preservados | 08-lock.log |
| npm audit | Falhou: EAI_AGAIN no registry oficial | 09-audit.log |
| PostgreSQL | Runner recusou Docker indisponível; **209 cenários escritos, zero executados nesta rodada** | 10-postgres.log |
| HTTP/browser | **35 HTTP em memória aprovados**; browser bloqueado por ERR_BLOCKED_BY_ADMINISTRATOR antes das asserções | 11-browser.log |
| Contrato HTTP | Verificação estrutural aprovada | 12-contracts.log |
| Scan de segredos | Sem padrões reconhecidos; não auditoria completa ou pentest | 13-secrets.log |
| Build | Frontend estático aprovado; não build de Functions | 14-build.log |
| Gate de publicação | Recusado; não há homologação válida deste fingerprint | 15-gate.log |
| verify completo | Aplicação 1.200 passou; comando falhou na checagem TypeScript | 16-verify.log |
| TypeScript suplementar | Passou com TypeScript 5.8.3 e tipos globais Node 22.19.7; **não substitui os tipos 22.15.30 do lock** | 17-typecheck-supplemental.log |

Os oito testes novos usam arquivos e subprocesso Node reais, mas entradas de evidência sintéticas, exclusivamente em diretórios temporários. As contagens sintetizadas nesses arquivos NÃO são aprovações PostgreSQL ou browser. Nenhum cenário SQL foi acrescentado, removido ou aprovado nesta rodada. Os seis testes TLS em loopback herdados continuam incluídos nos 1.200 Node, não são testes do driver pg ou do Supabase.

## Revisão e riscos
Revisão pelo mesmo executor, sem revisor independente. Foram preservados schema 1 do relatório, fingerprints, hashes, validade, contagens, bloqueio da liberação e regras do domínio. Uma referência coerente a uma pasta não prova por si só que o conteúdo foi produzido nessa execução; a proveniência ainda depende do runner e de revisão das evidências reais. As falhas de rede/browser não foram contornadas. Tentativas de obter dependência e fonte oficial PostgreSQL não produziram instalação disponível; nenhum servidor PostgreSQL foi instalado ou iniciado.

## Continuidade e efeitos externos
Nenhum push, PR, merge, workflow remoto, deploy, migration remota, alteração de usuário, segredo ou dado. Não foram buscadas credenciais de produção. Estado hospedado não homologado nesta rodada. Primeiro integrar e executar instalação/typecheck/audit/1.200 aplicação/209SQL/71HTTP-browser em ambiente apto; depois Function/Auth/M2M, capacidade, restore e revisão operacional. M2 não iniciado.

## Conferência do pacote
As variantes cumulativa R2–R9 (78 arquivos novos/alterados) e R9-only (7 arquivos, sobre R8 exato) passaram pelas inspeções before/after em cópias locais limpas. A cópia cumulativa passou novamente em 1.200 testes. O bundle foi recuperado em uma terceira pasta, conferido com git fsck e passou novamente em 1.200 testes. Os resultados pós-commit estão em verification/ e no manifesto externo. Essas inspeções não são integração no GitHub, execução de CI remoto ou homologação hospedada.

O remoto foi reconferido ao encerramento e continuava no commit b9481b9fabde2fd9c442e44099bc17608b59571a. O fingerprint executável desta rodada é c5a40a13df544efdac6d60c987fe11d62fa40f4c4df3c88dd0fbb20fb3c241e5; alterações apenas de documentação/evidências posteriores não alteram esse fingerprint.
