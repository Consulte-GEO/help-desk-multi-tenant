# Help Desk v0.3.0 — Continuidade M1 / estado e evidências

**Entregue localmente, sem publicação. M1 não encerrado.** Base v0.2.0: `922d5d16a5e30cbee05386c262d11849a8596987`. Branch `work/helpdesk-m1-v0.3.0`. Verificações em 16/09/2026; os logs usam UTC. Commit final identificado no manifesto externo e bundle Git da entrega.

## 1. Resultados efetivamente executados

| Verificação | Resultado | Evidência |
|---|---|---|
| Suíte local Node | **274 aprovados, zero falhas, zero cancelados/ignorados**; 88 testes adicionais sobre os 186 da base | `evidence/m1b/final-tests.txt` |
| HTTP real de loopback | **Nove verificações aprovadas**, com dados exclusivamente em memória | `evidence/m1b/final-http-smoke.json` |
| TypeScript do ambiente | Saída 0 usando compilador/tipos globais; não equivale às dependências do manifesto instaladas | `evidence/m1b/final-typecheck-environment.txt` |
| OpenAPI estrutural | 14 operações / 11 paths, referências e separação demo/runtime verificadas | `evidence/m1b/final-contracts.txt` |
| Sintaxe | 14 arquivos JS/MJS verificados; AST Python dos scripts de contrato e navegador válida | `evidence/m1b/final-syntax.txt` |
| Build estático | Assets gerados, incluindo o novo módulo de estado das mutações | `evidence/m1b/final-build.txt` |
| Scanner heurístico | Sem padrão reconhecível de segredo; não é auditoria completa nem revisão de supply chain | `evidence/m1b/final-secrets.txt` |
| Homologação local automatizada | **Bloqueada**, não aprovada: lock falhou; instalação/audit/aplicação/SQL/interface dependentes ficaram `blocked` | `evidence/homologation/latest.json` |
| Gate de publicação | **Recusou**, saída 1. O comportamento de recusa foi verificado, não a prontidão do produto | `evidence/m1b/final-release-gate.txt` |

A suíte local inclui execução de regras reais de domínio, HTTP in-process, estado puro da interface e processos locais. Os adaptadores PostgreSQL e autenticação externa usam respostas controladas. Fixtures do verificador de homologação são sintéticas e NÃO são o relatório operacional válido.

O smoke HTTP verificou: contas separadas, versão 0.3.0, criação/reenvio idempotente, ID conhecido de outra conta negado, 55 mensagens paginadas sem duplicação, separação público/interno, todos os módulos JavaScript servidos, parâmetros ambíguos/vazios negados e compressão não suportada recusada.

## 2. Falhas reproduzidas e corrigidas

**Vigência contratual durante espera:** a abertura capturava o horário antes de aguardar a consulta/lock das coberturas. Agora o relógio é consultado depois dessa espera. A regressão simula a passagem da vigência e comprova ausência de ticket/outbox/cache após rollback em memória. Isso ainda não prova lock ou isolamento PostgreSQL reais.

**Identidade inconsistente:** respostas HTTP 200 inválidas do provedor e objetos privados malformados eram pouco validados. Agora a resposta humana, tipo de principal, workspace, papéis, vínculos, scopes e contexto M2M são validados; extras não são projetados. Uma sessão M2M não pode ser interpretada como humano/administrador. Nenhuma configuração Supabase Auth foi modificada.

**Entrada HTTP:** leitura com limite total de 64 KiB e prazo de cinco segundos; rejeição de comprimento inválido/incompatível, UTF-8 corrompido, streams com falha e compressão não suportada. A aplicação retorna erros seguros. Esses limites não substituem proteção de ingresso ou teste de capacidade.

**Parâmetros e cursores:** lista de tickets rejeita parâmetros duplicados e seletores explicitamente vazios, usando o mesmo validador estrito das conversas. Cursores válidos emitidos pela base preservam o mesmo escopo; não houve mudança de formato de coleção.

**Respostas de mutações atrasadas:** snapshots de sessão/ticket/canal/revisão impedem apagar um rascunho novo, aplicar duas vezes o término ou reativar uma operação antiga após A→B→A. Retry sem alteração preserva a chave; novo payload recebe nova chave. A integração foi codificada na interface, mas apenas o estado puro e o transporte HTTP foram executados, não o navegador.

**Build/demo:** a inclusão do novo módulo foi verificada também por HTTP; uma ausência de rota foi reproduzida como 404 e corrigida. O smoke agora cobre essa classe de problema.

