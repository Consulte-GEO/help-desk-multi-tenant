# E-mails do Apoio Implantação

PR58, fonte `121ca8aae1381a6ed024f3b39e98fc8eb00d87cc`, fingerprint `35e7fa509dfe58e0d6cdf792102c9d852114c37d1525e226c42cd3a59cd39d1b`. A fila privada é admitida na transação da operação e processada pelo notification-worker e transporte Resend existentes. Não há novos segredos, provedor, scanner ou serviço Render. Destinatários são pessoas internas, ativas, com endereço confirmado e acesso vivo à conta. Notas internas não geram aviso. Compartilhamento e callbacks têm deduplicação persistente; envio incerto não é reenviado automaticamente.

Aba E-mails com consulta por registro e destinatários mascarados; modais distinguem fila, aceitação e entrega. Novos registros reaparecem ao reativar a aba. A montagem diferida dos modais foi qualificada no navegador. O estágio IMP e o núcleo de chamados executam independentemente; erro em qualquer estágio aparece no resultado503 do cron.

## Qualificação

CI [38802777836](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38802777836), commit de teste `aee2d523c956cee564994656e8079ed113b949f1`: aplicação, PostgreSQL e interface aprovados, sem falhas/skips. Artefato12004724338/digest `sha256:c31f3c9c3abc28f6d85475dfb3fc1d0d7556a4eb207bfc6868fbc61742719fa1`. Relatório/logs originais em `evidence/homologation/runs/c93a1591-8e05-42d9-b487-91efdf6603f6`; validados por hashes e fingerprint antes da promoção.

Qualificação específica [38802777967](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38802777967):49 verificações PostgreSQL17.11 (20 originais+29 e-mail),26 jornadas Chromium e13 contratos frontend. Inclui login worker real restrito, audiência/revogação, quotas, CAS/leases, rollback, envelope imutável, callback anterior ao ACK, estados incertos e preservação do core. Sem rede Resend; transporte real com fetch sintético. Artefato12004408626/digest `sha256:a6f5473301f90a159ef111259d0d916859b53a419e1f466e9b6c8084ac200d10`; arquivos originais copiados em `evidence/apoio-implantacao-emails/ci-121ca8a`. HDA38802777917 também aprovado. Revisão independente concluída e achados corrigidos.

## Banco e publicação

Aplicado somente addon `implementation_support_email_private_addon_v1`, versão registrada pelo Supabase `20261015234609`, projeto HelpDesk `xaelbntjnvztznnpcvtm`. Fonte SQL SHA256 `0f9fbdcfe4665a2edb71e03e4eb474da90e436c7dbc09d4df7feaaee8ca91c45`. A primeira chamada expirou sem efeito (ausência conferida antes de repetir); a segunda confirmou sucesso.

Conferência após DDL:core0.27/88 tabelas preservados; quatro tabelas novas FORCE RLS;12 funções SECURITY DEFINER/search_path vazio; zero acesso direto a tabelas por app/worker; zero acesso de anon/authenticated/service_role ao schema. Fila inicialmente vazia. Não foram criadas identidades, registros de negócio ou mensagens de teste em produção.

Publicação do código e primeiro ciclo produtivo do worker serão registrados após o deploy. Nenhuma entrega real é alegada: dependerá de uma operação legítima e de confirmação do provedor. Links continuam exigindo login e autorização; Novo GEO aguarda contrato/API e o scanner permanece cancelado.
