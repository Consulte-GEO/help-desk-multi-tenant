# CG-03b — resolvedor interno e revalidação antes de uso

Checkpoint pré-CI de 09/10/2026. Base: `bd1bd19d112090f2d5d75fc3658ac50d630d342b`, PR26, branch `review/cg01-cg02-20261009`. Principal observada `796face60367e2573d112b7ae42d570055474348`. Não reaplicar as entregas contidas nessa ancestralidade.

## 1. O que está implementado

`src/application/resource-access.ts` acrescenta um coordenador assíncrono, por instância, sobre as referências e cobertura integral do CG-03a. Faz uma consulta à autoridade de acesso ao resolver a seleção e outra imediatamente antes do consumo. Entre elas, a aplicação mantém somente uma prova opaca local, não um bearer ou uma autorização serializável.

A fábrica exige a porta de autoridade, o fingerprint esperado do manifesto e parâmetros explícitos de atualidade/prazo. Não possui fonte padrão, fonte em memória de produção, API inventada, rede própria, SQL ou rota HTTP. `Principal` deve vir da autenticação existente, nunca do corpo/header livre enviado pelo cliente.

**Não há adaptador real da autoridade nesta entrega.** Identidade externa, manifesto aprovado, mapping issuer/subject, binding persistente e revisão da origem ainda precisam de CG-01 e do restante de CG-03. O manifesto candidato existente não se torna aprovado por esse módulo. Um hash bem formado não comprova assinatura, identidade ou aceite.

## 2. Interfaces

```ts
createResourceAccessResolver({
  authority, manifestFingerprint, maxAgeMicros, timeoutMs, clock?
});

resolver.resolveResourceScope(
  p: Principal,
  refs: readonly ExternalResourceRef[],
  operation: string,
  signal?: AbortSignal
): Promise<VerifiedRequestScope>;

resolver.withResourceScope<T>(
  p: Principal,
  refs: readonly ExternalResourceRef[],
  operation: string,
  proof: unknown,
  work: (context: ResourceScopeContext) => Promise<T>,
  signal?: AbortSignal
): Promise<T>;
```

`VerifiedRequestScope` é um handle com marca TypeScript e registro privado `WeakMap` da fábrica. Sua representação JSON é `{}`. Somente o handle original daquela fábrica pode ser consumido. A marca de tipo sozinha, um boolean, JSON, cópia, outra fábrica ou um objeto com `verified: true` não passam.

`ResourceScopeContext`, entregue ao callback após revalidação, contém: `principalId`, `workspaceId`, `accountId`, `bindingId`, `bindingRevision`, `accessRevision`, `manifestFingerprint`, `operation`, `asOf`, `expiresAt` e somente as `refs` selecionadas. É uma cópia imutável; não contém todos os recursos da pessoa nem bearer. **Esse contexto é dado para a transação, não uma credencial reutilizável.**

O callback não substitui a transação autorizadora. O store futuro deve aplicar RLS/ACL e revalidar identidade/vínculos/revisões no SQL antes de LIMIT/cursor/aggregate/replay/notas/metadados/arquivos. Não reter o contexto para autorizar outra operação. O handle é consumido antes do primeiro await do uso; a rotina de negócio mantém sua própria idempotência e recibos.

## 3. Porta de autoridade — proposta interna, não API do Novo GEO

```ts
interface ResourceAccessAuthority {
  readAccess(query: ResourceAccessQuery, signal: AbortSignal): Promise<unknown>;
}
```

A query imutável contém `principalId`, `workspaceId`, `connectionId`, `tenantId`, `operation`, `refs`. A porta é dependência confiável de construção do servidor. Não recebê-la de requests, não aceitar respostas de autoridade fornecidas pelo browser e não implementar um stub de sucesso no runtime.

O futuro adaptador deve possuir/validar a identidade verificada da requisição e o manifesto aprovado. Deve verificar direitos da pessoa para **a operação solicitada**, resolver binding conta/workspace/conexão/tenant, reconsultar revogações e só então normalizar a resposta. Uma conexão M2M não representa pessoa. Mesmo e-mail não faz mapping de identidade. `AcessaTodasObras`, labels e metadata não aprovam acesso.

