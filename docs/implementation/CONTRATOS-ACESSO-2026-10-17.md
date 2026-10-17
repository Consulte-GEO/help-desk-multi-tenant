# Contratos de acesso — HD-002 — 17/10/2026

## Recorte da continuidade autorizada

Qualificar as respostas das rotas existentes `GET /workspaces`, `POST /integration-tokens` e `DELETE /integration-tokens/current`. A descoberta humana e a troca/revogação server-to-server já existem; não criar login novo, alterar MFA, ampliar permissões ou montar módulos adiados.

Reutilizar o validador offline OpenAPI, o handler core e o adaptador real de autenticação com SQL/provedor sintéticos próprios. Conferir respostas preenchidas/vazias, projeção sem campos privados, UUID/expiração da sessão, corpo vazio204, correlação e cabeçalhos `no-store`, `nosniff`, `no-referrer`. Recusar ausência/corrupção desses cabeçalhos no gate. Exigir `Retry-After` nos erros429/503 desse recorte, conforme comportamento já implementado.

O catálogo deve declarar o limite real de50 opções; uma resposta SQL incompatível ou com51 opções é indisponibilidade integral, não página parcial. A sessão curta devolve apenas o token recém-gerado, tipo, validade e workspace. Chave original, hashes e campos extras do resultado privado não saem na resposta. A revogação usa somente o digest da sessão apresentada e mantém204 idempotente, inclusive sem vínculos ativos; falha/incerteza nunca confirma logout.

Testes negativos exercitam recusas antes de consultar adaptadores, credencial revogada, catálogo inválido, falha do provedor/SQL, rate limit anterior à autenticação e diagnóstico sanitizado. Mutantes sobre respostas próprias devem comprovar que o gate detecta cabeçalho ausente/inválido, token/esquema inválido, catálogo excedente e corpo indevido204. Esses mutantes não são tráfego real nem um validador de requisições.

Não alterar corpos históricos, callbacks, regras de sessão, grants, migrations, dependências ou capacidades. As declarações de cabeçalho ficam limitadas às três operações deste recorte; demais operações conservam seus contratos. Preservar o gerador auxiliar de OpenAPI, sem regenerar o documento inteiro e reordenar respostas numéricas.

## Limites de evidência

Handlers e adaptadores reais com fontes sintéticas qualificam a composição local, não o Supabase/Auth produtivo. O CI Linux/PostgreSQL17 continua obrigatório para a fonte completa; testes de memória não comprovam RLS. Sem credenciais reais, e-mails, registros de negócio ou mudanças produtivas neste recorte. Aceite humano, métricas operacionais, expansão de capacidades e demais rotas continuam próprios. HD-002 permanece parcial.

MFA e Novo GEO adiados; scanner cancelado; modelos técnicos inexistentes não serão inventados. MCP independente continua local.

## Implementação e verificação local

Base produtiva PR75/0651eb6. Doze testes novos: dez cenários da composição/adaptadores existentes passaram antes da alteração; dois testes de mutantes reproduziram a ausência das restrições no contrato (RED). Após declarar cabeçalhos obrigatórios, prazo nos429/503 e teto50, os12 passaram. A regressão conjunta de contratos, descoberta, sessão curta e modo somente autenticação aprovou115/115, sem falha, skip, cancelamento ou todo.

Tipos pelo compilador direto, contrato formal de45 operações, lock, varredura heurística de segredos e build aprovados. A primeira tentativa de build não concluiu por DNS `ENOTFOUND` no sandbox durante instalação das dependências já fixadas; a repetição com rede permitida passou, sem alterar dependências/timeouts/gates. CI integral e revisão independente ainda pendentes neste checkpoint.

`evidence/access-contract-20261017/contract-scope.json` registra a comparação estrutural com o OpenAPI publicado75: fora dos cabeçalhos das três operações, seus503 explícitos, cinco definições reutilizadas de cabeçalho e `WorkspacePage.items.maxItems`, o contrato permanece igual. Os bytes não relacionados do JSON foram preservados, sem regenerar todo o documento. Runtime e política de acesso não mudaram.

## Revisão e complemento de cobertura

