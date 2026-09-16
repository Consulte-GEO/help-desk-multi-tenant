# Continuidade — Help Desk v0.7.0

Base v0.6.0 `a6eb2c69ce3ea9b49eaab881ed236da43a725662`; branch local `work/helpdesk-m1-v0.7.0`. Commit final no manifesto/bundle. Sem escrita remota; somente leitura GitHub, que retornou vazio. Reinspecionar os três destinos antes de integrar; não presumir ausência de trabalho concorrente.

Leia README, documentos 04/11, CHANGELOG e a atualização do plano. **486 testes locais e 17 checks HTTP de memória não encerram M1.** Esta entrega antecipa parte delimitada HD-302 do M3; M2/backoffice não foi implementado e os gates anteriores não mudaram.

## Sequência de continuidade

1. Resolver dependências: `npm run deps:resolve`; revisar lock real, árvore, origens, integridades e alertas. Repetir npm ci, verify e audit. Não criar lock sintético nem substituir tipos locais pelos globais no CI.
2. Executar PostgreSQL 17 descartável com seis migrations e login restrito: `npm run test:db:local`. Docker padrão, native somente com binários instalados e usuário não root. São **68 cenários SQL**, nenhum aprovado nesta entrega. Não usar Supabase remoto como fallback nem apagar schemas para tornar o teste verde.
3. Testar especificamente q/filtros com RLS real e dados autorizados/não autorizados, revogação entre páginas, parâmetros literais, equivalência Latin-1 e cursor. Verificar EXPLAIN/custo de substring e concorrência com mudança de estado. Sem medidas reais, não introduzir índice ou alterar limite/timeout como promessa de escala.
4. Executar `npm run test:ui:local`: **17 checks HTTP + 17 browser**. Os três novos browser verificam filtros combinados, limpar e resposta atrasada. Validar 390px/desktop, teclado/foco, mensagens de erro/vazio, 500 itens, retry, perfil, paginação e rascunhos. Não contornar bloqueio de política do navegador.
5. Homologar driver/Functions/Auth/pooler/TLS/IP e schema esperado **0.5.0**. Não gerar migration só para igualar a versão API **0.7.0**. Confirmar redação de query strings em logs de ingresso, pois a busca usa GET; os logs fechados da aplicação não bastam para garantir isso no provedor.
6. Executar `npm run homologate:local`, depois `npm run check:homologation`; revisar logs/fingerprint/contagens reais. Gate exige pelo menos 486 testes locais, 68 SQL e 34 checks HTTP/browser sem skips. Sucesso local não aprova produção ou destino; manter HELPDESK_RELEASE_APPROVED fechado.
7. Homologar capacidade, restauração, retenção, revisão independente e decisões operacionais. Só então avaliar encerramento M1 e início M2. Não ampliar escopo sem registrar a decisão.

## Arquivos de revisão

| Área | Arquivos |
|---|---|
| Validação/normalização/semântica | src/application/ticket-search.ts |
| Autorização/paginação | helpdesk.ts, pagination.ts, ports.ts, handler.ts |
| SQL candidato e memória | src/infrastructure/postgres.ts, memory.ts |
| Estado seguro da lista | web/ticket-list-state.js, app.js |
| Interface/contagens | web/index.html, styles.css |
| Contrato/capabilities | docs/openapi.json, scripts/generate-openapi.py, handler.ts |
| Testes locais | tests/m1f-*.test.ts |
| Testes reais escritos | supabase/tests/rls.test.ts, tests/browser-smoke.py |
| Evidências/revisão | evidence/m1f/, evidence/homologation/latest.json |

## Invariantes

Assunto/ID completo, não descrição ou conversa. `%`/`_`/aspas literais, equivalência de caixa somente ASCII/Latin-1, acentos significativos. Não trocar por LIKE/FTS sem especificar semântica e testar. Conta e cursor não autorizam. Filtros antes de LIMIT, RLS preservada, nenhum SECURITY DEFINER novo. Coleção viva sem garantia de snapshot. Contagens somente carregadas, não total do workspace. Limite500 da UI, não da API. Troca de consulta preserva detalhe/rascunho; troca de sessão limpa tudo. Querys antigas não substituem novas, páginas inválidas não se aplicam parcialmente.

Não somar SQL/browser escritos às aprovações locais. Nenhum review externo/pentest/carga/restore concluído. O ZIP inclui documentação e evidências; não publicar apenas HTML como sistema pronto.
