# HDA-00 — Inventário de ações e convivência com o catálogo

Referência: [Cadastros na abertura](https://github.com/Consulte-GEO/help-desk-multi-tenant/blob/511523bea50c053a3bf1ac027be7a4ff01414930/docs/150-CONSULTEGEO-CADASTROS-2026-10-14.md), revisão `511523bea50c053a3bf1ac027be7a4ff01414930`. O catálogo atual já usa a família `user_access` para oito tipos e cinco ações. Não confundir essa família visual com permissão de execução automatizada.

| Tipo atual de novo cadastro | Cobertura pela execução automática E01 |
|---|---|
| Usuário | Nenhuma; provisionamento IdP/GEO é HDA-12 |
| Traço | Nenhuma; schema decimal/unidades exigirá contrato próprio |
| Usina | Nenhuma; distinguir matriz compartilhada e vínculo da obra |
| Laboratório | Nenhuma; não atribuir acesso por categoria |
| Bloco de alvenaria | Nenhuma |
| Cerâmica | Nenhuma |
| Cabos | Nenhuma |
| Fornecedor | Nenhuma; alcance compartilhado exige análise própria |

## Única ação candidata implementada

`geo.user.grant_work.v1`: adicionar vínculo de **usuário existente** a **obra existente**, ambos resolvidos por fonte autorizada. Não cria usuário, não altera perfil, não concede acesso global, não remove outras obras e não envia convite.

Payload fechado: `{"kind":"add_work_link","preserveExistingLinks":true}`.

Efeitos fechados: `{"addWorkLink":true,"preserveExistingLinks":true,"changeProfile":false,"sendInvitation":false}`.

O alvo permanece fora de `proposedFields`: pertence ao snapshot do servidor, identificado por workspace, conta, conexão, instância, tenant, contrato, obra e beneficiário. O modelo não escolhe outro contrato por texto.

`getRegistrationAction` retorna definição **candidate**, nunca uma publicação operacional. `registrationActionDisposition` encaminha action-keys desconhecidas para `manual`. Ações atuais de alterar/desativar usuário e reenviar acesso permanecem humanas; não foram conectadas à automação.

## Regra de expansão

Cada nova action-key precisa de schema, efeitos, prévia, autorização, executor, recibo recuperável, testes e aceite próprios. O perfil canônico E01 aceita apenas inteiros seguros; **não reutilizá-lo silenciosamente para FCK/slump/preços**. Representação decimal e unidade devem ser decididas e versionadas antes da expansão. Não generalizar o executor para `tabela + campos`, SQL ou endpoint fornecido pelo Claude.
