# Consulte Help Desk — v0.7.0 / busca autorizada e caixa de chamados

Help Desk independente, multiproduto e multicontrato. Workspace, conta, produto/instância, contrato/versão e cobertura continuam conceitos separados.

**Incremento local, não publicado. M1 aberto.** 486 testes locais e 17 checks HTTP de loopback aprovados; SQL, navegador e runtime remoto não homologados. A busca antecipa parte delimitada HD-302 planejada em M3, sem declarar M1/M2/M3 concluídos.

## Novidades

Busca por assunto ou UUID completo no servidor, inclusive fora da primeira página. Situação pública e prioridade combináveis; API aplica filtros antes de limitar. Termo literal, equivalência de caixa ASCII/Latin-1 e acentos significativos. Não pesquisa descrição, respostas ou notas internas. Sem novos privilégios ou tabelas.

Interface com Aplicar/Enter, Limpar filtros, retry e contagens de itens **carregados**. Respostas atrasadas de outra consulta/sessão não substituem a atual; rascunho e detalhe não são apagados ao filtrar. Páginas malformadas/duplicadas são rejeitadas. Teto de 500 itens na tela pede refinamento, sem restringir o total paginável da API.

```http
GET /v1/tickets?q=Relat%C3%B3rio&status=in_progress&priority=high&limit=25
```

A requisição exige identidade e workspace autorizados. Nova capability `ticket_search`; continuam 16 operações/13 caminhos. Cursor é navegação, não autorização. Consultas são vivas, não snapshot.

## Executar demonstração

```bash
npm test
npm run demo
```

Node utilizado: 22.16.0. Demo escuta somente em `http://127.0.0.1:4317`, dados fictícios em memória, sem Supabase ou envio externo. `npm run test:ui:local` inicia/encerra suas próprias demonstrações; não reaproveita servidor desconhecido. Os 17 checks HTTP passaram; o browser bloqueou na navegação, antes dos 17 checks escritos.

## Homologação necessária

```bash
npm run deps:resolve
# Revisar lock real, árvore, origens e alertas.
npm run homologate:local
npm run check:homologation
```

Registry retornou EAI_AGAIN; não há lock, npm ci/audit aprovados. `npm run verify` falhou por dependências/tipos locais ausentes. Typecheck com ferramentas globais passou, mas não substitui instalação. Gate agregado/publicação bloqueados. `npm run build` produz somente assets estáticos, não bundle/execução das Functions.

Executar **68 cenários PostgreSQL** em banco descartável; Docker é padrão. Runner nativo anterior exige PostgreSQL 17 previamente instalado e usuário não root, selecionado explicitamente por HELPDESK_TEST_DB_ENGINE=native e HELPDESK_TEST_PG_BIN absoluto. Nenhuma instalação/fallback remoto/política alterada. Zero SQL executado nesta rodada. Ainda faltam browser, Auth/pooler/TLS/Functions, EXPLAIN/capacidade, restauração e revisão independente.

Observabilidade da v0.6.0 preservada; resumo offline: `npm run --silent logs:summary -- observacoes.jsonl`. Logs da aplicação não incluem q/filtros; validar redação de query strings no ingresso/proxy do destino. Não registrar segredos na busca.

## Compatibilidade e documentos

**API/interface 0.7.0; schema esperado 0.5.0.** Seis migrations preservadas byte a byte, 23 tabelas candidatas. Nenhuma migration nova. Busca é extensão opcional da API; o antigo filtro local de descrição deixou de existir. Semântica detalhada no documento 11.

[Arquitetura](docs/01-ARQUITETURA.md) · [Plano](docs/02-PLANO-DE-DESENVOLVIMENTO.md) · [Evidências](docs/04-ESTADO-E-EVIDENCIAS.md) · [Handoff](docs/05-HANDOFF-REVISAO.md) · [Busca e caixa](docs/11-M1F-BUSCA-E-CAIXA.md) · [OpenAPI](docs/openapi.json) · [Changelog](CHANGELOG.md).

Sem push/merge/deploy/migrations/segredos/MFA/dados alterados. GitHub foi lido e retornou vazio; Supabase/Netlify não reinspecionados. Preservar alterações concorrentes e reinspecionar antes de integrar. Backoffice M2, intakes, participantes/filas, SLA operacional, anexos, worker/e-mail/webhooks e suporte incorporado continuam fora desta entrega. Não utilizar dados reais de clientes antes da liberação explícita e homologação completa.
