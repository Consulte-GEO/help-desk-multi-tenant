# Tarefa executável — integrar e validar Help Desk M1-R10

## Objetivo
Integrar o cliente de aceitação de leitura hospedada sobre o R9 já publicado, sem reimplementar R2–R9 nem liberar atendimento real. Entregar evidências separadas de aplicação, banco, navegador e destino.

## 1. Conferir a base e aplicar o incremento
Ler PROJECT_HELP_DESK.md, README.md, AGENTS.md e docs63–68. Confirmar GitHub/branch/commit atual. Base deste pacote: `78bbb00112331531168ae24600604cb7f3148770`; fingerprint inicial `972674dad13427f3d71d6103e60772dd9e0979da5cf27c91adadf2393ba22581`. Conferir SHA-256 externo e manifesto. Trabalhar em branch de revisão, preservando alterações concorrentes.

No checkout real, usar o patch que está na raiz do pacote; `<PACOTE>` é a pasta onde o ZIP foi extraído:

```bash
git status --short
git rev-parse HEAD
git apply --check <PACOTE>/helpdesk-m1-r10-only.patch
git apply <PACOTE>/helpdesk-m1-r10-only.patch
git diff --check
```

Não aplicar os ZIPs antigos. Se o patch falhar, examinar as alterações concorrentes; não usar `--reject`, overwrite de pastas ou force-push como solução automática. `changes/` contém os arquivos finais apenas para revisão; o patch é a via de integração.

## 2. Toolchain e gates reais
```bash
npm ci --ignore-scripts
npm run typecheck
npm run check:migrations
npm run check:lock
npm test
npm audit --audit-level=high
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```

Executar PostgreSQL17 descartável e os runners já existentes, nunca usar o Supabase de produção como fallback. Aprovação esperada:1241+ aplicação,209 PostgreSQL e71 HTTP/browser sem skips/cancelados/TODO e mesmo fingerprint. Não converter npm test em aprovação do typecheck. Preservar logs de falha. O relatório da suíte hospedada não deve ser copiado para `evidence/homologation/latest.json`.

## 3. Preparar a fixture — operação remota depende de autorização atual
Não criar automaticamente pessoas, grants, contratos ou chamados. Solicitar ao responsável pelo ambiente a preparação aprovada ou utilizar uma fixture sintética já existente e revisada. O runtime precisa estar disponível em homologação por uma decisão específica; **não ligar o gate da produção apenas para executar testes**.

Conferir no Netlify o permalink imutável e seu commit; conferir o Supabase efetivo e o isolamento do backend. `environment:homologation` é declaração, não mecanismo de isolamento.

A fixture deve conter:
- Conta/produto A e conta/produto B, com serviço e cobertura vigentes; catálogo `environment:staging` pequeno e com paginação concluída.
- Solicitantes humanos A/B distintos, workspace_role nulo, cada um com exatamente um grant requester da própria conta e escopos contexts:resolve/tickets:read. Não usar admin/account_manager.
- Agente A distinto, workspace_role nulo, único grant agent em A, com leitura de chamados/contextos/notas.
- Principal integração A distinto, único grant requester em A, única instância de produto A, escopos de leitura/contextos e sessão curta válida.
- Chamado do solicitante A, chamado do solicitante B, chamado de autoria da integração A. Os três IDs devem ser distintos.
- Mensagem pública conhecida no chamado humano A e outra no chamado da integração A.
- Nota do agente no chamado humano A, com corpo exatamente igual ao marcador sintético `HD_TEST_INTERNAL_<identificador>`, e ID conhecido.
- Workspace seletor diferente que não seja autorizado ao solicitante A. Este controle não prova a existência/acesso positivo no segundo workspace.

Copiar `examples/hosted-acceptance.fixture.json` para arquivo local de trabalho e preencher os valores reais DA HOMOLOGAÇÃO. O exemplo tem identificadores fictícios e não deve ser executado como se fosse um ambiente provisionado. Nunca colocar tokens nesse JSON.

## 4. Executar o plano sem rede
```bash
npm run --silent test:hosted:read -- --config <FIXTURE_JSON>
```
Saída esperada: `status:planned`, `transport:none`,28 checks `not_run`. Não é homologação aprovada. A execução é possível sem as variáveis de sessão.

## 5. Executar somente com sessões de curta duração e autorização
Fornecer pelo mecanismo seguro do executor, sem logs e sem colar no chat/repositório:

| Variável | Conteúdo |
|---|---|
| HELPDESK_TEST_HUMAN_A |JWT de acesso do solicitante A |
| HELPDESK_TEST_HUMAN_B |JWT de acesso do solicitante B |
| HELPDESK_TEST_AGENT_A |JWT de acesso do agente A |
| HELPDESK_TEST_M2M_SESSION_A |Sessão `hd_session_` já emitida; nunca `hd_key_` |

Não usar service_role, token administrativo ou senha como bearer. Não relaxar TLS. O CLI recusa NODE_TLS_REJECT_UNAUTHORIZED=0. Limpar as variáveis ao terminar; não incluir valores em prints, history, `.env` versionado ou relatório.

```bash
npm run --silent test:hosted:read -- --config <FIXTURE_JSON> --execute --confirm-origin https://<DEPLOY_ID>--helpdesk-consultegeo.netlify.app > <RELATORIO_JSON>
```

A origem deve ser literalmente igual à do JSON, sem barra final, credenciais, query ou fragmento. Não usar o alias de produção. Códigos de saída:0 para plano ou sucesso da suíte;1 para erro/falha;2 para gate fechado. Conferir `status`, não apenas exit0. Um bloqueio deve ser registrado, nunca substituído por mock ou por ativação da produção.

## 6. Critérios e devolutiva
No destino, todos os28cenários precisam passar via transporte `https`. `injected` é teste do cliente, não homologação. Registrar commit da API conferido externamente, deploy, versão/manifesto do cliente, UTC, relatório, IDs de correlação e limites. Nunca anexar bearer, payload privado, credencial M2M permanente ou segredo de banco.

Mesmo com28/28, manter `platform_approved:false`, `operational:false`, `deployment_commit_verified:false` no resultado produzido pela ferramenta e os demais flags de lifecycle/browser/restore false. Atestações externas pertencem a registro separado; não editar o JSON para inventar comprovação.

Atualizar docs66/67 com execuções novas sem apagar evidências desta rodada. Próximas fatias: login/refresh/logout/expiração, emissão/revogação M2M, mutações/idempotência hospedadas, pg/TLS na Function, carga/restore/revisão operacional. Não iniciar M2 administrativo antes de encerrar M1.
