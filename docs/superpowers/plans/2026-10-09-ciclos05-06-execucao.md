# Ciclos 05 e 06 — implementação e fechamento verificável

> Executar com `superpowers:executing-plans`, testes negativos antes de implementação e revisão final. Solicitação: concluir pendências e desenvolver contas/catálogo/contratos e login Novo GEO.

**Goal:** compor capacidades administrativas existentes com configuração versionada da operação e construir o fluxo OIDC próprio, sem afirmar integração real ausente.
**Architecture:** continuar a base local C03/C04, reutilizar Auth/MFA, transações, instantes e identidade; nenhuma substituição por GeoLab/legado. Configuração por comandos de registro fechado, sessões externas opacas separadas de M2M. Adaptadores que exigem dados/serviços reais são explícitos, sem fallback.
**Tech Stack:** TypeScript/Node22, APIs crypto/fetch nativas; PostgreSQL17/Supabase/Netlify existentes no destino de integração. Sem alterar dependências ou lock.
**Spec:** plano original do usuário CG03–05 e plano de ciclos C05/C06. Spec complementar/contrato de origem não recuperados. Não inferir issuer/endpoints reais, scopes, provedores ou coorte.

## Constraints

Preservar os94arquivos de entrada salvo alterações rastreadas.12migrations/hashes existentes intactos. Não reenviar o SQL bloqueado anteriormente por alternativa. Não acessar bancoGEO nem usar produção para fixtures. Não publicar/grantar capacidades a Thiago. Repositório remoto f60baed permanece referência; pacote não é clone. Instantes UTC exatos; nenhum e-mail autoriza. Suíte não executada permanece pendente.

## Execução

1. Conferir arquivo/176hashes, recuperar dependências por blobSHA e repetir regressões. Registrar falta de PG/CLI/checkout, sem simular esses aceites.
2. C04: implementar aceitação explícita de convite da própria pessoa autenticada, mantendo função/validade, revisão geral e do membro, recibo/audit; não enviar e-mail, promover papel ou atribuir scope. Testes anteriores permanecem.
3. C05: `support-configuration.ts` com registros de conta/produto/instância/serviço/binding/contrato/versão/cobertura. `configuration-admin.ts` com comandos nomeados, relações no workspace, CAS/recibo/audit e proibição de editar versão publicada. Capabilities separadas por contas/catálogo/contratos/bindings; nenhum grant criado pelo construtor. Store transacional explícito; implementação durável dependerá da promoção SQL.
4. C05 HTTP e interface opcional: rotas fixas, origem/If-Match/chave obrigatórios em mutações, entrada/saída limitada, listagem por revisão. Não montar no runtime sem SQL/contratos/CI. Formulários não aceitam secrets/URLs de infraestrutura. Testes de aplicação e HTTP, sem declarar navegador homologado por DOM simulado.
5. C06: testar e implementar verificação criptográfica RS256 restrita usando JWKS configurado, issuer/audience/azp/nonce/exp/iat/nbf e limites; não buscar URL indicada por token. Verificação da assinatura não substitui fluxo possuído/contrato da origem.
6. C06: fluxo com state, nonce, PKCE S256, vínculo ao browser, consumo atômico de uma vez; cofre AES-GCM com associação de contexto. Sessão hd_person com hashes, rotação/CAS, revalidação e revogação; banco/fonte reais ainda requerem implementações qualificadas. Testes com chaves RSA geradas localmente e stores só de teste.
7. C06 montagem HTTP same-origin e callback limpo, troca explícita; browser mantém credenciais apenas em memória. Nenhuma adoção de ID token/M2M como sessão HelpDesk; recovery externo é responsabilidade do IdP.
8. Executar regressões disponíveis, typecheck focal, mutações de segurança e revisão final; gerar patch cumulativo e de transição, logs e matriz de cada requisito. Só afirmar concluído o que foi executado.

## Review focus

- Concessão expira enquanto transação aguarda; bloqueio pré-COMMIT sem dizer rollback de COMMIT confirmado.
- Cross-workspace em catálogo/recibo/identidade, ID repetido e aliases por e-mail.
- Alteração de contratos publicados, CAS concorrente e reenvio após resposta perdida.
- Callback de outro browser/issuer, state reutilizado, alg none/HMAC/jku e token com claims fabricados.
- Refresh concorrente/revogação e chegada tardia: nenhuma restauração de sessão ou privilégio.

## Gates não substituíveis

31cenários SQL E/G, novo store administrativo durável, promotion/migrationCLI/upgrade, origem OIDC real, runtime/OpenAPI/build/browser, CI fonte integrada e revisão independente. Essa lista não está concluída pela criação dos módulos acima. Nenhuma alteração remota de código planejada enquanto o fluxo de gravação SQL permanece bloqueado.
