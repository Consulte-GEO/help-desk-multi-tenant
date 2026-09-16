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

## Estado v0.9.0
M1 aberto. 635 locais/28 HTTP aprovados;100 SQL/25 browser escritos, não homologados. API/schema candidato0.9.0, oito migrations/23 tabelas/18 operações. Sem publicação ou inspeção remota nova. Ler docs04/05/13. Preservar migrations001–007;008 precisa de banco real/fresh+upgrade. Responsabilidade nunca concede acesso e não gera outbox. Retry mantém chave; não remover gates nem fabricar dependências/evidências.

Preservar as invariantes anteriores: prioridade somente operador humano/read/write, motivo interno obrigatório, If-Match/idempotência e no-op; cliente não recebe motivo. Outbox de prioridade mínima; snapshot/SLA não mudam. Revalidar operador no cache e no banco. Histórico não é auditoria global. Preservar busca/catálogo/rascunhos/telemetria. Não usar bloqueio de ambiente como justificativa para chamar M1 concluído. Reinspecionar destinos antes de integrar.
