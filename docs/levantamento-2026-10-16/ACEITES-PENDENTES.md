# Aceites e qualificações ainda pendentes

Corte: 16/10/2026. Esta é uma vista das pendências do backlog, não uma lista adicional para somar aos 50 itens. Código preparado, testes locais, CI, publicação e jornada humana hospedada são evidências diferentes. Falha da ferramenta de controle do navegador não demonstra falha do produto.

## AC-EMAIL — Monitor de notificações de chamados (HD-004)

**Já comprovado:** PR52/migration21 publicados; coleta nativa de abertura/clique aplicada pelo ID exato; cobertura registrada após a prova; sessão Administrador, histórico real, quatro indicadores, N/D histórico correto, detalhe/tentativa, Fila vazia, Escape/retorno de foco e duas capturas desktop.

**Falta verificar na interface autenticada:**

- Busca por protocolo, período, destinatário, tipo, conta/obra e estados disponíveis; combinar e limpar filtros, conferir paginação, resultado vazio e erro distinguíveis.
- Falhas/atenção sem fabricar falha de envio ou registro em produção para preencher a tela. Se não houver caso real, declarar essa limitação e manter evidência controlada separada.
- Caminho completo por Tab, abertura/fechamento/detalhe e retorno do foco.
- Tela e modais em 360px, rolagem, acesso ao fechamento e ausência de perda de conteúdo; registrar screenshot produtivo. Os testes mobile do CI não substituem essa captura.
- Envio novo com snapshot real de destinatário: endereço completo para administrador e máscara para equipe, sempre dentro das contas/obras permitidas. Não mudar papel de pessoa real só para comparar.

**Conclusão:** matriz marcada com observado/pendente/não aplicável e evidência por caso. Não somar fatos projetados e recibos nativos como tentativas extras. Identificar a origem das linhas da timeline é possível refinamento visual, não um defeito comprovado ou nova aprovação de escopo.

Cobertura continua `2026-10-15T19:57:29.552038Z`; histórico sem evidência permanece indisponível. Probe técnico não é leitura humana nem ciência. Não repetir migration ou envio já comprovados.

Fonte: [aceite autenticado](../implementation/EMAIL-MONITOR-V2-ACEITE-AUTENTICADO-2026-10-16.md), [produção](../implementation/EMAIL-MONITOR-V2-PRODUCTION-2026-10-15.md) e [matriz](../implementation/EMAIL-MONITOR-V2-MATRIZ-ACEITE.md).

## AC-APOIO — Jornada produtiva completa e e-mail próprio (HD-033)

**Já entregue:** Apoio interno no mesmo Help Desk, exclusivo suporte/admin; cadastro, modelos, importação/conversão/auditoria, laudos, revisão/aprovação/devolução/correção/reenvios, ajuda e fila de e-mail. PR60 publicado com correções UI e evidências de CI/qualificação completa em fixture.

**Falta comprovar com sessão legítima e dados autorizados:**

- Percorrer cadastro, salvar, reabrir dados revisados, exportar, enviar para revisão, aprovar/devolver/corrigir e dois reenvios sucessivos.
- Pré-analisar e converter planilha, conferir proposta/correção, salvar processo, auditoria e relatório.
- PDF textual e laudo corrigido: salvar, sair/retomar e confirmar valor revisado; persistência hospedada e outro dispositivo autorizado.
- Revisão, autoria de nota/análise, contagens e atualização de telas após retorno/reenvio.
- Imagem privada e link de ajuda, incluindo recusa por conta sem acesso e após revogação.
- Operação legítima que gere e-mail próprio para o destinatário já autorizado, `thiago@consultegeo.com.br`: uma intenção/uma tentativa quando cabível, mesmo ID no provedor, entrega/recebimento e estado correto na aba. Link exige acesso vivo. Cron204 idle não prova entrega dessa fila.

**Não foi realizado envio real de teste nessa rodada anterior.** Não usar callbacks de chamados CG como prova da fila IMP. Não refazer addon/infra nem exigir configuração antiga do Setup independente.

Fontes: [PR60 e limites](../apoio-implantacao-fluxos-ui-2026-10-16.md), [e-mails publicados](../apoio-implantacao-emails-publicacao-2026-10-15.md).

