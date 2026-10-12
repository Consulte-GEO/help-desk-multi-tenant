# Acesso simples temporário — 12/10/2026

Pedido do usuário: acesso apenas com login e senha, preservando o restante desativado/comentado para reativação. Base `6f7bc832d504ec1285d6125b68ab83be70c1f57f`, branch `codex/acesso-simples-20261012`. Autorização anterior de commit, merge e publicação sem Claude permanece aplicável.

## Comportamento

A tela inicial apresenta e-mail, senha e Entrar. O UUID da operação não precisa ser informado: a sessão consulta os vínculos autorizados e adota automaticamente a operação quando existe apenas uma. Depois de autenticar, a tela oferece Sair. O gate de atendimento continua independente do login.

Workspace manual/seleção interativa, MFA, recuperação, gestão de autenticadores, troca de senha, consulta da segurança e encerramento global ficam desativados na interface. Grupos HTML estão `hidden` e `inert`, com comentários de preservação; bindings desses recursos dependem de `ADVANCED_ACCESS`. Em `web/access-mode.js` a opção está false, com a linha de ativação true comentada. Os módulos e implementações anteriores foram mantidos, sem exclusão. Não há parâmetro de URL ou localStorage que reative esses controles.

O modo `passwordOnly` da sessão não fica esperando campos ocultos: múltiplas operações ou MFA já confirmado dão erro claro, fecham a credencial do provedor e não instalam sessão Help Desk. A validação de identidade, vínculos, AAL/MFA do backend, memória privada, renovação e logout local continua. Não há usuário/senha fixos nem fallback demo em produção.

Consulta somente leitura ao projeto HelpDesk atual encontrou zero fatores MFA confirmados. Nenhum fator, segredo, configuração Auth, grant ou migration foi alterado. A conta continua usando o e-mail e a senha cadastrados no provedor; não foi executado login real com credenciais de uma pessoa nesta rodada.

## Verificação

Cinco testes de sessão: três regressões RED observadas antes da correção, conjunto GREEN5. Negativas cobrem override manual, ambiguidade e MFA sem campo interativo; positivas cobrem operação única e cleanup sem vínculo. Typecheck e 45 testes focais aprovados. O teste de build isolado revelou a ausência do asset novo na fixture; corrigida com RED→GREEN, preservando as asserções.

Browser atual: 13 checks com DOM real e provedor/API sintéticos, cobrindo dois campos, opções ocultas/inertes, login e logout, ausência de persistência de credenciais, mobile sem overflow, erro simples sem pedir workspace, ambiguidade, MFA, descarte de recovery por URL, envio concorrente único e ausência de vínculo. Screenshots desktop/mobile inspecionadas.

Os 49 checks avançados anteriores continuam exercitados em fixture que habilita explicitamente o modo avançado somente no teste. Não são apresentados como funcionalidades ativas da UI atual. A suíte corrente tem registro próprio no runner canônico, sem redução de mínimos ou remoção de testes. A extração da fixture revelou um import Python ausente, corrigido e revalidado.

Revisão independente somente leitura: sem bloqueadores residuais; encontrados e corrigidos fixture do build e feedback que ainda pedia workspace. API0.27.0, schema0.19.0, 12 migrations e 19 operações preservados. Lock/dependências mantidos, audit sem vulnerabilidades. CI integral e publicação serão registrados após verificação.

## Reativação e limites

Para reativar recursos, revisar os módulos e mudar a opção de código, executar novamente as suítes atuais e preservadas e gerar nova evidência de fonte. A seleção de operação e as exigências do provedor não devem ser ignoradas para contornar recusas.

O atendimento operacional, qualificação Novo GEO, curadoria, custódia, contratos/cadastros, capacidade/restore e aceites reais continuam com as pendências das entregas anteriores. Simplificação do login não abre o gate operacional.

## CI canônico aprovado

[CI38239727638/1](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38239727638):3741/3741aplicação,294/294PostgreSQL e152/152interface, zero falhas/skips/cancelamentos/TODO. Instalação limpa, audit, tipos, contratos, migrations, scanner e build aprovados. CI push38239721224 também aprovado; CodeQL passou.

Artefato11742112946,598772bytes, SHA25695910e65e009fcabc9e2fc40d3640ed65417a41bc90b2c07e32ead8d39b37830 conferido antes da extração. Fonte PRc717355ebe4d193fae058400b75dc4f6d22b2bd4, head048af122; fingerprint45358c9d710d9ce917a909f8e47ad3be0e35fbfa2a27256a59a2f4e8b5bf0985 igual ao checkout atual. Relatório e seis logs originais da execução94670989-f921-4d8c-993a-2c7e2bd20ea9 importados sem edição; check:homologation passou no checkout. [Recibo](../evidence/simple-access/ci-receipt.json), [checks da UI corrente](../evidence/simple-access/browser-simple-access.json) e screenshots desktop/mobile no mesmo diretório.
