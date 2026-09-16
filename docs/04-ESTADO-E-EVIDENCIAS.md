# Help Desk v0.8.0 — Estado e evidências

**Entrega local, não publicada. M1 aberto.** Base v0.7.0 `d05f6f6f430dd624a7c550f81d81d895e858c156`; branch `work/helpdesk-v0.8.0`. Verificações em 16/09/2026; logs UTC. Commit final no manifesto/bundle.

## Implementação
PATCH restrito à prioridade, motivo interno obrigatório, If-Match, idempotência e controle de estado terminal; evento funcional e intenção transacional mínima; projeção privada/pública separada. Interface com formulário de equipe, rascunho próprio e recuperação explícita de 412. Histórico carregado sob demanda, paginação, validação fechada de eventos, proteção de geração e 500 itens na tela.

API/interface/schema candidato **0.8.0**. Sete migrations, 23 tabelas, 17 operações em 13 caminhos. As seis migrations anteriores intactas. Novo schema exigido por grant, constraint/guard, cache e evento reais, não cosmética.

Todos os caminhos `m1g/` abaixo são relativos à pasta `evidence/`.

## Verificações e alcance
| Verificação | Resultado | Evidência |
|---|---|---|
| Base v0.7.0 | 486 testes aprovados antes de alterar | m1g/00-baseline-tests.txt |
| Suíte local final | **569 aprovados, zero falhas/skips/cancelados**; 83 novos | m1g/final-tests.txt |
| HTTP loopback | **22 checks aprovados**, dados fictícios em memória | m1g/final-ui-attempt.txt; final-http-smoke.json |
| TypeScript global suplementar | Aprovado com compilador/tipos disponíveis no ambiente | m1g/final-typecheck-environment.txt |
| OpenAPI | 17 operações / 13 caminhos, verificação estrutural | m1g/final-contracts.txt |
| Sintaxe e build | Aprovados; somente assets, não bundle Functions | m1g/final-syntax.json; final-build.txt |
| Secrets scan heurístico | Nenhum padrão reconhecido; não auditoria integral | m1g/final-secrets.txt |
| Integridade | Seis migrations anteriores iguais por hash | m1g/migration-integrity.json |
| Verificação padrão | Falhou por dependências/tipos locais ausentes | m1g/final-verify-manifest.txt |
| Homologação/publicação | Não aprovadas; lock ausente bloqueia dependentes | m1g/final-homologation.txt; final-release-gate.txt |

Os testes locais exercitam aplicação, serialização HTTP, estado puro, fakes do driver e sentinelas de código. Os 22 checks HTTP usam servidor Node em loopback e apresentação dos eventos reais desse transporte, mas persistência de memória. **Nenhum desses resultados prova PostgreSQL, Auth real ou browser.** Contagens e exit codes em m1g/final-verification.json.

## Ciclos e revisão
- Prioridade: 47 falhas esperadas antes do comando, 47 passagens depois.
- Histórico: 24 falhas por módulo ausente e 3 testes de estado existente aprovados; 27 passagens depois.
- Contrato SQL/adaptador: 6 falhas/2 passagens antes da migration/guard; 8 passagens depois. São sentinelas/orquestração, não execução SQL.
- Revisão detectou precedência ambígua de extração JSON e subtração no SQL candidato; parênteses explícitos e regressão estrutural falha→passa. Não alegada execução PostgreSQL.
- Typecheck detectou declaração ausente do módulo JS de mutação, corrigida com interface .d.ts. Rechecagem global aprovada.
- Revisão local do diff e casos de negação documentada em m1g/local-review.md. Não houve revisor independente/subagente.

## Bloqueios
Registry: `npm run deps:resolve` retornou EAI_AGAIN registry.npmjs.org. Sem lock real, npm ci ou audit. `npm run verify` falha na checagem de tipos locais. Typecheck suplementar usa tipos globais diferentes dos declarados; não oculta a falha.

Banco: **82 cenários escritos, zero executados** (14 novos). Docker/servidor ausentes; runner recusa antes de conectar. Não foi tentado banco remoto, instalação alternativa ou bypass de usuário/política. Grants/RLS/FKs/locks/checks/triggers/planos e upgrade real continuam não homologados.

Browser: **22 checks escritos, zero aprovados**, cinco novos. Playwright bloqueia em page.goto com ERR_BLOCKED_BY_ADMINISTRATOR após os 22 HTTP aprovados. UI codificada e estado puro testado; sem aprovação visual/teclado/acessibilidade/390px ou fluxo DOM.

Destino/operacional: Auth, pooler/TLS, IP, empacotamento/execução de Functions, limites/carga, coleta de logs, restore e revisão independente pendentes. Outbox é intenção persistível, não envio. Não há SLA recalculado.

## Escopo e efeitos externos
Recorte HD-301 antecipado para prioridade/histórico e HD-105; não encerra M1, não entrega M2 nem todo M3. Nenhum push, PR, merge, deploy, migration remota, mudança de dados/segredos/MFA/infraestrutura cobrada. GitHub lido, vazio; Supabase/Netlify não reinspecionados.

Próxima prioridade: dependências → PostgreSQL 17/82 cenários/fresh e upgrade → runtime/Auth/Functions → browser → capacidade/restore/revisão. Código entregue para revisão; não para dados reais.
