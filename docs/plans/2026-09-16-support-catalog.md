# v0.5.0 — Descoberta autorizada e abertura guiada

## Objetivo e limite
Prosseguir no fluxo de abertura já existente (HD-105), oferecendo descoberta paginada de conta/sistema/serviço elegíveis. A indisponibilidade de registry/PostgreSQL não encerra M1. Este incremento não habilita produção, não inicia o backoffice administrativo M2 e não altera ambientes remotos.

## Decisões
- Novo `GET /v1/support-contexts`, autenticado, com scope existente `contexts:resolve`; sem novos poderes.
- Uma opção por tupla conta/instância/serviço, mesmo com múltiplos contratos. Catálogo não escolhe contrato e não concede acesso permanente. POST existente revalida e trata ambiguidade.
- Resposta contém apenas nomes públicos, ambiente e identificadores de contexto. Sem policy, credenciais, notas, contagem global ou contratos de outras contas.
- Paginação ascendente por chave composta; cursor vinculado a workspace/principal/filtro, não é credencial. Permissões vigentes são reavaliadas a cada página.
- Helper SQL privado faz filtro de grants/produto/scope/vigência; sem ampliar grants diretos nas tabelas. As cinco migrations prévias são imutáveis; 006 adiciona helper, índice e versão de schema 0.5.0.
- UI usa catálogo da API também na demonstração. Não usa dados do demo como autorização nem recorre a UUIDs manuais quando catálogo falha.
- Paginação manual, estados de carregamento/vazio/erro, opção única automática, múltiplas opções explícitas. Respostas antigas não substituem contexto após troca de perfil/fechamento.

## Execução verificável
1. [x] Recuperar bundle e reproduzir base: 325 testes.
2. [x] Tentar dependências/banco local: registry e apt sem resolução DNS; download oficial não concluído. Nenhum DB real iniciado.
3. [x] Testes negativos e positivos de catálogo, cursores, HTTP antes da implementação; registrar red/green.
4. [x] Implementar domínio de catálogo, aplicação, memória/SQL, helper 006 e OpenAPI.
5. [x] Testar estado da abertura antes da alteração da UI; integrar dropdown paginado, texto seguro e proteção de geração.
6. [x] Ampliar smoke HTTP e cenários SQL/browser, mantendo distinção executado/escrito.
7. [x] Revisar diffs e rodar suíte, checagens, build, smoke e tentativas de homologação; documentar bloqueios reais.
8. [ ] Commit local, ZIP, patch e bundle verificáveis. Sem push/merge/deploy.

## Riscos e próximos testes reais
RLS/SECURITY DEFINER/grants não são comprovados pelos doubles; exercício PostgreSQL é bloqueador de homologação. Consulta de catálogo é uma visão viva, não snapshot entre páginas: publicação/revogação pode adicionar/remover opções. Latência e planos de consulta exigem teste de carga. Nomes de catálogo precisam ser adequados à apresentação ao cliente. Não inclui edição administrativa, SLA, anexos, notificações ou sessão incorporada.

## Fechamento
O passo 8 é registrado pelo manifesto externo: commit, ZIP, patch, bundle e recuperação verificada. Não representa publicação remota.
