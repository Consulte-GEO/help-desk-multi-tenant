# HDN-01c — estado da continuidade em 12/10/2026

A base remota foi reconsultada em `6e069005beaa12d7cb55c77af92478c21f7526ca`. O PR29 corrigiu o painel após login e está preservado; esta rodada não altera frontend, Auth, permissões, schemas hospedados ou deploy. HDN-01a/b/c continuam sendo deltas locais.

## Entrega

Revalidação dos metadados das notas antes de usar o checklist para resolver o chamado. Nova leitura privada retém as evidências na transação do ticket; domínio recusa conjunto incompleto, outra conta/ticket/autor e nota posterior à marcação. O adapter também confere o ticket retornado. A leitura de edição e os recibos históricos permanecem independentes. Não há marcação, evento, auditoria adicional ou notificação produzida pela leitura.

O retorno externo do workflow continua mínimo; nenhum texto/evidência/risco foi acrescentado a evento público, outbox ou recibo. Os testes de composição chamam o workflow, o resolver, o runner e o adapter reais, com driver e autoridade controlados. Eles não demonstram RLS ou durabilidade do PostgreSQL.

## Evidência desta fonte

- 33 testes novos; 184 regressões preservadas; 217/217 no conjunto final, zero falhas/skips/cancelamentos/TODO.
- Quatro mutações da guarda detectadas: 20/1/2/1 falhas. Fonte restaurada e suíte repetida.
- Typecheck focal TS 5.8.3 com opções estritas e @types/node 25.1.0 globais; não npm ci pinado nem typecheck integral.
- 12 cenários SQL anteriores + 7 novos = 19 escritos, zero executados nesta rodada. Não chamar typescript --check de validação do PL/pgSQL.
- Não houve build, navegador, CI oficial, migration nova, fornecedor, revisão independente ou publicação.

## Primeiro ponto obrigatório

No checkout integral atualizado: aplicar uma alternativa de patch, instalar pelo lock e executar o runner `test:db:local` ou `test:db:native` já existente com PG17. Confirmar que a instalação HDN ocorre após D/E/G e que os 19 subtestes efetivamente rodam. Uma falha do grupo na instalação não aprova seus cenários. Não substituir esse teste por banco Supabase hospedado nem reabrir a consolidação histórica R1 como pendência.

O SQL novo é uma função adicionada ao candidato já existente; não há migration pronta. Rever especialmente locks da nota/serialização, FKs, grant EXECUTE, papéis e rollback. A nova função deve participar da futura migração aditiva e da readiness correspondente. Sua ausência deve continuar recusando resolução, sem fallback genérico.

## Referências técnicas consultadas

PostgreSQL 17, Explicit Locking: https://www.postgresql.org/docs/17/explicit-locking.html — `FOR SHARE` e manutenção dos row locks até o fim da transação. Isso fundamenta o desenho, não comprova execução desta função.

O índice de changelog Supabase não foi recuperado pela ferramenta. Não foi introduzida API/CLI nova ou versão presumida. Tentativas locais de rede/download e inspeção de ferramentas estão registradas no relatório externo do pacote.
