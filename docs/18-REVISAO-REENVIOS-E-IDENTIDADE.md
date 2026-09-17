# Help Desk v0.14.0 — Revisão acumulada, reenvios e identidade

**17/09/2026 · Entrega local · M1 aberto · Sem publicação**

Base revisada: `c94e49dc1066ffc89bfd444395d80e696e748daa` (v0.13.0). O código acumulado e seu histórico foram recuperados do bundle, não de um site em produção. Esta revisão confronta documentação, contratos, fontes, migrations e testes existentes. Não constitui auditoria linha a linha certificada, pentest ou revisão independente. Não houve acesso a dados de clientes.

## 1. Resultado da revisão do conjunto

A arquitetura permanece uma plataforma independente: workspace, conta, produto/instância, contrato/versão e cobertura são entidades diferentes. Os estudos originais em `docs/research/` são propostas, não prova de implementação. Conservamos seus conceitos de autorização por recurso, separação de mensagens/notas, snapshot histórico e intenção transacional. Fastify, pgTAP, OpenTelemetry completo, PGMQ e busca full-text citados nas pesquisas NÃO são tecnologias operacionais desta base; a implementação usa handler Request/Response TypeScript, node:test, driver pg candidato, busca literal e logs fechados.

| Área | Implementação encontrada | Validação e limite atual |
|---|---|---|
| Atendimento | Abertura guiada, contrato elegível, lista/busca/filtros, conversa pública e notas separadas, transições | Regressões locais executadas; banco e navegador não homologados |
| Operação da equipe | Prioridade, assumir/liberar, histórico, ações consultivas do GET | Não equivale a módulo completo de filas, equipes, participantes ou SLA |
| Identidade | Provedor humano, tradução Auth ID/principal, refresh/logout no browser; M2M separado | Supabase real, janela de revogação e configuração operacional pendentes |
| Autorização | Workspace/conta/recurso + papel + escopos no domínio; RLS/grants candidatos | Escopos humanos granulares não são hoje configuráveis por principal no SQL; ver R14-04 |
| Reenvio | Chave por ator/operação, hash, resposta original, reautorização | Reforçado nesta entrega; não é armazenamento assinado nem prova da integridade de um DB comprometido |
| Contratos | Catálogo de leitura, resolução/ambiguidade, vigência, snapshot | Não existe backoffice para publicar versões e administrar contratos |
| Persistência | Oito migrations, 23 tabelas candidatas, login restrito, contexto transacional, guards | 125 cenários SQL/upgrade escritos; ainda não executados aqui |
| Confiabilidade | Outbox escrita no mesmo UnitOfWork; validações SQL específicas | Sem dispatcher, entrega, ledger externo ou retry operacional; invariantes SQL não são uniformes em todos os comandos |
| Sessão/telas | Controle de gerações, preservação de rascunhos, erros parciais, hints atuais | Sem aprovação visual, acessibilidade, mobile ou navegador |
| Telemetria | Correlação, vocabulário fechado e agregação offline | Não é observabilidade distribuída, armazenamento durável ou painel de produção |
| SLA/anexos/conectores | Planejamento; calendário de referência isolado | Clocks, quarentena, scanner, Storage/restore e dois conectores reais ausentes |
| Engenharia | Testes, OpenAPI estrutural, manifesto de migrations e gates | Sem lock real, npm ci/audit, pipeline GitHub ou Functions homologados |

Não estimamos percentual global pelo número de testes. A suite inclui mocks do driver, testes do estado puro e sockets com identidade sintética; muitos testes verdes não convertem uma migration em SQL executado.

## 2. R14-01 — Resposta de reenvio não conferida contra recurso/operação — corrigido localmente

**Reprodução:** `HelpdeskService.idempotent` conferia flags/hash, mas confiava no namespace e no objeto de resultado devolvidos pelo adaptador. Os comandos de mensagem/nota/alteração autorizavam o ticket atual antes do replay, sem conferir o corpo salvo. A criação consultava o ID salvo, mas não comparava todos os vínculos imutáveis do snapshot devolvido. Um adaptador deliberadamente incorreto nos testes conseguiu devolver corpo de outra conta ou campos incompatíveis.

Isso NÃO demonstra que o cliente podia escrever livremente no cache, nem que ocorreu vazamento remoto. O helper SQL existente já faz verificações próprias. A falha identificada é uma defesa ausente na fronteira de aplicação diante de erro/inconsistência de persistência.

