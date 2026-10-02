# M1-R13 — prontidão PostgreSQL restritiva antes da suíte SQL

## Objetivo e fronteira
Corrigir o helper existente `scripts/postgres-readiness.mjs`, usado pelo runner Docker, sem criar novo comando, endpoint, dependência ou migration. A prioridade continua integrar R10–R12 e executar a homologação real do M1; esta correção evita avançar na preparação com uma verificação inválida.

## Achados reproduzidos
A comparação relacional anterior aceitava `version` ausente/NaN ou convertível implicitamente quando o nome do banco era `helpdesk_test`. `attempts:0` podia resolver sem executar nenhuma consulta. Além disso, a propriedade `wrongServer` de uma exceção do probe era tratada como se fosse uma marca confiável do próprio helper; o erro bruto podia atravessar o limite. Falhas de espera também saíam sem sanitização.

Reprodução com callbacks e dados sintéticos, não com credenciais ou servidor real. Não houve incidente de produção constatado. Uma falsa prontidão deste helper não demonstra que os guards posteriores da suíte SQL tenham sido contornados.

## Especificação objetiva
1. Validar probe e sleep como funções e attempts como inteiro positivo seguro, antes de chamar o probe. Preservar o padrão de 40 tentativas e espera de 500 ms; não ampliar timeouts do runner.
2. Aceitar somente objeto não nulo e não array, com versão numérica inteira segura na faixa [170000,180000) e banco exatamente `helpdesk_test`. Não converter strings, BigInt, null ou valores ausentes.
3. Metadados inválidos interrompem imediatamente; não são indisponibilidade transitória.
4. Exceções do probe permitem somente as retentativas de prontidão já previstas; não inspecionar marcas, mensagens ou propriedades arbitrárias do erro externo.
5. Falhas de leitura dos metadados, esgotamento e falhas da espera saem com mensagem fixa, sem erro original, cause ou credencial.
6. Somente uma consulta válida pode concluir a espera. Última tentativa válida deve continuar sendo aceita; não esperar depois da última falha.

## Execução local
- [x] Recuperar fingerprint exato do R12 e reproduzir baseline: 1.320/1.320.
- [x] Escrever 12 regressões/controles: 9 falharam e 3 passaram antes da correção.
- [x] Corrigir helper e repetir regressão focal.
- [x] Repetir suíte completa e verificações disponíveis.
- [x] Conferir patches e atualizar handoff/backlog com limites explícitos.

## Limites
O helper não instala PostgreSQL, não comprova Auth, RLS, grants, TLS, migrations, locks ou atomicidade. Também não estabelece prazo global para um probe arbitrário que nunca termina: timeout de conexão/consulta é responsabilidade do executor concreto. Retentativas aqui pertencem apenas à consulta de prontidão do banco descartável, nunca a mutações de atendimento ou clientes hospedados.

API/interface 0.19.0, schema 0.18.0, 11 migrations e lock inalterados. Nada de M2 ou campos de produtos específicos. Sem autorização atual de push/deploy/alteração de backend.

## Referência técnica externa
ECMAScript, Number.isSafeInteger: https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-number.issafeinteger . Fundamenta a validação de Number inteiro seguro, não comprova os resultados do projeto. Consultada em 01/10/2026.
