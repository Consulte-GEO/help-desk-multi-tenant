# Continuidade — Help Desk v0.5.0 / M1d

Base v0.4.0 `a51f721f329fa2a4e3029820c00793da1196b82e`; branch local `work/helpdesk-m1-v0.5.0`. Commit final no manifesto/bundle. Sem escrita ou reinspeção remota. Antes de integrar, reinspecionar os destinos e preservar trabalho concorrente; não pressupor que o repositório continua vazio.

Leia `04-ESTADO-E-EVIDENCIAS.md`, `09-M1D-CATALOGO-E-ABERTURA.md`, OpenAPI e CHANGELOG. 407 testes locais e 13 checks HTTP não encerram M1.

## Ordem de execução

1. Em ambiente com acesso autorizado ao registry, executar `npm run deps:resolve`. Revisar lock real, origens, integridades, versões e alertas. Repetir `npm ci --ignore-scripts`, `npm run verify` e `npm audit --audit-level=high`. Não usar locks sintéticos ou tipos globais como substitutos.
2. Executar `npm run test:db:local` em PostgreSQL 17 descartável. São **60 cenários**, não aprovados ainda. Aplicar as seis migrations em ordem; executar também upgrade 001–005 → 006 em ambiente separado com dados fictícios, sem apagar schemas existentes para fazer passar.
3. Revisar função `helpdesk_auth.support_contexts(uuid,uuid,uuid,uuid,text,integer)` com login real restrito. Validar owner, `SECURITY DEFINER`, `search_path`, grants, ausência de exposição na Data API, live scopes, conta/produto, suspensão, fim de vigência, cursor `COLLATE "C"` e Unicode. Medir plano de consulta e custo de contratos duplicados; o índice candidato ainda não foi homologado.
4. Executar `npm run test:ui:local`. **13 checks HTTP + 14 browser** são o conjunto escrito. Rever seleção única/múltipla, carregamento vazio/erro/mais páginas, escolha explícita de cobertura, troca de perfil com request pendente, fechamento/reabertura, teclado e foco mobile. Não contornar bloqueio de política do navegador. A nova lista substitui os campos de UUID, também fora do demo.
5. Empacotar e executar Functions com `pg` instalado em homologação autorizada; confirmar Auth, pooler/TLS, metadados IP, quotas, transações e schema 0.5.0. O backend 0.5.0 recusa schema 0.4.0. Não publicar somente o HTML como se o backend estivesse pronto.
6. Executar `npm run homologate:local` e `npm run check:homologation`, revisar logs/fingerprint. Homologação local não é autorização de publicação nem prova do destino. Manter `HELPDESK_RELEASE_APPROVED` fechado até decisão explícita e evidências completas.
7. Homologar carga/abuso, restauração, retenção, revisão independente e decisões operacionais aplicáveis. Só então avaliar encerramento M1 e início M2. O catálogo de leitura não é CRUD administrativo.

## Arquivos prioritários

| Área | Arquivos |
|---|---|
| Regras/cursor/projeção | `src/application/support-catalog.ts`, `helpdesk.ts`, `ports.ts` |
| Persistência | `src/infrastructure/memory.ts`, `postgres.ts`, migration `20260916000600_support_catalog.sql` |
| Fronteira HTTP | `src/http/handler.ts`, `scripts/generate-openapi.py`, `docs/openapi.json` |
| Formulário | `web/support-catalog-state.js`, `web/app.js`, `web/index.html` |
| Testes | `tests/m1d-catalog*.test.ts`, `supabase/tests/rls.test.ts`, `tests/browser-smoke.py` |
| Transporte/empacotamento | `scripts/demo.ts`, `build.mjs`, `smoke-local-http.mjs` |
| Evidências | `evidence/m1d/`, `evidence/homologation/latest.json` |

## Invariantes

Catálogo consultivo, nunca autorização ou reserva. Listagem só com `contexts:resolve`; criação continua revalidando cobertura na transação. Ausência de opção não cria intake nem contrato fictício. Cursor é navegação, não credencial assinada. Páginas são vivas: publicações/revogações podem mudar o conjunto entre leituras. Nomes de conta/produto/serviço devem ser adequados à apresentação ao cliente. Notas, política contratual e credenciais não entram no DTO. Identidade M2M permanece server-to-server; esta versão não implementa sessão incorporada por usuário externo.

As cinco migrations anteriores estão preservadas por hash. Não alterá-las para evitar falha de homologação. Não somar testes SQL/browser escritos aos testes locais aprovados. Não atualizar relatório para ocultar bloqueios.
