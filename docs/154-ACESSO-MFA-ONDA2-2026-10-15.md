# Dependência de MFA para a segunda onda

O acesso simples agora permite consultar a segurança da própria conta, configurar o primeiro autenticador e concluir a entrada de quem já tem MFA. A consulta da operação e do perfil do Help Desk ocorre somente depois de o provedor validar o código. Os demais controles avançados permanecem desativados.

Esta entrega não altera fatores, permissões, segredos, política de autoaprovação, banco ou templates em produção. O titular configura o próprio autenticador na interface. A segunda onda de e-mails permanece em desenvolvimento e precisa de aceite próprio.

## Qualificação

- Fonte `1b59bef70a5ca0fb1b6bfe786394c85a72ce93a6`, incluindo a base E06 publicada pelo PR44.
- [CI38679892994](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38679892994):5.433 aplicação,609 PostgreSQL17 e583 interface;6.625 verificações, zero falhas, cancelamentos, skips ou pendências. Lock, instalação e auditoria aprovados.
- Fingerprint executável `25df5a8a1611b4aef536b4aaa4a7e05580d52d8d1658e5b7585f134f4156d22c`; relatório e seis logs originais em `evidence/homologation/`. Artefato11947881231, SHA256 `d04690578e337adae6001fe59f42b45735fa2cff3307ef693e922e8c172375c6`.
- Revisão independente do diff completo: nenhum Critical/Important. O único Minor, posicionamento de diálogos no head, foi corrigido antes da fonte qualificada.
- Navegador independente a320px com Auth/API sintéticos: preparação/confirmação de fator, limpeza de segredo e canvas, consulta de status e nova entrada MFA; sem armazenamento persistente ou acesso de negócio antes do código.

## Limites e publicação

Auth real, fator real e aprovação de negócio não são comprovados por fixtures. A produção e a configuração pelo titular serão verificadas separadamente. O PR45 entrega somente esta dependência; não publica o backend incompleto nem ativa os13 templates da segunda onda.
