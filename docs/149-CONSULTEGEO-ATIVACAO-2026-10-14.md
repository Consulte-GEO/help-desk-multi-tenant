# Ativação do atendimento Consulte GEO — 14/10/2026

O atendimento passa a usar um cadastro local de clientes e obras enquanto a integração com o Novo GEO permanece adiada. A configuração inicial autorizada atende MRV — Residencial Encanto, com thiago@consultegeo.com.br como administrador e operador inicial.

## Composição qualificada

API/interface 0.31.0 e banco 0.24.0, com 17 migrations, 67 tabelas, 162 funções, 58 triggers, 355 constraints e 38 políticas. O prefixo de 16 migrations permanece integralmente preservado. A migration 17 tem SHA-256 `8ea04783e17104368741a895cdd2db20c5a45089914194f6269a3c83a5e48d8d`.

CI 38604378747, fonte d296a70f9211461eb1cd55b75c65719185ebc297: 4.913 testes de aplicação, 577 PostgreSQL e 561 de interface aprovados, sem falhas, skips ou cancelamentos. Fingerprint `3474b651e30d1ab16e38b1a414e5eab2516cfe5a71cc6f8e20fe74d5b844c7d6`; seis logs conferidos e revisão independente concluída. O terceiro cluster aplica as 17 migrations por operador NOSUPER genuíno. A evidência está em `evidence/activation-20261014` e `evidence/homologation`.

O primeiro conjunto publicado inclui Dúvidas, Backup e Relatar Problemas, seis configurações de workflow/checklist, SLA em horário útil de segunda a sexta, 08h–18h, America/Sao_Paulo, e reabertura em até sete dias. A configuração exige cumprimento dos itens obrigatórios antes da resolução. O novo namespace de protocolos CG começa em CG-10001 e não representa continuidade confirmada da numeração do GlobalCad.

A abertura grava protocolo, snapshot, evento, fila de notificação, recibo e vínculo do checklist na mesma transação. O isolamento considera cliente e obra antes dos filtros e da paginação. Alterações no cadastro local revogam o acesso corrente. Respostas privadas não seguem para o solicitante.

## Publicação e operação hospedada

Portal canônico: https://helpdesk.consultegeo.org. A raiz, index e links de chamados do alias Netlify redirecionam para o domínio canônico. As rotas e os headers próprios do Wiki foram preservados.

A sequência de implantação é código compatível com atendimento fechado, upgrade atômico 13–17 com histórico e dados preservados, configuração real MRV/obra, verificação do contrato hospedado e ativação dos módulos. A administração de configurações permanece fechada até o cumprimento do requisito de MFA. O operador inicial usa delegação explícita registrada, sem atribuir autenticação forte fictícia.

PR34 integrado em 6f9e389; código publicado em produção no deploy 6acfbe235d4a377dd520573c, ainda com atendimento fechado. Os 86 arquivos publicados conferem com o build, as rotas fechadas retornam503, identidade anônima retorna401, links profundos e Wiki retornam200. A migração hospedada foi aplicada em uma transação única e confirmou banco0.24/17 migrations, com as25 tabelas anteriores e os12 registros históricos preservados.

O contrato atual hospedado foi aprovado:67 tabelas,15 verificações de prontidão, aplicação sem privilégios administrativos, memberships ou objetos próprios. A configuração inicial real foi gravada às17:42:49Z com o mesmo requestId e commandHash do plano aprovado. O recibo registra delegação operacional, três configurações publicadas e origem local explícita. As flags de atendimento/workflow/intake foram configuradas somente em Production/Functions; o redeploy e o aceite HTTP liberado seguem como próxima verificação.

O backup protegido anterior e o backup do provedor foram conferidos. A receita privada revisada preservou os dados e o histórico existentes antes do COMMIT. CodeQL apontou um falso positivo no teste negativo que injeta `%00` em uma constante de conexão fictícia; a conferência independente confirmou que o trecho não sanitiza entrada externa e que o validator rejeita NUL antes de criar o pool.

## Emails

Canal autorizado: Resend, remetente Consulte GEO — Help Desk <helpdesk@consultegeo.org>, Click tracking mantido. O teste técnico autorizado para thiago@consultegeo.com.br foi aceito pelo Resend e recebido no Gmail; ele não comprova um chamado real nem entrega pelo outbox Help Desk.

Os eventos iniciais são abertura, devolutiva pública e resolução. O worker usa conexão e papel exclusivos, transporte TLS, fila persistente e orçamento limitado por ciclo. Resultado incerto permanece para reconciliação, sem reenvio automático duplicado. A conexão dedicada e a ativação do worker hospedado são as próximas verificações. A integração Novo GEO continua adiada.
