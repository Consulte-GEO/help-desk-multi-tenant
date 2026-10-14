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

Neste checkpoint, a fonte está qualificada; a promoção hospedada e a ativação ainda serão verificadas. O backup protegido anterior e o backup do provedor foram conferidos. A receita privada revisada usa uma transação única, protege as 25 tabelas existentes e preserva o histórico das 12 migrations já hospedadas.

## Emails

Canal autorizado: Resend, remetente Consulte GEO — Help Desk <helpdesk@consultegeo.org>, Click tracking mantido. O teste técnico autorizado para thiago@consultegeo.com.br foi aceito pelo Resend e recebido no Gmail; ele não comprova um chamado real nem entrega pelo outbox Help Desk.

Os eventos iniciais são abertura, devolutiva pública e resolução. O worker usa conexão e papel exclusivos, transporte TLS, fila persistente e orçamento limitado por ciclo. Resultado incerto permanece para reconciliação, sem reenvio automático duplicado. A conexão dedicada e a ativação do worker hospedado são as próximas verificações. A integração Novo GEO continua adiada.
