# Help Desk — roteiro para continuar pelo Codex

**Destino exclusivo do núcleo:** https://github.com/Consulte-GEO/help-desk-multi-tenant. A pasta local atual contém também outros materiais; confirmar o remoto dentro de `helpdesk/` antes de qualquer alteração. O Financeiro possui plano e repositório próprios.

## Prompt pronto para a próxima sessão

Copie o bloco abaixo para uma sessão vinculada ao repositório Help Desk. Ele pede a primeira entrega, sem tentar executar 33 entregas num único turno.

```text
Continue o desenvolvimento do Help Desk exclusivamente em
https://github.com/Consulte-GEO/help-desk-multi-tenant.

Leia AGENTS.md, README.md, PROJECT_HELP_DESK.md,
docs/01-ARQUITETURA.md, docs/02-PLANO-DE-DESENVOLVIMENTO.md,
docs/04-ESTADO-E-EVIDENCIAS.md, docs/05-HANDOFF-REVISAO.md,
docs/06-M1-SEGURANCA-E-LIMITES.md e docs/113-M1-R24-REVISAO-E-ESTADO.md.
Depois leia docs/roadmap/2026-10-06/LEIA-PRIMEIRO.md,
DIAGNOSTICO-E-REQUISITOS.md, REAPROVEITAMENTO.md e os dois CSVs
na mesma pasta, além de docs/superpowers/plans/2026-10-06-helpdesk.md.

Execute HD-P01: reconcilie o estado pós-R24, confira as evidências
atuais e atualize apenas as referências correntes, preservando o histórico.
Base da auditoria: b4dd00040605bd11f22d97636b5a973075e7cef2.
Reconsulte a branch padrão e mudanças concorrentes. Na auditoria ela
era codex/m1-reproducibilidade; o remoto github apontava ao GitHub,
enquanto origin era um bundle local. Não presuma origin/main.
Use branch codex/ e preserve alterações de outras sessões.

Não reimporte R23/R24. Não refaça busca, paginação, prioridade ou
assumir/liberar, já implementados. M1 operacional ainda estava aberto:
CI verde com 1436 aplicação, 215 PostgreSQL e 71 interface agregados;
platform_approved false; Netlify respondia 503 release_gate_closed.
Verifique se esses fatos continuam atuais antes de repeti-los.

Preserve notas privadas, acesso por workspace/conta, cinco scopes de
atendimento, identidade restrita de banco, idempotência/snapshots,
If-Match, atomicidade de eventos/outbox e precisão de microssegundos.
Não altere migrations aplicadas nem fabrique aprovação de homologação.

Conclua a entrega com os checks previstos, diff revisado, documentação
de progresso e commit da fatia. Informe evidências e limitações reais.
Não inicie HD-P02 automaticamente nesta sessão documental. Indique o
próximo comando de continuidade e eventuais dependências concretas.
```

O prompt delimita a sessão documental. Quando pedir uma implementação, troque o parágrafo “Execute HD-P01” pela HD-P escolhida e seu resultado. A autorização explícita do usuário na sessão continua prevalecendo; este plano não revoga autorizações anteriores nem concede por si só efeitos externos novos.

## Prompt do primeiro incremento de código

Depois de HD-P01, use:

```text
Execute HD-P02 do plano docs/superpowers/plans/2026-10-06-helpdesk.md
no repositório Consulte-GEO/help-desk-multi-tenant, seguindo AGENTS.md.

Confirme com regressão de navegador o achado estático da abertura:
após POST /tickets confirmado e resposta perdida, o reenvio na UI
refaz /contexts/resolve antes do replay. Cobertura vencida pode bloquear
recuperação e mudança de ambígua para única pode alterar coverage_id
sob a mesma chave. Preserve a intenção completa antes do despacho.

Primeiro reproduza a falha, depois corrija a menor composição necessária.
Se a hipótese não se confirmar, registre o comportamento e a evidência,
sem fabricar um bug. Não mude as regras de elegibilidade ou autorização.
Valide: mesma chave/payload devolve ticket original, sem novo evento ou
outbox; revogação continua negando acesso; nova intenção é explícita;
mudança de identidade limpa o estado. Execute os testes focais e as
validações indicadas no plano. Não amplie para M2 nesta entrega.

Entregue alteração revisada, evidências do commit, estado atualizado
da matriz e próximo passo HD-P03. Siga a autorização vigente da sessão
para commit/merge/publicação e confira os destinos antes de agir.
```

## Sequência de acompanhamento

| Sessão/fatia | Resultado revisável |
|---|---|
| HD-P01 | Estado corrente reconciliado, links de evidência e próximos gates reais |
| HD-P02 | Regressão/fix de retomada de abertura, sem alteração arbitrária de contrato |
| HD-P03 | Clientes hosted read/Auth/write executados no mesmo site/base HelpDesk com dados de teste identificáveis |
| HD-P04 | Capacidade/restore mínimos, runbook e aceite M1 |
| HD-P05/06 | Primeira administração com acesso, MFA e recuperação; fatias pequenas |
| HD-P07–11 | Conta → catálogo → contrato/cobertura → pessoa/conexão configurados por UI |
| HD-P12–18 | Operação e entrega externa confiável |
| HD-P19–27 | SLA/roteamento, anexos e dois conectores reais |
| HD-P28–30 | Relatórios, testes transversais e piloto completo |
| HD-P31–33 | Evolução priorizada após atendimento humano funcional |

## O que exigir no encerramento de cada entrega

- ID e escopo implementado; o que mudou para o usuário e arquivos principais.
- Evidência por camada: teste focal, CI/SQL/navegador, hosted e operação, cada um com resultado próprio.
- Commit, PR/merge quando realizado, destino/deploy quando realizado; não tratar código publicado como atendimento liberado.
- Matriz atualizada sem apagar a fotografia inicial; acrescentar data/commit e pendência residual.
- Falhas reais, dependências e próxima fatia. Não marcar “concluído” por existir código ainda não exercitado.

Revisões de Claude não são um requisito deste roteiro. A revisão pode ser feita no Codex; não substituir os testes e aceites por opinião de um modelo.

## Quando faltarem decisões

Antes de perguntar, concluir a parte independente e preparar opções concretas. Decisões de SLA, retenção, volumes, regiões, provedor, origens de embed e segundo produto devem ser tomadas quando sua entrega depender delas. Não inventar contrato comercial, destinatário, credencial ou identificadores reais para desbloquear um teste. Falha de infraestrutura deve ser relatada como tal, sem remover verificações do produto.
