# HDN-01f — admissão durante esperas do checklist

> Continuidade do plano V2 e da HDN-01e. Execução inline em recorte local isolado; este registro não é aceite operacional.

## Objetivo e achado

Preservar o bloqueio de atendimento ao atravessar autenticação, quotas, leitura de corpo, diretório e transação. O handler da HDN-01e só examinava `enabled()` no início. Foi reproduzido fechamento durante esperas seguido por chamada ao serviço e, na composição controlada, por COMMIT.

## Decisões desta correção

A admissão é uma função síncrona privada, pertencente à requisição. Nunca vem do JSON, query string, token ou header. A mesma função é transmitida ao runner transacional existente. Uma recusa observada permanece válida durante a requisição. Consulta concluída mas ainda não emitida não divulga dados quando o gate fecha. COMMIT de marcação já reconhecido não muda para erro; confirmação perdida continua desconhecida. Nenhuma intenção é repetida automaticamente.

Este mecanismo observa o estado disponível no processo. Não substitui ACL, locks/versionamento de coorte no PostgreSQL ou controle de recuperação. Não promete observar uma configuração remota que ainda não chegou à instância, interromper toda atividade física ou detectar um intervalo false→true entre duas consultas do guard.

## Arquivos e interfaces

- Modificar `src/http/execution-checklist.ts`: criar admissão por requisição, verificar entre as esperas, passar aos métodos do serviço, revalidar somente resultados de leitura antes da resposta.
- Modificar `src/application/execution-checklist.ts`: acrescentar último parâmetro opcional `admission?: TransactionAdmission` em `read`, `mark` e `queryEvidence`, transmitindo-o sem apagar retorno para `runResourceTicketTransaction`.
- Modificar `src/infrastructure/execution-checklist-store.ts` e `src/infrastructure/resource-access-store.ts`: conservar `release_gate_closed` e `request_cancelled` como recusas com mensagens locais, sem detalhes do driver.
- Criar `tests/execution-checklist-availability-http.test.ts`: 25 casos da fronteira HTTP.
- Criar `tests/execution-checklist-admission.test.ts`: 19 casos da composição real com driver/autoridade controlados.

## Passos executados

- [x] Reconsultar base 6e06900 e preservar as correções de login/painel.
- [x] Conferir 93 hashes do ZIP E e reexecutar 358 testes anteriores.
- [x] RED HTTP: 25 casos, 23 falhas comportamentais e 2 controles aprovados.
- [x] RED composição: 19 casos, 17 falhas comportamentais e 2 controles aprovados.
- [x] Implementar a passagem da admissão sem outro executor de transações.
- [x] GREEN 44 novos; executar o conjunto focal e os testes compartilhados atuais.
- [x] Conferir os blobs dos testes compartilhados com a base; recuperar três negativos de admissão assíncrona que não estavam no arquivo R1 histórico.
- [x] Detectar quatro mutações incorretas, restaurar código e repetir testes/tipos.
- [x] Autorrevisar o diff: privacidade, callbacks não-void, efeitos já confirmados e nenhum fallback para serviço de demonstração.
- [ ] Executar os 23 cenários SQL no runner PostgreSQL17 do repositório completo.
- [ ] Revisão independente, integração/runtime/migrations e homologação operacional.

## Critérios comprovados e limites

462 casos no conjunto local final: 358 anteriores do checklist/workflow, 44 novos e 60 regressões compartilhadas. Não é a suíte integral. Nenhum candidato SQL foi alterado nesta correção. As regras de negócio, riscos técnicos e escopos de Thiago não mudam. A correção de admissão é separada da validação SQL que continua bloqueada pelos pré-requisitos.
