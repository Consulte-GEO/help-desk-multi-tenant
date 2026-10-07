> **HD-P06 — 07/10/2026:** troca da própria senha integrada/publicada pelo PR12; API0.20.3/schema0.19.0. Payload Auth restrito, campos limpos no envio, requisição única e nova entrada após resultado; respeita recusas MFA/autenticação recente sem alterar configuração. [Entrega e limites](../../123-HD-P06-TROCA-DE-SENHA-AUTENTICADA.md). Atendimento fechado; senha/MFA/SMTP reais, recuperação completa e M1 operacional pendentes. CI1554/229/96 aprovado; merge33c2f86 e produção6ac67460 verificados.

> **HD-P06 — 07/10/2026:** encerramento global das próprias sessões integrado/publicado pelo PR11; API0.20.2/schema0.19.0. Confirmação explícita, limpeza local imediata, novo login bloqueado enquanto o pedido aguarda resultado; logout local continua padrão. [Entrega e limites](../../122-HD-P06-ENCERRAMENTO-GLOBAL-DE-SESSOES.md). Atendimento fechado; aceite Auth entre dispositivos, MFA/recuperação/administração e M1 operacional permanecem pendentes. CI1544/229/92 aprovado; merge e6ed434 e produção6ac66dae verificados.

> Continuidade executada em06/10: [HD-P01](../../114-HD-P01-ESTADO-POS-R24.md), [HD-P02](../../115-HD-P02-RECUPERACAO-DA-ABERTURA.md) e continuidade HD-P03 com [destino de produção](../../116-HD-P03-VALIDACAO-EM-PRODUCAO.md) e [diagnóstico privado de runtime](../../117-HD-P03-DIAGNOSTICO-NO-RUNTIME.md). P01/02 integrados; aceite operacional M1 ainda pendente. O levantamento abaixo permanece fotografia inicial.

> 07/10: PR5/6 integradas/publicadas; CI1458/215/79 aprovado. Dez checks readonly passaram no servidor real, incluindo conexão/TLS/papel restrito e segurança do banco. Auth/M2M e percurso de atendimento continuam pendentes; seguir doc117, sem repetir instalação/diagnóstico já comprovados.

> 07/10: [bootstrap privado inicial](../../118-HD-P03-PRIMEIRO-ADMINISTRADOR.md) aplicado ao usuário escolhido; role admin e dois escopos de leitura preservados, replay sem efeito adicional. PR7 integrado/publicado; CI1482/223/79 aprovado. Não repetir a promoção inicial nem declarar backoffice/M1 completos. Continuar pelos cadastros reais e Auth/M2M.

# Help Desk — levantamento e plano de continuidade

> 07/10: [troca segura de workspace](../../121-HD-P05-TROCA-SEGURA-DE-WORKSPACE.md), PR10 integrado/publicado; API0.20.1, CI1536/229/89. Nova autenticação obrigatória, cancelamento preserva rascunho e confirmação limpa contexto; corrigida retenção de motivo/textos antigos. Banco/escopos intactos, atendimento fechado e aceite operacional pendente.

> 07/10: [descoberta/seleção no login](../../120-HD-P05-DESCOBERTA-DE-WORKSPACES.md), PR9 integrado/publicado, CI1536/229/85. UUID opcional, escolha explícita entre vínculos ativos, revalidação emme;012 aplicada preservando escopos/admin e dados existentes. API0.20/schema0.19. Login humano real/M2M e atendimento seguem pendentes; não repetir bootstrap.

> 07/10: [login antes da liberação](../../119-HD-P03-LOGIN-ANTES-DO-ATENDIMENTO.md), PR8 integrado/publicado, CI1510/223/81 aprovado. Login/configuração disponíveis com atendimento bloqueado; verificações HTTP reais aprovadas. Login humano real, M2M e primeiro serviço ainda pendentes. Não repetir bootstrap nem criar clientes/contratos/SLA fictícios.

**Data:** 06/10/2026. **Repositório exclusivo do núcleo:** [Consulte-GEO/help-desk-multi-tenant](https://github.com/Consulte-GEO/help-desk-multi-tenant). Este pacote trata do Help Desk independente; o plano do Financeiro permanece separado.

## Conclusão

O Help Desk tem um núcleo significativo já implementado: autenticação/adaptadores, contexto de atendimento, abertura de ticket, conversa pública, notas internas, estados, prioridade, assumir/liberar responsabilidade, busca, paginação, controle de concorrência, idempotência e outbox transacional. Não é necessário reconstruir essa fundação.

O R24 está integrado e o CI do código atual passou. Entretanto, **M1 operacional continua aberto**: a publicação atual responde `503 release_gate_closed`, e os testes hospedados com Auth, Function, banco e identidades reais ainda precisam de aceite. Depois disso, faltam principalmente administração, equipes/participantes, dispatcher/entregas, SLA/roteamento, anexos seguros e dois conectores reais. Conhecimento, canais adicionais e IA entram após a operação humana funcional.

## Como usar

1. [Diagnóstico, evidências e requisitos](DIAGNOSTICO-E-REQUISITOS.md): fotografia atual e lacunas.
2. [Matriz de capacidades](CAPACIDADES-ATUAIS.csv): cada capacidade, código existente, trabalho restante e entrega responsável.
3. [Tickets históricos](TICKETS-HISTORICOS.csv): os 38 IDs HD-101 a HD-605 preservados e relacionados ao plano atual.
4. [Reaproveitamento e fronteiras](REAPROVEITAMENTO.md): o que manter e onde estender, sem misturar Help Desk e Financeiro.
5. [Plano detalhado](../../superpowers/plans/2026-10-06-helpdesk.md): entregas HD-P01 a HD-P33, dependências, interfaces, arquivos e testes.
6. [Roteiro para o Codex](ROTEIRO-CODEX.md): prompt da próxima sessão e padrão de encerramento.
7. [Cobertura](COBERTURA.md): contagens e limites, sem percentual artificial de conclusão.

Os IDs de capacidade `HD-Cxxx` foram criados **neste levantamento**. Não são uma numeração histórica recuperada. Os tickets `HD-xxx`, em contrapartida, vêm de `docs/02-PLANO-DE-DESENVOLVIMENTO.md`. Os CSVs usam UTF-8 com BOM e separador ponto e vírgula.

## Próximo incremento recomendado

Atualizar o estado pós-merge e confirmar por teste uma possível falha na retomada da abertura de ticket após resposta perdida. Em seguida, executar a validação M1 diretamente em produção, no site e na base HelpDesk existentes, conforme [decisão HD-P03](../../116-HD-P03-VALIDACAO-EM-PRODUCAO.md). Não criar mais ferramentas genéricas de gate como substituto de executar os clientes existentes. Administração M2 vem com seu próprio fluxo de usuário, persistência, autorização e teste, sem considerar que tabelas já existentes constituem backoffice.

Esta rodada inspecionou código, histórico, CI e metadados de infraestrutura e produziu documentação. Não criou usuários, tickets, infraestrutura, segredos, grants ou mensagens, nem abriu o gate publicado.
