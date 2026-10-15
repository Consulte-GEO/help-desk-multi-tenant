# Plano atualizado — E03 / HD-DA-CADASTROS

**14/10/2026 · Versão 2.0+E03.** Principal observada `d5610aca8b4a5ca65567c0c92b2c7a1df5aa6da4`. O escopo original e os 81 aceites de negócio foram preservados.

| Pacote | Estado após E03 |
|---|---|
| HDA-00 | Qualificação parcial; fonte/IdP e instalação do Claude pendentes |
| HDA-01 | Contratos implementados/testados no subconjunto; integração/.NET pendentes |
| HDA-02 | Persistência parcial; ACK/replay reforçados, candidato SQL revisado, prova PostgreSQL e promoção pendentes |
| HDA-03 | Não iniciada; abertura + intenção + tarefa atômicas dependem da prova HDA-02 |
| HDA-04 | Não iniciada; conector Claude, entrega autorizada e supervisão do processo |
| HDA-05 | Contrato candidato de prévia preservado; fonte real não qualificada |
| HDA-06 | Revisão visual de rascunho não implementada |
| HDA-07 | Aprovação de execução não implementada |
| HDA-08 | Escrita idempotente no Novo GEO não implementada |
| HDA-09 | Callback/conciliação da origem não implementados |
| HDA-10 | Resultado HDA/notificação não compostos; preservar worker de email existente |
| HDA-11 | Piloto não iniciado |
| HDA-12 | Usuário novo + IdP não iniciados |
| HDA-13 | Expansão por cadastro não iniciada |

## Próximo incremento: concluir a prova da HDA-02

1. Integrar o overlay na árvore atual e rodar os gates completos com dependências pinadas.
2. Executar o runner nativo E03 e os 12 novos negativos com PG17 descartável. Investigar toda falha; inspeções estáticas não são prova semântica.
3. Executar compatibilidade/upgrade sobre as migrations reais, com papéis e catálogos atuais, fora da produção. Conferir o lock de human_scope_versions, o desenho atual do conector e revisões de acesso.
4. Definir e testar publicação qualificada dos bindings/configuração, limite de fila, retenção e leitura de tarefas por reserva vigente; não usar grants sintéticos como autoridade real.
5. Com essas provas, gerar migration aditiva pelo procedimento oficial e atualizar inventários/manifest/readiness. Este pacote não inclui essa promoção.
6. Só então conectar a abertura na HDA-03. Preservar as separações rascunho do formulário / rascunho de execução / aprovação / execução / notificação.

## Restrições de continuidade

Nenhum banco remoto ou ferramenta paga deve ser criado como substituto automático do cluster local. Não desabilitar a autenticação, a validação de versão, os gates ou o isolamento para obter um teste verde. Sem CLI/API real, não declarar que um cadastro foi criado. Cada etapa continua distinguindo implementação, teste local, SQL, navegador, publicação, homologação e operação.

Entrega E03: 275 testes Node locais, incluindo 48 novos; SQL não executado, 81 aceites de negócio ainda pendentes. O cronograma não foi estimado nem alterado por contagem de testes.
