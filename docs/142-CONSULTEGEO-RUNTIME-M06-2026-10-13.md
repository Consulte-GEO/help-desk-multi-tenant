# Consulte GEO — runtime e conversa pública M06

Data: 13/10/2026. Continuidade do desenvolvimento autorizado, sobre a M05 `a930874`, no mesmo worktree/branch `codex/consultegeo-m02` e [PR31 draft](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/31). Produto dedicado à Consulte GEO, preservando isolamento entre clientes, contas e obras.

**Estado de qualificação:** M06 implementada e homologada na fonte `47bee4ed3c025ce78f05a53683b00729bc760d9e`, com revisão independente e fix pass concluídos. CI original [38469608228](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38469608228): **4.418 aplicação,390 PostgreSQL17 e192 interface**, zero falhas/cancelamentos/skips. O aceite da operação hospedada permanece nas próximas etapas.

## Comportamento implementado

O runtime registra as factories reais de configuração M04, workflow M02/M03 e checklist. Administração exige autenticação humana, MFA e capability própria; pode preparar configurações com atendimento fechado. Workflow/checklist exigem liberação de atendimento, flag própria, origem HTTPS exata e portas de origem qualificadas fornecidas somente pelo servidor.

Sem resolver/diretório da origem, os novos endpoints recusam com 503. Não há autoridade de demonstração, wildcard, grants inventados ou JSON de ambiente que substitua essa dependência. A entrada Netlify mantém bootstrap lazy, conexão TLS restrita, papel `helpdesk_app`, schema/readiness, limitador distribuído e observabilidade. O adaptador real do Novo GEO continua no M08.

Quando a flag de workflow está ativa, o handler scoped possui as rotas de tickets e reautoriza recurso/ator/conta no mesmo cliente da leitura ou escrita. Coleção e abertura ficam indisponíveis até sua integração própria. Falha de origem, diretório ou autorização não encaminha a requisição ao handler antigo. O adapter emprestado de `HelpdeskService` não adquire outro pool nem abre transação aninhada; prende toda a identidade e expira ao terminar o callback.

As interações públicas com mudança de estado — devolutiva, retorno do cliente e resolução — antes tinham corpo somente no ledger privado. Agora são lidas com ID, ator e data do evento original, junto às mensagens antigas. Resposta ordinária que já existe em `ticket_messages` aparece uma vez. Reabertura e resolução posterior preservam cada solução histórica; não se usa a resolução corrente como texto do passado.

A timeline conserva a linha core do evento e acrescenta `public_interaction` somente quando conta/workspace/ticket/ID/ator/tipo/data/ação/revisão correspondem ao ledger. Motivos de encaminhamento, cancelamento e reabertura, notas, atribuições e evidência de checklist não se tornam mensagens públicas. O serializer do cliente preserva seu status público e campos mínimos. A normalização mantém a igualdade dos recibos antigos em milissegundos e conserva microssegundos reais.

Comandos novos usam If-Match, Idempotency-Key e ação nomeada. A admissão da requisição acompanha flag e cancelamento durante as esperas e até o COMMIT. Recusa observada não pode ser revertida reabrindo a flag. Depois de COMMIT confirmado, fechamento/limpeza posteriores não reclassificam o recibo como falha. Confirmação perdida continua desconhecida e exige conciliar a mesma intenção, sem retry automático.

## Contrato e banco

API/interface candidata `0.28.0`, schema esperado `0.21.0`, 26 operações OpenAPI. O gerador canônico inclui a extensão M06 e reproduz o contrato. Rotas acrescentadas:

| Rota | Uso |
|---|---|
| GET/POST `/v1/admin/consultegeo/configurations` | Listar; salvar/publicar/restaurar configuração com MFA/capability |
| GET `/v1/admin/consultegeo/configurations/{id}/versions/{version}` | Ler versão exata autorizada |
| POST `/v1/tickets/{ticket_id}/workflow-commands` | Executar ação nomeada no perfil fixado |
| GET `/v1/internal/tickets/{ticket_id}/execution-checklist` | Ler checklist interno |
| POST `…/execution-checklist/marks` | Confirmar item/evidência sob revisão |
| POST `…/execution-checklist/evidence` | Consultar evidência interna autorizada |

Flags de servidor `HELPDESK_CONSULTEGEO_ADMINISTRATION=false` e `HELPDESK_CONSULTEGEO_WORKFLOW=false` por padrão. `HELPDESK_CONSULTEGEO_ORIGIN` requer origem HTTPS sem caminho/credenciais quando algum módulo é habilitado. Origem vazia com ambos desativados equivale a não configurada. Capabilities informam dependências disponíveis; não concedem autorização.

