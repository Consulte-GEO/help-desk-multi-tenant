# Ciclo 02 — qualificação da origem Novo GEO

**09/10/2026 — qualificação real pendente.** Este registro não transforma a proposta em contrato implementado. O repositório do consumidor Help Desk é conhecido; o repositório/API de identidade do Novo GEO não foi confirmado.

## Evidência encontrada nesta rodada

| Item | Observação efetiva | Consequência |
|---|---|---|
| Help Desk / PR26 | Leitura conectada confirmou draft, não integrado, HEAD `f60baed8022b28e067a702b3dd51031e86983017`. | E–I/C01 permanecem nos pacotes locais; não são a fonte remota. |
| Repositório Novo GEO | A pesquisa conectada por `Novo` na organização Consulte-GEO retornou lista vazia. | Não prova inexistência; identificação ainda pendente. Não utilizar geolab por semelhança. |
| Especificação adaptada e contrato | A busca por nomes de `2026-10-08-helpdesk-consultegeo-design.md`, `NOVO-GEO-CONTRATO.md` e `134-CONSULTE-GEO-ANALISE-E-ADAPTACOES.md` retornou documentos de outros assuntos, não os solicitados. | Esses resultados não foram usados para preencher o contrato. |
| Issuer / client / subject / audience reais | Não fornecidos por evidência de origem nesta rodada. | Nenhum valor sintético vira configuração. |
| OIDC/BFF/PKCE/refresh/delegação | Não executados na origem real. | Verificador de produção continua ausente; não ligar o resolvedor nas rotas. |
| Diretório e integridade de pessoas | Envelope interno foi implementado e testado; não há adaptador SQL/constraint nova nesta fatia. | Não criar usuários externos usando UUID Supabase fictício. |
| Aceite/owners/coorte | Nenhuma decisão nova do titular. | Manter controles e escopos existentes. |

O erro da chamada genérica de pesquisa de repositórios indicou endpoint não aceito; a ação específica `search_repositories` foi a leitura usada para obter o resultado vazio. Isso não foi tentativa de reenviar código bloqueado. Não houve nova tentativa de gravar o SQL D/E/G.

## Contratos internos já executáveis

São contratos do Help Desk, **não declarações da API do Novo GEO**:

- `ExternalIdentityRef`: issuer/subject exatos. E-mail, nome, tenant, obra e clientId não substituem o par. ClientId é validado separadamente na observação do verificador.
- `HumanIdentityOrigin`: credencial de origem Supabase com userId real, OU credencial externa com identityId/issuer/subject. O discriminador descreve uma origem de credencial; não cria política de vinculação de múltiplos provedores à mesma pessoa.
- `ExternalIdentityRegistration`: principalId local, principalKind humano explícito, revisão, estados de identidade/pessoa e origem externa. Nenhuma permissão na resposta.
- `IdentityObservation`: envelope normalizado devolvido pela porta verificadora confiável: issuer, subject, clientId, asOf, expiresAt. A validação do envelope NÃO valida assinatura, token ou fluxo OAuth.

`ExternalIdentityVerifier.verify(evidence, namespace, signal)` é uma porta configurada no servidor. O adaptador futuro deve consumir o fluxo de login de sua propriedade, validar assinatura/issuer/audience, nonce e PKCE onde pertinentes, expiração e resposta limitada; só então retornar o envelope. Não adaptar por `decode(jwt)` ou boolean `verified`.

`ExternalIdentityDirectory.lookup(reference, signal)` é somente leitura. Deve consultar o par exato e o estado da pessoa/registro na mesma visão consistente, retornando zero/um registro ou dois para indicar ambiguidade. Precisa confirmar principal humano e credencial registrada, sob privilégios mínimos. Não pesquisar e-mail e não criar usuário como efeito do login.

A implantação dessas duas portas e sua configuração devem depender do manifesto realmente qualificado e do aceite da origem, não da mera existência de um objeto JSON com campos completos. Não foi criado `ApprovedIntegrationManifest` a partir do candidato.

## Regra de associação

A chave usa hash do vetor `['helpdesk-external-identity-v1', issuer, subject]`, com a canonicalização existente. Ela evita junção ingênua por delimitador e preserva texto exato. Não é segredo, assinatura ou bearer. O banco futuro deverá armazenar e comparar as coordenadas originais exatas; o hash sozinho não autoriza.

Dois subjects pairwise diferentes não são automaticamente associados, mesmo com e-mail igual. Se a origem requer associação explícita de várias credenciais à mesma pessoa, isso exige procedimento aprovado com prova de controle, trilha e comando próprio; esta entrega não oferece tal comando.

## Pendências a responder pela equipe da origem

1. Identificar repositório e revisão reais, versão OpenAPI/schema e documentos originais. Informar somente evidências verificadas com arquivo/linha ou consulta reproduzível.
2. Confirmar protocol/issuer/client/redirect/audience/JWKS/scopes, fluxo de propriedade do login, PKCE, nonce, renovação e delegação da API. Não enviar tokens, senha ou client secret.
3. Demonstrar estabilidade e unicidade de subject; comportamento entre clientes/realms e contas renomeadas; distinção entre pessoa, tenant e usuário compartilhado.
4. Confirmar APIs de permissões e revisão/revogação; respostas parciais, paginação e falhas; não presumir que a origem possua o envelope normalizado do Help Desk.
5. Definir aprovação de vínculo de credencial/pessoa e de migração de registros existentes. Ausência não vira cadastro automático.

Se OIDC/BFF/refresh/delegação não forem suportados, registrar a divergência e uma ADR antes de escolher alternativa. Não declarar que um endpoint foi implementado apenas por aparecer em um documento de proposta.

## Referência externa, distinta da evidência da origem

OpenID Connect Core 1.0, errata set2, seções2,5.7,8 e14: `https://openid.net/specs/openid-connect-core-1_0.html`. Consultada para semântica de issuer/subject, identificação pairwise e comparação de strings, não para comprovar suporte do Novo GEO.

As restrições ASCII imprimível em subject, limite de issuer2048/client200 e sintaxe conservadora de client são escolhas do envelope interno. Subject mantém espaços imprimíveis e caixa; issuer não é reserializado pelo parser URL. A higiene de URL não faz descoberta nem proteção operacional de SSRF. Reavaliar compatibilidade com a origem antes da ativação.
