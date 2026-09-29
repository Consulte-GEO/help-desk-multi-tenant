# M1-R9 — Coerência da execução e dos arquivos de evidência

## Base, problema e limite
Base local: R8 `ebb598af29a187c20d71d7395edabe3b722eebd0`; remoto observado: `b9481b9fabde2fd9c442e44099bc17608b59571a`.
O baseline teve 1.192 aprovações Node. Dependências oficiais e PostgreSQL continuam indisponíveis neste ambiente. Não transformar essa indisponibilidade em nova função de atendimento.

Durante a revisão do gate existente, a reprodução controlada mostrou que `validateReport` e `verifyLogs` aceitavam um relatório cujas etapas apontavam para diretórios de execuções diferentes, desde que cada hash e contagem fosse válido. Também aceitavam um log de instalação como se fosse o de auditoria. O CLI existente aprovou uma fixture com essa mistura. Um link simbólico no diretório da execução podia redirecionar todos os caminhos sem ser recusado pela verificação do arquivo final.

As fixtures de reprodução são sintéticas e vivem somente em diretórios temporários dos testes. Não são resultados reais de instalação, aplicação, PostgreSQL ou navegador. Não houve constatação de publicação indevida, alteração remota ou incidente de produção.

## Especificação objetiva
Modificar apenas o validador existente; não criar comando, serviço, endpoint, configuração ou migration.

1. Exigir exatamente uma entrada para cada etapa existente, sem etapas adicionais ou duplicadas.
2. Exigir `runs/<execução>/<etapa>.log`, com o nome do arquivo igual ao identificador da etapa.
3. Todas as etapas do relatório devem pertencer ao mesmo diretório de execução.
4. Aplicar essas regras tanto na validação estrutural quanto na conferência independente dos arquivos.
5. Recusar redirecionamento por link simbólico em componentes intermediários do caminho do log, mesmo que o destino permaneça dentro da pasta de evidências.
6. Preservar hashes, contagens mínimas, validade temporal, fingerprint, `platform_approved:false` e o formato schema 1. Relatórios coerentes continuam aceitos.

## Plano e evidência de execução
- [x] Recuperar bundle R8 e confirmar baseline de 1.192 testes.
- [x] Registrar testes de regressão antes da implementação: oito cenários, sete falharam e um controle passou.
- [x] Implementar a validação de coerência no módulo existente.
- [x] Reexecutar regressão focal e suíte completa.
- [x] Executar os gates disponíveis e registrar bloqueios sem herdar aprovações históricas.
- [x] Conferir patches/source/bundle e atualizar estado, handoff e backlog.

## O que a correção NÃO prova
Um hash verifica a correspondência dos bytes; estas regras adicionais verificam a organização/coerência do relatório. Elas não criam assinatura ou atestação independente e não detectam toda fabricação deliberada por alguém com controle de todos os arquivos, hashes e metadados. A proveniência depende do runner e das evidências reais da execução. Não chamar esse resultado de homologação PostgreSQL, autenticação real, aprovação de produção ou fechamento do M1.

## Compatibilidade
API/interface 0.19.0 e schema 0.18.0. Núcleo de atendimento, permissões, lockfile e onze migrations permanecem fora do escopo. M2 não iniciado.
