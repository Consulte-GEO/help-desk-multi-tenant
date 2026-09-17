# Help Desk v0.15.0 — Estado e evidências

**Entrega local, não publicada. O M1 permanece aberto.** A base é a v0.14.0, commit `503f1b0d3db59cb373d492bf7434d908ce6522dd`. A branch é `work/helpdesk-v0.15.0`. As verificações ocorreram em 17 de setembro de 2026; os logs usam UTC. O manifesto externo e o bundle identificam o commit final.

## 1. Desenvolvimento desta rodada

R14-04 e R14-05 receberam implementação candidata: capacidades humanas versionadas por pessoa e workspace, função de consulta compartilhada entre a resolução de identidade e o RLS, ausência de perfil sem permissões e histórico privado com revisão esperada. A migration realiza uma carga inicial única das relações humanas legadas ativas, preservando as cinco capacidades anteriores.

O setter SQL é `SECURITY INVOKER` e não pode ser executado pelo login HTTP. A ferramenta de linha de comando gera um plano de provisionamento parametrizado, sem conectar ou executar SQL. O acesso a cada conta continua dependente de vínculo, papel e recurso. Nenhuma interface administrativa foi entregue.

A recuperação do recibo da própria nota exige `tickets:read`, `notes:write` e condição de operador. A consulta da coleção privada continua exigindo `notes:read`. Namespace, integridade dos reenvios e prazos do cache foram preservados. O contrato compartilhado recusa listas de capacidades desconhecidas, repetidas, nulas ou com posições ausentes. A verificação de inicialização também deixou de usar a quantidade fixa de 23 tabelas e passou a consultar o inventário central.

**API, interface e schema candidato: 0.15.0.** São nove migrations, 24 tabelas e 18 operações em 14 caminhos HTTP. A migration 009 é nova; as oito anteriores estão intactas. Não foi adicionada dependência ou rota. Na interface, houve apenas atualização da indicação de versão.

## 2. Resultados efetivamente executados

Os caminhos abaixo são relativos ao repositório.

| Verificação | Resultado e alcance | Evidência |
|---|---|---|
| Base anterior | 868 testes aprovados antes das alterações. | `evidence/v015/00-baseline-tests.txt` |
| Suíte local final | **905 aprovados**, zero falhas, cancelados, ignorados ou TODO; 37 novos. | `evidence/v015/final-tests.txt` |
| HTTP de loopback | **35 verificações aprovadas**, usando memória e dados fictícios. | `evidence/v015/15-interface-attempt.txt` |
| Plano offline | Saída parametrizada sobre exemplo fictício; nenhuma execução de banco. | `evidence/v015/example-scope-plan.json` |
| Integridade das migrations | Oito arquivos anteriores idênticos ao Git base; nona migration incluída no manifesto. | `evidence/v015/migration-integrity.json` e `final-migrations.txt` |
| TypeScript suplementar | Aprovado com ferramentas globais previamente instaladas. | `evidence/v015/final-typecheck-supplementary.txt` |
| OpenAPI estrutural | 18 operações e 14 caminhos; referências e verificações estruturais. | `evidence/v015/final-contracts.txt` |
| Sintaxe e build estático | 27 arquivos JavaScript, MJS e Python verificados; assets gerados. Não inclui Functions. | `evidence/v015/final-syntax.json` e `final-build.txt` |
| Busca heurística de segredos | Nenhum padrão reconhecido; não equivale a pentest ou auditoria integral. | `evidence/v015/final-secrets.txt` |
| Verificação padrão | **Falhou com código 2**, depois dos testes, por dependências e tipos locais ausentes. | `evidence/v015/16-verify-standard.txt` |
| Homologação agregada e publicação | **Não aprovadas**. A ausência do lockfile bloqueia as etapas dependentes. | `evidence/v015/final-homologation.txt` e `final-release-gate.txt` |

Os 37 novos testes correspondem a 22 casos do contrato e fluxo em memória, sete verificações estruturais e de prontidão e oito da ferramenta offline, com processos e arquivos locais. **Não são 37 testes de PostgreSQL.** Nenhum perfil foi configurado no Supabase. Os testes locais que usam adaptadores SQL empregam respostas controladas e não comprovam execução de funções, permissões ou RLS reais.

## 3. Regressões e revisão

