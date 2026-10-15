# Handoff CODEX — E02 cumulativa / HD-DA-CADASTROS

**Pedido:** integrar e continuar a implementação, preservando os demais desenvolvimentos. **Não ativar a execução no Novo GEO.**

## Antes de aplicar

Leia AGENTS.md, PROJECT_HELP_DESK.md e os checkpoints mais recentes do repositório completo. Este pacote é aditivo e foi preparado contra as interfaces lidas em `e66814a7ed4f445c1b4897cb35b790cd71457743`; a reinspeção final observou `a06c21a8ec828ad38b04dd4005137f2fca5b6eb5` (PR40). Não reverta PR38/39/40, atendimento ativo, schemas atuais, Email Kit, callback ou pré-condições dos rascunhos.

A pasta `repo/` contém somente adições E01+E02; não é clone da aplicação inteira. `verificacao/context/` é exclusivamente um contexto mínimo para reproduzir os testes neste ambiente: **nunca substituir package.json, tsconfig.json, sql.ts, canonical.ts ou errors.ts reais por ele.**

Use branch/worktree isolada e escolha uma forma de aplicação:

- Sem E01 aplicada: conferir e aplicar `patches/HDA_E01_E02_CUMULATIVO.patch`.
- Com E01 idêntica já aplicada: conferir e aplicar somente `patches/HDA_E02_DELTA_SOBRE_E01.patch`.
- Com modificações concorrentes nos mesmos arquivos: reconciliar os diffs; não usar force, reset ou sobrescrita ampla.

```sh
git status --short
git apply --check /caminho/pacote/patches/HDA_E02_DELTA_SOBRE_E01.patch
# Somente depois da conferência, aplicar o patch escolhido.
git apply /caminho/pacote/patches/HDA_E02_DELTA_SOBRE_E01.patch
```

## Gates locais da árvore completa

Preservar package-lock e versões pinadas. Usar os scripts existentes do repositório, não instalar dependências pela pasta de contexto.

```sh
npm ci --ignore-scripts
npm run check:lock
npm test
npm run typecheck
npm run check:contracts
npm run check:migrations
npm run check:consultegeo-upgrade
npm run check:secrets
npm run build
npm audit --audit-level=high
python scripts/verify-hda-canonical-vectors.py
```

A evidência de homologação da principal não vale para esta fonte modificada; executar a homologação completa e conferir o fingerprint antes de qualquer publicação. Este pacote não publica nem habilita flags.

## PostgreSQL obrigatório — somente cluster próprio

```sh
# Plano, sem banco:
node scripts/test-registration-db-native.mjs --plan
# Linux, usuário não-root, Node22 com flag abaixo, pg8.16.3 instalado pelo lock,
# initdb/pg_ctl17 no PATH ou HDA_PG_BINDIR apontando para binários locais:
node --experimental-strip-types scripts/test-registration-db-native.mjs --execute
```

O runner recusa DSN/host externo herdado, cria um cluster novo por socket Unix sem listener TCP, banco `helpdesk_test`, owner administrativo de teste e dois logins restritos. Credenciais aleatórias ficam só no processo/cluster local, não nos logs da entrega. O encerramento confirmado precede a remoção do diretório próprio. Se o processo de inicialização/parada ficar incerto, preservar e diagnosticar; não apagar dados de outro cluster.

A suíte chama o `runTransaction` real da árvore completa, mas usa uma fixture mínima de core marcada como sintética. Sua aprovação **não dispensa** a regressão e o upgrade reais das migrations em outro cluster descartável. Nesta sessão o preflight retornou blocked/executed:false; nenhum teste SQL rodou.

O arquivo `supabase/candidates/hda02_analysis_persistence.sql` não é uma migration pronta. Contém admissão local deliberadamente incompatível com o destino hospedado. Não remover essas guardas para publicar: após provas, gerar uma migration própria pela CLI e qualificar owners/default ACL, catálogo e versão correspondentes. Não experimentar DDL na base hospedada.

## Composição de produção a implementar na HDA-03

Exemplo de fronteira, não montagem já existente:

```ts
return runTransaction(pool, principal, async client => {
  const store = createPostgresRegistrationStore(client, {
    workspaceId: principal.workspaceId, id: principal.id
  }, {
    assertCurrent: () => assertBorrowedTransactionIdentity(client, principal),
    reject: error => rejectTransactionValidation(client, error)
  });
  return executeRegistrationCommand(store, serverResolvedScope, command);
}, existingAdmission);
```

`serverResolvedScope` vem da autoridade do servidor; não aceitar grants, actorId ou binding qualificado do body como autorização. `existingAdmission` preserva a sessão/escopo vigentes. Se a função já estiver dentro da transação de abertura, use aquela mesma conexão/guarda; **não abra outro runTransaction**. Só depois do COMMIT confirmado a reserva pode ser consumida por um runner. Não invocar CLI, API de origem ou e-mail dentro do lock SQL.

Faltam qualificação real da origem, identidade técnica, publicação de bindings/capabilities, reader do job por lease vigente, processamento CLI e exposição de rascunhos. A E02 não fornece credenciais de escrita nem autorização de executar. Aprovação e execução têm suas próprias tabelas/contratos futuros.

## Retorno exigido ao final

Registrar fonte exata, diff, resultados da suíte completa, SQL nativo/catálogo/rollback, status de cada pacote e limitações. Não marcar HDA-02 concluída antes da qualificação de banco. Entregar novo ZIP cumulativo, handoff e plano. Nenhuma criação fictícia em produção é necessária para testar esta etapa.
