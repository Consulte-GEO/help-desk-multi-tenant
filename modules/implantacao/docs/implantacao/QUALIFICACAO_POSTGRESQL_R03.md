# Qualificador PostgreSQL local — R03

## Evidência atual

O executor foi chamado nesta sessão e respondeu `status=blocked`, `postgresqlExecuted=false`, exit 2. Motivos: usuário de SO root, binários PostgreSQL 17 ausentes e driver pg ausente. Nenhuma query, instalação do DDL, tabela, role ou migration foi executada. O DDL da R02 não foi alterado. A falta de rede também impediu obter dependências. Não houve tentativa em Supabase hospedado nem uso de emulador como substituto.

## Como executar no ambiente de desenvolvimento do Codex

Executar como usuário de sistema operacional não-root, com binários locais PostgreSQL 17 (`initdb`, `postgres`, `pg_ctl`) e uma instalação aprovada, travada por lock, do driver Node `pg`. O script não instala dependências. Driver deve ser o diretório local do pacote que possui package.json name=pg; a versão exata entra na evidência. Não expor credenciais em comandos.

```sh
node --experimental-strip-types tools/qualify-import-process-postgres.mjs \
  --execute \
  --pg-bin /caminho/local/postgresql/17/bin \
  --driver /caminho/local/node_modules/pg \
  --output /caminho/externo/evidencias/pg-r03-novo
```

Sem --execute ou pré-requisitos: exit 2, blocked; não é homologação. Diretório de evidência deve ser novo. Não adicionar parâmetros --host/--dsn/URL: são recusados. O script cria cluster TEMPORÁRIO próprio e socket Unix privado; listen_addresses vazio, não conecta a banco existente. O bootstrap administrativo vale somente para esse cluster sintético e não é receita para o provedor hospedado.

Após início local, cria a base sintética, o papel restrito e aplica o DDL candidato dentro do cluster. Exercita o adaptador com `pg` real e a mesma conexão por transação. Fecha/reabre pool para checar persistência entre conexões. Mantém autoridade/inspeção como fixtures CONTROLADAS; essa suíte não qualifica login real nem arquivo real.

## Onze cenários preparados, ainda não executados em PostgreSQL

Catálogo/RLS/owner; criação e replay; reabertura do pool; concorrência de duas conexões; negação sem contexto e limpeza SET LOCAL; conta/solicitante; imutabilidade UPDATE/DELETE/TRUNCATE; COMMIT sem evento/recibo; recusa de papel administrativo; arquivo pending/ready; rollback após falha injetada depois da revisão.

Saídas: qualification.json, catalog.json, log do PostgreSQL e do ferramental. O script para o cluster antes de apagar seu diretório privado identificado por marcador. Se não conseguir pará-lo, retém o diretório e falha; não remove um cluster ativo. Evidências ficam fora do temporário.

## Ainda necessário além de passar os onze testes

Revisão de privilégios/memberships conforme o provedor, testes com queda ambígua no COMMIT, reinício físico do cluster, restore/RTO/RPO, padrão de snapshots grandes, catálogo de migrations e vínculo de autoridade real. Testar grants herdados: o guard básico do adaptador não equivale a uma auditoria completa de ACL. Qualificar armazenamento imutável, scanner, download e retenção efetiva. Não promover o DDL para migration nem abrir flags a partir de contagens da suíte em memória.

Referências primárias consultadas: PostgreSQL 17, Row Security Policies (https://www.postgresql.org/docs/17/ddl-rowsecurity.html), e node-postgres, Transactions (https://node-postgres.com/features/transactions). A separação entre RLS e autenticação e a necessidade de uma mesma conexão transacional foram preservadas. Nenhuma recomendação de versão 'mais recente' é inferida.
