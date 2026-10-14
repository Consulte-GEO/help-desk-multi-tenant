# Auditoria de compatibilidade — UX10

## Conclusão executiva

O cumulativo UX09 não deveria ser aplicado indiscriminadamente sobre a frente operacional. Seu build não carregava os assets M04/M09 e seus componentes compartilhados tinham contratos diferentes dos introduzidos na operação. O UX10 une essas mudanças e adapta as duas telas nativas novas, sem substituir o backend.

A aplicação guardada exige a revisão operacional compatível. Não usar o UX09 antigo para contornar uma recusa deste pacote. A base inicial `604478e` sozinha não satisfaz os requisitos atuais.

## Bases examinadas e evolução durante a sessão

| Evidência | Constatação |
|---|---|
| Branch base | `codex/m1-reproducibilidade` em `604478e2d05ed019baac6d92a9a04db236fafb82` |
| Referência inicial operacional | `1c6aa7ef94ccf1ae41179ae07d09ade2de96329e`, PR31 aberto/em rascunho; 33 commits à frente, 232 arquivos na metadata consultada inicialmente |
| Fonte operacional qualificada | `b4a6c9012463d3709e51a9b17efe68997a7b2d7a`, mais um commit durante a sessão |
| Árvores comparadas | `web`, `shared` e `scripts` têm os mesmos hashes entre 1c6aa7e e b4a6c90; a atualização não mudou os arquivos de frontend compatibilizados |
| Versões efetivas do código | API 0.29.0, schema 0.22.0, manifesto com 15 migrations; não usar o resumo histórico M09a como versão corrente |
| CI inicial | Run 262 / 38489679760: aplicação 4487/4487, PostgreSQL 394/403, interface 206/206; conclusão failure |
| CI final da outra frente | Run 264 / 38493924090, head b4a6c90: completed/success, finalizada em 13/10/2026 às 22:13:08 (São Paulo) |
| Limite da CI observada | O sucesso pertence à fonte operacional anterior à aplicação do UX10, não ao código compatibilizado nesta entrega |

A nova revisão corrige o vínculo da retomada de rascunho à observação corrente e a coerção de seletores, segundo o commit e o diff examinados. Não reproduzi essa correção SQL, não apliquei migrations e não atribuo sua autoria ao trabalho visual. O novo hash da migration M09b foi preservado como requisito somente leitura.

## Última conferência antes de empacotar

O PR31 avançou para `ca40dfcef5a372e40f5cc1c58053c68d06b77b50`, commit documental “Record Consulte GEO M09b qualification and delivery”. Continua aberto/em rascunho, sem merge. Na última consulta constavam 35 commits e 269 arquivos; essas contagens não significam que cada arquivo foi auditado nesta sessão. As árvores de código `web`, `shared`, `scripts`, `src`, `supabase` e `tests` permaneceram iguais a b4a6c90.

O novo documento `docs/144-CONSULTEGEO-CATALOGO-E-RASCUNHOS-M09B-2026-10-13.md` registra a qualificação canônica M09b: 4.487 aplicação + 403 PostgreSQL17 + 206 interface = 5.096 testes, na fonte b4a6c90, CI original38493917973. Essas contagens são atribuição ao relatório upstream, não uma execução desta entrega. A metadata da CI264 também foi consultada e está verde. O pacote preserva esse trabalho; nenhuma evidência canônica é substituída por testes visuais locais.

## Mapa das colisões e decisões

### Renderer de formulários

A operação introduziu `canEdit`, `onChange(answers)` e invalidação das respostas tardias ao reconstruir campos. A visual introduziu `onAnswersChange`, foco, erros, contadores, seleção Sim/Não e experiência de linhas. Escolher qualquer uma das versões inteiras descartaria a outra evolução.

Foi feito o merge sem alterar o parser compartilhado. O renderer notifica ambos os contratos uma vez por alteração, entrega snapshot imutável ao callback operacional, recusa edição programática bloqueada e descarta seleções iniciadas antes de uma troca de geração. Ocultar e exibir novamente o campo não torna válida uma resposta anterior.

### Painel de abertura

O estado de conciliação M09a foi preservado: uma recusa a um replay não demonstra que o primeiro pedido não gravou. A intenção permanece desconhecida; não há nova chave, novo corpo ou liberação para outro pedido. A primeira recusa autoritativa ainda pode retornar para edição, conforme o comportamento original.

As fases do painel voltaram a chegar à jornada externa. Com isso, o seletor de ação bloqueia imediatamente durante salvamento, prévia, envio e incerteza. O teste que usa somente o painel isolado não era suficiente para detectar esse conflito.

Nos tipos havia uma sobreposição real: o mesmo nome `onChange` significava respostas do renderer e snapshot do intake na interseção das opções. A assinatura do mount exclui o primeiro callback da interseção, mantendo o segundo com `IntakeUiSnapshot`. O erro de compilação foi reproduzido e corrigido sem desligar `strict`.

### Timeline, build e identificação de versão

A timeline operacional passou a reconhecer `transfer`. O pacote guarda seu hash novo e não regrava o arquivo. O teste mantém a transferência privada e o título humano correto.

O build incorpora cinco assets `web/consultegeo-*` e o parser `shared/consultegeo-request.js`, além de todos os assets visuais. Não há inclusão de fixtures no `dist`. Duas etiquetas fixas 0.27.0 foram retiradas do HTML, evitando comunicar uma versão de API desatualizada; a interface não inventa um valor novo no lugar.

## Etapa nova desenvolvida

`consultegeo-request.js/.css` apresenta o formulário da ação publicada no tema Consulte GEO, preserva as classes do host e coloca a confirmação de descarte junto ao seletor. O adaptador local é preparado antes de descartar o formulário anterior. Falha de configuração local preserva a ação e os dados anteriores.

`consultegeo-configuration.js/.css` organiza definição, prévia, diferenças e revisão da operação. O resumo apresenta ação, versão e motivo. Rótulos possuem cores corretas no modo escuro; cancelar é uma ação secundária. Resultado incerto seguido de recusa continua incerto e reutiliza a intenção original.

Essas telas são opcionais e não foram montadas automaticamente no `app.js`. O editor continua técnico (JSON); não foi criado um segundo motor de formulários nem alterada a política de publicação de configurações.

## O que a inspeção não prova

A metadata do PR não é uma auditoria linha a linha de todos os seus 232 arquivos. A revisão minuciosa desta sessão foi dos pontos de contato visual/operacional, dos contratos e da composição de frontend. A CI de upstream foi consultada; o backend completo não foi executado localmente nesta cópia.

O clone Git falhou por DNS neste ambiente. A bancada usa uma árvore seletiva de fontes verificadas. As requisições do novo teste passam pelos adaptadores reais de sessão e de intake, mas terminam em respostas fictícias. Não há prova de banco, autorização HTTP, scanner, provedor de identidade ou envio de e-mail real nessa bancada.

## Fontes verificáveis

Repositório: `Consulte-GEO/help-desk-multi-tenant`. PR31. Commits e hashes constam no manifesto. Conferir especialmente `docs/143-CONSULTEGEO-FORMULARIOS-M09A-2026-10-13.md`, `docs/superpowers/plans/2026-10-13-consultegeo-m09b.md`, `src/version.ts`, `supabase/migrations.manifest.json`, `web/dynamic-form*`, `web/support-intake*`, `web/consultegeo-request*`, `web/consultegeo-configuration*`, `web/consultegeo-intake-api.js`, `shared/consultegeo-request*` e `scripts/build.mjs`.

CI atual observada: https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38493924090 . O JSON `evidence/upstream-ci-summary.json` distingue as duas revisões.
