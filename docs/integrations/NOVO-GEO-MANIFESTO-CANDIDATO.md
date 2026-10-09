# CG-01a — validação local do manifesto candidato Novo GEO

**Estado:** implementado localmente, sem qualificação do provedor e sem ativação. Esta fatia não encerra CG-01, CG-02, CG-03 ou CG-05. Base remota: `796face60367e2573d112b7ae42d570055474348`; os PR23 e PR24 permanecem entregas independentes não integradas.

## Contrato implementado e limite de confiança

`src/connectors/novo-geo/contract.ts` exporta `validateIntegrationManifest(input: unknown): ValidatedIntegrationManifestCandidate`. Valida um envelope interno proposto; **não descreve a API real do Novo GEO**. `{}` é recusado com `400 integration_manifest_invalid`.

A saída contém `kind: validated_candidate`, `liveAdapterAllowed: false`, cópia imutável do candidato e fingerprint SHA-256 canônico. A função não faz rede, discovery, autenticação, consultas SQL, criação de pessoas ou concessões de acesso. Não altera configurações e não possui rota HTTP.

**Ruling do executor:** não produzir `ApprovedIntegrationManifest` a partir de JSON não verificado. O tipo aprovado previsto no plano continua pendente de qualificação real, assinatura/aceite dos responsáveis e configuração confiável do servidor. Esta saída não pode ser passada como sua substituta ao CG-03/05. `status: approved`, `approved: true` e campos extras de ativação são recusados.

Uma referência de responsável ou hash bem formado não prova autoria, aceite, correspondência de um schema ou existência de uma API. O fingerprint detecta alterações do candidato; não é uma assinatura. `liveAdapterAllowed: false` informa o limite do artefato, não substitui um guard do futuro adaptador. O adaptador ainda não existe.

## Envelope proposto v1

| Campo | Regra desta proposta local |
|---|---|
| schemaVersion / status / system | Exatamente `1` / `candidate` / `NOVO_GEO`. |
| issuer | HTTPS, sem credenciais/query/fragmento; preservar texto, caixa do path e barra final. |
| clientId | Identificador não vazio, até 200 caracteres ASCII do conjunto explícito do validador. |
| redirectUri | HTTPS, callback com path explícito, sem query/fragmento. Não implementa callback. |
| apiOrigin | Origem HTTPS exata, sem path. Nenhum endpoint de negócio é inventado. |
| hosts | Lista sem duplicatas, contendo exatamente as origens referidas por issuer/callback/API, máximo técnico oito. Não é configuração de egress. |
| scopes | De 1 a 32 tokens únicos, até 100 caracteres por token, incluindo `openid`. Não são scopes do Help Desk nem concedem permissões. |
| schemaHash | SHA-256 minúsculo, 64 caracteres. O conteúdo de origem deve ser verificado depois. |
| ownerRefs | Referências opacas para identidade/API/suporte/segurança, nunca inferidas por e-mail. As quatro áreas são uma proposta de organização, não pessoas nomeadas. |
| accessRevision | Estratégia candidata `per_request` ou `source_revision` e referência do contrato. Não implementa nenhuma das estratégias. |

URLs com IP literal ou normalização numérica de IP, wildcard, localhost/sufixos locais, escapes percentuais, credenciais, espaços ou normalização de path são recusadas. Exigir representação canônica da autoridade evita normalização silenciosa. **Essas restrições são conservadoras do envelope candidato, não afirmações de que OIDC proíbe todas essas formas.** Um provedor legítimo divergente exige revisão do envelope após CG-01, não adivinhação ou alteração silenciosa.

Não há resolução DNS, proteção operacional contra DNS rebinding, validação de certificado, pinning de issuer, SSRF defense completa ou prova de alcance do host. Tudo isso pertence ao adaptador e ao aceite posteriores. Aceitar uma string não torna seguro acessá-la pela rede.

## Dados e testes

`tests/fixtures/novo-geo/manifest.json` contém apenas valores sintéticos sob `example.invalid`, com `synthetic: true` e `providerContractVerified: false`. Os dados não são configuração de produção nem seed.

`identity.json`, `access.json` e `lookups.json` registram **desenhos de cenários**: mesmo e-mail/issuers diferentes, subject pairwise sem vínculo provado, obras A/B/C, dois tenants repetindo ID e resposta malformada/tardia. Não são formatos de resposta reais e não provam ACL/identidade/lookup. CG-03/05 ainda devem implementá-los e exercitá-los no SQL/HTTP pertinentes.

Os 59 testes focais de `tests/novo-geo-contract.test.ts` verificam o validador real: ausência de campos, saída sem aprovação, imutabilidade/cópia, fingerprint, case sensitivity, origem trocada, scopes, campos secretos/desconhecidos, prototypes/getters, arrays esparsos e erros sanitizados. RED inicial por interface inexistente; GREEN após implementação. Três mutações funcionais (aceitar status errado, ignorar binding de hosts e ignorar campos extras) foram detectadas pelos testes; uma remoção de predicado redundante não mudou o comportamento observado e não é tratada como prova adicional.

Comando focal: `node --experimental-strip-types --test --test-reporter=tap tests/novo-geo-contract.test.ts`.

Fonte local é um recorte isolado. Dependências `errors.ts` e `canonical.ts` foram conferidas por Git blob SHA e permanecem intactas no repositório. A suíte integral, SQL17, browser, tipos/contratos/audit/build e fingerprint da árvore inteira devem ser executados pelo CI existente e registrados com o attempt correspondente. Este checkpoint precede o CI; não importar evidências antigas para aprovar código novo.

## Fontes e próximos gates

Base: plano fornecido pelo usuário, CG-01, linhas 101–120 e constraints 15–27. A spec complementar/análise/contrato candidato/matriz citados no plano não foram recuperados; não foram substituídos por suposições sobre endpoints ou tabelas do Novo GEO.

Referência externa consultada: OpenID Connect Discovery 1.0, seções 3, 4.3 e 5, `https://openid.net/specs/openid-connect-discovery-1_0.html`. Ela sustenta issuer HTTPS e comparação exata; não comprova que o Novo GEO suporte OIDC/BFF/refresh/delegação. Nenhuma dependência foi adicionada ou atualizada.

Próximos passos: obter a origem e registrar suas divergências, verificar discovery/OpenAPI e contrato de revisão, registrar responsáveis/aceites reais, definir a origem confiável do manifesto aprovado e testar o guard do adaptador antes de qualquer ativação. Ver `NOVO-GEO-QUALIFICACAO-PENDENTE.md` e o manifesto bloqueado do piloto.
