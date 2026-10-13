# Consulte GEO workflow e comunicação do atendimento

O pedido atual autoriza desenvolver a próxima etapa do plano V5 nesta conversa. As decisões delegadas por Thiago prevalecem sobre as propostas anteriores: produto focado na Consulte GEO; Resend; Email Kit fornecido como identidade; decisões de SLA, acesso e ciclo pelo implementador; implantação somente por planilha. Esta etapa não exige construir suporte a outras empresas.

## Resultado deste incremento

Integrar e verificar o writer PostgreSQL M02, fechar compatibilidades M03 e entregar política Consulte GEO e transporte/renderer de e-mail reutilizáveis. A aplicação preserva identidade, conta e obras autorizadas já existentes, sem introduzir novas abstrações de produto. Publisher, origem Novo GEO, montagem hospedada e piloto seguem os próximos blocos do V5.

## Decisões de operação

- Atendimento de segunda a sexta, 08h–18h, America/Sao_Paulo. Um dia útil corresponde a dez horas de atendimento. Feriados são lista explícita de datas no calendário publicado; a ausência de calendário qualificado não produz vencimento fictício.
- Cadastro, liberação e dúvidas: primeira resposta em quatro horas úteis, solução em dez. Backup: quatro/trinta horas úteis, resolvendo a divergência atual em favor de três dias para preparar e conferir o pacote. Implantação nova: oito/setenta; ajuste: quatro/trinta. Problemas: urgente uma/dez, alta duas/dez, normal quatro/dez, baixa oito/trinta horas úteis. SLA começa após recebimento completo; estados de espera do cliente pausam solução, encaminhamento interno/externo não apaga consumo ou violações.
- Perfis de produto: solicitante, gestor do cliente, equipe Consulte e administrador Consulte, mapeados aos papéis existentes. Obra/grupo vêm da origem autorizada. Não copiar logins compartilhados do sistema atual nem conceder acesso por e-mail.
- Ações de usuário: incluir, alterar, desativar, reenviar acesso e liberar em nova obra. A execução no GEO permanece humana. Transferência só por equipe autorizada para atendente ativo com cobertura integral das obras e motivo, sem conceder acesso ao destino.
- Resolução exige texto e checklist quando vinculado. Reabertura exige motivo e até sete dias corridos após a resolução ou fechamento correspondente; fora da janela, orientar novo chamado vinculado. Mensagem pública em estado terminal exige reabrir antes. Aprovação pendente impede comandos, exceto cancelamento autorizado. Resposta do cliente em aguardando cliente retoma atendimento sem perder responsável.
- Implantação aceita XLSX e CSV, até 15 MiB por arquivo. XLS, formatos com macro e DWG ficam fora dessa família. Outros serviços conservam seus formatos próprios. Esta política não anuncia Storage/scan ainda não montados.
- E-mail contém protocolo, título e explicação pública curta do evento, uma ação para abrir o portal e motivo do envio. Detalhes da obra, formulário, devolutiva integral, arquivos, notas e checklist ficam no portal. O Email Kit é referência visual, não código executável nem fonte de endereço jurídico; o rodapé não usa Rua Exemplo nem links inexistentes.
- Renderer de tabelas, largura máxima 600px, fonte de sistema, fundo #faf9f7, texto #16213e, cabeçalho azul #182863 com gradiente #3E2D71/#C5117E e CTA com altura mínima 44px. Preservar hash/versão do template e escaping. Palavra Consulte GEO permanece visível mesmo sem imagens.
- Canal Resend usa POST fixo, chave server-side, remetente explicitamente configurado, mesma Idempotency-Key e sem retry interno. Aceite exige ID válido. Timeout/5xx/ACK sem ID ficam desconhecidos. Só rejeição tipada comprovada autoriza retry. Lookup usa prova correlacionada durável; não inventa sequência a partir de resposta nativa.

## Persistência e segurança

Um cliente transacional emprestado para ticket, perfil, recursos, checklist, decisão, evento, efeito, outbox e recibo. Não criar outro outbox. O candidato SQL permanece no runner descartável PG17 até promoção M05. Migrations anteriores, grants de pessoas, segredos e gate operacional são preservados. Políticas de produto são configuração versionada para futura publicação, não criação de usuários/grants.

## Aceite

Testes de workflow incluem comandos positivos, transições de cliente, reabertura, transferência, replay, SQL direto, mensagens antigas e rollback. Transporte Resend é testado com servidor/fetch controlados sem enviar e-mails reais; HTML é renderizado e inspecionado em desktop/mobile. CI original Linux22/PG17/Chromium qualifica a fonte completa. Nenhuma contagem local substitui PostgreSQL ou jornada hospedada.
