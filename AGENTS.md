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

## Estado v0.7.0
M1 em andamento, sem publicação. 486 testes locais e 17 checks HTTP de demonstração aprovados. 68 casos SQL e 17 checks browser continuam escritos, não aprovados. API 0.7.0 / schema 0.5.0; seis migrations preservadas, 23 tabelas, 16 operações HTTP. Não criar migration somente para alinhar versão visual.

Diagnósticos usam lista fechada em src/observability, com request_id para correlação, nunca como autorização ou dimensão agregada. Não registrar IP, query, tokens, corpo, nomes, UUIDs de recursos ou exceções brutas. O resumo offline conta registros, não requisições únicas; não inventar percentis exatos. Observer é best-effort e não substitui auditoria/outbox.

PostgreSQL nativo: engine explicitamente native, binários instalados em HELPDESK_TEST_PG_BIN e usuário não root. Nenhum downloader/fallback remoto. Só limpar cluster próprio após confirmação; se ownership/parada falhar, preservar e retornar falha. Tests com comandos controlados não comprovam PostgreSQL real. O caminho Docker anterior permanece padrão.

Ler documentos 04, 05 e 11; 06–09 e docs/history preservam o histórico. O catálogo continua consultivo, não CRUD M2 nem autorização permanente. Criar sempre revalida. Manter gates fechados até dependências e ambiente real aprovados.

Busca q/situação pública/prioridade precede LIMIT no servidor. Assunto/ID completo apenas, sem notas/mensagens/descrição no predicado; equivalência ASCII/Latin-1 e acentos significativos. Não mudar para LIKE/FTS sem especificar semântica. Cursor vinculado aos filtros, autorização a cada consulta. Logs não registram q; homologar também ingresso/proxy. Estado da lista guarda geração e valida páginas integralmente; preservar rascunho ao filtrar, limpar por sessão. Contagens apenas carregadas; teto de 500 é da interface, não do total da API. Parte HD-302 antecipada sem fechar M1 nem entregar M2/M3.
