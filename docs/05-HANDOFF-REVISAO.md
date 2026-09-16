# Continuidade — Help Desk v0.4.0 / M1c

Base v0.3.0 `011bec31f0d2ef5622c9b4f401edc9fc753a65e5`. Branch `work/helpdesk-m1-v0.4.0`. O pacote é local, sem autorização implícita de publicação, alterações de segredos/MFA ou migrations remotas. Antes de integrar, reinspecionar os destinos: não houve nova leitura remota nesta rodada.

Leia `04-ESTADO-E-EVIDENCIAS.md`, `08-M1C-TRANSACOES-E-SESSOES.md`, `CHANGELOG.md` e `examples/integration-session-lifecycle.http`.

## Próxima execução

1. Resolver dependências em ambiente autorizado: `npm run deps:resolve`. Revisar o lock real, origens/integridades/versões/licenças/alertas e repetir npm ci/audit. Não copiar os locks sintéticos dos testes nem marcar a etapa como concluída por existir package.json.
2. Executar `npm run homologate:local` em ambiente apto. São 325 testes locais, 46 casos SQL e 10 checks HTTP + 11 browser. Os números escritos não substituem as contagens efetivamente retornadas. Não usar dados reais.
3. Revisar especialmente as cinco migrations em um PostgreSQL 17 novo. Validar BEGIN/COMMIT/ROLLBACK reais, o retorno ROLLBACK após erro SQL engolido, descarte do pool, contextos vazios, timeouts, FORCE RLS e privilégios. A nova função revoga somente o digest apresentado, sem alcance à credencial ou pares. Validar também o update 001–004 → 005 em homologação com dados fictícios e manter schema 0.4.0 consistente com o runtime.
4. Executar as verificações visuais/ponta a ponta já escritas. Não contornar `ERR_BLOCKED_BY_ADMINISTRATOR`. Conferir rascunhos, contexto e paginação. No adaptador HTTP real, DELETE sem conteúdo pode apresentar stream vazio: isso é aceito; qualquer payload é recusado.
5. Empacotar e executar Netlify Functions com pg instalado em ambiente autorizado. Confirmar driver command tags, tempos server-side, metadados IP confiáveis, Auth humano, divergência de relógios, M2M/tokens curtos, revogação, pooler e TLS. Não confundir testes com doubles com essa etapa.
6. Medir round trips, número de conexões, timeouts e comportamento de 429/503. O envelope de controle introduz transações adicionais; não remover a proteção para ocultar latência, e não ampliar timeouts sem medir o efeito.
7. Rever logs e `npm run check:homologation`. Aprovação local não é publicação nem homologação do destino. Manter `HELPDESK_RELEASE_APPROVED` fechado até decisão explícita e verificações completas. Depois avaliar o início do M2.

## Arquivos prioritários

| Tema | Arquivos |
|---|---|
| Resultado transacional e descarte | `src/infrastructure/transaction.ts`, `postgres.ts`, `tests/m1c-transaction.test.ts` |
| Controle com timeouts no pool real | `src/infrastructure/runtime.ts`, `rate-limit.ts`, SQL M1c |
| Sessões curtas | `authentication.ts`, `session-lifecycle.ts`, `tests/m1c-sessions.test.ts` |
| Endpoint e corpo vazio | `src/http/handler.ts`, `empty-body.ts`, `tests/m1c-empty-body.test.ts` |
| SQL/grants | `20260916000500_m1_session_lifecycle.sql`, `supabase/tests/rls.test.ts` |
| Contrato/exemplo | `scripts/generate-openapi.py`, `docs/openapi.json`, `examples/integration-session-lifecycle.http` |
| Evidências | `evidence/m1c/`, `scripts/homologation-core.mjs` |

## Observações de segurança

- 503 após COMMIT é resultado incerto, não prova de ausência de gravação. Nunca retry automático com nova chave.
- Revogar sessão não cancela requisição em andamento nem substitui revogação de credencial/conexão. Não inclui logout humano, suporte incorporado ou backoffice.
- Uma resposta privada inválida de troca M2M não devolve bearer. Sessão eventualmente criada nessa falha expira sem ser entregue ao consumidor.
- Exigir relógios sincronizados na aplicação/DB; a validação recusa prazo restante acima de dez minutos.
- No demo, M2M não é configurado: capability false, endpoint 503. Não adicionar fake de sucesso para uma homologação verde.
- Evidência local é revisável, não uma atestação independente. Nenhum pentest, teste de carga ou restore foi concluído.