**Implementado:**
- Conferência independente de workspace, principal, operação e chave, tipos de flags e formato de digest.
- Resultado bem-sucedido exige um formato fechado para a operação: ticket, mensagem pública ou nota interna.
- Ticket replay deve corresponder aos campos imutáveis do recurso atualmente autorizado, ao snapshot contratual e ao resultado pedido; versão futura ou status/prioridade incompatível são recusados.
- Mensagem/nota deve corresponder a workspace, conta, chamado, autoria e corpo original. Tipo histórico de autor humano é preservado quando o papel atual mudou.
- Campos desconhecidos, incluindo hints `available_actions`, não entram nos snapshots dos comandos.
- `503 invalid_idempotency_result` interrompe o reenvio sem executar a função de escrita ou devolver o conteúdo incompatível. Não remove/repara o cache nem gera uma nova chave.

**Preservações importantes:** a resposta histórica não é substituída pela situação atual; alteração posterior de prioridade/status/responsável não modifica o replay. Snapshots anteriores à coluna `assignedTo` continuam sem esse campo. Ordem de propriedades JSONB não causa conflito artificial. Contrato expirado depois da criação não exige recriar/resolver o contrato para reler uma operação já concluída; autorização atual continua obrigatória.

Campos atualmente imutáveis (assunto, descrição, contexto/contrato) participam da comparação. Se um futuro comando permitir editá-los, precisará versionar esse contrato de replay; não basta alterar o update. Esta validação não prova autenticidade criptográfica de todos os campos mutáveis antigos e não substitui controles de integridade do banco.

## 3. R14-02 — SQL malformado tratado como cache ausente — corrigido localmente

O adaptador usava truthiness e `.rows[0]?.record`. Zero linhas, campo ausente, `false`, string vazia e zero podiam virar `null`, permitindo seguir o caminho de primeira execução.

Agora, o SELECT escalar precisa retornar exatamente uma linha com `record`. Somente `record: null` significa ausência. O formato de sucesso e os sinais privados `denied`/`expired` são conferidos explicitamente, sem coagir strings para booleanos. O retorno legítimo da migration 008 continua aceito. Isso foi comprovado com respostas controladas do driver, não pela execução desse SELECT em PostgreSQL.

**Evidências:** 63 testes de envelope/resultados/SQL, com 54 falhas e nove passagens antes da correção, depois 63 passagens. Três testes por sockets comprovaram bloqueio do conteúdo incorreto, ausência de uma segunda gravação, erro seguro nos logs e preservação do resultado histórico válido. Eles estão incluídos na suite local, não são testes do Supabase.

## 4. R14-03 — Leitura de identidade sem orçamento de bytes — corrigido localmente

A autenticação no backend usava `Response.json()` diretamente no sucesso do provedor. Havia AbortSignal de cinco segundos na chamada HTTP, mas não um limite explícito dos bytes decodificados nem rejeição estrita de UTF-8 inválido dentro de metadados ignorados.

O leitor novo aceita até **64 KiB decodificados**, usa o mesmo sinal de prazo já criado para o fetch e verifica UTF-8 antes de JSON. Não compara Content-Length comprimido aos bytes descomprimidos. Limite excedido, corpo inválido, falha/aborto de stream geram `503 auth_unavailable` antes da resolução dos vínculos. A tentativa de cancelamento não espera indefinidamente por confirmação do stream.

Metadata do provedor continua sem definir papéis; o ID Auth continua traduzido para um principal interno distinto. Nenhum token/senha/metadata é registrado. Treze testes cobrem fronteira de bytes, streaming, UTF-8 dividido, compressão, aborto/cancelamento, exceção privada e não promoção de roles. A primeira bateria reproduziu quatro falhas em seis testes.

**Limite operacional:** 64 KiB é um orçamento de engenharia desta implementação, não um limite anunciado pelo Supabase. Usuários com metadata maior receberão indisponibilidade; esse caso precisa ser validado no piloto. Não foi alterada a configuração do provedor, MFA, chaves ou duração das sessões.

## 5. Lacunas que a revisão NÃO converteu em funcionalidades entregues

### R14-04 — Escopos humanos granulares: configuração pendente (P0 para perfil somente leitura)

Na migration 002, `resolve_human` devolve a mesma lista de cinco scopes para humanos vinculados. Na migration 003, `has_scope` também reconhece os cinco scopes para humanos ativos com membership/grant; as diferenças de acesso por conta/papel continuam sendo aplicadas separadamente. O modelo atual não contém uma configuração persistida para retirar individualmente `tickets:write` de um agente humano mantendo seu vínculo.

