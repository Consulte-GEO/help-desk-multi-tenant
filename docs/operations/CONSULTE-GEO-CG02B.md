# CG-02b — aviso de segredo e assurance administrativo

Checkpoint pré-CI de 08/10/2026. Base incremental `70dda25aa67becf2c8ebbd70582a39a9d9e7b882` do PR23, ainda aberto; branch padrão consultada `796face60367e2573d112b7ae42d570055474348`. Não reaplicar CG-02a. API/interface0.27.0, schema0.19.0 e 19 endpoints preservados; nenhuma migration, dependência, configuração hosted ou permissão alterada.

## Entrega

- Aviso de segredo cobre chave, QR e capturas de tela; antecede os dados e possui associação acessível. Fluxos JS de provisionamento/limpeza não alterados.
- Método server-only `withAdministrativeAssurance(request, callback)` no factory de autenticação; prova opaca `VerifiedAdministrativeAssurance` e `assertAdministrativeAssurance`. Exige bearer humano validado no Auth, fator confirmado atual/AAL2, vínculo vivo e admin. Usa uma consulta Auth e uma de vínculo por invocação, sem checagem baseada só em JWT decodificado.
- Prova limitada ao callback aguardado, à instância/snapshot do principal e à validade temporal. Copiada/forjada/expirada ou contexto alterado não passa; expiração, retrocesso ou erro de relógio não ressuscitam a prova. Cleanup no sucesso e erro; sem retries.
- Política e runbook candidatos em `docs/auth/POLITICA-DE-ACESSO.md` e `docs/operations/CONSULTE-GEO-CONTINGENCIA-DE-ACESSO.md`.

O método não tem rota HTTP nesta entrega. Não é um CRUD administrativo, uma concessão de capability nem uma substituição de autorização na transação futura do CG04. Login comum, discovery e o setup/recovery da própria conta continuam no caminho existente.

## Evidência local

Recorte de fontes recuperadas pelo GitHub conectado e conferidas por Git blob SHA; não clone integral. Container sem DNS utilizável para GitHub/registry. Node22.16.0.

RED inicial:28 testes,2 preservados aprovados/26 falhas por ausência da nova interface. GREEN28/28. Aviso:3 casos,1 aprovado/2 falhas RED; GREEN31/31 conjunto. Autorrevisão adicionou três regressões de não-ressurreição (RED3, corrigidas) e duas de relógio que lança erro (RED2, corrigidas). Final local36/36, nenhum skip; `git diff --check` aprovado. Logs completos preservados na entrega.

Comando focal: `node --experimental-strip-types --test --test-reporter=tap tests/administrative-assurance.test.ts tests/mfa-secret-warning.test.ts`.

CI integral desta fonte, SQL17, browser humano e evidência canônica devem ser conferidos após o push. Números/digests pós-CI serão registrados no PR/relatório, sem alterar este checkpoint pré-CI ou reaproveitar evidência anterior.

## Rulings e limites

Spec complementar não recuperada nesta sessão; a implementação se limita aos contratos expressos em CG02/CG04 do plano. Papel admin é requisito conservador adicional; outros papéis com capability exigirão decisão/revisão CG04. Prova não é capability e não remove a necessidade de checar grants/ACL/revogação na mesma transação do comando.

Atendimento continua fechado. Nenhum fator real criado/removido, scopes de Thiago não ampliados. Auth/MFA reais, preflight/read hospedados atuais, backup/restore, política operacional aceita, CG01 e revisão independente permanecem pendentes até evidência própria. Autorrevisão não satisfaz a revisão independente por branch. Não fazer merge/deploy para contornar essas pendências.
