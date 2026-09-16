# M1 — Persistência e segurança — plano de execução v0.2.0

**Goal:** tornar o núcleo verificável com PostgreSQL real, fechar lacunas de revalidação e introduzir limites persistentes de abuso sem publicar ambientes.
**Architecture:** manter API própria, schemas privados, autorização contextual, SQL parametrizado e login restrito. Acrescentar controles no HTTP e no banco, preservando as migrations anteriores e aplicando evolução em migration adicional.
**Tech Stack:** Node.js 22, TypeScript, pg, PostgreSQL 17, Netlify Functions.
**Spec:** `docs/01-ARQUITETURA.md`, M1/HD-101–105 de `docs/02-PLANO-DE-DESENVOLVIMENTO.md`.

## Restrições
- Sem push, deploy, migration remota, alteração de segredos/MFA ou infraestrutura cobrada.
- Testes de SQL só em banco local novo, nome helpdesk_test, com opt-in explícito e URLs sem parâmetros que redirecionem conexão.
- Não tratar doubles de SQL como comprovação de RLS ou concorrência PostgreSQL.
- Não gerar lockfile com integridades presumidas nem liberar release sem gates reais.

## Execução
1. [x] Recuperar branch do bundle e verificar estado remoto; executar os 90 testes de base.
2. [x] Regressão de replay: criar chamado, manter resultado idempotente, negar leitura no store e exigir 404 no replay. Acrescentar tombstone expirado; nunca recriar silenciosamente.
3. [x] Regressões de runtime: recusar escalada por roles/ownership, parâmetros TLS, falta de chave HMAC, driver/schema incompatível; falhar fechado.
4. [x] Rate limit: consumo atômico persistente por IP confiável, identidade e workspace; retornar 429/Retry-After; teste de cabeçalho forjado, falha do limitador e ausência de metadata confiável.
5. [x] Migration adicional: scopes vivos nas policies, transições no banco, quota de sessões e idempotência, contadores e limpeza técnica restrita/dry-run.
6. [x] Paginar mensagens/notas/timeline com cursor vinculado a pessoa/workspace/recurso e SQL com LIMIT. Preservar resposta pública distinta de nota interna.
7. [x] Ampliar teste PostgreSQL com ataques diretos, FKs, scopes, concorrência, rollback, quota, limpeza e revogação. Criar executor local seguro e gates de publicação que distinguem teste escrito de executado.
8. [x] Executar o que o ambiente permitir, registrar bloqueios reais, atualizar evidências, handoff e versão. Preparar ZIP integral, patch e bundle sem credenciais ou node_modules.

## Critério de saída
M1 só se encerra com HD-101/102/103/104/105 efetivamente homologados. Uma parte implementada/testada localmente será entregue como avanço de M1, não como homologação remota ou produção liberada.

## Gates não concluídos
- [ ] Registry, lockfile verdadeiro, instalação limpa e audit.
- [ ] Execução das quatro migrations e dos 35 cenários em PostgreSQL 17 real.
- [ ] Homologação de Auth, pooler, privilégios, Data API e bundle/execução Netlify Functions.
- [ ] Teste de carga/abuso e aprovação de limites e manutenção operacional.
- [ ] Browser, responsividade, acessibilidade e sessão ponta a ponta.

Os itens marcados na execução representam desenvolvimento e verificações locais, não aprovação destes gates.
