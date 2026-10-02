# Help Desk M1-R18 — Estado e evidências

Data: 01/10/2026. Escopo: revisão da conferência privada dos recibos da aceitação HTTP/PostgreSQL do R17.

## Bases e limites de recuperação
A consulta GitHub desta rodada encontrou ambas as branches `codex/m1-reproducibilidade` e `codex/m1-r9-integracao` em `78bbb00112331531168ae24600604cb7f3148770` (R9 integrado). A fonte executável do R17 foi extraída do pacote entregue, sem instalar dependências ou trazer evidências históricas para a pasta de execução.

O fingerprint recuperado foi `3819e2205d51535df464faff626c7cfed1969d5d979a81d98aa5d7b5d1248df8`. Coincide com o manifesto R17, que identifica o commit local anterior `51299891552aac86de8db5f8dc99e5ec5c0fe75e`. A recuperação não contém a história Git upstream completa. A base R9 reconstituída por reversão do patch anterior coincidiu com `972674dad13427f3d71d6103e60772dd9e0979da5cf27c91adadf2393ba22581`.

Fingerprint executável R18: `66b19776e652a210ebc819e49dac7650bb27eae00c269b8c186ab55e90d84491`. O commit desta entrega consta no manifesto; não confundir o commit local de recuperação com o SHA upstream.

## Achado, reprodução e correção
A função real `correlate` do R17 conferia namespace, autor, identificador e versão do recibo, mas não toda a linha ou o conteúdo privado de `result`. Para testar essa função diretamente, sua assinatura foi exportada no módulo de testes, sem mudar o comportamento inicial.

Uma fixture explicitamente sintética, derivada do handler e do adaptador de memória existentes, produziu registros no formato das tabelas. O controle íntegro passou, mas treze testes que exigiam recusa falharam: hash do pedido, data do recibo, política privada, criador, responsável, workspace, conta, assunto, descrição, campo adicional e corpo/autor/data da mensagem. Não houve reprodução de falha de autorização do produto nem alteração de dados reais.

A correção funciona em dois momentos:

1. Após cada uma das cinco primeiras gravações confirmadas, a suíte confere o recibo com o pedido normalizado e o recurso persistido naquele instante. O hash não é mais aceito apenas por existir. A projeção privada de ticket/mensagem precisa estar completa, sem campos extras, com identidade, contexto e conteúdo correspondentes. Para prioridade, considera o motivo normalizado e `If-Match` no hash.
2. Guarda uma cópia independente do recibo já conferido. Ao final do percurso, exige igualdade integral com essa cópia, incluindo metadados e dados privados. Essa comparação final não reformata timestamps nem altera as linhas.

Na comparação inicial com o recurso, instantes equivalentes podem usar fusos ou representações distintos, mas um microssegundo de diferença reprova. A equivalência usa o parser existente de microssegundos, sem arredondamento por `Date`. A cópia devolvida pelo helper não compartilha referências com o snapshot observado.

O helper é exclusivo de testes e não abre conexões. Os seis percursos SQL R17 passam a utilizá-lo. Não há nova consulta SQL além das observações já existentes, nova requisição HTTP, novo endpoint ou mudança de permissão. A comparação usa o recurso observado como referência; corrupção coordenada de múltiplas fontes ou efeitos fora do recorte exigem outros controles.

## Evidências executadas
| Verificação | Resultado da rodada |
|---|---|
| Baseline R17 completo | 1.389 aprovados; log04. Duas chamadas anteriores foram interrompidas pelo limite de execução da ferramenta; logs incompletos01/02 não são aprovação. |
| Reprodução da correlação anterior | 14 casos: 1 controle passou e 13 regressões falharam; log05. |
| Contrato do validador antes da implementação | 28 casos: 1 passou e 27 falharam; log06. Parte das falhas demonstrava que o novo helper ainda não existia. |
| Regressão focal final | 28/28 aprovados; logs07/22. |
| Aplicação completa | 1.417/1.417 aprovados; zero falhas, cancelamentos, skips ou TODO; log08. |
| Tipo suplementar | Aprovado com TypeScript 5.8.3 e tipos globais Node 25.1.0; logs13/23. Não é a toolchain travada. |
| Instalação offline | Reprovada: ENOTCACHED; log09. |
| Instalação online | Interrompida pelo prazo do comando, sem conclusão; log20. Não houve troca de registry ou lock sintético. |
| Auditoria | Reprovada por EAI_AGAIN no registry oficial; log19. Não equivale a ausência de vulnerabilidades. |
| Typecheck padrão | Reprovado por definições locais ausentes; log12. |
| PostgreSQL | 215 cenários escritos, nenhum novo; ZERO executados aqui. O runner recusou ausência de Docker; log10. |
| HTTP de demonstração | 35 verificações em memória aprovadas; log11. |
| Navegador | Recusado por ERR_BLOCKED_BY_ADMINISTRATOR em loopback; log11. Não houve contorno da política. |
| Migrations | Onze verificadas e preservadas; log15. |
| Lock/contratos/segredos/build estático | Verificações disponíveis passaram; logs14/16/17/18. Build de frontend não comprova bundle Functions. |
| Gate local | Não aprovado; log21. Nenhum relatório antigo foi adaptado para aprovar a fonte nova. |
| CI remoto, hospedado, carga, restore, revisão independente | Não executados nesta rodada. |

Os 28 testes novos incluem os controles e as verificações de cópia/precisão. Os seis testes TLS reais herdados estão incluídos na suíte Node, não são somados novamente. A fixture sintética e os cinco recibos conferidos em memória não comprovam SQL, driver, RLS ou triggers.

## Compatibilidade e estado
API/interface 0.19.0; schema 0.18.0; onze migrations e lockfile preservados. Núcleo `src/`, frontend, permissões, clientes hospedados e suas intenções/chaves permanecem intactos em relação ao R17. O mínimo de aplicação do gate passou a 1.417; o mínimo PostgreSQL continua 215, e o de interface continua 71.

IMPLEMENTADO: sim, no código local de testes. TESTADO_LOCALMENTE: sim. TESTADO_EM_POSTGRESQL_REAL: não nesta rodada. TESTADO_EM_NAVEGADOR: não aprovado. DEPLOYADO: não. HOMOLOGADO: não. OPERACIONAL: não. M1 aberto; M2 não iniciado.

A inspeção remota desta rodada limitou-se ao GitHub. Não houve teste de funcionamento atual do Supabase/Netlify, nem push, PR, merge, deploy, migration remota, mudança de usuário, dado, segredo ou gate. A revisão do código foi feita pelo próprio executor; não constitui revisão independente.
