# Revisão do Apoio Implantação — 15/10/2026

Revisão sobre o estado publicado por PR57/PR58 e checkpoint `54991ca`. Escopo: corrigir os fluxos existentes de suporte/administradores, preservando o atendimento e as integrações já ativadas.

## Correções confirmadas

- O leitor de JSON podia aguardar indefinidamente um corpo incompleto. Agora reutiliza o leitor controlado do Help Desk: cancelamento, prazo de cinco segundos, UTF-8 e limites existentes; nenhuma transação ou chamada de IA começa enquanto a leitura não termina.
- Ao cancelar a troca de conta, o seletor nativo mostrava a conta recusada. O valor visual é restaurado antes da confirmação, acompanhando o escopo efetivo; a troca confirmada continua remontando o módulo e descartando dados anteriores.
- Alternar processos enquanto o histórico anterior carregava podia deixar o novo histórico vazio. Cada escolha invalida a geração anterior e permite carregar imediatamente o processo escolhido.
- Uma falha ao listar registros na aba E-mails impedia nova tentativa. “Atualizar situação” recarrega registros e situação, preserva a seleção válida e descarta respostas de ciclos anteriores.

## Verificação local

Os quatro defeitos foram reproduzidos antes das correções. Após os ajustes:

- 57 testes focais de backend, corpo de requisição, sessão e e-mails aprovados; os dois novos testes verificam cancelamento e prazo real, sem trabalho no armazenamento/provedor.
- 30 verificações Chromium aprovadas, incluindo troca de histórico com resposta atrasada, recuperação da lista de e-mails e troca de conta cancelada/confirmada; nenhum erro de console.
- 13 testes do frontend aprovados; typecheck, build completo, contratos, verificação de segredos e sentinelas das 21 migrations aprovados.
- Revisão independente do diff e do addon SQL concluída, sem defeitos confirmados pendentes.

A suíte Linux completa e a publicação serão registradas após conclusão. Os cenários do navegador usam API local controlada; não equivalem a uma sessão humana autenticada em produção. Nenhum e-mail fictício ou registro de negócio foi criado em produção. Nenhuma alteração de SQL, credenciais ou infraestrutura paga nesta revisão. Scanner permanece cancelado; Novo GEO permanece preparado, aguardando contrato/API.
