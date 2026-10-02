# Tarefa executável — integrar R10+R11 e validar o ciclo básico de sessões

## 1. Fonte e integração
Leia PROJECT_HELP_DESK.md, README/AGENTS e os handoffs upstream/R10/R11. Base remota desta entrega: `78bbb00112331531168ae24600604cb7f3148770`. Confirme HEAD e concorrência. Não reaplique ZIPs R2–R9: já foram integrados upstream.

Em branch de revisão, conferindo previamente o SHA256 do ZIP e os hashes do manifesto:

```bash
git status --short
git rev-parse HEAD
# Escolha só uma variante:
git apply --check <PACOTE>/helpdesk-m1-r10-r11.patch
git apply <PACOTE>/helpdesk-m1-r10-r11.patch
git diff --check
```

Para R10 exato já integrado, use `helpdesk-m1-r11-only.patch` nos dois comandos git apply. Se houver diferenças ou falha do patch, revise o delta; não usar force-push, --reject ou sobreposição de pastas como correção automática. O manifesto registra fingerprints das duas entradas.

## 2. Executar gates do código novo

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

Exigir1.277+ testes de aplicação,209PostgreSQL17 e71HTTP/browser sem skips/cancelados/TODO, com dependências oficiais e mesmo fingerprint. PostgreSQL deve ser descartável e guardado pelos runners; sem banco real de cliente como fallback. Typecheck global suplementar não é aceite da toolchain travada. Não editar relatório antigo para corresponder ao código novo.

## 3. Preparar a fixture com autorização atual
O R11 cria/renova/encerra sessões; não é somente leitura. Requer autorização explícita para as duas origens e para a conta/conexão de teste. Não provisiona usuário, grant, chave, workspace ou contrato. Não altera MFA, CAPTCHA, política de sessões ou gate.

Copie examples/hosted-auth.fixture.json para um arquivo local não versionado e substitua os valores fictícios. Conferir no provedor o permalink/deploy/commit e o Supabase efetivo de homologação, sem usar o alias da produção. O JSON contém:

| Campo | O que informar |
|---|---|
| origin |Permalink HTTPS de24hex--helpdesk-consultegeo.netlify.app |
| supabaseUrl |Origem https://<project-ref>.supabase.co da homologação |
| deploymentCommit |Commit conferido externamente no deploy; o runner não o atesta |
| workspaceId / accountId |Workspace e conta sintéticos autorizados |
| humanAuthUserId |ID do usuário no Supabase Auth |
| humanPrincipalId |Principal interno correspondente; não confundir com Auth user ID |
| integrationPrincipalId / productInstanceId |Principal e instância da conexão de teste |

Humano e integração precisam de exatamente um grant requester da conta, workspace_role null e scopes contexts:resolve/tickets:read. A integração deve resolver somente a instância indicada. Não elevar papéis para fazer passar. Usar contas de teste dedicadas; login pode afetar sessões prévias conforme a política do provedor. Esse efeito deve ser aprovado, não contornado.

A versão atual do transporte humano usa chave pública `sb_publishable_` retornada por public-config. Uma configuração legada anon JWT não é flexibilizada pelo cliente. Falhas de MFA/CAPTCHA devem ser resolvidas pelo fluxo aprovado do ambiente; não desativar o recurso.

## 4. Plano sem segredos e sem rede

```bash
npm run --silent test:hosted:auth -- --config <FIXTURE_JSON>
```

Esperado: status planned, transport none,12checks not_run. Exit0 do plano não é execução aprovada.

## 5. Sessões reais — somente no destino autorizado
Forneça no ambiente seguro do processo, sem incluir valores no comando, histórico, chat, print ou arquivo versionado:

| Variável | Valor |
|---|---|
| HELPDESK_TEST_EMAIL_A |Email do usuário sintético |
| HELPDESK_TEST_PASSWORD_A |Senha do mesmo usuário |
| HELPDESK_TEST_M2M_KEY_A |Chave longa hd_key_ da conexão sintética; nunca service_role |

A chave longa fica server-side no executor: só é enviada à emissão de sessão. O runner recebe e usa os tokens temporários exclusivamente em memória, sem exportá-los. Limpar as variáveis ao final. Não há promessa de apagamento físico de strings da memória do Node.

```bash
npm run --silent test:hosted:auth -- --config <FIXTURE_JSON> --execute --allow-session-mutations --confirm-origin <PERMALINK_EXATO> --confirm-auth-origin <SUPABASE_ORIGIN_EXATA> > <RELATORIO_JSON>
```

As origens devem ser idênticas às do arquivo, sem barra final. TLS padrão obrigatório; NODE_TLS_REJECT_UNAUTHORIZED=0 é recusado. Exit0 só é aceite desta fatia quando status=passed, transport=https,12passed, cleanup humano/máquina confirmed e unconfirmed_session_creation=false. Exit1=falha,2=bloqueio por gate fechado. Não repetir automaticamente depois de falha incerta.

## 6. Ler o resultado e tratar pendências
O relatório não contém tokens/corpos. Não anexar dump do tráfego nem variáveis de ambiente. Guardar relatório, manifesto do cliente, commit/deploy verificados externamente e correlações. `injected` é teste local, nunca homologação hospedada.

Se houver criação de sessão não confirmada, ou cleanup unconfirmed, parar e usar os procedimentos autorizados de sessões do ambiente. Não reemitir chave/sessão como atalho. Um204confirma o endpoint; uma revogação ainda aceita pelo backend continua falha. R11 espera403/membership_required depois da autorrevogação M2M, conforme o contrato atual. No humano, exige rejeição do refresh após logout; não exige nem afirma invalidação imediata do access JWT.

Registrar a execução nova no handoff sem apagar registros anteriores. Continuam pendentes expiração real, ciclo da chave longa, grants concorrentes, M2M completo, mutações idempotentes hospedadas, capacidade, restore e revisão operacional. M2 continua posterior ao M1. Push/merge/deploy ou mudanças remotas dependem de autorização atual específica; este pacote não os executou.
