# Consulte GEO — upgrade do banco M05

Data: 13/10/2026. Base `392fdd2bf3b9bafdd574dce5df66483e13127c0a`; branch `codex/consultegeo-m02`; [PR31 em draft](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/31). A M05 prepara e homologa o upgrade da base 0.19.0 para os módulos Consulte GEO desenvolvidos até M04. API/interface permanecem 0.27.0; a fonte candidata passa a exigir schema 0.20.0.

## Entrega

A migration `20261013181408_consultegeo_m05_upgrade.sql` foi criada pela CLI oficial Supabase 2.120.0 e preenchida pelo compiler local. A distribuição Windows AMD64 foi conferida contra o checksum oficial: `53920013d24bc9e66180f35ceeea9ddc20e65a7afa883421e9c0ba60ad7457ee`. O comando local criou o arquivo; não conectou ou instalou em um projeto hospedado. Referência do comando: [CLI migrations](https://supabase.com/docs/reference/cli/supabase-migration-new).

O upgrade reúne, na ordem de dependência, escopo de recursos, observações, publicação privada da origem, checklist, workflow M02/M03 e configuração M04. Os doze arquivos anteriores e os seis candidatos ficam intactos. A receita `supabase/consultegeo-upgrade.manifest.json` registra origem/hashes, prefixo histórico, migration e sua geração; o manifest principal passa a treze migrations. `npm run check:consultegeo-upgrade` confere toda essa cadeia, sem importar driver, executar SQL ou reparar arquivos.

O contrato estático revisado contém 48 tabelas, 94 funções, 39 triggers, 257 constraints e 38 policies. As 25 tabelas, 37 funções, 18 triggers, 26 constraints declaradas e 28 policies do contrato anterior foram comparadas e preservadas. As 23 tabelas novas não dão DML direto ao app; há vinte helpers adicionais de entrada para os módulos e dez policies CG adicionais restritivas. Os checks anteriores de RLS, schemas, colunas, helpers, constraints, índices e triggers continuam ativos. Metadados conferidos não substituem os testes semânticos de autorização.

## Instalação e permissões

BEGIN/COMMIT envolvem o upgrade inteiro. A admissão exige PostgreSQL 17, marcador anterior exato, operador qualificado com propriedade da estrutura privada e privilégios de migration. Advisory lock serializa a instalação e locks protegem as tabelas antigas. Uma instalação parcial de objetos CG/HDN é recusada; reaplicação é recusada pelo marcador. O schema muda somente ao final.

Não há criação automática de clientes, pessoas, capabilities, registry, configurações publicadas, canais, vínculos de chamados ou preenchimento de dados antigos. O upgrade conserva os registros, snapshots e escopos existentes. Um chamado somente vinculado ao checklist, sem estado completo do workflow, não recebe autorização implícita para usar o writer genérico; a recusa e seu rollback foram testados na composição promovida. Chamados antigos sem vínculos novos conservam o percurso anterior.

`helpdesk_app` continua o login normal de request. `helpdesk_resource_publisher` fica separado, com USAGE em auth e execução somente de três comandos privados de publicação. `helpdesk_notification_worker` é reservado sem acesso a schemas, tabelas ou funções de domínio; nenhuma operação de entrega existe para esse papel nesta etapa. Novos papéis nascem NOLOGIN. Papéis existentes seguros conservam LOGIN/credencial; identidades com administração, associação, propriedade ou direitos privados indevidos recusam a instalação. A prontidão também verifica essas fronteiras efetivas.

A admissão também recusa privilégios padrão incompatíveis do operador, globais ou nos schemas privados. O owner mantém seus direitos; o EXECUTE padrão PUBLIC de funções é revogado pelos corpos qualificados. A instalação não transforma um default configurado para outro papel em acesso a helpers novos. Antes do marcador/COMMIT, uma segunda conferência verifica os direitos efetivos do publicador e do worker, incluindo coluna, função, schema, propriedade e associação. Um excesso tardio provoca rollback integral, sem remover silenciosamente um default existente.

A referência Supabase distingue permissões de objeto e RLS: [segurança da API](https://supabase.com/docs/guides/api/securing-your-api). O Help Desk mantém seus schemas privados e a API própria; a M05 não concede acesso aos papéis anon/authenticated/service_role nem altera a configuração da Data API.

## Validação

CI integral aprovado na fonte `febce83f75c45bb85aa6e22c26325e54b7b0a969`, [run38453749955](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38453749955): **4.384/4.384 aplicação, 385/385 PostgreSQL17 e 184/184 interface**, zero falhas, cancelamentos, skips ou todo. Lock, instalação limpa, audit, tipos, contratos/migrations, scan heurístico de segredos e build passaram no workflow original Linux/Node22. A suíte nativa inclui quatorze casos M05 mais seu teste pai, exercitando login restrito real, instalação nova, upgrade histórico, credencial preservada, rollback e limites do worker/publicador.

Fingerprint `cffaa123ce2f9f1ed2c1594a49b083863efe6fb0d43c2f1075ae15afb64d3457`. Relatório e seis logs da mesma execução foram importados para `evidence/homologation`, preservando os anteriores. `npm run check:homologation` confirmou a fonte, hashes, contagens e estrutura no Windows. [Origem CI](../evidence/consultegeo-m05/ci-source.json): `tests_executed:false` ali descreve apenas preparação da fonte; os resultados estão no relatório homologado. Documentação e evidências posteriores não mudam esse fingerprint.

Migration final: 163.253 bytes, SHA256 `23aae798d34cf5c4d6e96478761dfb2e5208dc071fd886f2ab56d78e12d83b1a`. O negativo de default ACL e o de EXECUTE extra no fim da instalação passaram no PG17 real, com recusa e rollback antes do marcador. Esta prova não é instalação Supabase, aceite de TLS/pooler/Function hospedados, entrega de e-mail ou liberação operacional.

Local: 126 focais passaram ao revisar a extensão do contrato; após a correção final, 54 focais, typecheck e checagens offline passaram. Quatro testes históricos de symlink do loader não executam com sucesso na restrição padrão do Windows; passaram no workflow Linux, sem skips ou enfraquecimento. A leitura do inventário nativo revisou a extensão do contrato antes de qualificá-lo; o runtime não captura e adota permissões automaticamente.

O primeiro CI `09ddf56` instalou o upgrade e capturou o catálogo, mas a fonte ainda usava parte das expectativas 0.19: 4.378/4.384 aplicação e 351/370 PostgreSQL. O segundo, `45c31f0`, aprovou 4.384/4.384 aplicação e 184/184 interface; faltavam adaptar dois cenários nativos ao catálogo completo: seis tabelas CG antigas versus dez promovidas e uma resposta genérica num checklist sem estado de workflow. Os 12 novos cenários M05 e seu teste pai passaram naquela execução, incluindo instalação/rollback, papéis e credenciais reais do cluster próprio. A execução ainda falhou 379/383 PostgreSQL e não é homologação final.

A revisão independente encontrou uma falha Important de default ACL: o operador podia conceder automaticamente EXECUTE em funções novas ao publicador, e a recusa do readiness ocorria depois do COMMIT. A regressão real `4277dba`, [CI38452159544](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38452159544), observou a instalação aceitar esse caso: 382/384 PostgreSQL, falhando somente o novo negativo e seu teste pai. A correção acrescenta admissão de defaults e conferência final de privilégios, mantendo os seis candidatos intactos. O reviewer revalidou 24 focais, receita, migrations e tipos no código corrigido e não identificou Critical/Important restantes; não presumiu o resultado PG17 da CI. [Revisão final](../evidence/consultegeo-m05/review-final.md).

## Promoção e retorno

Esta entrega é de engenharia, em branch. A aplicação hospedada deve ocorrer junto com código compatível 0.20.0, pela promoção própria; publicar apenas o código sobre a base 0.19 ou apenas trocar o marcador produz incompatibilidade. O atendimento continua fechado até os aceites de montagem e operação.

Procedimento a executar no ambiente da Consulte GEO quando a promoção for autorizada:

1. Reinspecionar repositório, schema/versão, proprietários, privilégios e defaults do operador, logins restritos e destino, preservando alterações concorrentes. Conferir receita, manifest e evidência da mesma fonte.
2. Confirmar backup/retorno e janela de manutenção, mantendo o gate fechado. Não testar DDL experimental no banco hospedado.
3. Aplicar o upgrade íntegro por identidade privada qualificada e registrar a migration no histórico do provedor. Não instalar arquivos de candidatos isoladamente nem provisionar senha em SQL do repositório/chat.
4. Publicar o código compatível e executar diagnóstico somente leitura com login real do app; validar TLS, schema, catálogo, permissões e rollback/cleanup.
5. Na M06, montar writer/configuração e leitura pública restrita; M08 qualifica origem/registry. Dados e capabilities da Consulte GEO são provisionados por fluxos autorizados, nunca pelas seeds de teste.
6. Conservar atendimento/e-mail fechados até os próximos aceites. Storage/relógios/worker/webhook são M11; piloto operacional é M12.

Se houver erro antes de COMMIT, a transação deve ser encerrada por ROLLBACK e o marcador permanecer 0.19. Após um COMMIT bem-sucedido, não fazer downgrade artificial do marcador ou apagar tabelas: retorno exige procedimento de backup/restore compatível com código/dados e suas próprias verificações, ou correção progressiva revisada. Este recorte não executa restore hospedado nem atesta RTO/RPO.

Não houve aplicação remota, alteração hospedada de Auth/grants/segredos, envio de e-mail, registro no GlobalCad, merge ou deploy de produção. O pipeline do PR cria uma prévia automática, cujo build não constitui aceite de banco/runtime. O próximo bloco de desenvolvimento é M06.