Revisão independente da fonte iniciale243b5b:12/12 testes aprovados e paridade integral do gerador nas três operações, cinco headers e catálogo; sem achados de runtime/privacidade. Um achadoP2: a especificação também pedia mutantes de token/corpo, ausentes dos testes iniciais. Acrescentados dois testes: token inválido, tipo/expiração incompatíveis, campo obrigatório ausente e campo privado extra;204 sintético com `clone()` incompatível que expõe corpo. Ambos exigem erro sanitizado do gate real. Fetch não permite construir204 com corpo, por isso o último caso representa um wrapper sintético incompatível, não tráfegoHTTP válido.

O validador existente já recusava esses corpos; a correção completa a cobertura, sem alterar runtime, schemas além do recorte ou inventar RED. Fonte revisada:14 testes novos e117 focais aprovados. Execuções integrais da fonte inicial ultrapassada são preservadas como diagnóstico/canceladas quando ainda ativas; somente a fonte final poderá ser qualificada.

## Qualificação integral da fonte final

[PR76](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/76), fonte **34aec05f6716158e659ce08c530b0917ee235a91**, base produtiva75/0651eb6. [CI fonte39050400336](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39050400336) e [merge de teste39050404070](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/39050404070) aprovados: **6052 aplicação + 710 PostgreSQL17 restrito + 699 interface = 7461**, sem falha/skip/cancelamento/todo. Instalação limpa/audit/tipos/contratos/build/lock aprovados; varredura de segredos permanece heurística. Relatório e seis logs originais preservados sem normalizar bytes; fingerprint idêntico fonte/merge **464f26929e8b49be3b18456773cdd3a5534f9f803cf2cde5d6ab46a19cd2d8ad**. Artefato **helpdesk-homologation-34aec05f6716158e659ce08c530b0917ee235a91-39050400336-1**, digest **sha256:70bbaf5624a278fd6c22815d133a39b19b518194e4092c7d5b9581f6daa7e311**. Recibos em **evidence/access-contract-20261017**.

Revisão independente e seu único complemento de cobertura concluídos:14 testes novos/117 focais e compilador direto aprovados; nenhum achado pendente. Comparação dos3 arquivos do recorte contra a fonte qualificada confirmou bytes iguais. Nenhum runtime, regra de MFA/autorização, grant, SQL, migration, dependência ou capacidade mudou. HD-002 continua parcial.

Três recusas anônimas401 do site produtivo75 passaram no gate candidato76, com privacidade/correlação e sem credenciais. Esse recibo somente confirma os erros já existentes; não troca credencial, encerra sessão real ou consulta catálogo humano autenticado. [Prova e limites](../../evidence/access-contract-20261017/anonymous-production-baseline.json).

O PR76 permanece sem merge/publicação. Relatório incorporado para qualificar a prévia; os checks e recibos de preview identificam seu commit exato. O próximo ciclo de HD-002 pode qualificar respostas positivas do workflow/checklist e intake nativo usando as fontes já existentes, sem montar revisões/MFA ou inventar política técnica. Busca pública global, projeção SLA, exportação durável e restore operacional mantêm os pré-requisitos registrados no estado corrente.

## Prévia qualificada e handoff

Prévia **6ad3a95a43409751d62bce22**, commit documental **9958b9adee1c1648c70a1ee315cd404ddb81afe8**, READY:10 ativos críticos conferidos por HTTPS/bytes/manifesto, incluindo shell e módulo Apoio. [Preview](https://deploy-preview-76--helpdesk-consultegeo.netlify.app), [recibo](../../evidence/access-contract-20261017/preview.json). Fingerprint da fonte34aec05 preservado. Este checkpoint identifica esse deploy; alterações documentais posteriores exigem conferir seus próprios checks/preview antes de anunciar a cabeça corrente pronta. Nenhuma autenticação humana ou escrita de negócio na prévia.

Desenvolvimento concluído para revisão, sem merge/publicação do PR76. A produção segue75/0651eb6/deploy6ad3a29338ddf71339a08253. Para a próxima pessoa: ler este documento e docs/ESTADO-ATUAL.md, preservar os originais dos logs, conferir commit/checks/preview atuais e não reaplicar migrations. Não converter o gate offline em middleware de produção, expor respostas privadas em diagnósticos, enfraquecer schemas ou mudar MFA/grants para fazer fixtures passarem. Descoberta não concede contas/scopes; revogar a sessão apresentada não revoga chave ou chamadas já em andamento.