O primeiro grupo teve 21 falhas antes da implementação, incluindo importações ausentes, e um fluxo existente aprovado. Os 22 passaram depois. As seis verificações estruturais da migration falharam pela ausência do arquivo e passaram depois de sua criação; isso não representa execução de SQL.

A regressão de prontidão apresentou seis aprovações e uma falha pelo limite antigo de 23 tabelas. Os sete testes passaram após a correção. A ferramenta offline teve oito falhas antes de existir e oito aprovações depois. Foram verificados resultado, campos de segredo adicionais, tamanho, UTF-8, link simbólico, arquivo ausente, diretório e quantidade de argumentos.

A primeira execução integrada apresentou 892 aprovações e quatro falhas em 896 testes. Os fixtures de sucesso ainda esperavam schema 0.9.0, 23 tabelas e oito migrations. Essas expectativas foram atualizadas para o novo contrato, sem remover testes negativos. Com todos os testes novos incluídos, os 905 passaram.

O compilador encontrou `await` em um callback não assíncrono de uma nova asserção SQL. O teste foi corrigido e a checagem suplementar foi repetida. Isso não comprova que o cenário SQL foi executado.

A revisão do diff, da semântica, dos privilégios propostos e dos limites está em `evidence/v015/local-review.md`. **Foi uma revisão local pelo implementador, sem revisor independente, subagente, pentest, carga ou restauração.**

## 4. O que não foi homologado

**Dependências.** A nova tentativa de `npm run deps:resolve` retornou `EAI_AGAIN registry.npmjs.org`. Não há lockfile real, instalação limpa ou auditoria da árvore instalada. A checagem suplementar usou Node 22.16.0, TypeScript 5.8.3 e tipos Node globais diferentes dos declarados. Ela não substitui a instalação do manifesto. Evidência: `13-dependencies-attempt.txt`.

**PostgreSQL.** O executor `test:db:local` recusou a ausência de Docker antes de conectar. Há **146 cenários escritos, zero executados nesta rodada**: 136 principais, sendo 19 novos, e dez de upgrade, sendo dois novos. O ensaio mantém a comparação do upgrade 001–007 para 008 e depois aplica a 009, verificando também a carga inicial das capacidades. Permanecem sem comprovação a concorrência, o RLS, os grants, as chaves estrangeiras, os triggers, a latência e o upgrade. Não foi utilizado o Supabase remoto como alternativa. Evidências: `14-database-attempt.txt` e `sql-written-counts.json`.

**Navegador.** Depois dos 35 checks HTTP, a navegação bloqueou em `page.goto` com `ERR_BLOCKED_BY_ADMINISTRATOR`. Permanecem **35 verificações escritas, zero aprovadas**. A segunda suíte, de autenticação humana, não foi alcançada pelo executor. Não há validação visual, mobile, de acessibilidade, CSP ou CORS. Nenhuma política do ambiente foi alterada.

**Destino e operação.** Auth, pooler, TLS, metadados IP, empacotamento e execução de Functions, capacidade, restauração e governança de provisionamento continuam pendentes. O histórico não é WORM: um administrador do banco pode alterar DDL ou utilizar TRUNCATE. O teto de capacidades é por workspace, não distinto por conta. Não foi acrescentada revogação instantânea de JWT nem cancelamento de comandos já autorizados.

## 5. Pendências e efeitos externos

R14-04 e R14-05 possuem código candidato nesta entrega, **com homologação SQL e operacional pendente**. R14-06, sobre a obrigação de evento e outbox em todas as mudanças de estado e mensagens, **não foi implementado nesta rodada**. O backoffice M2, anexos, SLA operacional, processamento de notificações e conectores reais continuam ausentes.

**Nenhum push, PR, merge, deploy, migration remota, alteração de dados, segredos, MFA ou usuários.** Não houve nova inspeção remota nesta rodada. Os estados anteriores de GitHub, Supabase e Netlify são históricos, não confirmação atual. O pacote foi desenvolvido a partir do bundle anterior.

A próxima sequência é: dependências reproduzíveis, PostgreSQL 17 e os 146 cenários, alinhamento de R14-06, runtime real, navegador e critérios operacionais. O verificador exige 905 testes locais, 146 SQL e 70 checks HTTP/navegador realmente aprovados. Nesta execução, permaneceu bloqueado por ausência do lockfile. Mesmo uma aprovação local não autoriza produção.

O bundle recuperado e os resultados dessa recuperação acompanham o pacote, fora da árvore do commit.
