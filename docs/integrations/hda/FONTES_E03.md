# Fontes e limites — E03

Pacote de partida: `HelpDesk_DevAgent_E02_2026-10-14.zip` fornecido na conversa. O pacote original foi preservado.
Principal consultada: `Consulte-GEO/help-desk-multi-tenant`, `d5610aca8b4a5ca65567c0c92b2c7a1df5aa6da4`, branch `codex/m1-reproducibilidade`, PR41.

O nome do lock e a semântica do teto de permissões foram conferidos em `supabase/migrations/20260917000900_human_scope_versions.sql` no mesmo commit: `guard_human_scope_version`, `has_scope` e `human_scopes`. Leitura de fonte não equivale a teste da integração.

Referências primárias consultadas em 14/10/2026:
- PostgreSQL17 / explicit locking: https://www.postgresql.org/docs/17/explicit-locking.html
- PostgreSQL17 / PLpgSQL statements: https://www.postgresql.org/docs/17/plpgsql-statements.html
- PostgreSQL17 / configuration syntax: https://www.postgresql.org/docs/17/config-setting.html

A configuração de arquivo usa aspas simples duplicadas e evita reinterpretação de caminho pelo argumento -o. Locks de linha não impedem sozinhos uma inserção de uma revisão futura em tabela append-only: por isso se preserva a chave de lock do publicador.

Sem cópia integral do repositório; sem alteração de GitHub, Netlify, Supabase ou Novo GEO. Os hashes de arquivos do pacote são verificação de integridade, não uma assinatura ou auditoria independente.