Envelope normalizado interno proposto:

| Campo | Contrato local |
|---|---|
| `principal` | Principal humano atual, exatamente id/workspaceId/kind/workspaceRole/grants/scopes, sem metadata. |
| `binding` | id/accountId/workspaceId/connectionId UUID locais, tenantId opaco, revision opaca, active boolean. |
| `operation` | Operação exata para a qual a fonte verificou permissões. |
| `manifestFingerprint` | Hash de 64 caracteres hex minúsculos igual à configuração confiável esperada. Não é aprovação por si só. |
| `accessRevision` | Revisão opaca do conjunto de direitos verificado pela fonte. |
| `asOf`, `expiresAt` | Instantes UTC canônicos de 3 ou 6 casas; sem truncamento de microssegundos. |
| `resources` | Coleção completa e válida dos recursos autorizados para a query/operação; seleção deve estar integralmente coberta. |

`null` significa acesso ausente/revogado; falha de transporte ou resposta malformada significa indisponibilidade, sem fallback. Nenhuma dessas situações produz prova ou inicia callback. O envelope é proposta de boundary interno; não confirma nomes de endpoints/campos ou suporte a revisão/expiração na API real. Se a origem não suportar o contrato, revisar o adaptador/ADR; não fabricar revisão ou validade.

## 4. Política aplicada

| Operação | Escopos exigidos, além da cobertura de recursos |
|---|---|
| `contexts.resolve` | contexts:resolve |
| `tickets.read` | tickets:read |
| `tickets.write` | tickets:read + tickets:write |
| `notes.read` | tickets:read + notes:read + operador da conta |
| `notes.write` | tickets:read + notes:write + operador da conta |

São reutilizados `canAccessAccount` e `isOperator` da política atual. Não há ampliação dos cinco escopos de negócio nem alteração de MFA/capabilities administrativas. Escrita de nota continua independente de notes:read e tickets:write. Gestor e solicitante não usam notas internas apenas por declarar um scope; admin ainda precisa dos scopes e da cobertura de todos os recursos.

Isso é uma camada **adicional**: a posse do ticket, elegibilidade de produto/contrato, workflow, capabilities e ACL SQL permanecem necessárias. Resolver uma obra não significa poder ler todos os tickets dela.

## 5. Concorrência, validade e falhas

Na resolução, validam-se pedido, operação, pessoa, binding, manifesto, escopos, operador quando necessário, datas e toda a resposta de cobertura. Somente os recursos pedidos são devolvidos; A+C contra A/B é recusado integralmente, sem usar a parte A.

Antes do uso, o handle é reservado uma única vez. São conferidos pessoa, operação e conjunto exato; faz-se nova leitura pela mesma porta, revalida-se o envelope inteiro e compara-se o estado observado: pessoa/papéis/grants/scopes, binding e sua revisão, manifesto e revisão de acesso. Divergência recusa a operação. A data asOf não pode retroceder entre as leituras. Uma origem com permissões revogadas ou alteradas não restaura o handle antigo.

As referências externas mantêm zeros, caixa e Unicode conforme CG-03a. Dados são lidos por descritores próprios; getters/toJSON/campos extras/arrays esparsos não são adotados. Papéis/scopes/grants equivalentes com outra ordem de propriedades não causam recusa falsa. A comparação trabalha somente com dados normalizados privados.

A validade é checada após a resposta, antes de emitir a prova e imediatamente antes do callback. Expiração é exclusiva: na igualdade com expiresAt, recusa. O segundo snapshot não prorroga uma prova já expirada. Clock inválido/retrocedendo recusa; corrigir depois o relógio não ressuscita um handle consumido.

`maxAgeMicros` e `timeoutMs` são obrigatórios, sem default comercial. Prazo de cada consulta limitado tecnicamente a 1–10.000 ms. Quantidades/limites da coleção seguem CG-03a; principal local tem limite defensivo de 1.000 grants. Esses limites não são SLO/SLA da origem nem política já aprovada para produção.

