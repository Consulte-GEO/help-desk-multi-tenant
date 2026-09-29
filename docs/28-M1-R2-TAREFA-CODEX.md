# Tarefa executável para o Codex — integrar e validar M1-R2

Leia este arquivo integralmente e o material de continuidade indicado. A tarefa é integrar o incremento privado de diagnóstico de runtime e produzir evidências reais novas, preservando o Help Desk genérico. Não iniciar M2 nesta rodada.

## Base e artefato

Repositório: `Consulte-GEO/help-desk-multi-tenant`. Base inspecionada: `b9481b9fabde2fd9c442e44099bc17608b59571a`, branch `codex/m1-reproducibilidade`. O ZIP contém `helpdesk-m1-r2.patch`, `overlay/`, manifesto de preimages/SHA256, documentos e evidências locais. É incremental, não é um snapshot completo do remoto. Não importar a história local recuperada como substituição do GitHub.

## Passo 1 — contexto e aplicação local

Ler PROJECT_HELP_DESK, README, AGENTS, docs04/05 **do checkout atual**, docs24–28 do pacote, especificação e plano. Conferir `git status --short`, `git branch --show-current`, `git rev-parse HEAD` e mudanças concorrentes. Criar branch local própria a partir da base atual após preservá-las. Não usar reset, clean indiscriminado, checkout forçado nem force push.

Comparar os arquivos existentes com seus hashes `before_sha256` no manifesto; conferir a integridade do patch pelo SHA256. Conferir que caminhos novos não existem. Se HEAD avançou, revisar o diff antes de aplicar; falha de preimage exige conciliação, não sobrescrita.

```sh
# Substituir o caminho pelo ZIP extraído; estes comandos não publicam.
git apply --check /caminho/do/pacote/helpdesk-m1-r2.patch
git apply /caminho/do/pacote/helpdesk-m1-r2.patch
git diff --check
```

Não copiar overlay por cima de um checkout sem essa verificação. O patch não substitui docs04/05 remotos. Atualizá-los depois com as novas evidências efetivamente produzidas, mantendo o histórico e apontando o novo handoff.

## Passo 2 — revisar implementação

Verificar runtime-config, runtime-preflight, CLI e regressões. O gate existente vem antes da validação de produção. A CLI default é offline. A conexão só ocorre com --connect e configuração autorizada. Confirmar pool exclusivo, TLS verificado antes do SQL, READ ONLY, guardas reais existentes, rollback/descarte e erros sanitizados. Não aceitar configuração/URL de usuário HTTP como argumento do diagnóstico.

Revisar o uso de client.connection.stream contra pg8.16.3. Não remover a exigência caso seja incompatível: reproduzir com o driver real, escrever teste falhando e corrigir sem enfraquecer TLS. Revisor independente deve avaliar as mudanças antes de liberação.

## Passo 3 — gates locais reais

```sh
npm run check:lock
npm ci --ignore-scripts
npm run verify
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```

Aceite: instalação/verify/audit concluídos com dependências locais; pelo menos1.099 aplicação; 204PostgreSQL (188principais+16upgrade); 71HTTP/browser; zero falha/cancelamento/skip/TODO; fingerprint e logs coerentes. Não reclassificar typecheck global como padrão. Não importar evidência antiga sob fingerprint novo.

Se Docker/PostgreSQL/browser estiverem indisponíveis, registrar o bloqueio e usar somente ambiente autorizado adequado. **Nunca executar o runner SQL descartável contra Supabase remoto.** Ele possui fixtures e alterações administrativas exclusivas de teste.

## Passo 4 — diagnóstico e sequência hospedada

Executar default offline e ajuda. Somente com autorização atual para o destino e acesso protegido às variáveis, executar `npm run --silent runtime:preflight -- --connect`. Não passar segredo em argumentos, não gravar `.env` versionado e não criar a flag de produção. Guardar relatório e stderr sanitizados com data/origem/commit; a saída não certifica Auth nem Function.

A etapa seguinte é validar dentro da Function e testar Auth/M2M real em homologação. Especificar a forma privada/autorizada de executar antes de abrir endpoint, publicar ou alterar configuração. Não habilitar atendimento real para fazer o diagnóstico passar. A falta de autorização limita apenas as ações remotas; continuar tarefas locais independentes.

## Passo 5 — fechamento

Entregar diff/revisão, base/branch/commit, arquivos alterados, migrations zero ou delta aditivo justificado, contagens reais, falhas e tentativas, estados separados, riscos e próximo passo. Atualizar docs04/05, novo handoff e backlog com evidências efetivas. Preparar pacote revisável. Não executar push, PR, merge, deploy, migration remota, secrets, MFA, usuários, dados ou recursos pagos sem autorização explícita atual.

**Conclusão esperada:** incremento integrado e seus gates comprovados ou bloqueios honestamente descritos. M1 não fecha apenas porque o preflight retornou success:true.
