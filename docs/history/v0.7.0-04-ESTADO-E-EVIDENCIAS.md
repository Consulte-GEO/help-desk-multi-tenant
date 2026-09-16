# Help Desk v0.7.0 — Estado e evidências

**Entrega local, não publicada. M1 permanece aberto.** Base v0.6.0 `a6eb2c69ce3ea9b49eaab881ed236da43a725662`; branch `work/helpdesk-m1-v0.7.0`. Verificações em 16/09/2026, logs UTC. Commit final no manifesto externo e bundle.

## Resultados executados

| Verificação | Resultado e alcance | Evidência |
|---|---|---|
| Suíte local Node | **486 aprovados; 0 falhas, cancelados ou ignorados** — 35 novos sobre os 451 reproduzidos na base | evidence/m1f/final-tests.txt |
| HTTP loopback | **17 checks aprovados**, dados fictícios em memória | evidence/m1f/09-ui-attempt.txt; final-http-smoke.json |
| TypeScript com ferramentas globais | Aprovado com compilador/tipos existentes no ambiente; não equivale a npm ci do manifesto | evidence/m1f/final-typecheck-environment.txt |
| OpenAPI estrutural | 16 operações/13 caminhos, referências e sentinelas | evidence/m1f/final-contracts.txt |
| Sintaxe JS/MJS e AST Python | Aprovada para os arquivos listados | evidence/m1f/final-syntax.json |
| Build | Frontend estático aprovado, não bundle das Functions | evidence/m1f/final-build.txt |
| Scanner de segredos | Nenhum padrão reconhecido pelo scanner; não é auditoria integral | evidence/m1f/final-secrets.txt |
| Integridade migrations | Seis anteriores iguais por bytes/hashes; nenhuma nova | evidence/m1f/migration-integrity.json |
| Verificação padrão npm run verify | **Falhou (2)** por ausência de dependências/tipos locais; os testes Node anteriores à checagem passaram | evidence/m1f/final-verify-manifest.txt |
| Homologação agregada e gate | **Não aprovados**; lock ausente bloqueia etapas dependentes | evidence/m1f/final-homologation.txt; final-release-gate.txt |

Comando de typecheck adicional: `npm run typecheck -- --typeRoots /opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/node_modules/@types`. Ferramentas: Node 22.16.0, TypeScript 5.8.3; tipos Node globais diferem dos declarados. Não omitir a falha do comando padrão ao apresentar esse resultado.

O smoke comprova API local, não PostgreSQL/Netlify/Auth. Quatro checks novos: busca de chamado fora da primeira página, filtros AND, paginação filtrada/cursores, isolamento/validação/capability. Os 35 testes novos locais incluem doubles do driver e estado puro da UI; não são 35 testes de banco ou navegador.

## Código e compatibilidade

Busca autorizada no servidor por assunto/ID completo, filtros de situação pública e prioridade antes da paginação, SQL parametrizado, cursores vinculados aos filtros, equivalência ASCII/Latin-1 determinística e acentos significativos. Descrição/notas/mensagens não participam da busca textual. Interface aplica/limpa filtros, mantém rascunho/detalhe, limita itens na tela, informa contagens carregadas e rejeita páginas/respostas antigas ou malformadas.

**API/interface 0.7.0 / schema esperado 0.5.0.** Seis migrations preservadas, 23 tabelas candidatas, 16 operações. Consulta não cria grants/helpers privilegiados novos. Nenhuma migration, conta, segredo, MFA ou configuração de dados real alterados.

Enquadramento: parte delimitada de **HD-302 (busca, originalmente M3)** antecipada na caixa existente + evolução HD-105. Isso não reclassifica o M1 como concluído nem inicia/entrega o backoffice M2 ou o M3 inteiro. Prioridade de homologação continua HD-101/102/103.

## Regressões e revisão

- Base: 451 passaram antes das alterações (`00-baseline-tests.txt`).
- Busca: 13 falhas/3 passagens na base; 16 passagens após implementação (`01/02`).
- Estado da lista: 12 falhas por módulo ausente; 12 passagens após implementação (`03/04`).
- Adaptador/validação/observação: sete testes adicionais aprovados (`06`).
- Revisão local do diff, UX, SQL candidato, autorização e semântica em `evidence/m1f/local-review.md`. Não houve revisor independente, subagente, pentest ou carga.
- Um assert de vazio na suíte browser foi ajustado na revisão para o elemento que apresenta a mensagem. O browser bloqueou antes das asserções; não foi chamado de regressão DOM comprovada.

## Bloqueado / não executado

**Registry:** `npm run deps:resolve` retornou `EAI_AGAIN registry.npmjs.org`. Sem lockfile real, npm ci, audit ou dependências homologadas. Não foram usados proxies alternativos nem alterações de política (`10-dependencies-attempt.txt`).

**PostgreSQL:** runner padrão recusou Docker ausente; não houve fallback remoto (`11-db-attempt.txt`). **68 cenários SQL escritos, zero executados**, oito novos. Runner nativo anterior preservado; não foi usado para contornar a exigência de usuário não root/binários locais. RLS, FKs, helpers, locks e desempenho reais ainda não comprovados.

**Navegador:** `test:ui:local` executou 17 checks HTTP e encontrou `ERR_BLOCKED_BY_ADMINISTRATOR` no `page.goto`. **17 checks browser escritos, zero aprovados nesta sessão**. Interface codificada e estado puro testado, sem certificação visual, responsividade, acessibilidade ou E2E browser.

**Destino e operação:** Auth/pooler/TLS, IP confiável, Functions com pg instalado, limites/carga, redação de logs do provedor, restauração e revisão operacional pendentes. Busca substring sem benchmark nem índice novo; não prometer latência ou escala.

Contagens e códigos de saída em `evidence/m1f/final-verification.json`. Um exit 1 esperado no gate significa **publicação recusada**, não subsistema aprovado. O relatório agregado permanece bloqueado e não assinado; não é atestação independente.

## Ambientes remotos

Uma consulta GitHub via conector retornou “This repository is empty.” no repositório indicado. Registro em `evidence/m1f/remote-readonly.json`. **Supabase e Netlify não foram reinspecionados nesta rodada**; os metadados históricos não são confirmação atual.

Nenhuma escrita remota: sem push/PR/merge/deploy/migration, alteração de segredo/MFA, dados ou infraestrutura cobrada. Antes de integrar, reinspecionar todos os destinos e preservar eventuais alterações concorrentes.

## Próximo passo

Dependências reais → PostgreSQL 17 descartável/68 cenários → plano/desempenho da busca com RLS → Auth/pooler/Functions → 17 checks browser/UX → capacidade/restore/revisão e gates. Não ampliar módulos para apresentar como resolvidas essas lacunas. Backoffice, intakes, participantes/filas, SLA operacional, anexos, worker/webhooks/e-mail e suporte incorporado permanecem fora desta entrega.
