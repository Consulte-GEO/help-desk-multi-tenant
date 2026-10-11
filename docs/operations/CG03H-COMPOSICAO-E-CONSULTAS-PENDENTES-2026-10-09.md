# CG-03h — revisão da composição e encerramento de consultas pendentes

**09/10/2026. Entrega LOCAL sobre CG-03g local.** Não é release, migration ou homologação PostgreSQL. O PR26 consultado permanece em `f60baed8022b28e067a702b3dd51031e86983017`, draft. As fatias E/F/G/H não estão nessa head. Nenhum SQL anteriormente bloqueado foi reenviado e nenhum código/ref remoto foi alterado nesta rodada.

## Escopo e decisões

Plano vinculante: “Help Desk Consulte GEO — plano de implantação”, CG-03, especialmente revalidação nas esperas, ausência de autorização por dados do cliente, preservação de recibos, SQL real e separação de estados de aprovação. A especificação complementar citada no plano ainda não foi recuperada. Nada neste documento confirma APIs, identidades ou responsáveis do Novo GEO.

A prioridade de entrada era executar E/G em PostgreSQL17. O ambiente foi reinspecionado: não há `postgres`, `psql`, CLI Supabase ou Docker; a tentativa de obter a distribuição PostgreSQL falhou e os hosts consultados não foram resolvidos por DNS. Não foi usado o banco remoto como ambiente de teste, nem outro motor chamado de PostgreSQL. A limitação permanece explicitamente aberta.

**Ruling:** revisar a composição já escrita antes de acrescentar outro subsistema. Foram encontradas falhas reproduzíveis no encerramento de consultas e na classificação das recusas. A correção modifica o runner existente, não cria outro framework. Como `transaction.ts` é compartilhado, o gate integral do repositório continua obrigatório antes da integração, inclusive para funções que não usam recursos.

## H-01 — não solicitar COMMIT enquanto o callback deixou consulta pendente

### Reprodução observada

O objeto de consulta emprestado pelo `runTransaction` já fazia uma verificação de admissão após a resposta de cada consulta. Porém, se o callback disparasse uma consulta sem aguardá-la e retornasse, o runner podia solicitar COMMIT antes dessa verificação posterior. Um transporte de testes com fila FIFO reproduziu o caso: a consulta terminou, a admissão recusou o acesso, mas o COMMIT já havia sido solicitado e a chamada principal retornou sucesso.

Outra reprodução mostrou ROLLBACK sendo solicitado com consulta ainda pendente quando o callback lançava um erro. Um terceiro cenário expôs uma rejeição assíncrona não observada para uma consulta descartada.

**Alcance:** erro de orquestração do servidor reproduzido com driver controlado, não ataque HTTP ou prova de comprometimento de produção. FIFO simula a ordem de despacho; não executa PostgreSQL, SQL, RLS ou locks.

### Implementação

`runTransaction` registra cada Promise de consulta emprestada, incluindo sua checagem após a resposta. Ao terminar o callback, fecha novas chamadas e aguarda as consultas ainda registradas antes de solicitar COMMIT ou limpeza. Se o callback terminou com consultas pendentes, o runner recusa sua conclusão com `503 transaction_work_incomplete` e segue o rollback existente; aguardar durante a limpeza não converte o callback incompleto em sucesso.

Uma rejeição original do callback é preservada, inclusive valores falsy. O observador das Promises evita uma rejeição sem observação, sem transformar a Promise devolvida ao chamador em sucesso. Chamadas explicitamente aguardadas, `return client.query(...)`, `Promise.all(...)` e callbacks sem consulta continuam aceitos. O cliente emprestado permanece indisponível após o callback.

Não foram alterados timeout de statement/lock/transação, listeners de saúde, command tags, tentativa única, descarte de conexão ou diagnóstico de release. COMMIT confirmado continua confirmado; reconhecimento perdido continua `transaction_outcome_unknown`. Não acrescentar retries de mutação em reação ao novo código de falha.

**Limite deliberado:** o runner detecta consultas ainda pendentes no encerramento; não prova estaticamente que todo chamador usou `await`. Uma Promise já concluída não pode ser distinguida com segurança apenas pelo objeto de Promise. Revisão dos chamadores e regras de lint de Promises continuam úteis. A espera de drenagem depende dos limites e erros do transporte/servidor existentes; não é autorização para consultas sem prazo.

## H-02 — preservar recusa conhecida sem confundir com confirmação perdida

### Reprodução observada

