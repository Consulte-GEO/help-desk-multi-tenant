# Manual operacional candidato — C15/C16

**Preparado para revisão, não manual de operação já liberada.** Interface administrativa opcional, sem inclusão no runtime, OpenAPI ou capabilities atuais.

## Operações HTTP candidatas

| Método e rota | Ação | Pré-condições |
|---|---|---|
| GET `/v1/admin/pilots/:id` | Resumo de estado | Auth/MFA e `release.read` |
| POST `/v1/admin/pilots/:id/preparations` | Preparar manifesto atestado | `release.prepare`, motivo, revisão esperada, envelope assinado |
| POST `/v1/admin/pilots/:id/start` | Iniciar piloto restrito | `release.pilot`, preparado, evidência ainda válida |
| POST `/v1/admin/pilots/:id/acceptance` | Registrar aceite | `release.accept`, prova de jornada da revisão/pessoa corretas |
| POST `/v1/admin/pilots/:id/containment` | Conter | `release.contain`, revisão/motivo atuais; certificado antigo pode estar expirado |

Mutações exigem Origin configurada igual à origem da aplicação, `If-Match` com revisão entre aspas, `Idempotency-Key` de 16–128 caracteres seguros e JSON limitado a 256KiB/5s. A revisão inicial é `"0"`; a primeira preparação grava1. Não enviar nomes, tokens do IdP, segredos ou URLs assinadas. A credencial humana fica só no mecanismo de sessão atual, não em comandos/documentação Git.

Os campos de corpo são `reason`, acrescidos de `releaseEnvelope` só na preparação ou `acceptanceEnvelope` só no aceite. Action/pilotId/revisão são derivados de rota/header, não de campos extras. GET/HEAD não consomem decisão; método errado é recusado. O resumo não contém lista de pessoas, recursos privados ou certificados.

## Resultado desconhecido

Em `pilot_outcome_unknown`, consultar o registro autorizado. Preservar a intenção original e sua chave; repetir explicitamente essa mesma solicitação pode recuperar o recibo. Não gerar outra chave, acionar start automaticamente ou afirmar rollback. COMMIT confirmado continua confirmado mesmo se uma prova expirar depois; a operação seguinte verificará novamente.

## Pendências para disponibilizar o manual ao operador

Implementar store PostgreSQL e audit/receipts, migrationsCLI/readiness/upgrade e locks testados; configurar autoridade/capacidades após aprovação; ligar rotas ao runtime/limites atuais, sem bypass por endpoints antigos; atualizar OpenAPI/capabilities só do que existe; realizar ensaio de navegador e treinamento. As rotas acima não estão publicadas, não há UI nova montada nem coorte real cadastrada.
