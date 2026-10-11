# Ciclo 02 — contrato da origem e resolução de identidades externas

> Execução na sessão corrente por `superpowers:executing-plans`; TDD e revisão independente antes da integração.

**Goal:** implementar o reconhecimento interno por issuer/subject sem junção por e-mail, sem credencial Supabase fictícia e sem conceder acesso ao atendimento.

**Architecture:** domínio de referência/registro + resolvedor que consome duas portas server-only: verificador de identidade e diretório de registros. As portas são autoridades reais a implementar depois de qualificar a origem; nos testes são adaptadores sintéticos explicitamente identificados. Não há rota, escrita no banco, geração de sessão ou concessão de grants nesta fatia.

**Tech Stack:** TypeScript/Node22 e validadores exatos já existentes. Nenhuma dependência nova.

**Spec:** plano de implantação fornecido pelo usuário, CG01/CG03; plano de18ciclos, C02. A especificação adaptada e contrato real continuam não recuperados.

## Restrições

- O usuário pediu avançar ao próximo ciclo. C01 continua aberto; esta preparação independente não aprova sua composição SQL e não amplia a liberação.
- Namespace de issuer/clientId vem da construção no servidor; não do navegador.
- A validação de forma de um objeto não autentica tokens. A porta `verify` deve validar fluxo, assinatura/issuer/audience/nonce/PKCE/expiração no adaptador futuro; não fornecer fallback aqui.
- Lookup somente do par exato issuer/subject; nenhuma busca por e-mail/nome. Zero/mais de um registro ou registro inativo não cria pessoa.
- Origem Supabase e externa são discriminadas; não aceitar mistura nem fabricar UUID Supabase. Não conectar essa proposta ao CHECK SQL antigo antes de C03/upgrade.
- Resultado contém identidade local/revisão, nunca scopes, obras, papel ou sessão. C03 continua obrigatório antes de acesso.
- Preservar as67 entradas do pacote C01 e os SQL candidatos bloqueados. Não reenviar esses SQL nem registrar evidência antiga como nova.

## Entregas desta sessão

1. `src/domain/external-identity.ts`: `parseExternalIdentityRef`, `externalIdentityKey`, `parseIdentityNamespace`, `parseHumanIdentityOrigin`, `parseExternalIdentityRegistration`, `parseIdentityObservation`.
   - RED: referências diferentes não colidem; sujeito mantém zeros/caixa; e-mail/metadata não são identificadores; registro externo sem UUID Supabase; dados/propriedades inválidos recusados.
   - GREEN: `node --experimental-strip-types --test tests/external-identity.test.ts`.
2. `src/application/external-identity.ts`: `createExternalIdentityResolver(options).resolve(evidence,{signal}?)`.
   - Consome verificador server-only, namespace fixo e diretório readonly. Sem cache, retry, escrita, sessão ou grants.
   - RED: dois issuers/e-mail igual, pairwise, issuer/audience errados, desconhecido/revogado/ambíguo, expiração durante consulta, microssegundo, cancelamento, timeout e erros privados.
   - GREEN: testes de domínio/resolução e regressões da entrada realmente disponíveis.
3. Documentar matriz de qualificação com o que foi de fato encontrado, o contrato das portas e as verificações ainda necessárias no PostgreSQL/API/IdP reais. Preparar handoff e pacote cumulativo, com patch isolado C02 independente de E–I.

## Revisão

Revisar fronteira entre parse e verificação real, cópias antes das esperas, ausência de caminhos de união/cadastro por e-mail, resultado sem permissões, observações tardias e erros seguros. Comparar os67 arquivos preservados byte a byte. Não tratar teste de adaptador simulado como Auth/SQL.

## Critério de saída do ciclo inteiro

Contrato real qualificado, mapping e vínculos persistidos sem identidade fictícia, atualização SQL com usuários antigos, CI e revisão independente. O código desta sessão só fecha as partes comprovadas; não basta para encerrar C02.
