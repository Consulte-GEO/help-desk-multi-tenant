# Contenção de coortes — contrato candidato C16

## Estados

`prepared` não libera atendimento. `pilot` permite somente a coorte e as funcionalidades comprovadas. `accepted` exige aceite adicional vinculado àquela revisão. `contained` fecha a coorte; não apaga o histórico nem os recibos.

Os comandos exigem a prova opaca do Auth/MFA existente e capacidades explícitas `release.prepare`, `release.pilot`, `release.accept`, `release.contain`. A leitura usa `release.read`. Adicionar nomes ao catálogo de capacidades não concede esses grants; nenhum foi atribuído a Thiago ou a outra pessoa nesta entrega.

Toda alteração exige revisão esperada, motivo e chave de intenção. A persistência deve produzir estado, auditoria e recibo atomicamente, sob locks. O adapter durável não foi implementado. Recibo histórico pode ser consultado após contenção; isso não reabre nada. Recibo malformado ou de outro comando não pode anunciar aceitação.

## Emergência e retomada

A contenção não exige que o certificado antigo ainda esteja válido: fechar deve continuar possível após expiração. MFA/capacidade e identidade atuais continuam obrigatórios. O procedimento de emergência quando essa autoridade não está acessível precisa ser aprovado; não existe bypass secreto neste pacote.

Não há transição direta contido → aceito/piloto. Preparar novamente exige outro manifesto e evidências atuais. O novo manifesto deve refletir a mudança legítima de fonte/configuração/geração/coorte, não ser editado só para alterar um hash. Não reemitir atestados automaticamente para evitar um bloqueio.

A leitura de rollout confere a geração de recuperação retida fora do backup, a root atual e a identidade observada. Um backup com registro de piloto antigo não basta para habilitá-lo. O controle retido deve ser reconciliado e a geração alterada por procedimento aprovado; restaurar simultaneamente ambos os lados antigos invalidaria a premissa e permanece proibido.

## Portas de produção obrigatórias

`LockedPilotStateReader.readLocked(client,p,ticketId,scope)` deve retornar o root e o piloto bloqueados, além de ticketId e dimensões completas **lidas do ticket/configuração autoritativos**, não uma cópia da solicitação. A alteração do root/coorte precisa serializar na mesma conexão até o COMMIT. O wrapper existente de autorização de recurso continua ativo. O novo módulo não autoriza campos/obras que esse wrapper recusou.

Categoria/canal/feature vêm do mapeamento fixo da rota e do diretório privado; não ler flags de liberação de querystring/header/corpo. Uma linha única de coorte precisa cobrir todas as dimensões e recursos; duas coortes não podem formar um produto cartesiano. Coleções, abertura, downloads e workers precisam de montagens próprias com o mesmo critério. Não conectar só o detalhe e deixar a rota antiga servir de desvio.
