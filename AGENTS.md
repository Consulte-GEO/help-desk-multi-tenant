# Instruções de continuidade — Help Desk

Leia README, docs/01-ARQUITETURA.md, docs/02-PLANO-DE-DESENVOLVIMENTO.md docs/04-ESTADO-E-EVIDENCIAS.md e docs/06-M1-SEGURANCA-E-LIMITES.md antes de alterar o código.

## Fronteiras obrigatórias
- Workspace, conta, produto/instância, contrato/versão e cobertura são conceitos distintos.
- Não introduzir laboratório, obra, aluno ou identificadores específicos como colunas obrigatórias do core.
- Não acessar o banco GeoLab ou legado para armazenar tickets deste produto.
- Nunca usar service_role, postgres ou BYPASSRLS como identidade normal de request.
- Não expor schemas/tabelas de domínio diretamente a browsers ou sistemas consumidores.
- Não tratar header, UUID ou JWT metadata como autorização.
- Notas internas têm tabela, endpoint e DTO próprios; não participam de outbox externo.
- Preservar versões publicadas e snapshots; alterar políticas em nova versão.
- Idempotência é persistente/transacional; contexto de pool somente transacional.
- Memória e credenciais `demo-*` são exclusivamente de testes/loopback. Nunca fallback de produção.

## Execução segura
- Esta entrega não autoriza implicitamente deploy, merge, migration remota, alteração de segredo/MFA, criação de infraestrutura cobrada ou alteração de outros sistemas.
- Reinspecionar GitHub/Supabase/Netlify antes de publicação: podem existir mudanças concorrentes.
- Trabalhar em branch isolada. Não sobrescrever o repositório remoto porque a inspeção antiga disse que estava vazio.
- Testar SQL com login real restrito em banco descartável; os testes de memória não comprovam RLS.
- Não alterar políticas de segurança do ambiente de execução para contornar bloqueios de navegador/rede.
- Não marcar requisito concluído só por haver arquivo, migration ou teste escrito.

## Qualidade
Escrever testes negativos antes da correção; executar npm test, typecheck, check:contracts e build. Executar a suíte PostgreSQL e a interface em ambiente apto. Não publicar com lockfile ausente, dependência não auditada ou capabilities fictícias. Documentar explicitamente não executado, bloqueado e não implementado. Entregar evidências por commit e atualizar a matriz de status.

## Estado v0.8.0
M1 aberto. 569 locais e 22 HTTP aprovados; 82 SQL e 22 browser escritos, não aprovados. API/schema candidato0.8.0, sete migrations, 23 tabelas, 17 operações. Sem publicação remota. Ler docs04/05/12 e histórico. Não reescrever migrations001–006; 007 candidata precisa de PostgreSQL real.

Prioridade: humano operador + read/write, reason interno obrigatório, If-Match/idempotência; mesmo valor não aumenta versão. Cliente não recebe reason. Outbox mínima, sem envio externo. Snapshot/SLA não mudam. Revalidar operador antes de cache e nos helpers de banco. Histórico não é auditoria global; UI com páginas/geração, não dados arbitrários.

Preservar busca/catálogo/rascunhos/telemetria e invariantes do histórico nas versões anteriores. Não usar bloqueio de ambiente como motivo para ampliar módulos e chamar M1 concluído. SQL/browser escritos não são passagens locais. Reinspecionar destino antes de integração.
