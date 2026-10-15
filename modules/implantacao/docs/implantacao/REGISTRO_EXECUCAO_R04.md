# Registro de execução R04 — plano PLANO_IMPLANTACAO_REVISAO_R03_2026-10-14.md

## Recorte autorizado e base
Continuidade do IMP-02b/D/E: recuperação de recibo depois de reload e ligação de apresentação ao controlador. Fonte: cumulativo R03 validado e leitura remota de main dcf5607652281bb688f366e6a4f05e07eb698d31. Workspace isolado de pacote, não clone completo. Nenhuma autorização para publicar ou alterar dados remotos.

## Pre-flight / decisões
- Serviço R02 guarda recibo por ator/caso/operação. HTTP/cliente R03 só recuperam repetindo POST com o conteúdo em memória. A nova consulta GET usará o mesmo repositório e autorização vigente, sem novo schema.
- Ruling: priorizar consulta autorizada do recibo e marcador opaco por aba — a política bloqueia a navegação HTTP de Chromium, a rede não resolve GitHub/npm e PG17/pg não estão instalados. Não contornar política, instalar silenciosamente ou trocar banco real por mock na evidência.
- Ruling: marcador contém apenas IDs de escopo, versão, identificação da operação e hash do pedido, nunca snapshot, nome de arquivo, senha ou bearer. sessionStorage não é autorização nem backup de edição. Sem recibo, ausência NÃO comprova rollback; recuperação fica pendente, sem POST automático ou UUID novo.
- Ruling: configuração de recuperação exige identidade fornecida pelo host autenticado. Vinculação local é só prevenção de mistura na UI; o serviço reautoriza toda leitura. Logout/troca de escopo limpam o contexto.
- Compatibilidade: serviço/repositório/DDL atuais preservados. Opção de recuperação é explícita; controlador antigo sem journal preserva contrato em memória. Runtime permanece fechado.
- Testes de pacote devem rodar na raiz codigo, com normalizationService original disponível e TS local ou global identificado. As primeiras falhas foram montagem incompleta/cwd, não regressões: logs preservados. Reexecução correta: 123/123 integridade e 166/166 processos.
- Chromium R03 foi tentado uma vez: ERR_BLOCKED_BY_ADMINISTRATOR antes de assertions; não foi contornado. Não equivale a teste de navegador aprovado.

## Tarefas desta rodada
- [x] T1: consulta de recibo no serviço e HTTP + validação do cliente (RED → GREEN).
- [x] T2: marcador mínimo de recuperação e controlador seguro após reload (RED → GREEN).
- [x] T3: binding para Vuex e modelo de apresentação/guardas, sem credenciais em estado (RED → GREEN).
- [x] T4: regressão cumulativa, revisão pelo autor, empacotamento R04 e plano atualizado.

## Evidências e revisão
T1: 18 testes RED (funções ausentes/rota não resolvida) → 18 GREEN; regressão de processos 184/184 naquele ponto.
T2: 32 testes RED → 32 GREEN para journal/recuperação; integração preserva R03.
T3: 15 testes RED → 15 GREEN para binding/projeção; lifecycle acrescentou quatro cenários.
T4: 367/367 Node, 21/21 SimilaritySelfTest, 10/10 Chromium offline; typechecks strict aprovados TS5.8.3. PostgreSQL blocked/exit2 zero queries; Chromium HTTP blocked por política.

Final review: self-review (no subagent tool). Template auxiliar code-reviewer.md não ficou disponível; revisão executada por critérios de integridade, autorização, perda de resposta, lifecycle, isolamento e regressão. Não é revisão independente.
Final: corrigido teardown que apagava marcador e binding obsoleto que limpava montagem nova — testes de lifecycle falharam antes da correção; detach/dispose preservam localizador, endSession/clearSession limpam explicitamente. Regressores passaram.
Final: corrigido teste do qualificador dependente de cwd — reproduzido fora da raiz; runner agora é resolvido por import.meta.url. Subprocesso de teste exige stdout TAP e teste count, sem herdar NODE_TEST_CONTEXT. Não houve redução de gates.
Final: Ruling: não montar interface de produção, não gerar outra fonte de permissões nem substituir PostgreSQL por emulação — os três exigem qualificação e portas existentes. Custo: ainda não operacional; explicitado no plano e handoff.
Final: minor (deferred): refinamento visual dos rótulos e mensagem orientada ao suporte para marcador malformado; erro bloqueia, não libera escrita.

Verificação de cópia limpa (raiz frontend como npm): 127/127 + 240/240, typechecks 0; 33 scripts com node --check aprovado. O pacote não inclui o normalizationService original em codigo: a montagem de teste usa a cópia de baseline e o aplicador apenas verifica seu blob no checkout.
