# Execução hospedada dos emails Consulte GEO

O deploy82385d8 incorporou a conexão dedicada e a flag de entrega, porém o agendamento real retorna503. A conexão foi qualificada fora do runtime com papel exclusivo e TLS cliente/backend. O guard continua fechado; não considerar o worker ativo somente porque o schedule foi registrado.

1. Registrar a falha real pelo request log do Netlify e conferir os metadados das oito variáveis fixas, sem ler valores secretos.
2. Acrescentar observação privada e finita da fase de falha no scheduled handler. Capturar somente flags de presença, sem dados, stack ou objeto de configuração/erro. Manter os guards e a resposta pública. Isolar estado por invocação e ignorar falha do logger.
3. Testar recusa antes de env/SQL, falhas de configuração/inicialização/ciclo, privacidade, logger e concorrência. Revisão independente, qualificação completa vinculada à fonte e publicação por PR.
4. Identificar a fase no agendamento real, corrigir sua causa e repetir somente as verificações necessárias à mudança. Exigir execução real204 no deploy publicado antes de afirmar ativação.
5. Registrar a primeira notificação ligada a chamado real separadamente. Não fabricar chamados ou autoridade para criar prova de transporte. Callback de entrega usa segredo nativo próprio e permanece etapa separada.
