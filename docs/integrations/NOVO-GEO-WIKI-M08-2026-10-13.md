# Novo GEO Qualificação documental para o Help Desk

Fonte indicada pelo usuário: [wiki Consulte GEO](https://github.com/Consulte-GEO/wiki_consultegeo), revisão `74d55052794723afb6d7eec91e11aa218012393c`, documentos vigentes v2026.10/revisados em13/10. Onze documentos de engenharia foram lidos pelo GitHub em modo somente leitura; paths e SHA256 em [manifesto da leitura](../../evidence/consultegeo-m09a/wiki-sources.json). O wiki descreve levantamentos do código, mas não fornece o commit implantado da API/IdP nem um schema de integração aprovado.

## Identidade e contexto documentados

O Novo GEO usa API .NET e front Vue separados, com `Consulte.IdentityServer`. O wiki descreve authorization code com PKCE no SPA, claims `sub`, `email`, roles, `codigoContrato` e `ClientPermission`; há usuário local por tenant ligado por `IntegracaoOpenId`. O front existente usa armazenamento local e cliente próprio. Isso não concede ao Help Desk um cliente BFF, audience, callback ou credencial. Referências: `corpus/70-engenharia/repositorios-e-camadas.md:17-28` e `autenticacao-e-sessao.md:17-47,59-72,91-108,119-126` na revisão acima.

`codigoContrato` é o identificador do catálogo `CTBase.Contrato`; `Ges_Contrato` é um agrupador dentro do tenant. Conta, workspace, contrato de suporte e instância Help Desk exigem mapping próprio. O header `Contrato` e a seleção de obra são sugestões a conferir no servidor, jamais autoridade. O wiki registra seleção de tenant sem validação suficiente e caminho normal que antecede verificação de scope. Referência: `autenticacao-e-sessao.md:68-89`; `banco-multi-tenant.md`.

## Leituras documentadas e limites

| Necessidade | Operação citada no wiki | Uso possível e confirmação necessária |
|---|---|---|
| Pessoa corrente | GET `api/SegUsuario/GetUserByEmail` | Resolve pelo claim email; não usar sozinho para associar principal Help Desk. Confirmar `IntegracaoOpenId`, issuer/subject e usuário ativo. |
| Permissões correntes | GET `api/SegUsuario/GetPermissoes` | Matriz por grupo/material; há bypass Admin. Confirmar DTO, versão/revogação e checagem por recurso. |
| Obras permitidas | GET `GesObra/ListByUsuario` | Seletor pode divergir do conjunto conferido pelo middleware. Confirmar host/prefixo, DTO completo, obra ativa, paginação e autorização final. |
| Tenants disponíveis | GET `api/user/GetContratos` | Wiki também cita rota no IdP. Resolver divergência do host e provar vínculo por subject. |
| Grupos | GET `SegGrupoUsuario/List` | Grupos são específicos do tenant; nenhum ID/nome é seed de capability Help Desk. Confirmar shape, acesso e paginação. |
| Materiais | GET `UtlTipoFornecimento/IdsAtivos` | Ativo não significa material autorizado para a pessoa/obra; confirmar interseção real. |
| Pessoa beneficiária | GET `SegUsuario/{id}` / `ObterAcessosUsuario/{id}` | Documentadas para Admin/Suporte; não expor como busca geral ao cliente. Qualificar lookup restrito ao contexto. |

Referências: `api-rotas-e-controllers-4.md:39,89-94`, `api-rotas-e-controllers-5.md:21-43`, `autenticacao-e-sessao.md:107-110`, `permissoes-no-codigo.md:23-28,119-123` e `permissoes-no-codigo-2.md:23-30,47-50`. Métodos/paths documentados não são DTOs homologados ou endpoints consultados nesta etapa. Não foram enviados tokens ou credenciais do usuário ao Novo GEO.

## Cadastro e e-mails

O wiki documenta inclusão/edição e vínculo de obras no tenant; inclusão pode criar também a identidade. Convite e reenvio chamam endpoints do IdentityServer com token humano. Exclusão no tenant conserva a identidade central. Referências: `api-rotas-e-controllers-5.md:27-43` e `autenticacao-e-sessao.md:121-138`.

Decisão Help Desk: registrar intenção e execução manual com checklist; nenhuma escrita automática nesses endpoints. Solicitação de reenviar acesso não é prova de convite enviado, aceito ou entregue. Resend atende notificações do chamado; não substitui o provedor de credenciais do GEO. Não inserir senha, token, link de acesso ou parâmetros pessoais na notificação de atendimento.

## Condições para concluir M08

1. Revisão implantada de API/Front/IdentityServer e schemas/DTOs sanitizados completos, incluindo erros e paginação.
2. Cliente Help Desk próprio, issuer/discovery/JWKS/audience/algoritmo/autenticação BFF e callbacks confirmados; subject estável e revogação definidos. O cliente do SPA não será reutilizado por inferência.
3. Consulta que confirme pessoa ativa pelo subject e tenant autorizado; obras/material/grupo revalidados com estratégia de revisão/expiração e janela em voo explícita. Lista vazia ou erro não viram acesso global.
4. Mapping versionado de conta/instância/conexão/tenant; publicar snapshots pelo canal privado antes do diretório M06. IDs repetidos em tenants distintos conservam sua namespace.
5. Provas sintéticas na origem: A/B permitidas,C negada, obra inativa, tenant vizinho, usuário desativado, paginação, permissão revogada durante espera e retorno tardio; confirmação pelos responsáveis por identidade/API/suporte/segurança.

M08 avançou de roteiro sem fonte para qualificação documental com referência verificável. Conector live e aceite hospedado continuam pendentes. Nenhum manifesto com `approved=true`, credencial, grant, chamada de AdminScripts ou escrita na origem foi criado.