**Homologação:** antes, `verify:release` não exigia evidências de SQL e browser. Agora exige um relatório local completo, logs correspondentes e fingerprint do código/configuração/testes. Recusa resultados ausentes, skips, contagens insuficientes, falhas, sinal de término, alteração de fontes, relatório vencido e logs adulterados. O registro é local e revisável, não assinado e não uma certificação de produção.

## 3. Ciclos de regressão preservados

| Grupo | Antes da correção | Depois |
|---|---|---|
| Requisições/vigência | 17 falhas esperadas | 17 aprovados |
| Autenticação | 27 falhas esperadas | 27 aprovados |
| Estado das mutações | 14 falhas esperadas | 14 aprovados |
| Verificador de homologação | 24 falhas esperadas | 24 aprovados |
| Executor local limitado | Cinco falhas esperadas | Cinco aprovados |
| Revisão de fonte alterada durante execução | Uma falha adicional | Uma aprovação adicional |

As fases red/green estão em `evidence/m1b/02–22`. A base foi executada antes das alterações (186 aprovados). Um fixture antigo de integração foi ajustado para representar o contrato SQL real: conexão, produto e scopes de integração. As expectativas de negação de acesso não foram removidas.

## 4. O que continua bloqueado ou não executado

- **Dependências:** nova tentativa real retornou `EAI_AGAIN registry.npmjs.org`. Sem lockfile, instalação limpa ou audit de dependências. Não foram usados proxies alternativos ou alterações da política de rede. `25-dependencies-attempt.txt`.
- **Verificação padrão do manifesto:** `npm run verify` terminou com código 2 na checagem TypeScript por tipos locais não instalados. A checagem com tipos globais passou, mas não substitui essa etapa. `final-verify-manifest.txt`.
- **PostgreSQL:** Docker e binários de servidor/cliente PostgreSQL não estão disponíveis. Há `pg_config`, mas ele sozinho não constitui um servidor. A tentativa `test:db:local` falhou antes de abrir conexão. Permanecem **35 cenários SQL escritos, zero executados**. Quatro migrations e versão de schema **0.2.0 permanecem inalteradas**. Não há migration nova nesta entrega.
- **Navegador:** Playwright foi iniciado, mas a navegação para loopback retornou `ERR_BLOCKED_BY_ADMINISTRATOR`, antes das asserções. A suíte tem 11 verificações escritas, incluindo duas regressões de envios atrasados; zero concluídas nesta sessão. Sem aprovação visual/mobile/acessibilidade. `final-ui-http-browser.txt`.
- **Destino:** Supabase Auth, pooler/TLS, policies/grants/FKs/locks reais, bundle e execução Netlify Functions não homologados.
- **Operação:** carga, calibração de quotas, restauração, pentest e revisão independente não executados.

Os comandos e códigos de saída estão em `evidence/m1b/final-verification.json`. `expected_exit: 1/2` significa que o bloqueio era esperado, NÃO aprovação do subsistema.

## 5. Matriz M1

| Item | Avanço nesta entrega | Condição ainda aberta |
|---|---|---|
| HD-101 dependências/CI | Executor e evidências vinculadas às fontes; gates mais estritos | Registry, lock revisado, npm ci/audit e cadeia de CI completa |
| HD-102 PostgreSQL/isolamento | Correção do instante de vigência na aplicação | Executar 35 cenários com papel real em PostgreSQL 17 e corrigir achados |
| HD-103 runtime | Validação de principal e erros de autenticação reforçados | Auth, pooler/TLS, bundle e execução Functions em homologação autorizada |
| HD-104 limites | Deadline, bytes, UTF-8 e parâmetros reforçados | Concorrência SQL, teste de abuso/capacidade e calibração |
| HD-105 interface/sessão | Estado puro de mutações e transporte local verificados; regressões de browser escritas | Executar browser e validar interação visual/acessível |

## 6. Ambientes remotos e continuidade

**Nenhum push, PR, merge, deploy, migration remota, alteração de dados, segredo ou MFA foi realizado.** Os ambientes não foram reinspecionados nesta rodada; observações remotas da v0.2.0 são históricas, não uma confirmação atual.

M2 não foi iniciado. O próximo passo continua sendo dependências reproduzíveis → PostgreSQL 17 → Auth/pooler/Functions → browser/capacidade e revisão operacional. Funcionalidades futuras continuam anunciadas como desabilitadas na API.
