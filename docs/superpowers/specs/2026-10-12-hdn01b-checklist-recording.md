# HDN-01b — marcação privada do checklist e adaptador PostgreSQL

## Base e objetivo
Continuação aprovada da HDN-01a, RF-CEN-07/RF-CEN-11 do levantamento fornecido. Registrar um item por operação, com ator do servidor, revisão esperada, evidência existente, auditoria e recibo. Isso não executa cadastro, envio de acesso, script ou ação técnica no GEO.
Base inicial: `6f7bc832d504ec1285d6125b68ab83be70c1f57f`. Base final reconsultada: `fb4c7b943bc8e83541c000ba59f32fb2ab448914`. A atualização do PR28 simplificou o login; seus arquivos e comportamento ficam preservados. As três preimagens modificadas por HDN-01a/b mantêm os mesmos Git blobs nessa nova base. R1 e HDW-00/00b já integrados; não reaplicar seus cumulativos. HDN-01a é incorporada ao pacote atual, não declarada integrada remotamente.

## Decisões desta fatia
- Somente operador humano atribuído ao chamado marca itens. Exige os escopos existentes `tickets:read`, `tickets:write`, `notes:read`, `notes:write`, mais autorização integral de recursos. Administrador não ganha exceção de atribuição. Outro executor deve assumir/receber a atribuição pelo fluxo autorizado antes de marcar. Não foram concedidos escopos.
- Leitura privada exige operador, `tickets:read`, `notes:read` e acesso ao chamado e seus recursos. O read histórico de recibo continua sujeito ao acesso atual. Marcação antiga não prova autorização atual.
- Evidência nesta fatia significa `note:<UUID>` de nota interna EXISTENTE, do mesmo workspace/conta/chamado e autor, sem data futura. Não copiar o corpo da nota; não interpretar URL livre ou referência de arquivo como recibo verificado. Isso comprova a existência de uma declaração registrada, não sua verdade, a ação no GEO, entrega de e-mail ou aprovação técnica. Arquivos e auditorias externas qualificados exigem extensão posterior.
- Corpo da marcação contém exatamente action/itemId/status/expectedTicketVersion/expectedChecklistRevision/evidenceRefs/reason/acknowledgeRisk. Nunca recebe ator, instante, snapshot, grant ou aprovação.
- Status `done`, `not_applicable` e `pending`. Dispensa exige regra e motivo; reset exige motivo que fica na auditoria, limpa ator/data/evidência do item atual, sem apagar versões anteriores. Sensível não admite dispensa e exige evidência e reconhecimento explícito. A frase do reconhecimento e seu ator/instante são gerados pelo servidor/banco.
- A marcação avança a revisão do checklist, não a revisão/status do chamado. Quando a revisão do chamado muda, o snapshot antigo não é herdado. Leituras apontam para nova revisão inicialmente sem marcações; as antigas permanecem na tabela/auditoria.
- Nenhuma marcação gera evento público, resposta humana, intenção de notificação ou alteração de SLA.

## Persistência candidata
Cinco tabelas privadas: templates publicados; vínculo do ticket ao perfil/template; snapshot por revisão de ticket; auditoria imutável com antes/depois; recibo imutável por pessoa/ticket/chave. O template e o vínculo não podem ser alterados pela aplicação de request. A publicação qualificada de templates e a criação do vínculo pelo intake real continuam pendentes, não são substituídas por dados padrão.

O SQL encontra-se em `supabase/candidates/hdn_execution_checklist.sql`, fora do manifesto de migrations. Só instala com marcador local, banco `helpdesk_test`, PG17 e administrador do runner. Os helpers SECURITY DEFINER leem/escrevem tabelas privadas sem conceder SELECT/UPDATE direto ao app, revalidam pessoa/scopes/papel/recursos e são restritos ao login `helpdesk_app`. Funções internas não têm EXECUTE pelo app; PUBLIC, anon, authenticated e service_role não recebem acesso. Tabelas com ENABLE/FORCE RLS. Não usar o SQL para contornar indisponibilidade de um fornecedor ou aprovação de configuração.

`hdn_lock_execution_checklist` retém ticket/template/vínculo/snapshot até terminar a transação existente. `hdn_mark_execution_checklist` deriva ator e UTC no banco, confere versão e evidência novamente, grava snapshot/auditoria/recibo no mesmo statement transacional. Dados do corpo não são adotados como snapshot. Respostas SQL são novamente validadas pelo domínio; divergência faz rollback antes do COMMIT. Nenhum caminho faz retry automático após confirmação perdida.

O hash canônico do template é verificado na aplicação contra a referência fixada. O validador estrutural SQL não é um assinador nem certifica a origem de um template. O futuro publicador qualificado deverá calcular/verificar a correspondência antes de inserir e dar o aceite apropriado.

## Composição e HTTP
`createExecutionChecklistService` reutiliza o resolver, `runResourceTicketTransaction` e o runner originais, com a mesma conexão. A factory congela uma cópia da pessoa autenticada; o browser não constrói Principal. Adapter não adquire outro pool nem faz COMMIT.
Montador opcional:
- GET `/v1/internal/tickets/{id}/execution-checklist` — registro privado e ETag da revisão do checklist.
- POST `/v1/internal/tickets/{id}/execution-checklist/marks` — If-Match da revisão do checklist, Idempotency-Key e expectedTicketVersion no corpo. GET/HEAD não marcam.
Origem HTTPS configurada, limite8KiB, leitor JSON/deadline existente, autenticação e quotas exigidos, recurso vindo de diretório privado, respostas no-store. Auth/MFA é o existente; confirmação de risco não substitui MFA nem alçada institucional. Nenhuma rota foi montada no runtime ou anunciada em capabilities/OpenAPI nesta entrega.

## Integração com a resolução
O adapter expõe `readExecutionChecklist(ticketId)` no contrato já introduzido em HDN-01a. O `SupportWorkflowTransaction` real deverá delegar a esse método NA MESMA conexão, sem um pool aninhado. O lock do ticket impede marcação concorrente enquanto a resolução fixa sua revisão; o commitDecision deve manter o CAS existente e resumo privado da HDN-01a. Não liberar a resolução genérica antiga para contornar isso. A persistência de perfil/workflow completo ainda precisa estar montada e consistente com o binding.

## Limites
Implementado localmente, não homologado no PostgreSQL. Sem criação de migration pela CLI indisponível; sem mudança de versão/schema/lock/12 migrations, grant, MFA, fornecedor ou release flag. SQL e cenários registrados devem ser executados no checkout integral. UI de marcação, publicador de templates, binding de intake e integração completa continuam HDN-01b/01c. Os testes antigos D/E/G JÁ passaram na consolidação R1; não descrevê-los como pendências históricas não executadas.
