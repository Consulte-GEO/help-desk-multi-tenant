# Revisão independente M09a

Uma revisão fresh-context, read-only, pela skill executing-plans/requesting-code-review. Base f3cb786fd522fce436f1f4ad2e06844db4902b4e; fonte revisada378dca23ba82b6682cdb11048bd8b2788423561f. Revisor gpt-6-astra; não alterou index/HEAD/checkout nem criou agentes. Executou46focais e reproduziu três achados em stdin.

Critical0; Important3; Minor0. O executor confirmou todos pelo efeito e fez um único fix pass, sem segunda revisão.

| Achado | Reprodução | Correção |
|---|---|---|
| Recusa de uma conciliação apagava uma intenção anterior desconhecida | unknown→editing depois de429/release fechado; key/payload perdidos | Durante conciliação, rejected conserva unknown e a mesma intenção. Só confirmação correlacionada encerra a ambiguidade. A recusa inicial continua editável. Dois negativos de criação/salvamento RED→GREEN. |
| Caminhos duplicavam `/v1` ao compor a sessão | adapter com createSessionFetch real despachava `/v1/v1/form-drafts/...` | Closure recebe paths relativos ao prefixo existente. Teste compõe save/preview/create com createSessionFetch e verifica autorização e três caminhos exatos. Browser agora também usa essa closure, com sessão sintética. RED→GREEN. |
| Lookup tardio voltava após ocultar/reexibir campo | condição true→false→true, retorno antigo repunha seleção descartada | Rebuild do formulário invalida geração e cancela consultas pendentes; escolhas antigas não são adotadas. Casos lookup e file RED→GREEN. |

Fix pass focal:73/73, zero falhas/skips/cancel/todo; Chromium14/14 desktop/mobile. A suíte integral da fonte corrigida é registrada na homologação, não inferida desses testes. Logs vermelhos em `regressions/`; nenhum resultado da origem ou provedor real foi simulado como homologação.

## Comportamentos considerados fora do recorte pelo revisor

Origem/identidade reais e aceite M08; catálogo autorizado/stores/mapping de profiles/montagem M09b; operação real Storage/scanner/e-mail. O executor mantém os três adiamentos porque dependem de contratos de origem/instalação operacional ainda não qualificados. Custo: componentes prontos não são uma jornada hospedada disponível, upload ativo ou entrega de e-mail. Capabilities/gates atuais não são ampliados.

Decisões adicionais: avançar M09a independente enquanto M08 é qualificação documental; custo é a dependência explícita para montagem live. Helpers shell da skill foram adaptados ao ledger Windows após MSYS recusar inicialização no sandbox; comandos e resultados foram registrados diretamente, com verificação Linux/Node22/PG17 integral como autoridade de homologação.
