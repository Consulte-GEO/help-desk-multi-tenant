# Processos de implantação/importação — IMP-02a / R02

**Serviço de servidor com montagem Netlify preparada e fechada por configuração.** A condição efetiva de produção depende da migration, credenciais e vínculos reais; conferir `docs/implantacao/IMP02-HOSPEDAGEM.md` e as evidências da entrega.

## Arquivos

- `canonical.ts`: JSON determinístico limitado, SHA-256, snapshots, campos e fontes.
- `contracts.ts`: tipos e portas de servidor.
- `service.ts`: criar/salvar/ler/cancelar, registrar e verificar arquivos; contexto vivo, CAS e recibos.
- `postgres.ts`: transação de uma conexão, SQL parametrizado, escopo, lock e recuperação de falha.
- `hosted.ts`: autenticação viva Supabase, diretório, vínculos persistidos, listagem e montagem HTTP.
- `storage.ts`: upload privado imutável e inspeção concreta dos bytes por gateway qualificado.
- `tsconfig.json`: typecheck estrito isolado do frontend.

O módulo permanece fora de frontend/public e não deve ser copiado para o bundle público. Não introduz React/Pinia/novo servidor/banco, não remove Vuex nem skeleton .NET. O backend oficial futuro .NET pode reutilizar os contratos e regras por implementação equivalente; não se afirma que este TypeScript já roda no .NET.

## Montagem

`createImportProcessService(options)` exige `Repository`, `authority.resolve(credential,scope,operation,signal)`, `inspector.inspect(objectKey,signal)`, clock, UUID generator e retentionDays. São funções/objetos construídos pelo servidor, nunca portas enviadas pelo usuário. O adaptador PostgreSQL exige pool que devolve `{query, release}`, com conexão assumindo `setup_import_app`. Não embute conexão, senha nem driver.

Métodos: `createCase`, `saveRevision`, `getCase`, `getRevision`, `cancelCase`, `registerArtifact`, `finalizeArtifact`. Os comandos de escrita incluem scope, operationId e expectedVersion. A função `frontend/netlify/functions/import-process.mts` monta os endpoints correspondentes quando a configuração explícita habilita o módulo. Sem vínculos cadastrados a sessão autenticada recebe scopes vazio.

Read/write exigem autorização viva para workspace/conta/processo/obra, usuário e solicitante. O serviço reconsulta antes de confirmar; isso não resolve por si uma transação distribuída com o sistema da origem. Expiração de sessão não elimina o processo. O chamador deve exibir versão/recibo confirmados pelo servidor; falha ou COMMIT incerto não deve aparecer como salvo.

## Semântica e arquivos

Snapshot é rascunho de dados, não plano aprovado. `target` declara intenção, não qualificação de receptor. Campos de decisões livres não são executados. Nenhum estado disponível significa importado, entregue ao suporte ou tecnicamente aprovado. `awaiting_ticket` permanece até implementação do vínculo em IMP-03.

Artefato declarado é pending. Só a inspeção server-side pode concluir ready/rejected; scanner/serviço inconclusivo gera erro e mantém pending. O storage deve garantir upload imutável/upsert=false e leitura da versão verificada. Metadados esperados e extensão não comprovam MIME ou segurança do conteúdo. O método de leitura não devolve objectKey/objectVersion; download autorizado virá por capacidade própria.

O registro reserva 60 MiB por arquivo pending/rejected, pois uma URL assinada pode aceitar até esse limite do bucket apesar do tamanho declarado. Só ready usa o tamanho exato verificado. A soma reservada fica em até 1 GiB por processo, sob a transação serializada; até 1.000 registros continuam permitidos quando os bytes verificados cabem na cota.

Hash do documento não autoriza acesso; a mesma fonte em outro caso tem identidade privada distinta. Não há armazenamento de bytes no snapshot, telemetria ou recibo. Retenção é configurada explicitamente pelo servidor e apenas agendada em retainUntil nesta versão; purge ainda não implementado.

## Testes e limites

```sh
node --experimental-strip-types --test tools/tests/import-process/*.test.mjs
tsc -p modules/import-process/tsconfig.json
```

Node 22.16 foi usado na sessão; TS 5.8.3 global. A suíte tem um repositório transacional em memória e um fake de transporte SQL, explicitamente em tools/tests. Não demonstram banco real nem retomada em outro dispositivo. Conferir o guia de qualificação PostgreSQL antes de qualquer montagem hospedada.

## Incremento R03

`http.ts` acrescenta adaptador Web Request/Response de sessão e controle condicional de versão. A função não instala rotas, não cria servidor e fecha por padrão. As sete operações têm contrato em `docs/implantacao/R03-HTTP-CONTRATO.md`. Há 4 jornadas com sockets HTTP reais em `http-loopback.test.mjs`, usando serviço real e MemoryRepository/autoridade/scanner explicitamente sintéticos.

O módulo de cliente fica separado em `modules/import-process-client/`. A leitura de revisão agora recusa propriedades inesperadas mesmo que o hash tenha sido recomposto. PostgreSQL e storage continuam não qualificados.

Qualificador descartável: `tools/qualify-import-process-postgres.mjs`. Não aceita conexão remota nem base existente, exige binários PostgreSQL 17, usuário de SO não-root e instalação local do driver pg. Ausência de requisito produz exit 2, não teste pulado verde. O corpo da suíte real permanece NÃO EXECUTADO nesta entrega.
