# CG-01 — qualificação real ainda pendente

Não há contrato Novo GEO verificado nesta entrega. Este registro não se chama `NOVO-GEO-VERIFICADO.md` porque a qualificação ainda não ocorreu. Os quatro documentos de apoio citados no plano não foram recuperados nas inspeções anteriores; uma nova tentativa de recuperação contextual também não trouxe seu conteúdo.

## Roteiro para o responsável técnico da origem

Inspecionar o repositório e a API do **Novo GEO**, não GeoLab/Concresoft/legado. Retornar evidências sanitizadas, versões/commits e divergências; não enviar tokens, senhas, client secret ou dados reais de clientes.

1. Identificar repositório, OpenAPI/schema e versão do serviço. Confirmar endpoints e formatos reais de identidade, contexto, pessoas, tenants, permissões e lookups. Ausência deve ser registrada, não preenchida por proposta.
2. Demonstrar se há OIDC authorization code, PKCE, BFF, refresh e delegação de acesso à API; informar issuer/client/audience/redirect/JWKS/scopes reais em canal privado apropriado. Mesmo e-mail não comprova pessoa. Confirmar comportamento de subject pairwise entre clientes/issuers e o procedimento legítimo de associação.
3. Explicar como conta/workspace Help Desk se relacionam com conexão/tenant/produto/obra da origem. Confirmar recurso global, zero/uma/múltiplas obras, obra encerrada/revogada e ID repetido em tenants diferentes. `AcessaTodasObras` não substitui verificação de cada recurso.
4. Demonstrar revisão/atualidade das permissões e tratar concorrência: revogação durante consulta, resposta tardia, cache e janela em voo. Especificar a estratégia real, não presumir que a origem ofereça `source_revision`.
5. Confirmar tipos dos IDs, zeros iniciais, cardinalidade/paginação, erros, limites, disponibilidade e representação de CNPJ numérico/alfanumérico. Não converter IDs opacos ou CNPJ em número.
6. Identificar responsáveis por identidade/API/suporte/segurança/Qualidade, decisões de autorização administrativa e contingência. Registrar o canal de aceite e as revisões dos documentos aprovados.

Cada resposta deve distinguir **implementado / documentado / proposto / não disponível**, com evidência e critério de teste. Se o protocolo de origem não suportar o desenho OIDC aprovado no plano, produzir ADR e revisar CG-03/05 antes de implementar alternativa.

## Material necessário para substituir esta pendência

Contrato verificado e hash do schema; fixtures sanitizadas derivadas do contrato; aceite dos responsáveis; política de atualização/revogação e estratégia de custódia/validação do manifesto aprovado. Somente referências públicas/sanitizadas entram no Git. Informação privada e credenciais permanecem no mecanismo seguro definido pela equipe.

O validador CG-01a é utilizável para conferir a estrutura proposta, mas sua saída nunca é aceite desses itens. Ainda não existe `ApprovedIntegrationManifest` confiável ou adaptador habilitado.
