# HDN-01j — validação SQL em branch isolada

## Escopo desta branch

Base `6e069005beaa12d7cb55c77af92478c21f7526ca`. Esta branch reúne os 11 arquivos da HDN-01i necessários aos 31 cenários PostgreSQL: domínio, parser de marcação, contrato de página, store, guard legado, executor, PostgresStore, SQL candidato e registro/cenário. Os bytes foram conferidos pelos objetos Git; a árvore reconstruída com os hashes locais coincide com a árvore transferida.

Não é ainda a integração dos 75 arquivos do cumulativo: interface, handlers e montagem estruturada restantes continuam no pacote local. O objetivo é executar a persistência no runner já existente, em checkout completo Linux/Node22/PostgreSQL17. Workflows, lock, migrations, gates, evidência canônica e UI da principal permanecem intactos. Teste não executado não é aprovação.

## Regras

Não aplicar o SQL candidato no Supabase hospedado, não promover migration, não fazer merge ou abrir atendimento. A própria instalação candidata exige banco descartável, marcador local e administrador do teste; operações exercitadas usam login restrito. A suíte principal conserva as regressões anteriores e registra os 31 cenários novos após D/E/G.

O primeiro commit conserva o código do pacote I para revelar falhas reais de integração. Corrigir somente causas demonstradas e preservar as execuções vermelhas. Não remover cenários, ampliar grants ou enfraquecer gates para aprovar. O arquivo SQL continua fora do manifest de migrations.

## Evidência

No momento deste checkpoint nenhum novo CI foi concluído. Resultados e correções posteriores serão registrados no PR e no pacote cumulativo, vinculados à fonte exata. A aprovação dessa fatia SQL não equivale a montagem de runtime, navegador do checklist, qualificação do Novo GEO ou aceite operacional.
