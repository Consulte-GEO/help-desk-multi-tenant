# Consulte GEO — abertura atômica M09c

Implementação M09c concluída e qualificada em 14/10/2026 no [PR31 draft](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/31). [CI original 38505830238](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38505830238): 4.496 aplicação, 419 PostgreSQL17 e 206 interface, total 5.121, zero falhas/cancelamentos/skips/todo. Instalação hospedada, montagem da UI, origem real e operação de email continuam nos incrementos próprios. Nenhuma escrita no GEO foi executada.

## Comportamento

A abertura mantém a pessoa, conta e conjunto completo de obras autorizados pela origem e pelas linhas nativas atuais. Usa a mesma transação e o mesmo cliente PostgreSQL emprestado para conferir a versão publicada fixada no rascunho, as respostas, a cobertura vigente, o workflow e o SLA. A prévia não reserva protocolo nem cria efeitos. A criação exige a revisão do rascunho, o hash da prévia e uma chave estável de idempotência.

O protocolo CG é sequencial e exclusivo por workspace. A aplicação não inicializa nem reinicia o contador. Antes da ativação, o operador deve conferir o último protocolo do legado e preparar uma única linha do contador privado com esse valor. CG-10001 aparece apenas na fixture sintética, que prepara 10000 explicitamente. A captura fornecida já mostra 12264; esse número não foi presumido como o último valor atual da operação. Sem preparação válida, a abertura é recusada sem alterar o contador.

A transação grava ticket versão1, referências completas e seladas, estado do workflow, snapshot de formulário/respostas públicas/perfil/cobertura/calendário/SLA/relógios iniciais, evento ticket.created, auditoria, outbox mínima e recibo imutável. Consome o rascunho em nova revisão auditada. A fila reaproveita o evento existente para o canal Resend; não chama o provedor. Notification=pending significa enfileirado. O protocolo não foi criado no GlobalCad nem em outro sistema.

Todos os INSERT/UPDATE exigem confirmação e comparação dos valores persistidos. Snapshot, ticket, contador e recibo alterados por triggers são recusados; o digest do snapshot também é conferido no COMMIT. As funções nativas reconstroem intenção, perfil, respostas, cobertura, prévia, relógios e recibo, sem aceitar o bundle como autoridade. Tabelas novas têm ENABLE/FORCE RLS, sem acesso direto da aplicação, clientes, publicador ou worker. Helpers privados têm search_path vazio e ACL mínima.

Repetir a mesma intenção/chave devolve o recibo original, com revalidação atual de acesso, sem outro protocolo, ticket ou item na fila. Uma chave com conteúdo diferente é recusada. O rascunho consumido continua consultável mesmo após seu TTL, sem voltar a edição. Resultado desconhecido no COMMIT exige conciliação com a mesma intenção; nenhuma troca automática da chave. Prévia e persistência aplicam o mínimo histórico de três caracteres Unicode no assunto.

## Montagem e limites

- POST /v1/support-requests/preview.
- POST /v1/support-requests com Origin, If-Match e Idempotency-Key.

As rotas verificam origem HTTPS exata, Auth/MFA, taxa, tamanho JSON e admissão/cancelamento até o COMMIT. Não há fallback legado, upload, delegação ou execução automática no GEO. As capabilities dependem de atendimento/workflow/intake habilitados e portas reais da origem. Netlify ainda não possui origem M08 qualificada e os gates continuam false.

A primeira jornada nativa qualificada é Incluir usuário, com execução manual posterior na origem. Lookup e anexos sem evidência qualificada são recusados. A montagem da UI M09a, formatos específicos e duplicidade no GEO, integração real M08, instalação hospedada, preparação do contador e operação de envio/webhooks/retry M11 continuam em seus respectivos incrementos. A fila atômica não comprova entrega Resend nem DNS autenticado.

API/interface0.30.0; schema candidato0.23.0;16 migrations. Prefixo15 e seis candidatos M05 preservados. Contrato estático revisado:53 tabelas,124 funções,45 triggers,287 constraints e38 policies. Migration16 criada pelo Supabase CLI2.120.0; timestamp UTC gerado em14/10 corresponde à execução local de13/10.

## Validação

Os seis checks originais (lock, instalação limpa, auditoria, aplicação/tipos/contratos/build, PostgreSQL17 e interface) passaram. Relatório e seis logs originais foram importados com comparação de bytes/hashes e contagens, vinculados ao fingerprint `d50ffef9b3565a7ae1cc33913c7199c6d6834a5e7c5e4acea9efa2de63e28ee6`. Fonte da branch `14866114942e1eb1f8e597d8a42f25d848dfb2e8`; checkout CI `d3b476bfe377f5ade9d6107448363ce1d0f30307`. Quando o checkout é o merge temporário de PR, a equivalência é demonstrada pelo fingerprint completo, não pelo nome do commit.

O inventário nativo confere integralmente com o contrato estático revisado, inclusive as permissões de colunas como conjuntos. Prefixo de 15 migrations, candidatos/receita M05 e testes originais preservados. A migration16 também passou por upgrade e recusa de ACL/default inseguro no cluster descartável com login restrito.

As tentativas anteriores e seus logs originais ficam em [regressões](../evidence/consultegeo-m09c/regressions/attempts.json); são diagnóstico, não a qualificação corrente. A expiração inicialmente se perdia na tradução de erro da consulta emprestada. O teste focal observou RED antes da correção e GREEN depois; a suíte nativa também comprova rollback integral após espera. A fixture passou a observar a espera nativa e expirar em menos de 2000ms, preservando o lock_timeout real. A execução push 38505825900 aprovou aplicação e PostgreSQL, mas teve timeout no navegador ao clicar notes-retry; o resultado é preservado separadamente da fonte finalmente aprovada.

O Windows executou 4.495 testes antes da última regressão adicionada: 4.462 aprovados e 33 falhas de ambiente symlink/socket/CLI registradas nominalmente. A regressão posterior passou nos 66 testes focais e na suíte Linux completa de 4.496. Nenhuma falha Windows foi dispensada e nenhum gate foi reduzido ou ignorado. [Relatório canônico](../evidence/homologation/latest.json), [origem CI](../evidence/consultegeo-m09c/ci-source.json), [inventário nativo](../evidence/consultegeo-m09c/security-inventory.json).

Revisão única independente:0 Critical,2 Important,0 Minor. Corrigidos o mínimo Unicode divergente do core e a confirmação incompleta de efeitos persistidos, com regressões antes das correções. A validação nativa também revelou ambiguidade entre variável e coluna request_id no trigger do COMMIT; substituída por nome inequívoco. A correção mantém o tratamento conservador de confirmação desconhecida. [Revisão e resolução](../evidence/consultegeo-m09c/review-final.md); [ledger](../evidence/consultegeo-m09c/execution-ledger.md). Nenhum minor adiado.

## Continuidade

Promover código/schema juntos pelo processo próprio, após qualificar a origem real e sua identidade, os vínculos/coberturas, o calendário vigente e o último protocolo legado. Não repetir bootstrap nem usar a base hospedada como laboratório. A próxima entrega da jornada pode montar a UI sobre esses endpoints; a operação de email usa esta outbox e as políticas/templates Resend já preparados.
