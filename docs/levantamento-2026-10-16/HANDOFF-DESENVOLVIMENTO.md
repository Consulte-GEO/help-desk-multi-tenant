# Contexto para a próxima pessoa desenvolver — inclusive em Claude

## Ponto de partida

O Help Desk Consulte GEO já atende em produção. Não é projeto inicial. A auditoria de 16/10/2026 usa Help Desk `f13754e`, com PR60 integrado, e Wiki irmã `72f4e60`, v1.7. Repositório: [Consulte-GEO/help-desk-multi-tenant](https://github.com/Consulte-GEO/help-desk-multi-tenant). Branch remota principal deste projeto: `codex/m1-reproducibilidade`; verificar o remoto antes de trabalhar, sem presumir `main`. No checkout auditado, `github` aponta ao GitHub e `origin` é bundle/local histórico. Não enviar para `origin` por hábito.

O pacote é um levantamento, sem implementação. Comece por [LEIA-PRIMEIRO](LEIA-PRIMEIRO.md), escolha recorte do [BACKLOG](BACKLOG-ATUALIZADO.md) e confirme seu estado no SHA que receber. Não usar o backlog de 15/10 isoladamente: persistência HDA, monitor de e-mail, Wiki e Apoio evoluíram depois dele.

## O que existe e deve ser reaproveitado

| Frente | Base existente | Limite que permanece |
|---|---|---|
| Atendimento | Catálogo, draft, prévia, abertura atômica/protocolo/snapshot, conversa pública/notas, fila/timeline, workflow/checklist | Formulários especializados, SLA corrente, cockpit completo, anexos e backoffice |
| Cadastros | Oito inclusões e cinco ações de usuário | Não são oito CRUDs; execução GEO atual é manual e modelos ainda mínimos |
| Identidade | Supabase Auth, sessão por pessoa, contexto/ACL, MFA e rotas sensíveis guardadas | Acesso avançado oculto no modo simples; ativação sensível MFA adiada |
| E-mail chamado | Ledger/outbox/worker Resend, webhook verificado, monitor V2 com máscara no servidor, cobertura e sinais independentes | Aceite complementar; monitor não autoriza editar template/reenviar/inbound/preferência individual |
| Apoio Implantação | Mesmo shell/sessão; cadastro/planilhas/laudos/revisão/ajuda/e-mails e stores privados; importação por overlay preservando originais | Aceite produtivo, IA real, vínculo processo↔ticket CG e jornada pública |
| Wiki | Leitor autenticado, contribuição/aprovação, busca, mídia, avaliação/pedidos, aviso editorial | Aceite completo, conteúdo factual e lote cliente aprovados; store/composição knowledge no HelpDesk |
| HDA | Persistência oficial, leitura e worker manual_review ativos | Intake+tarefa, histórico/edição, Dev Agent isolado, aprovação e execução ainda recortes futuros |
| Serviços candidatos | Portal/report/export, CSAT, members/config admin, knowledge/macros, anexos | Arquivo/teste/factory não prova store durável, montagem de runtime ou operação hospedada |

O core está em schema0.27/21 migrations; API/interface0.31.0 é outro versionamento. Addons privados Apoio/Wiki têm seus próprios contratos, não alterar contagem de migrations do core para acomodá-los. Gate base `email:false` ou `sla_clocks:false` deve ser lido junto da composição Consulte GEO; não usar a flag base para concluir ausência do monitor V2.

## Leitura antes de alterar código

Na raiz do repositório, ler `AGENTS.md`, `README.md`, `docs/01-ARQUITETURA.md`, `docs/02-PLANO-DE-DESENVOLVIMENTO.md`, `docs/04-ESTADO-E-EVIDENCIAS.md`, `docs/06-M1-SEGURANCA-E-LIMITES.md` e o checkpoint mais recente do recorte. Os checkpoints datados mais novos prevalecem sobre frases antigas. Atualizar a síntese corrente sem apagar histórico.

Localização neste computador: `C:\Users\thiag\OneDrive\Documentos\ChatGPT\Help Desk\helpdesk`. Wiki irmã: `C:\Users\thiag\OneDrive\Documentos\ChatGPT\Help Desk\wiki-consultegeo`. Estes caminhos não são pré-requisito para a conta Claude: clonar os repositórios autorizados e adaptar raízes, mantendo refs/versões e referências de fonte. Os documentos históricos ainda não rastreados precisam acompanhar a entrega se o colega receber só o Git; verificar presença de `docs/handoff-2026-10-15/`, `docs/decisoes-e-emails-geolab-2026-10-15/` e `docs/melhorias-para-aprovacao-2026-10-15/`.

Para entregar um pacote autossuficiente, anexar esta pasta com o ZIP de contexto gerado ao fim do levantamento. Não exportar `.env`, cookies, tokens, dumps produtivos ou conversas brutas. O ZIP é documentação; código atual deve vir do repositório no SHA informado.

## Ordem de execução de cada recorte

1. Confirmar HEAD, status/alterações de terceiros e remote/branch. Preservar arquivos não rastreados existentes. Buscar implementação, montagem, testes e recibos antes de escrever código.
2. Escolher um ID e critério observável. Se envolve política de negócio, resolver a regra específica com responsável; não inventar alçada, norma de ensaio, promessa de prazo ou endpoint GEO.
3. Reaproveitar motores e contratos existentes. Evoluir publicador/servidor e UI em conjunto; um novo tipo de campo só no browser pode ser recusado pelo compilador/SQL.
4. Manter operações atômicas, CAS/versão e idempotência. Efeito externo tem intenção/recibo/estado desconhecido e reconciliação; nunca novo ID para repetir silenciosamente o mesmo efeito.
5. Testar riscos alterados no ambiente pertinente: ACL/negativas e revogação, ACK perdido/replay, persistência real quando houver store, jornada UI e build. Seguir scripts/gates do repositório; `npm ci` preserva lock. Não declarar que as 7.158 verificações históricas passaram no seu novo SHA sem executá-las nele.
6. Revisar, corrigir achados, atualizar documentação e evidência com SHA/limites. Separar pronto no código, CI aprovado, merge, deploy, migration, configuração e aceite humano.

## Cuidados que evitam problemas

- **Autoridade:** conta/obra sempre explícitas; mesmo domínio ou grupo não é grant global. Revalidar antes de listar, contar, gerar snippet, abrir arquivo, exportar ou enviar.
- **Público:** notas internas, diagnósticos, conteúdo editorial privado e dados de outra obra não entram na UI/DOM/e-mail/export público. Autorização deve ocorrer no servidor, antes de LIMIT/agregação, e no download.
- **Migrations:** preservar aplicadas e fingerprints; evolução por append conforme processo. Não reaplicar migration19/20/21, addon Apoio, bootstrap admin, vínculo Claude ou contador de protocolo por leitura de documento antigo.
- **Incerteza:** timeout/ACK perdido não prova ausência de COMMIT/envio; manter intenção/payload e consultar recibo. Não repetir mensagem, executar GEO novamente ou baixar guardas para “destravar”.
- **E-mail:** não confundir enfileirado, aceito pelo provedor, entregue, aberto e clicado. Abertura é sinal aproximado; clique não é aceite/ciência. N/D histórico não vira zero; cobertura não retroage. Manter tracking compartilhado.
- **Apoio:** originais PDF/XLSX em memória são limitação explícita, não storage persistido. Ajuda privada `stored_uninspected` não é arquivo clean. Protocolo IMP não é automaticamente protocolo CG. Não editar importados para perder rastreabilidade; usar overlay adotado pelo módulo.
- **Conhecimento:** proposta e conteúdo publicado são estados distintos. Texto Wiki exige aprovação Thiago; mídia usa capacidade própria e acesso Wiki, não só domínio. Não liberar todo corpus para clientes; quarentena/hash/audiência continuam valendo.
- **IA:** saída é proposta revisável, não dado técnico validado. Bridge CLI não é sandbox. Sem execução automática, credencial ampla ou inferência paga sem política/limites autorizados.
- **Operação:** banco, objetos e ledger precisam de restore conjunto; restaurar outbox sem reconciliar pode repetir e-mails. Pool1 por Function não limita concorrência agregada.

## O que não fazer nesta continuidade

Não reativar scanner cancelado; não pedir staging hospedado; não ativar Novo GEO, SSO, MFA sensível, assistente cliente, legadoV2 ou serviço pago por inferência. Não criar dado/chamado/usuário fictício em produção, extrair sessão nem expor segredo para ultrapassar controle do navegador. Não enfraquecer teste/gate/ACL, remover skips por maquiagem ou usar timeout maior como prova de correção. Não transformar todo AUX/MEL em escopo aprovado. Não refazer importador, Wiki, monitor, motor SLA ou armazenamento HDA entregues.

## Prompt inicial sugerido para a conta Claude

> Leia AGENTS.md e docs/levantamento-2026-10-16/LEIA-PRIMEIRO.md. O HelpDesk auditado está em f13754e, Wiki irmã72f4e60; confirme o SHA recebido e os checkpoints posteriores. Reconcile o ID que eu indicar com código montado e evidências. Não implemente o backlog inteiro. Informe o que já existe, o trabalho residual, dependências e critério de conclusão. Preserve scanner cancelado, MFA/NovoGEO/revisão factual adiados e legadoV2 futuro. Use os serviços atuais, mantenha ACL por conta/obra, CAS/idempotência e incerteza de efeitos. Código/teste/publicação/aceite são estados separados. Para o ID escolhido, execute o recorte autorizado, verifique-o e produza evidência sanitizada e documentação atualizada, sem inventar integração ou repetir efeito produtivo.

Os adiamentos são decisões do usuário, não bloqueios técnicos a remover. Critérios específicos e dependências estão no backlog; a conta Claude deve receber somente os acessos necessários ao recorte, pelo mecanismo seguro do serviço, sem compartilhar senhas ou sessões no pacote.