Logo, testes que removem scopes do principal sintético comprovam que a aplicação sabe recusá-los, **não que exista hoje uma tela/tabela que configure aquele principal no Supabase**. Não houve concessão nova nesta rodada, nem remoção da autorização por conta/recurso. Antes de anunciar agente humano somente leitura configurável, definir os grants granulares no M2 e alinhar resolver, helper, administração/auditoria e testes PostgreSQL.

### R14-05 — Nota com escrita sem leitura: replay SQL assimétrico (P0 antes de habilitar esse perfil)

A aplicação mantém `notes:write` separado de `notes:read`. Porém, `lookup_idempotency` da migration 008 exige `notes:read` para replay de notas, enquanto o comando de criação exige `notes:write`. O perfil humano de escrita-sem-leitura é atualmente sintético pela limitação anterior, mas a assimetria precisa ser resolvida explicitamente antes de habilitá-lo de verdade. Não foi alterada a migration para presumir qual política de retorno privado deve prevalecer.

### R14-06 — Garantia de evento/outbox varia por comando (P0 de persistência)

O serviço escreve operações + eventos + intenções dentro do mesmo UnitOfWork. O SQL possui trigger diferido explícito para a abertura; a prioridade exige evento/outbox correspondente; atribuição exige evento interno e proíbe sua notificação externa. Na cadeia atual não há obrigação diferida equivalente para toda atualização de estado ou inserção de mensagem. Não afirmar que qualquer SQL feito com o login restrito está universalmente impedido de omitir esses registros.

Não foi alegada falha transacional em um banco real. A próxima revisão SQL deve exercitar writes diretos controlados e rollback, definir a garantia exigida por cada operação e, se necessário, acrescentar uma migration de invariantes. Sem reescrever as oito antigas.

### Demais limites mantidos

JWT humano emitido pode continuar válido até expiração depois de logout; não há bloqueio instantâneo adicional. Hints do GET são consultivos, não autorização. Notas/eventos internos não se tornam públicos. Atribuição não concede acesso. Sem administração M2, intakes, clocks de SLA, participantes/filas completos, anexos, processor de outbox, e-mails/webhooks, conectores reais, load test ou restore.

## 6. Fronteiras revisadas e alcance

Inspecionamos os casos de uso, replay, políticas/workflow, serializers, contratos de persistência, autenticação/runtime/transações, cadeia de migrations e inventário da aplicação. Toda a suíte local foi repetida. Os testes de UI existentes foram tentados; o navegador bloqueou antes de asserções. O diretório de frontend foi inventariado, mas não é uma revisão visual/DOM linha a linha. Históricos e pesquisas foram preservados.

O registro de fontes e o inventário em `evidence/v014/` distinguem revisão focal de código, inspeção estrutural e execução. Não houve subagente/revisor independente.

## 7. Fontes externas consultadas nesta rodada

O desenho já exigia replay da resposta original e isolamento de cache. As fontes externas abaixo reforçam esses princípios; não comprovam nossas correções ou nosso SQL:

- OWASP, Multi-Tenant Security Cheat Sheet, seção Cache & Session Isolation: `https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html` — chave escopada não dispensa autorização do valor protegido.
- Stripe, Idempotent requests: `https://docs.stripe.com/api/idempotent_requests` — referência do princípio de retornar o resultado salvo para uma mesma chave; não adotamos automaticamente todos os detalhes da política Stripe.

Nenhum conteúdo de cliente foi enviado para consulta externa. Evidências funcionais vêm dos logs dos nossos testes, não das páginas de documentação.

## 8. Próxima execução com resultado verificável

1. Resolver lock real, instalação limpa e audit. Não usar tipos globais como prova de reprodutibilidade.
2. Executar as oito migrations e os 125 casos/upgrade em PostgreSQL 17 descartável, com o login normal. Não usar o projeto remoto como substituto do laboratório de teste.
3. Tratar R14-04/05/06 com decisão explícita e testes reais; registrar o que é contrato da aplicação e o que o banco impõe por si.
4. Homologar Auth/pooler/TLS/IP/Functions, frontend/35 checks browser, limites e comportamento com metadados humanos maiores.
5. Somente após critérios M1, iniciar configuração/administração M2. Relógios, entregas, anexos e dois consumidores reais mantêm suas próprias condições de aceite.

API/interface **0.14.0**, schema **0.9.0**, oito migrations, 23 tabelas candidatas, 18 operações/14 caminhos. Código local, sem publicação. M1 não encerrado.
