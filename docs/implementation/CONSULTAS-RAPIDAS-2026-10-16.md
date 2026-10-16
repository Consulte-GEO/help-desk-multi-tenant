# Consultas rápidas da fila — HD019

Continuidade autorizada após o merge/publicação do PR62. Recorte da fila existente; não cria novas categorias, autoridade, relatórios ou visões persistentes.

## Desenho

Botões Todos, Aguardando resposta e Resolvidos para quem tem leitura. Meus atendimentos e Sem responsável somente para operador humano, conforme a identidade já carregada. Estes botões preenchem os filtros públicos atuais e passam pelo mesmo envio/validação da lista; o servidor continua decidindo o acesso por conta/obra. Meus atendimentos significa responsabilidade atribuída ao usuário, não chamados abertos por ele.

Cada consulta define situação e responsabilidade e preserva busca/prioridade digitadas. Todos remove somente situação/responsabilidade. Textos auxiliares tornam esse comportamento explícito. Filtros inválidos não apagam a consulta anterior. O destaque usa os filtros efetivamente aplicados, não campos ainda não enviados; combinação diferente aparece como Personalizada. Sem persistência, compartilhamento de URLs com termos de busca ou ampliação de scopes.

Os totais completos entregues no PR62 continuam sendo consultados junto da primeira página. Carregar mais preserva os totais. Estado de carregamento/erro, respostas antigas, troca de sessão e navegação mobile continuam sob os controladores existentes. Botões acessíveis com `aria-pressed`, teclado nativo, foco conservado após atualização e disposição que quebra linhas em telas pequenas.

## Limites e decisão de sequência

A análise de HD020 encontrou o motor SLA determinístico existente e snapshots de abertura/revisão. Porém o leitor de agregado completo disponível (`hdnr_aggregate`) está acoplado a perfis/políticas de revisão, e a projeção exige histórico completo equivalente à versão corrente, inclusive comandos legados. Não apresentar snapshot antigo como relógio atual nem reutilizar revisão/aprovação como atalho de leitura. HD010/020 permanecem separados para reconciliação de fonte/política e composição própria; não se alteraram prazos, calendário ou regras de reabertura nesta etapa.

MFA/Novo GEO continuam adiados; scanner cancelado; nenhum modelo técnico homologado disponível. Nenhuma migration, grant, segredo, dependência ou infraestrutura adicional nesta entrega.

## Execução e verificação

- [x] Testes negativos dos presets, identidade, preservação de filtros e destaque aplicado.
- [x] Integração na fila/formulário existente e inclusão no grafo de assets.
- [x] Navegador real com API/Auth sintéticos: lista+totais, validação, teclado/foco, mobile, troca para solicitante e logout.
- [ ] Gates locais, revisão independente e CI completo; PR separado para revisão. Merge/publicação dessa nova etapa não são presumidos pela autorização específica do PR62.

## Progresso observado

5 testes dos presets executados vermelhos antes do código;33 verificações focais atuais aprovadas. Navegador local real com API/Auth sintéticos alcançou8 asserções aprovadas: lista/totais, preservação de busca/prioridade, teclado/foco, consulta personalizada, validação, bloqueio durante leitura,390px e sessões. O caso de botão destacado após login de novo operador foi observado vermelho (alterava assignment para mine) e corrigido exigindo pertencimento ao grupo DOM atual; verde após a correção. O helper Windows não confirmou encerramento com código0 no último ciclo; por isso a execução local inteira não está declarada aprovada e a prova completa permanece no gate Linux. Capturas sintéticas desktop/mobile em `evidence/ticket-views-20261016/`.

Typecheck, contratos45 operações, lock, segredos heurísticos,21 migrations e build passaram. Execução ampla Windows:5860 testes,5722 aprovados/138 falhas do ambiente; a comparação com a baseline não encontrou novos nomes de falha e a qualificação integral virá do CI Linux, sem remover testes. Não é aceite hospedado humano.

## PR62 publicado nesta rodada

Merge `40f8f0db4fad736bbaf280f27b797fd93a3ffac2`; deploy production `6ad23faaa12159f25057e22a` READY em2026-10-16T15:16:58.173Z (12h16 Brasília).118 entradas do manifesto conferidas por HTTPS/SHA1; nova capacidade/configuração ticket_totals ativa e consultas anônimas401. Fontes/migrations404, worker nativo403. Sem migration/escrita de negócio. Prova em `evidence/totais-fila-20261016/production/publication.json`; aceite humano permanece distinto.
