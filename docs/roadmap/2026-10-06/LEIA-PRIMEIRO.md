> **HD-P06 — 08/10/2026:** conclusão de recuperação por link direto revisada e aprovada em CI; API/interface0.24.0/schema0.19.0. Contexto privado só de senha, MFA preservado, sem workspace/scopes; nenhum e-mail/callback/PKCE nesta fatia. [Entrega e limites](../../129-HD-P06-CONCLUIR-RECUPERACAO-POR-LINK.md). CI1644/229/115 aprovado; Important corrigido e minor de texto registrado. Merge/publicação pendentes; atendimento fechado.

> **HD-P06 — 07/10/2026:** outro TOTP da própria conta integrado/publicado pelo PR17; API/interface0.23.0/schema0.19.0. Exige catálogo vivo verificado/AAL2, retoma pendente ou cria com nome distinto; preserva fatores confirmados e não amplia scopes. [Entrega e limites](../../128-HD-P06-OUTRO-AUTENTICADOR-TOTP.md). CI1629/229/112 aprovado e revisão sem Critical/Important; minor de texto registrado. Mergedf3d2b9 e produção6ac6f2d7 verificados. Atendimento fechado; recuperação/remoção/QR/admin MFA e aceite real pendentes.

> **HD-P06 — 07/10/2026:** consulta da segurança da própria conta integrada/publicada pelo PR16; API/interface0.22.1/schema0.19.0. Catálogo vivo limitado, fatores confirmados/pendentes e AAL consultivo; dados privados descartados e resposta tardia isolada. Nenhuma gestão/remoção de fatores ou ampliação de scopes. [Entrega e limites](../../127-HD-P06-CONSULTA-DA-SEGURANCA.md). Revisão corrigida com10 testes; CI1619/229/109 aprovado. Merge4c663a2 e produção6ac6b8ee verificados. Atendimento fechado; gestão de fatores/recovery/admin obrigatório e aceite real pendentes.

> **HD-P06 — 07/10/2026:** primeiro TOTP opcional da própria conta integrado/publicado pelo PR15; API0.22.0/schema0.19.0. Chave manual, catálogo vivo e confirmação, pendente retomado sem criar outro, sem remoção/reset de fatores. Segredo retirado do DOM ao encerrar e nova entrada após confirmação. [Entrega e limites](../../126-HD-P06-PRIMEIRO-AUTENTICADOR-TOTP.md).9 novos/27 focais/106 interface aprovados; revisão sem achados. Atendimento fechado; fatores adicionais/recovery/QR/admin obrigatório e aceite real pendentes. CI1609/229/106 aprovado; merge912bea2 e produção6ac6ad5e verificados.

> **HD-P06 — 07/10/2026:** login TOTP existente e guard MFA integrados/publicados pelo PR14; API0.21.0/schema0.19.0. Auth valida bearer exato antes de exigir AAL2 para fatores verificados e antes dos vínculos; grants/scopes vivos preservados. Login espera código antes de workspace, cleanup privado e resposta antiga protegidos. [Entrega e limites](../../125-HD-P06-LOGIN-TOTP-E-VALIDACAO-DE-MFA.md).73 focais/103 interface aprovados; enrollment/recovery/MFA administrativo obrigatório e aceite real pendentes. Atendimento fechado; CI1600/229/103 aprovado; merge24559ce e produção6ac6991e verificados.

> **HD-P06 — 07/10/2026:** código adicional para troca de senha integrado/publicado pelo PR13; API0.20.4/schema0.19.0. Solicitação explícita ao próprio canal cadastrado e nonce opcional, sem reenvio automático ou configuração alterada. Corrigida corrida de despacho concorrente com código/senha;67 focais e99 interface aprovados. [Entrega e limites](../../124-HD-P06-CODIGO-PARA-TROCA-DE-SENHA.md). Atendimento fechado; SMTP/MFA/recuperação e M1 operacional pendentes. CI1565/229/99 aprovado; merge1c04c76 e produção6ac68492 verificados.

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
