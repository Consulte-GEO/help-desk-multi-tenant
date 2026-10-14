# Execução hospedada dos emails Consulte GEO

O deploy82385d8 incorporou a conexão dedicada e a flag de entrega, porém o agendamento real retorna503. A conexão foi qualificada fora do runtime com papel exclusivo e TLS cliente/backend. O guard continua fechado; não considerar o worker ativo somente porque o schedule foi registrado.

1. Registrar a falha real pelo request log do Netlify e conferir os metadados das oito variáveis fixas, sem ler valores secretos.
2. Acrescentar observação privada e finita da fase de falha no scheduled handler. Capturar somente flags de presença, sem dados, stack ou objeto de configuração/erro. Manter os guards e a resposta pública. Isolar estado por invocação e ignorar falha do logger.
3. Testar recusa antes de env/SQL, falhas de configuração/inicialização/ciclo, privacidade, logger e concorrência. Revisão independente, qualificação completa vinculada à fonte e publicação por PR.
4. Identificar a fase no agendamento real, corrigir sua causa e repetir somente as verificações necessárias à mudança. Exigir execução real204 no deploy publicado antes de afirmar ativação.
5. Registrar a primeira notificação ligada a chamado real separadamente. Não fabricar chamados ou autoridade para criar prova de transporte. Callback de entrega usa segredo nativo próprio e permanece etapa separada.

## Correção da admissão do agendador

O deploy publicado9770415/6acfe132 retornou503 na fase `deploy_guard`, com contexto nativo `production` e observação `publishedDeploy=false`, antes de ler configuração/banco/Resend. A [API oficial](https://docs.netlify.com/build/functions/api/#schedule) define `schedule` exclusivo com path e sem requisições web. O [agendamento oficial](https://docs.netlify.com/build/functions/scheduled-functions/) ocorre automaticamente apenas no deploy publicado; `Run now` do painel é uma ação autorizada do operador, inclusive sobre deploys antigos.

Corrigir somente o worker agendado: exigir contexto nativo production e conservar o binding exclusivo do provedor. Não converter metadata, nem aceitar URL/header/body como autoridade. O bit published permanece no diagnóstico; o webhook HTTP conserva seu guard próprio. Testar production com bit false/ausente, preview/branch/contexto ausente com metadata forjada, binding somente schedule, logger e orçamento. Confirmar schedule no deploy corrente e recusa da URL pública, além do ciclo real204. Invocação manual de production antigo não demonstra execução no deploy corrente.
