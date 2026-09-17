# Revisão local v0.16.0

Sem subagente/revisor independente, pentest, carga ou restore. Inspeção manual do diff, contrato de escrita, composição com os guards anteriores e fontes oficiais PG17; suíte local reexecutada. Não é prova de execução SQL.

## Correções e ajustes encontrados
- Omissão silenciosa de evento/outbox pelo adaptador:24 falhas comportamentais reproduzidas após corrigir parâmetros dos fixtures; modelo por transação impede confirmação parcial em memória.
- Mudança de assunto junto de uma transição: nova regressão falhou e o modelo foi alinhado à recusa SQL candidata de campos não suportados.
- Inventário privado/manifestações: cinco checks de integração faltavam; atualizado contrato do runtime sem conceder acesso à nova tabela ou helpers.
- Quatro fixtures anteriores mantinham24 tabelas/31 funções/12 triggers. Atualizados para25/36/18 e quatro triggers diferidos, sem retirar asserts de negação.
- Typecheck suplementar identificou um efeito possivelmente indefinido. Correção de narrowing e refatoração legível, mantendo rejeição quando ausente.
- Bindings BEFORE INSERT poderiam falhar por ausência de efeito antes da política RLS. Acrescentada autorização explícita do pai antes de ler o registro privado, preservando erro42501 para acesso cruzado, com policy posterior mantida. Ainda não executado no PostgreSQL.
- Um teste SQL antigo esperava23514 propagado pelo UoW no COMMIT. O executor existente converte esse cenário em503 transaction_outcome_unknown. Um teste local específico confirma esse contrato; a expectativa SQL foi alinhada sem retirar a recusa nem o assert de rollback. Novos testes de SQL direto continuam exigindo23514.
- Smoke HTTP ainda comparava release0.15.0. Corrigido para0.16.0; na repetição35HTTP passaram e o navegador bloqueou em page.goto.

## Propriedades revisadas no SQL candidato
Tabela sem acesso direto/app, RLS+FORCE, helpers sem execução pública, search_path vazio e owner aprovado. Recibo produzido pela escrita real; top-level xid8 conserva vínculo em subtransações. Mensagem mantém efeito pendente até incremento da versão. Evento vincula exatamente uma escrita; outbox pública usa mesmo evento/revisão, envelope fechado sem motivo/corpo. Trigger diferido consulta estado final do registro e recusa pares incompletos. Valores legados não são reescritos. Dados de efeitos são metadados identificáveis, não anônimos. Retenção/volume/latência continuam sem homologação.

## Pontos que exigem revisão real
PL/pgSQL e tipos/assinaturas; plano dos índices; ordem e interação de triggers/FKs; defaults/owner/grants; live scopes; note write-only; concorrência/pool; erros efetivos de COMMIT; fresh e upgrade. Não chamar checks de texto ou memória de SQL verde. Não ampliar escopo com outras funcionalidades para encobrir essas lacunas.
