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

## Estado v0.11.0
M1 aberto. 710 locais/32 HTTP aprovados;125 SQL/27 browser escritos, não homologados. API0.11.0/schema0.9.0; oito migrations/23 tabelas/18 operações. Ler docs04/05/15. Reinspeção remota feita somente leitura; não pressupor estado futuro nem autorização de escrita.

Preservar UUIDs nos limites persistidos/Auth e aliases somente no domínio/demo. NUL/surrogates isolados são recusados, não removidos silenciosamente. Validar parent e escopo de cada linha de conversa antes de serializar. Filtros assignment somente operador por conta, antes de paginação; não concedem acesso. Principal HelpDesk não é obrigatoriamente igual ao usuário Auth.

Prioridade/atribuição são internas à equipe, com motivos restritos e controle de versão/idempotência. Responsabilidade não produz outbox e não entra na política de leitura. Cache devolve resposta original reautorizada. Preservar busca/catálogo/rascunhos/telemetria. Não alterar as oito migrations anteriores, seus hashes, gates ou fixtures para fabricar homologação.
