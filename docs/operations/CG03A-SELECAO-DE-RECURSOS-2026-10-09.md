# CG-03a — referências externas e cobertura integral da seleção

**09/10/2026 — checkpoint anterior ao CI.** Continuidade do plano de implantação fornecido pelo usuário, após CG-REV01. Base de trabalho: PR26, `e2ac98a4e274c1bdadd8bb3a166648cb1ca76ecc`; branch padrão consultada `796face60367e2573d112b7ae42d570055474348`. A branch padrão não foi integrada nesta preparação.

## 1. Alcance exato

Primeira camada **pura e genérica** de CG-03. Implementa a representação de referências completas, a seleção explícita de um contexto e a conferência integral de sua cobertura. Não implementa `resolveResourceScope`, não emite `VerifiedRequestScope` e não valida a identidade ou a procedência de uma resposta do Novo GEO.

Esta antecipação local usa a permissão da linha47 do plano: motores locais podem avançar enquanto CG-01 impede live adapters. As dependências de implantação CG-01/02 permanecem. A spec complementar e o contrato real continuam não recuperados; os nomes de propriedades e limites abaixo são uma proposta interna, não um esquema de API de origem.

## 2. Interfaces entregues

Arquivo: `src/domain/external-resource.ts`.

```ts
type ExternalResourceRef = Readonly<{
  connectionId: string;
  tenantId: string;
  type: string;
  id: string;
}>;
parseExternalResourceRef(value: unknown): ExternalResourceRef;
parseExternalResourceSelection(value: unknown): readonly ExternalResourceRef[];
externalResourceKey(value: unknown): string;
externalResourceSelectionKey(value: unknown): string;
requireCompleteResourceCoverage(requested: unknown, coverage: unknown): readonly ExternalResourceRef[];
```

`connectionId` é o UUID local da conexão Help Desk e usa o validador já existente. `tenantId` e `id` são identificadores opacos da origem: mantêm zeros, caixa, pontuação e composição Unicode; nunca passam por Number, trim, normalização Unicode ou comparação por nome. Somente o UUID local é canonicalizado para minúsculas. `type` é um identificador técnico minúsculo, não uma classe executável.

A chave usa uma tupla JSON dos quatro componentes, não concatenação por um separador ambíguo. IDs iguais em outra conexão, tenant ou tipo são referências diferentes. A chave do conjunto não depende da ordem de seleção. **Essas chaves contêm IDs de origem: não devem ir a URLs, logs ou ser tratadas como token de autorização.**

## 3. Regras de seleção

Uma requisição deve declarar pelo menos uma referência e no máximo100. Todas pertencem à mesma conexão e tenant. Duplicatas são erro, inclusive UUIDs locais com diferença apenas de caixa. Recurso adicional inválido não é ignorado e excesso não é truncado. As saídas são cópias imutáveis.

Entradas são objetos simples de dados com exatamente os quatro campos; arrays são densos. Campos `label`, `allowed`, `AcessaTodasObras`, workspace/account adicionais, símbolos, propriedades ocultas e getters não são adotados. Nenhum getter de campo ou `toJSON` é invocado. Exceções de parser/proxy são substituídas por erro seguro. Isso não oferece proteção contra controle arbitrário do processo JavaScript confiável.

Seleção vazia não significa global/todas as obras. Um ID semelhante a `*` ou `all` é literal e não cobre outro recurso. A política de recursos globais/ausência de obra ainda deve ser aprovada e integrada no CG-03 completo; esta camada não a inventa.

Limites técnicos propostos: tenant/id até256 caracteres, tipo até32,100 referências por pedido e1000 na coleção de cobertura. Não são limites comerciais, quotas de produção nem a capacidade da API de origem. A cobertura futura pode ser uma projeção autorizada das referências pedidas, não precisa listar todas as obras de um grande cliente. Limites divergentes exigem revisão explícita, jamais truncamento.

## 4. Cobertura integral, sem permissão implícita

`requireCompleteResourceCoverage` valida todo o pedido e toda a coleção de cobertura antes de comparar os conjuntos. Exemplos sintéticos:

| Pedido | Cobertura fornecida | Resultado local |
|---|---|---|
| A+B, mesma conexão/tenant | A+B+D, mesmo contexto | Retorna somente A+B. |
| A+C | A+B | Recusa integralmente; não retorna A como sucesso parcial. |
| A | coleção vazia válida | Recusa por ausência de cobertura. |
| ID0001 no tenantA | ID0001 no tenantB | Recusa: não são a mesma referência. |
| A | A seguido de elemento corrompido | Indisponível; não aprova pelo primeiro elemento. |

A função não recebe papel de usuário e não possui bypass para gestor/admin. Os testes com rótulos requester/account_manager/admin demonstram apenas a ausência de bypass nessa comparação de conjuntos; **não são testes de autenticação desses papéis nem de RLS**.