Migration CLI oficial2.120.0: `20261013195704_consultegeo_m06_public_conversation.sql`. Cadeia de14 migrations, prefixo13 idêntico à M05 e seis candidatos originais preservados. Três helpers privados acrescentados: diretório, mensagens e eventos. Catálogo:48 tabelas,97 funções,39 triggers,257 constraints e38 policies. Sem nova tabela, seed ou backfill.

Leituras exigem scopes/conta/produto/ticket e cobertura CG atual antes de ordenar/paginar. Histórico interno também exige operador, notes.read e cobertura completa de notas. Ledger permanece sem SELECT para app/clientes/publicador/worker. Helpers possuem search_path vazio e execução limitada ao app. Defaults inseguros, direitos efetivos extras ou instalação parcial recusam antes de marcador/COMMIT. Nenhum papel Supabase ausente é criado para fazer a migration passar.

## Revisão e decisões

[Revisão independente](../evidence/consultegeo-m06/review-final.md): uma rodada fresh-context, sem alterações pelo revisor. Identificou diretório sem cobertura CG completa e erro de MFA reclassificado como indisponibilidade. O fix pass acrescentou autorização CG também antes de divulgar metadata e preservou mfa_required403 com zero efeitos. O negativo nativo do diretório falhou na fonte anterior a99b3e6 e passou na fonte final; MFA teve reprodução local503→403 e passou na suíte integral.

Decisão: snapshots da origem devem estar atuais antes do diretório. M08 precisará renovar publicação/autorização pelo seu canal privado antes desse lookup; uma requisição recusada não recebe refs para tentar ampliar acesso. Custo: atendimento desse chamado permanece indisponível até atualização qualificada do snapshot.

Decisão: tratar a perda do motivo MFA como Important pelo efeito no fluxo de step-up, embora a barreira já recusasse efeitos. Recusa de autenticação deve orientar a confirmação necessária, sem sugerir retry de indisponibilidade.

Não foram encontrados outros Critical/Important na revisão. Exclusões consideradas: origem e aceite hospedados M08, jornada M09/M10, operação e-mail/Storage/SLA M11 e prontidão de produção. Permanecem etapas explícitas; não são aceites presumidos.

## Validação e procedência

Testes focais verificam leitores/DTOs/IDs, recibo inválido, dedupe, datas, identidade e ciclo de vida emprestados, flags/origin, If-Match/key, MFA e fechamento antes/depois de COMMIT. Chromium HTTPS próprio passou8 verificações desktop/mobile com identidade/estado sintéticos. Isso comprova o handler/domínio/serializer na fixture, não a origem real.

PostgreSQL17 da CI original qualifica lojas/reautorizações/transações reais em cluster próprio: projeção, paginação, histórico, ACL, upgrade, dados/credenciais antigas, defaults, reaplicação e HTTP composto. O cenário reconfirma checklist por revisão depois de retorno/reabertura; não usa marcações de uma revisão anterior.

Windows não possui PG17/WSL/Docker aptos neste ambiente. Node22 portátil oficial foi conferido por SHA256; a suíte completa local teve limitações de symlink, sockets Unix, OpenSSL/PATH e contexto CI. Nenhum guard foi reduzido para aceitar o ambiente. A evidência canônica foi produzida pelo runner Linux/Node22/PG17 da fonte final. Logs brutos/SHA256 e check:homologation foram conferidos para o código atual.

Procedência: [metadata da fonte](../evidence/consultegeo-m06/ci-source.json), fingerprint `d424f1a200192c10f081c503fa99214034c01e5edd3748b9043e97eea7d64a20`; migration014 SHA256 `10a397bd74b6ba2c81bd115c63ad205bc2aeac157686812e7d040ffcf353f09b`. O catálogo nativo corresponde ao contrato estático, inclusive UPDATEs antigos e papéis separados. [RED nativo do diretório](../evidence/consultegeo-m06/regressions/directory-red.json) preserva o caso que reproduziu a lacuna.

## Promoção e continuidade

Promover código/schema compatíveis juntos, pelo processo próprio, depois de CI/revisão e demais aceites. Não aplicar candidatos avulsos nem ajustar somente o marcador. Flags novas e atendimento não são liberados por esta migration. Não foram alterados banco hospedado, Auth, grants de pessoas, segredos ou provedor; não houve envio de e-mail, registro GlobalCad, merge ou deploy de produção nesta etapa.

M04/M05 e M06 preparam a operação Consulte GEO. M08 conecta identidade/contexto/obras e registry reais; M09/M10 entregam formulários e jornada cliente/N1 sobre configurações publicadas; M11 entrega Storage/scan, execução de SLA e worker/webhook Resend com acompanhamento; M12 realiza piloto e aceite hospedado. O transporte/template/políticas de email anteriores estão documentados na [M02/M03](139-CONSULTEGEO-WORKFLOW-E-EMAIL-2026-10-13.md).
