# Consulte GEO M05 — upgrade verificável do banco

O pedido de continuar, após a entrega M04 e a indicação de M05/M06, autoriza desenvolver M05 nesta conversa. Permanecem as decisões de produto delegadas pelo usuário e o foco na Consulte GEO. Execução inline na branch/worktree existente do PR31, base `392fdd2bf3b9bafdd574dce5df66483e13127c0a`. A abordagem é arquitetural: promover os componentes SQL já homologados para um upgrade coerente. A autorização de desenvolvimento não solicita aplicação remota nesta rodada.

## Resultado e escolha

Uma migration criada pela CLI Supabase oficial e adicionada ao manifest leva o schema 0.19.0 a 0.20.0, preservando os doze arquivos anteriores byte a byte. A ordem é resource_scope, resource_observation, resource_publication, execution_checklist, support_workflow, consultegeo_configuration. São os seis candidatos já ensaiados, com sua origem/hashes registrados. Os arquivos de candidatos preservam os guards descartáveis; somente a cópia promovida substitui a admissão de instalação.

Escolha: um upgrade transacional por inteiro, com marcador de versão no final. Seis migrations independentes aumentariam estados intermediários e manutenção do readiness; aplicar candidatos avulsos perderia manifest e integridade. Nenhuma dessas alternativas é adotada. A instalação fresca usa as treze migrations em ordem; o upgrade usa 001–012, dados antigos e 013.

## Admissão e integridade

O upgrade exige PostgreSQL 17, schema anterior exato, operador com BYPASSRLS/superuser, propriedade da estrutura privada e capacidade de provisionar papéis. Serializa o upgrade, usa timeouts locais e recusa objetos cg_/hdn_ previamente instalados; não adopta uma instalação parcial. Papéis já existentes só são aceitos se restritos, sem administração, associação ou propriedade privada. A migration não altera senha/LOGIN de um papel existente. Novos papéis nascem NOLOGIN. Reaplicar é recusado por versão, sem reset de dados.

O corpo publicado deve corresponder a uma transformação determinística dos seis arquivos com hashes qualificados, mais prólogo/epílogo específicos M05. Uma verificação offline confirma manifest, prefixo histórico, receita, origem, SQL e hash. Não aceita path ou conteúdo vindo de HTTP, não escreve automaticamente durante um check e não importa driver para conferir arquivos.

BEGIN/COMMIT envolvem todos os efeitos. O marcador só muda após DDL e permissões. Falha de instalação ou drift não confirma um schema parcial. Não há INSERT de clientes, pessoas, capabilities, configurações, tickets, workflows vinculados, registry ou canais; nenhum backfill automático dos chamados antigos. A configuração dos dados da Consulte GEO será feita pelos fluxos próprios nas etapas seguintes.

## Readiness e papéis

O contrato estático do catálogo 0.20.0 descreve todas as tabelas/helpers/policies/triggers/constraints e privilégios do app. A consulta existente continua somente leitura e recusa objeto ausente, objeto inesperado, permissão excessiva, RLS/trigger/constraint inválido ou helper público. O inventário capturado no PG17 próprio serve à revisão da extensão, nunca à adoção automática no runtime. A versão esperada passa a derivar do contrato, incluindo o portal opcional.

`helpdesk_app` continua identidade normal de request, sem propriedade/BYPASSRLS. `helpdesk_resource_publisher` é o papel separado do publicador privado já desenvolvido, com somente USAGE em auth e execução dos três comandos de publicação autorizados. `helpdesk_notification_worker` é reservado sem acesso aos schemas/tabelas/helpers de domínio; não é um worker de entrega funcional. Readiness confere também esses limites, sem conceder privilégios de manutenção ao app. M11 definirá as operações privadas do worker Resend e sua identidade efetiva.

## Aceite

Negativos antes da implementação: arquivo/receita/hash alterados; ordem e prefixo antigos preservados; schema e roles/readiness divergentes. PG17 real comprova instalação fresca, upgrade com histórico existente, versão incompatível, privilégios, reaplicação, rollback de falha no meio da instalação e ausência de sementes automáticas. Os cenários CG/HDN/M02/M04 deixam de instalar candidatos em seus próprios blocos e passam a exigir os objetos instalados pela migration; mantêm suas asserções semânticas e negativas. Não remover guards dos candidatos nem diminuir testes.

O workflow original Linux/Node22 executa aplicação, PostgreSQL17 e interface; evidências source-bound e revisão independente final. No Windows, tipos/focais/checks offline; não usar o Supabase hospedado como laboratório. Registrar limites e procedimento de promoção no relatório141 e entregar pacote M05 com PR31 atualizado.

## Fronteira desta etapa

Preparação e homologação da migration, manifest, readiness e papéis. Não há aplicação hospedada, merge/deploy de produção, segredo/LOGIN provisionado, mudança do gate, concessão a pessoas, envio de e-mail ou gravação no GEO. M06 monta runtime e projeção pública; M08 qualifica origem/registry; M11 implementa Storage/relógios/worker/webhook. Schema 0.20.0 deve ser instalado junto com o código compatível em uma promoção futura, mantendo atendimento fechado até seu aceite.
