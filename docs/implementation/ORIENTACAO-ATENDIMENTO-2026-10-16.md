# Resumo e próximo passo no atendimento — HD-019

## Escopo e decisões

Continuação autorizada dos itens prioritários após a publicação do PR64. Alteração delimitada na tela existente de detalhe: apresentar situação, responsabilidade relativa e próximo passo com os dados da última consulta autorizada. Não são novos estados, pendências cadastráveis, comandos, políticas ou autorização. Reaproveita o DTO, o validador de ações, o carregamento do detalhe e os fluxos atuais.

A equipe distingue Novo, Triagem, Em atendimento, Aguardando cliente/equipe/terceiro, Resolvido, Encerrado e Cancelado quando recebe `internal_status`. A responsabilidade é somente Você, Outro atendente ou Sem responsável; nenhum nome/UUID, diretório ou inferência de identidade. Se a projeção não informar responsabilidade reconhecida, a tela informa a ausência de informação.

O cliente recebe orientação pelos cinco estados públicos, sem criar no DOM a responsabilidade ou as distinções internas. O perfil geral de `/me` não substitui a projeção do chamado. Ações efetivas sem escrita produzem orientação de consulta. A apresentação exige ações do mesmo chamado e versão, validadas pelo módulo existente; pacotes inválidos ou ausentes não produzem resumo.

O texto é orientação da versão consultada, sem contagem de pendências, promessa de SLA, confirmação de aprovação, novo comando ou afirmação de que o checklist está concluído. Checklist/revisão continuam nas superfícies existentes. Nenhuma nova requisição, storage, preferência persistida ou consulta a notas é criada pelo resumo. Cada operação de atendimento mantém a revalidação no servidor.

## Integração e invalidação

`web/ticket-guidance.js` projeta dados e renderiza texto com APIs DOM. `web/app.js` monta o resumo somente após detalhe, ações e conversa pública serem aceitos. O início de uma nova leitura apaga o resumo; falha/recusa não reaproveita orientação antiga. Logout/troca de sessão também apagam. As proteções existentes de geração impedem resposta tardia de repovoar a tela. Envios incertos continuam sob controle dos módulos atuais, sem nova chave ou descarte de rascunho.

O build copia o módulo pela whitelist existente; a demonstração local o serve pelo mapa explícito de assets. A suíte de build verifica os bytes copiados e a exclusão de fontes privadas. CSS usa os tokens atuais, com disposição de uma coluna em celular e herança dos temas claro/escuro.

## Verificação e limites

Cinco cenários de domínio novos, usando respostas reais do handler em memória: todas as situações, audiência pública/interna, responsabilidade relativa, ações ausentes/obsoletas/inválidas, consulta e ausência de mutação. Os testes foram executados primeiro com projeção vazia: cinco falhas esperadas; após implementação, cinco aprovações. Conjunto focal com ações e build:36/36 aprovado.

Navegador com shell real e Auth/API sintéticos: oito verificações, desktop/celular390px, distinção interna, remoção ao atualizar, detalhe público apesar de perfil de operador, consulta,403, logout e resposta tardia. Capturas em `evidence/ticket-guidance-20261016`, explicitamente sintéticas; não são aceite humano hospedado. A primeira tentativa revelou o novo asset ausente do mapa da demonstração, corrigido sem alterar CSP/controles. Compilador TypeScript direto aprovado. Build/gates/CI completos e revisão independente ainda em andamento neste checkpoint inicial.

## Continuidade

HD-019 permanece parcial. Busca de protocolo, totais antes da paginação e consultas rápidas já publicados; este recorte acrescenta orientação no detalhe. Busca no conteúdo de conversa exige contrato e audiência próprios. Pendências editáveis, exibição nominal de responsáveis, SLA corrente e automações não estão incluídos. HD-002 ainda precisa conformidade de outros grupos de rotas/requisições/headers.

HD-011 exige versão explícita e equivalência DSL/publicador/SQL/UI; não apertar a validação dos formulários publicados. Políticas de SLA/autoridade ainda exigem definição. MFA e Novo GEO seguem adiados, scanner cancelado, modelos técnicos homologados ausentes. Nenhuma migration, grant, segredo, ativação ou escrita produtiva faz parte deste recorte. Novo PR para revisão; publicação posterior depende da decisão sobre essa entrega.