A correspondência entre dois JSONs arbitrários **não prova acesso**. Antes de utilizar essa verificação em um comando, o futuro resolvedor deve validar a pessoa, o manifesto aprovado, o binding conta/workspace/conexão/tenant, a operação, os grants, a atualidade/revisão e a autorização de cada recurso. O SQL deve reaplicar ACL antes de paginação, aggregate, replay, arquivos e metadados. Nenhuma rota atual chama este módulo.

| Falha | Código local |
|---|---|
| Pedido/ref inválido | 400 `invalid_resource_selection` |
| Coleção válida, mas cobertura insuficiente | 403 `resource_scope_denied` |
| Resposta de cobertura malformada, duplicada, excessiva ou mistura de contextos | 503 `resource_scope_unavailable` |

Erros não incluem IDs, labels, campos privados ou qual obra existe. Nenhuma falha é convertida em uma lista vazia de permissões silenciosamente.

## 5. Ajuste do teste apontado pelo CodeQL

`tests/mfa-secret-warning.test.ts` não precisa sanitizar HTML. Retirada a remoção de tags por regex; o teste passa a comparar a marcação estática esperada e mantém as asserções semânticas/acessíveis. O HTML de produto permanece exatamente igual.

Uma mutação local que inseriu um elemento script extra no aviso era aceita pelos três testes antigos. Com a comparação exata, a mesma mutação falha. A página real não foi modificada ou usada para executar esse conteúdo. O ajuste fortalece a asserção e elimina o padrão redundante apontado; **não é alegação de XSS explorável corrigido em produção**. Não foi solicitado encerramento/supressão manual do alerta; o resultado do analisador na fonte nova precisa de verificação própria.

## 6. Evidência local e revisão

57 testes do novo módulo falharam inicialmente pela ausência das interfaces (RED) e depois passaram. Quatro mutações de implementação foram detectadas: retirar tenant da chave, aceitar cobertura parcial, alterar caixa dos IDs e permitir duplicatas. Após restaurar a implementação,60/60 testes focais passaram (57 de recursos e3 do aviso), sem skips.

Comando: `node --experimental-strip-types --test --test-reporter=tap tests/external-resource.test.ts tests/mfa-secret-warning.test.ts`.

Typecheck focal de `external-resource.ts` e suas dependências passou com TypeScript5.8.3, targetES2022/libES2023 e as opções estritas do projeto. A primeira tentativa falhou porque o recorte local não tinha `package.json` e foi interpretado como CommonJS; recuperado o arquivo original, não foi alterada nenhuma configuração do produto. `errors.ts`, `input-values.ts` e `package.json` coincidiram com seus Git blobs remotos.

A fonte local é um recorte isolado; esses60 testes não são a suíte completa. CI Linux, audit, contratos, migrations, PostgreSQL17 e navegador da combinação devem ser registrados depois, com fonte/run/attempt/artefato/digest. A verificação real desta camada de ACL no SQL e no navegador não existe ainda, mesmo quando a suíte de regressão geral passa.

Autorrevisão: comparadas interfaces, cópias/imutabilidade, namespace, limites, arrays, erros e falta de efeitos externos; sem achado adicional observado nessa camada. Não equivale a revisão independente.

## 7. Decisões e continuidade

Ruling: implementar somente seletores/cobertura pura de CG-03 — evita fingir contrato real ou emitir uma prova autorizadora. Custo: não há proteção de tickets por obra no banco até a integração completa do resolvedor e da ACL.

Ruling: manter uma conexão/tenant por seleção e negar seleção vazia — evita unir contextos ou inventar acesso global. Custo: políticas legítimas multi-contexto/globais exigem um comando e uma decisão explícitos posteriores.

Ruling: atualizar o PR26 candidato, preservando seu histórico, em vez de abrir outro PR cumulativo — reduz conjuntos duplicados. Custo: CI/revisão do head anterior não aprovam este novo head; registrar nova rodada antes de integrar.

Próxima fatia CG-03: qualificar a origem; mapear identidades issuer/subject e bindings sem e-mail; construir VerifiedRequestScope somente por backend; persistir resource scopes com FKs/RLS e adaptar todos os helpers; provar A/B/C e tenantB em SQL17 real/upgrade; integrar UI/HTTP sem contornar o endpoint genérico. Não fabricar UUID Supabase para pessoa externa.

Permanecem pendentes: revisão independente, evidência canônica/importação em checkout integral, causa histórica da falha de visibilidade de notas, preflight/read hospedados atuais, Auth/MFA/restore e contrato/políticas/coorte. Nenhum merge, grant, migration, dependência, fator Auth, release gate ou serviço hospedado alterado. API0.27.0/schema0.19.0 preservados; scopes de Thiago continuam os dois definidos no plano.
