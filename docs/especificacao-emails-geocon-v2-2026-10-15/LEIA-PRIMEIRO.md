# Especificação de e mails com referência GEOCON

Pacote V2 de 15/10/2026 para a pessoa que continuará o Help Desk no Claude. A referência visual passa a ser o modal Entrega do e-mail do broadcast do GEOCON. O escopo de monitoramento aprovado após a análise do GEOLAB continua válido.

## Ordem de leitura

1. [Especificação V2](ESPECIFICACAO-V2-GESTAO-EMAILS.md): comportamento, indicadores, dados, segurança e sequência de desenvolvimento.
2. [Protótipo visual](PROTOTIPO-ENTREGA-EMAIL.html): abrir em um navegador; todos os dados são fictícios. Os controles de perfil/cenário pertencem à demonstração, não ao produto.
3. [Análise do GEOCON](ANALISE-REFERENCIA-GEOCON.md): correspondência da imagem com o código e adaptações necessárias.
4. [Mudanças desde a V1](ALTERACOES-EM-RELACAO-A-V1.md) e [decisões humanas](DECISOES.json): o que mudou e o que permanece.
5. [Handoff ao Claude](HANDOFF-CLAUDE.md), [checklist de aceite](CHECKLIST-ACEITE.md) e [requisitos estruturados](REQUISITOS-V2.json).

## Uso com os pacotes anteriores

O handoff geral `HelpDesk_Handoff_Claude_2026-10-15.zip` continua sendo a base da auditoria do projeto. O complemento `HelpDesk_Complemento_MEL09_Emails_2026-10-15.zip` guarda as sete decisões sobre e-mails e a aprovação da MEL-09. Esta V2 prevalece na organização visual e no detalhamento MON-01 a MON-05; não altera os fatos históricos ou aprova as demais propostas.

Os três pacotes devem ser fornecidos ao colega. A cópia de [aprovação da MEL-09](DECISOES-E-BACKLOG-ADICIONAL.md) neste pacote mantém esse contexto acessível. O pacote de melhorias para aprovação preserva as outras 13 sugestões pendentes.

Esta entrega contém especificação, protótipo e verificações documentais. Não inclui implementação do painel ou da nova telemetria no produto. O protótipo não consulta serviços, não possui autenticação real e não comprova isolamento de backend.
