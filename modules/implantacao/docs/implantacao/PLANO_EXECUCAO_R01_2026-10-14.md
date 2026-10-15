# Plano de execução revisado — Implantação e Importações / R01

14/10/2026. Complementa o plano original sem declarar concluídas fases não executadas.

**Objetivo permanece:** receber documentos/dados de uma obra, analisar, revisar, aprovar, executar, conferir e comunicar pelo Help Desk, sem inventar informação nem misturar clientes/destinos.

## Estado consolidado

| Incremento | Estado depois da R01 | Evidência / próxima entrega |
|---|---|---|
| IMP-00 Baseline e contratos | Parcial | Ref e arquivos Setup conferidos; matriz documental entregue. Falta checkout completo, baseline integral e contrato de pelo menos um receptor realmente aceito. |
| IMP-01 Integridade e contratos locais | Parcial, código focal testado | Medido/especificado, unidades, eventos e tipos corrigidos; identidades e contagem por entrega implementadas como núcleo. Montagem monolítica/corpus completo e demais contratos ainda pendentes. |
| IMP-02 Casos/revisões/arquivos/permissões | Não iniciado | Definir armazenamento durável e autorização real a partir do contexto resolvido no servidor; não usar rascunho de curta duração como processo de dias. |
| IMP-03 Help Desk | Não iniciado | Protocolo autoritativo, vínculo entre processo/chamado, eventos e notificações sem duplicidade. Preservar gates atuais. |
| IMP-04 Cadastro e visualização | Não iniciado | Importação sobre rascunho com diff, prévia fiel e aceite da estrutura. |
| IMP-05 Triagem e complementação | Não iniciado | Perfis distintos implantação/histórico/consolidado; pendências e reuso de respostas por revisão. |
| IMP-06 Conversão histórica | Não iniciado como etapa completa | Consumir núcleo da R01; reconhecer granularidade, corte e mapeamentos confirmados; substituir ponte transitória por módulos diretos. |
| IMP-07 OCR integrado | Não iniciado | Preservar motor existente; anexos privados, retomada, evidência por campo e releitura focal. |
| IMP-08 Entidades e vínculos | Não iniciado | Resolver entrega/amostra/CP; consumir identidades e soma da R01 sem inventar IDs ou valores. |
| IMP-09 Plano e aprovação | Não iniciado | Versão imutável, escopo, hash, validação atual de autoridade e separação aprovação operacional/técnica. |
| IMP-10 Executor de um destino | Não iniciado | Só após qualificar o receptor; recibos/idempotência/cancelamento e falhas parciais. |
| IMP-11 Conciliação | Não iniciado | Comparar fonte, aprovado, recibos e destino completo, registro a registro. |
| IMP-12 Wiki e ajuda | Não iniciado | Corrigir lacunas após qualificação; público/versão adequados sem publicar conteúdo restrito. |
| IMP-13 Piloto operacional | Não iniciado | Evidências de ponta a ponta, recuperação e aceite autorizado. |

## Próximo lote obrigatório — qualificação da R01

1. Obter checkout integral atual; verificar branch/commit e mudanças concorrentes. Aplicar o pacote em branch isolada via aplicador com checks de blob. Se recusar, reconciliar por revisão, nunca retirar as guardas.
2. Executar `npm ci --ignore-scripts`, typecheck, build, todos os gates existentes e os novos. Registrar erros originais separadamente de regressões; não tratar SKIP Deno/browser como aprovação.
3. Testar a página **real** `/importa`: carregar workbook sintético, confirmar cabeçalho/mapeamento/unidades, revisar eventos, editar medição, exportar e reabrir o XLSX. Confirmar as abas `Importação`/`Proveniência`, linha por entrega, tipos de célula e nome de rascunho com pendências. Os testes DOM entregues não cobrem esses passos.
4. Verificar cache/publicação acoplada dos três motores; simular asset ausente ou de versão antiga e conferir bloqueio com mensagem, sem permitir exportação antiga silenciosa.
5. Validar payload geomat schema 1.2.0 contra o receptor existente. Confirmar representação de volume e valores especificados; FLOW sem representação compatível continua pendente, nunca entra em slump_*.
6. Identificar e congelar o layout real da importação histórica/resultados no Novo GEO. Reconciliar a divergência documental da wiki com o procedimento interno, usando exemplo aceito/recibo e leitura autorizada da gravação.

**Saída:** revisão do pacote + evidência do checkout completo. Apenas depois avançar à persistência/integração; ainda sem liberar importações automáticas não qualificadas.

## Complementos ainda necessários para fechar IMP-01

Formalizar e validar os schemas canônicos versionados de campo/evidência/entidade, incluindo unidade/precisão e ausência/ilegibilidade/conflito. A R01 contém funções e shapes locais, não todo o modelo canônico/persistente previsto no plano.

Ligar sourceRecordId e summarizeDeliveries à classificação de granularidade real. Testar uma entrega com múltiplos CPs/idades e duas entregas com o mesmo valor/nota; provar que o volume não multiplica e que os CPs não desaparecem. Nenhum resumo do núcleo significa cadastro executado.

Revisar restantes normalizadores, defaults de moldagem, corte e correspondência no export técnico SQL Server. O módulo de normalização existente foi usado como dependência no teste; não foi auditado/corrigido integralmente nesta rodada.

## Depois: IMP-02 + IMP-03

Seguir os passos do plano original: persistência com revisões e controle de concorrência, vínculo a conta/obra autorizado pelo servidor, arquivos privados e dados brutos imutáveis, processamento retomável e ligação ao protocolo do Help Desk. Não duplicar o atendimento existente, não estender o núcleo genérico com campos físicos específicos de concretagem e não abrir flags para substituir origem ausente.

A integração do Dev Agent só propõe alterações. Executor recebe uma versão aprovada e qualificada; mudança no conteúdo/escopo invalida a aprovação. Sem destino qualificado, manter exportação assistida e acompanhamento honesto do estado.

## Condições de encerramento

Distinguir sempre: desenvolvido; testado focalmente; testado com dependências do lock; testado em PostgreSQL; testado na página real; publicado; homologado; operacional. A R01 alcança somente os dois primeiros no escopo descrito, mais o ensaio DOM focal em Chromium.
