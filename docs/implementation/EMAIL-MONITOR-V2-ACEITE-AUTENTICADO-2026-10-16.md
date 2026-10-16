# Gestão de e-mails — verificação autenticada de 16/10/2026

## Resultado e alcance

A tela produtiva foi acessada na sessão humana existente, identificada pela própria interface como Administrador, em `https://helpdesk.consultegeo.org/`. A lista, o modal de entrega e o detalhe do destinatário carregaram dados reais. O smoke visual autenticado desktop está comprovado. Não foi necessária alteração de código, banco, segredo ou permissão nesta verificação.

Os testes complementares de todos os filtros e da apresentação produtiva em360px **não foram concluídos**: o controle do Chrome alternou entre respostas válidas e timeouts de foco, avaliação e envio de comandos. Não confundir esses erros do controle com defeitos demonstrados da aplicação, nem considerar uma tentativa como aprovação. A validação mobile/DOM do CI continua uma evidência distinta, com a fonte e os limites registrados na matriz.

## Evidências observadas

| Verificação produtiva | Resultado observado |
|---|---|
| Sessão e montagem | Perfil Administrador, navegação E-mails e título Comunicações por e-mail |
| Histórico real |11 comunicações, oito do CG-10002 e três do CG-10001; horários em America/Sao_Paulo; paginação desabilitada quando não há outra página |
| Entrega do CG-10001 / Abertura | Modal com Saiu, Entregue, Aberto* e Clicou, cada um com1 observado |
| Cobertura histórica | Aviso explícito de cobertura indisponível e de que fatos históricos não representam taxa da coorte; nenhuma fração1/1 inventada |
| Destinatário antigo | Destinatário indisponível e referência da intenção, sem reconstrução do endereço atual do Auth |
| Telemetria real | Colunas de abertura e clique em15/10/2026 16:56, correspondentes aos callbacks nativos já comprovados |
| Detalhe | Estado operacional Entregue, uma tentativa, referências exatas da intenção/evento/provedor, versão e hash do template e linha do tempo com ocorrência/recebimento |
| Retorno do detalhe | Voltar à entrega restaurou o resumo e o foco no botão Detalhes do destinatário |
| Teclado | Escape fechou o modal; leitura DOM confirmou zero dialogs abertos e foco no Ver entrega do CG-10001/Abertura |
| Fila | Situação Fila selecionada,0 comunicações e mensagem Nenhuma comunicação encontrada; resultado vazio distinguido de erro |
| Desktop | Duas capturas nativas salvas e inspecionadas: resumo de entrega e detalhe, com cabeçalho/rodapé e rolagem interna |

A intenção conferida foi `fd88db0d-18f2-4b32-b695-3402410f79bc`, providerMessageId `01a13cbd-aa65-721b-9519-f9860eee49f8`, evento `8fb268d9-288c-41f3-b905-91028dc2f464`. Esses identificadores vieram da interface e coincidem com a prova anterior; não foram usados para simular autenticação ou forjar associações.

## Arquivos de evidência

Em `evidence/email-monitor-authenticated-20261016/`:

- `delivery-desktop.jpg`: modal com os quatro indicadores e avisos de interpretação.
- `recipient-desktop.jpg`: detalhe e linha do tempo do destinatário.
- `recipient-detail.txt`: snapshot DOM renderizado do detalhe, incluindo tentativa e metadados.
- `queue.txt`: texto renderizado da consulta Fila com resultado vazio.
- `verification.json`: alcance, checks comprovados, limitações e hashes dos arquivos.

Não foram lidos ou persistidos cookies, tokens, storage do navegador, chaves ou headers. Não houve novo e-mail, alteração de chamado, seed ou reaplicação de migration. O teste de clique/abertura de15/10 foi técnico/automatizado e continua sem equivaler a leitura humana, ciência ou aceite.

## Continuidade e cuidados

O início de cobertura de ambos os sinais permanece o marco comprovado de15/10/2026 19:57:29.552038Z (16:57:29 Brasília). A intenção antiga observada não se torna elegível por ter um fato posterior. Não preencher endereço histórico por inferência, retroagir cobertura, apagar lacunas ou transformar ausência de coleta em zero.

A visualização de endereços completos de envios novos e a máscara no perfil da equipe não foram exercitadas nesta sessão administrativa com dados antigos; as provas SQL/HTTP/CI existentes continuam separadas desse smoke. Não trocar o papel da conta real para executar essa comparação.

A timeline apresenta tanto fatos projetados quanto recibos nativos, que podem ter o mesmo rótulo e horário, mas valores distintos de recebimento. Isso não representa duas tentativas ou dois destinatários. Como possível refinamento de apresentação, pode-se avaliar uma identificação explícita da origem de cada linha; não houve alteração funcional nem deduplicação destrutiva nesta rodada.

Falhas e atenção, busca por protocolo/período/destinatário, navegação completa por Tab e screenshot produtivo mobile ficam como verificações complementares bloqueadas pelo controle, sem alegação de aprovação. O override temporário360x800 foi solicitado pela API de viewport; a captura expirou e reinicializou o controle. Após reconexão, `viewport.reset()` concluiu para remover a alteração temporária. A tentativa de restaurar Histórico também expirou: a última consulta confirmada continua Fila; o usuário pode selecionar Histórico normalmente.

Para retomar, usar a sessão humana legítima e os controles normais da interface. Não criar endpoint diagnóstico, copiar sessão, enfraquecer MFA ou contornar o navegador por leitura de credenciais. Este documento supera a afirmação anterior de que nenhuma inspeção autenticada havia ocorrido, mas não fecha as verificações complementares acima.
