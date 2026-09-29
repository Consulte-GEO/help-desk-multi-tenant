# Handoff — Help Desk M1-R7

Ler PROJECT_HELP_DESK.md e docs49–53. Base local R6 `5aedc4885b9e6edeb3bb7ca47b0fc397c366701f`, recuperada do bundle. Remoto observado `b9481b9fabde2fd9c442e44099bc17608b59571a`, branch codex/m1-reproducibilidade. Commit final e fingerprint no manifesto. Nenhuma publicação nesta rodada.

## Resultado
R7 limita-se à homologação/CI. Preparação gera fonte nova sem `evidence/` histórico; compara fingerprint. Falha de Playwright não bloqueia etapas independentes, mas mantém interface e job reprovados. Upload é exclusivo da tentativa, nome com SHA/run/attempt.1192testes Node passaram, incluindo15novos e6TLS herdados.209SQL escritos/0executados;35HTTP memória passaram e browser bloqueou. Instalação/audit/typecheck padrão/gate continuam não aprovados. M1 aberto, M2 não iniciado.

## Integração
Escolher somente uma variante: `helpdesk-m1-r2-r7` para a base remota compatível sem R2–R6; `helpdesk-m1-r7-only` para o R6 exato. Verificar before, aplicar e verificar after com o script de integração já existente. Não usar R7-only em R2/R3/R4/R5; conciliar um checkout intermediário sem sobrescrever alterações. Não recalcular hashes para aceitar conflitos. Source/bundle em pasta nova para recuperação e estudo; não substituir história remota.

## Continuidade operacional obrigatória
A próxima entrega precisa executar o workflow atualizado no GitHub ou os gates em Linux apto. Publicar/disparar workflow exige autorização atual; não presumir a partir de instruções históricas. Usar registry autorizado, Docker local/PostgreSQL17, OpenSSL e browser permitido. Não criar novas camadas de diagnóstico para adiar essas execuções.

Confirmar instalação/auditoria;1192aplicação,209SQL e71HTTP/browser sem skips. Recuperar o artefato da tentativa correta; conferir source.json, SHA/run/attempt, resultado do job e fingerprint. Ele pode conter somente preparo se o job falhou cedo. Só depois copiar as evidências da tentativa para o checkout do MESMO código e repetir check:homologation. Preservar histórias existentes em diretórios separados; não confundir source receipt com approval.

Quando gates locais passarem, validar pg/TLS e execução DENTRO da Function, Auth/M2M, revogação e isolamento, com autorização atual de ambiente. Restam capacidade/abuso, descarte físico, restore, residência/RPO/RTO e revisão independente. Não alterar HELPDESK_RELEASE_APPROVED para contornar pendências.

## Revisão focal
stage-ci-source.mjs: Linux/GNU tar, HEAD, fonte imutável, symlinks/submódulos, export-ignore, caminho resolvido, archive sem colisão; limpeza só da pasta criada pela invocação. Workflow: nenhum continue-on-error, gates condicionados à source e não ao browser, ambiente READY recusando estados não aprovados, artifact path isolado. homologation-core: nenhuma dispensa dos mínimos/instalação/interface. Runtime e onze migrations preservados.

As duas referências-base de migrations agora ficam em tests/fixtures/migration-baselines, com os mesmos hashes originais; não restaurar sua leitura de evidence/ nem regenerar os arquivos para acomodar divergências.

A extração CLI foi ensaiada localmente sobre o commit790b602, com IDs sintéticos e mesmo fingerprint final de código. A suíte passou1192/1192 nessa pasta, sem manifests antigos em evidence/. Isso não executou o workflow GitHub nem PostgreSQL.