## AC-IA-APOIO — Inferência/OCR externo real (recorte HD-033)

Código de IA/OCR, consentimento, servidor e quotas específicos já existem. Não há prova de ausência de chave nem motivo para solicitar credenciais no chat. A fixture de PDF textual e fetch sintético não prova inferência externa.

Falta qualificar corpus representativo autorizado, consentimento, limites/custo, cancelamento, precisão/erros, revisão humana e exportação. Valores desconhecidos não viram dados técnicos confirmados; preservar original e correção. Novo GEO permanece sem execução. Critério: relatório com fonte/modelo, amostra, resultados/limites e revisão humana, sem apresentar extração como laudo homologado.

## AC-WIKI — Jornada autenticada e aviso editorial (frente Wiki / HD-031–032 relacionados)

Wiki v1.7 está publicada, incluindo 30 ajustes WUX. Busca, contribuição, avaliação, pedidos e mídia não estão ausentes. A sessão de 16/10 abriu o hub de mídia; demais jornadas produtivas permaneceram parciais.

Falta upload/ampliação de imagem, MP4/WebM, YouTube e consentimento, associação a documento/seção, leitura por outra pessoa autorizada e fluxo proposta→aprovação Thiago→leitor. Texto tem aprovação exclusiva; mídia direta usa capacidades específicas. Não converter conta corporativa sem acesso em usuário autorizado da Wiki.

O aviso de contribuição foi aceito pelo Resend; ainda falta confirmar entrega/caixa/leitura quando houver evidência. Não reenviar só para fabricar recibo. Esse aviso usa ledger próprio e não deve aparecer automaticamente no monitor V1 de chamados.

Observação sobre espaçamento do hub exige reprodução; não é bug confirmado. Referências: [auditoria Wiki](AUDITORIA-WIKI.md), `wiki-consultegeo/docs/evolucao/REVISAO-INTEGRACAO-V17-2026-10-15.md` e `Entregas/Wiki_Teste_Visual_2026-10-16/RESULTADO_PARCIAL.md`, na pasta do projeto.

## AC-ONDA2 — Ciclos de atendimento/notificação (HD-003)

Faltam solução, encerramento, reabertura e cancelamento reais, com checklist/formulário, eventos/recibos, audiência e caixa. O retorno do cliente PR49 já foi corrigido. Não reabrir CG-10001 nem repetir abertura/bootstrap/migration19 para obter novas provas. Usar somente ações e chamado que sejam legítimos no teste autorizado.

Revisão/aprovação e avisos21–24 são outra qualificação, condicionada a MFA/política/roster (HD-007/008), não incluída por inferência nesse aceite.

## AC-AUTH — Recuperação e logout global (HD-005/006)

Recuperação/senha/logout global têm código preservado, oculto por `ADVANCED_ACCESS=false`. Decidir exposição antes de homologar jornada pela UI simples. MFA inicial tem liberação própria, não é equivalente à liberação de todo acesso avançado.

Faltam troca integral de senha/retorno, entregabilidade Auth e cenários negativos; logout exige os dois casos combinados especificados no doc122, além do aceite entre dispositivos. Não desligar click tracking compartilhado, extrair sessão, inventar fator ou prometer revogação instantânea de bearer ainda válido.

## AC-OPERACAO — Restore e capacidade (HD-045/046)

Falta ensaio de restauração completo e reproduzível com core atual/addons, objetos e ledgers; RPO/RTO definidos e medidos; workers reconciliados sem e-mail repetido. Falta carga multi-instância hospedada/SLO/custo com fronteira e amostra explícitas, responsáveis/runbooks e exercício de contenção/retomada.

Reutilizar bancadas descartáveis e runners existentes. Produção é o único ambiente hospedado permitido; o levantamento não executa nem autoriza carga destrutiva, recuperação produtiva, criação de registros fictícios ou novos serviços pagos.

## Regra para fechar qualquer aceite

Registrar SHA/fonte, contexto/ator autorizado, cenário e resultado, IDs de recibo necessários, evidência sanitizada e limitações. Só marcar aprovado o observado. Se surgir defeito reproduzível, abrir recorte de correção com teste pertinente; não transformar falha do navegador em mudança de banco/segredo. Nenhum item deste documento foi executado novamente durante o levantamento.
