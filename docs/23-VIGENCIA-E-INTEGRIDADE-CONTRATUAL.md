# v0.19.0 — Vigência e integridade da resolução contratual

**Estado:** implementado e testado localmente; PostgreSQL/runtime/browser e M1 não homologados. Sem publicação.

## 1. Origem e escopo da correção
A v0.17 preservou microssegundos nas coleções, mas `resolveCoverage` ainda convertia o instante e as extremidades contratuais com `Date.parse`. Isso reduzia a precisão ao comparar os períodos. A função também aceitava flags truthy e não fazia a validação integral do retorno privado antes de decidir a elegibilidade. São achados de código e regressões locais; não houve incidente ou perda de dados constatados no Supabase.

O resultado passa a ser calculado em inteiros de microssegundos. O relógio continua sendo fornecido pelo servidor e capturado depois da leitura/espera e validação da cobertura; não é um campo recebido do cliente. O incremento não altera o relógio do processo, a política de fusos, o calendário de SLA ou qualquer prazo de sessão.

## 2. Regra temporal preservada
O período é `[validFrom, validUntil)`: início inclusivo, fim exclusivo; `validUntil: null` representa ausência de fim. Período vazio ou invertido é configuração incompatível.

| Instante analisado | Início | Fim | Resultado |
|---|---|---|---|
| 12:00:00.123000Z | 12:00:00.123456Z | sem fim | Não elegível. |
| 12:00:00.123455Z | 12:00:00Z | 12:00:00.123456Z | Elegível. |
| 12:00:00.123456Z | 12:00:00Z | 12:00:00.123456Z | Não elegível. |
| 12:00:00.123456Z | 09:00:00.123456-03:00 | 12:00:00.123457Z | Elegível. |

`shared/instant.js` recebe `zonedInstantMicros`, com calendário gregoriano, ano de quatro dígitos de0001 a9999, fuso explícito Z/deslocamento numérico e zero a seis dígitos fracionários. Datas impossíveis, NUL, timezone implícito, leap second, ano fora do formato e precisão maior não são ajustados silenciosamente. O resultado interno usa BigInt e não é exposto como campo JSON.

O parser histórico de `replay-result.ts` foi extraído para esse módulo, mantendo a semântica anterior. Representações UTC canônicas e cursores continuam com as regras existentes. Nenhum timestamp armazenado foi reformatado.

**Precisão não é resolução do relógio:** `new Date()` normalmente fornece milissegundos; o comparador não inventa os microssegundos atuais. API e banco ainda precisam de relógios sincronizados, locks/checagens temporais reais e medição no ambiente autorizado. Não há promessa de decisão em tempo real com precisão física de um microssegundo.

## 3. Validação integral da coleção privada
`validateCoverageResult` é chamada somente nos caminhos de resolução e primeira criação. Ela exige array denso, no máximo100 candidatos e IDs distintos. Esse limite acompanha o helper SQL existente; não cria uma nova limitação do total de contratos do sistema.

Cada objeto precisa ter o formato completo esperado, sem campos adicionais; contexto de workspace/conta/instância/serviço exatamente igual ao solicitado; identificadores válidos; flags booleanas reais; estado contratual reconhecido; versão inteira positiva; datas válidas e política como objeto JSON finito. São recusados NUL/surrogates, ciclos, valores não JSON e políticas acima de16KiB na representação JSON canônica compacta.

O limite compacto da aplicação não substitui a constraint de tamanho `policy::text` do PostgreSQL; a instalação real deve confirmar ambos. A política continua opaca quanto às regras de SLA: validar JSON não implementa nem atesta um motor de SLA.

A validação usa aliases de domínio/demonstração já aceitos. As entradas do adaptador PostgreSQL e da autenticação persistida continuam UUID-only. O incremento não flexibiliza nem substitui essa fronteira.

Dados inválidos produzem `503 invalid_coverage_result`, com mensagem segura e sem candidatos parciais, política, IDs privados ou texto do erro de origem. O vocabulário fechado de logs reconhece esse código. Nenhum contrato fictício, intake ou correção automática de banco é produzido.

| Situação | Resultado |
|---|---|
| Resposta válida e vazia | `no_coverage`; criar retorna422. |
| Coberturas válidas mas desabilitadas, não publicadas, suspensas, terminadas ou fora da vigência | `no_coverage`. |
| Uma cobertura elegível | `resolved`. |
| Várias elegíveis | `ambiguous`; criação exige seleção explícita. |
| Qualquer candidato malformado, duplicado ou de outro contexto |503, não seleção parcial nem ausência de contrato. |

O catálogo em memória foi alinhado para excluir outros workspaces/contas/produtos antes de interpretar datas. A regressão impediu que uma cobertura estrangeira malformada derrubasse a listagem autorizada. Isso não altera o helper SQL de descoberta nem comprova isolamento PostgreSQL.

## 4. Idempotência, histórico e transações
Um reenvio autorizado continua devolvendo sua resposta original, mesmo após o vencimento do contrato. Não consulta novamente a elegibilidade atual, não estende validade, não muda o snapshot e não gera nova escrita. Uma nova chave segue a resolução atual e pode ser recusada.

Os testes HTTP locais verificaram criação recusada antes do início,503 seguro em retorno inconsistente, recuperação explícita com a mesma chave e replay após o fim sem alterações do estado. O modelo de memória preservou rollback de chamado/evento/outbox/cache. Não houve reescrita de contratos publicados ou de recibos.

## 5. Evidência e limites
1.040 testes Node aprovados,38 novos; três sockets novos estão incluídos, não são testes de banco.35 checks HTTP da demonstração aprovados.201 SQL escritos (185 principais e16 upgrade), zero executados contra servidor real.36 checks browser escritos, bloqueados antes das asserções. Ver docs04 para comandos, falhas intermediárias, contagens e evidências.

Os cinco novos testes SQL cobrem: início fracionário futuro; fim fracionário posterior ao relógio; intervalo de um microssegundo; saída da sessão PostgreSQL em Asia/Kathmandu; e rejeição de infinity como configuração incompatível. Não utilizam tempo livre enviado pela API. A injeção do relógio é exclusiva do teste, e os casos não fingem alterar `now()` do banco.

Sem nova migration, tabela, grant, endpoint ou dependência. API/interface0.19.0, schema esperado0.18.0,11 migrations e25 tabelas candidatas,18 operações/14 caminhos.

## 6. Fontes técnicas verificadas nesta rodada
As observações sobre milissegundos e microssegundos são externas; os resultados de testes são evidências do projeto.

- ECMAScript, Time Values and Time Range: https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-time-values-and-time-range — `Date` usa valores temporais em milissegundos; isso não atesta o comportamento do nosso código.
- PostgreSQL17, Date/Time Types: https://www.postgresql.org/docs/17/datatype-datetime.html — resolução de timestamps em microssegundos e representação conforme timezone da sessão. Não comprova que a nossa suíte SQL executa.

M1 permanece aberto. Não houve revisão independente, pentest, teste de capacidade, restauração ou publicação. Administração M2, anexos, SLA operacional, dispatcher e conectores reais continuam fora desta entrega.
