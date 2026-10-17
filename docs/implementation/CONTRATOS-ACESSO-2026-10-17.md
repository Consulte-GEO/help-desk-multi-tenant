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