O adapter G reconhecia uma conexão sem autorização ou conflito de revisão, mas o publicador F podia converter esses resultados em `resource_publication_outcome_unknown` ou em uma indisponibilidade genérica. Os testes agora compõem ambos os módulos reais, em vez de testar somente cada porta isoladamente.

### Implementação

O publicador mantém um vocabulário fechado de erros de sua porta de persistência configurada no servidor. `resource_publication_publisher_denied` retorna 403; conflito conhecido de revisão/intenção retorna 409; persistência inválida continua 503. Mensagem e status livres recebidos da porta não são repassados: o módulo reconstrói um erro local seguro.

Essa classificação só é definitiva antes de haver resultado emitido pelo callback. Depois que o callback devolveu o recibo preparado, um erro com aparência de recusa não pode reescrever a semântica de confirmação: mantém resultado desconhecido quando não há confirmação inequívoca. `transaction_outcome_unknown` permanece desconhecido em todas as composições pertinentes. Nenhum erro é autorização de acesso e o vocabulário não aceita callbacks ou portas fornecidos pelo cliente.

## H-03 — cancelamento da consulta à fonte e exceções de transporte

Cancelamento do chamador durante a consulta da fonte agora permanece `409 resource_publication_cancelled`; timeout da fonte permanece `503 resource_publication_source_unavailable`. Ambos impedem a entrada na persistência. O teste controla o mesmo prazo de 1000ms, sem aumentar limites do produto ou depender de sleeps reais.

Dois testes adicionais reproduziram exceções ao consultar o descritor `code` de erros de transporte. A leitura é protegida, não executa getter, e não devolve texto privado da exceção. Isso foi corrigido tanto na classificação do publicador quanto na tradução SQL do adapter G. Não é afirmação de vazamento ocorrido em produção.

## Evidência executada e o que ela não prova

- Integridade do ZIP G de entrada confirmada: `1fc20c0a401ec51cae3992cfc049d50225f86d676e36acf9b3c09a4fca7d4f3b`.
- Baseline focal reexecutada: 346/346.
- Ciclo H-01: 11 testes, 7 aprovados e 4 falhas na implementação antiga; GREEN 11/11. Depois, um caso de compatibilidade adicional para rejeição falsy.
- Ciclo H-02/H-03: 11 casos de composição, 4 aprovados e 7 falhas antes da correção; GREEN. Dois casos adicionais de exceção de descritor falharam antes de sua correção.
- Final: 371/371, sem falhas, cancelamentos, skips ou TODO. São 346 preservados e 25 novos; não todos os testes do repositório.
- Mutações detectadas: omitir drenagem (3 falhas), aceitar callback incompleto (2), classificar recusa depois do resultado preparado como definitiva (1) e ignorar cancelamento da fonte (1). Código restaurado e 371 testes repetidos.
- Typecheck focal: TypeScript5.8.3, targetES2022/libES2023/NodeNext/strict, tiposNode22.19.7 globais. Exit0. Não comprova `npm ci`, o lock ou um build completo.

Os candidatos SQL D/E/G e seus cenários foram preservados byte a byte. **Nenhuma nova execução PostgreSQL, upgrade, CI integral, browser, build, audit ou CodeQL foi concluída nesta etapa.** Os 15 cenários SQL E e os 15 G continuam não executados. O CI de D não é evidência de E/F/G/H. Não usar os logs locais como `evidence/homologation/latest.json`.

## Pré-requisitos para integração

A correção de `transaction.ts` requer suíte integral e testes de saúde/release/COMMIT dos fluxos existentes, além de PG17. Executar a composição E/G no runner descartável existente, com o papel restrito da aplicação e o papel privado do publicador; medir as condições de falha no banco real. A fila FIFO dos testes desta rodada não substitui esse passo.

Continuam pendentes: fonte/identidade externas qualificadas, publicação e custódia do pool privado, correlação das revisões sob lock, migration pela CLI, schema/manifest/readiness/upgrade, políticas de recurso global, integração HTTP, importação canônica e revisão independente. Não ligar rotas ou abrir a coorte para contornar esses gates. A ocorrência histórica de `notes-retry` não foi declarada corrigida. Não houve nova inspeção Netlify nesta rodada.

Referências técnicas consultadas: documentação oficial node-postgres sobre transações (`https://node-postgres.com/features/transactions`) e PostgreSQL17 sobre locks (`https://www.postgresql.org/docs/17/explicit-locking.html`). Sustentam requisitos de mesma conexão e responsabilidade transacional; não são evidência de execução do código local. A leitura de `https://supabase.com/changelog.md` não completou por tipo de conteúdo não aceito; nenhuma dependência Supabase foi alterada.