Abort antes ou durante consulta recusa a decisão e sinaliza cancelamento ao adaptador. Timeout sinaliza abort, não repete chamadas e ignora uma resposta posterior mesmo se a origem ignorar o sinal. A chamada já iniciada na origem pode continuar; não há promessa de cancelamento remoto. Exceções do provedor/clock/parser são sanitizadas e não expõem URLs, IDs ou tokens.

Depois de autorizado o callback, esta camada não oferece revogação distribuída instantânea nem cancela/reverte efeitos de negócio automaticamente. O SQL deve estabelecer o ponto de serialização/revalidação; o procedimento futuro deve medir a janela em voo. Duas leituras não substituem esse trabalho.

## 6. Testes e evidências desta fatia

82 testes novos do resolvedor. RED inicial: 68 falhas por interface inexistente; GREEN 68. Na autorrevisão, mais quatro regressões reproduziram ausência de qualificação de operação, mudança local da pessoa durante revalidação, asOf retrocedendo e expiração na emissão: 68 passaram/4 falharam; corrigidas para 72/72. Dez casos complementares cobrem operações permitidas, erro/abort no consumo, getters e ordenação da seleção.

Quatro mutações funcionais foram detectadas: eliminar a segunda consulta (20 falhas), permitir reutilização da prova (14), ignorar a qualificação da operação (1), aceitar seleção sem cobertura (9). Implementação restaurada; conjunto local final **201/201**, sem skips: 82 novos +119 existentes disponíveis no recorte.

Comando focal:

```sh
node --experimental-strip-types --test --test-reporter=tap \
  tests/resource-access.test.ts tests/external-resource.test.ts \
  tests/novo-geo-contract.test.ts tests/mfa-secret-warning.test.ts
```

Typecheck focal com TypeScript5.8.3/ES2022/libES2023 passou. Tipos Node globais25.1.0 não são os pinados do repo; o CI integral deve comprovar o lock real. O package local é apenas um marcador ESM do harness, não mudança de produto nem substituição do package original. Nenhuma dependência auxiliar reconstruída é incluída no diff.

**Fonte local parcial, não clone.** Não foram executados localmente SQL17, browser completo, instalação/audit ou build do repositório inteiro. A autoridade dos testes é sintética; o resolvedor e a política/cobertura reais são exercitados. CI de regressão posterior deve ser associado ao head/attempt/artefato corretos. Os testes SQL existentes não comprovam esta nova ACL de recursos.

## 7. Decisões, integração e pendências

Ruling: seguir a autorização expressa da linha47 do plano para motores locais. Implementar a coordenação real por porta obrigatória, sem inventar API/manifest aprovado. Custo: não há uso operacional até integrar autoridade qualificada, persistência/ACL, rotas e upgrade.

Ruling: prova local de uso único e revisão comparada novamente no consumo, não snapshot autorizador reutilizável. Custo: cada ciclo bem-sucedido requer duas leituras; alteração de revisão exige resolução nova, sem retry automático. Medir custo/latência e definir otimização com a origem sem relaxar revogação.

Ruling: estado local do Principal deve permanecer igual durante o ciclo. Custo: uma atualização legítima de papéis/grants também exige nova resolução; não promove permissões automaticamente.

A base canônica de evidências ainda exige importação validada em checkout integral. Git direto continua indisponível por DNS; não foi repetido o workflow de exportação anteriormente bloqueado, nem alterados gates. Preview e CodeQL não são classificados como aprovados por estes testes locais. Revisão independente continua pendente; esta rodada é autorrevisão.

Próximo CG-03: qualificar identidade/manifesto; implementar porta sobre binding/rights atuais; novas migrations por CLI com identidades externas legítimas, FKs compostas e RLS; fresh SQL17+upgrade+HTTP incluindo ownership, notas-only, replay/paginação/agregação. Só então associar o resolvedor às rotas. Não adicionar Supabase UUID fictício para pessoa externa.

Produção existente preservada, sem novas rotas/grants/fatores/migrations/providers/dependências/release flags. API/interface0.27.0/schema0.19.0 e os dois scopes de Thiago permanecem. CG-01/02/03 completos, causa histórica das notas, CodeQL/preview, aceite Auth/MFA/restore e coorte não são encerrados por esta fatia.
