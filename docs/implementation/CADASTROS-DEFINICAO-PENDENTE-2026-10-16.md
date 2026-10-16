# Cadastros — base existente e definição técnica pendente

O usuário confirmou em16/10/2026 que não existem documentos/modelos técnicos homologados para completar os formulários. Este documento registra a coleta atual e as decisões restantes; não aprova campos, normas, faixas ou execução GEO. HD-011–016 continuam abertos no levantamento.

Fonte implementada: `src/application/consultegeo-registration-operation.ts`, função `createRegistrationConfiguration`, base `f13754e`. Inclusão oferece oito categorias condicionais; descrição é comum. As outras quatro ações do conjunto são alteração, desativação, reenvio de acesso e liberação em obra, voltadas a usuário. Não são oito CRUDs completos.

| Cadastro | Obrigatório atualmente na inclusão | Opcional atualmente | Definição necessária para ampliar |
|---|---|---|---|
| Usuário | Nome, e-mail, perfil/permissões solicitadas | Telefone | Alçada, perfis permitidos, beneficiário e alcance por obra; dado declarado não concede acesso |
| Traço | Concreto/graute, FCK, brita, slump, tolerância, usina/fornecedor | Código do traço na usina | Especialista define materiais/aplicação, unidades, compatibilidades e dados técnicos adicionais; não presumir regra de argamassa/flow |
| Usina | Nome | CNPJ, endereço | Entidade central versus vínculo com obra, contatos e efeitos de alteração/inativação |
| Laboratório | Nome | CNPJ, contato | Responsável, contato por finalidade, vínculo e modo de operação por obra |
| Bloco | Identificação/modelo, fornecedor, resistência | — | Tipo de material, dimensões/classes/padrões e versão do modelo que o negócio realmente utiliza |
| Cerâmica | Identificação/modelo, fornecedor | Dimensões | Unidade/estrutura de dimensões, aplicação e demais propriedades confirmadas |
| Cabos | Identificação/modelo, fornecedor, diâmetro | — | Material/aplicação, unidade, propriedades e padrões realmente exigidos |
| Fornecedor | Nome/razão social, CNPJ ou CPF declarado | Contato | Pessoa física/jurídica, identificação normalizada, relação central/obra e contatos por finalidade |

Obrigatoriedade atual é uma fotografia do código, não homologação de engenharia. Contato livre pode conter telefone/nome/e-mail; não convertê-lo inteiro em campo de e-mail obrigatório. “E-mail ou identificação do usuário”, nas ações não inclusivas, também não é exclusivamente endereço eletrônico.

## Separação para a implementação seguinte

1. **Validação sintática independente de modelo técnico (HD-011):** e-mail quando o campo é expressamente e-mail; documento com tipo declarado CPF/CNPJ e DV; números/unidades quando houver representação aprovada. Reutilizar o motor e a validação CNPJ existente, inclusive seu suporte atual. Não validar identidade/alçada com base no formato do dado.
2. **Contrato ponta a ponta:** DSL, registry/publicador, validador PostgreSQL, rascunho/intake/revisão e UI precisam aceitar a mesma nova versão. A versão publicada atual continua texto; não aplicar silenciosamente regras novas aos seus snapshots. A evolução do contrato requer os testes SQL/upgrade correspondentes, não só troca visual de input.
3. **Normalização:** preservar entrada original e valor normalizado no mecanismo versionado apropriado; explicar unidades e erro por campo. Não usar arredondamento ou conversão implícita para “corrigir” valor técnico. Erro não elimina rascunho nem muda a intenção de envio.
4. **Regra técnica (HD-013–015):** responsável do domínio define campos, nomes/unidades, opcionalidade, combinações, exemplos válidos/inválidos e fonte/versão. Sem essa definição, os campos atuais permanecem e a equipe faz conferência manual.
5. **Alteração/vínculo (HD-016):** identificar entidade atual e abrangência antes/depois. Alteração central, vínculo por obra e inativação são efeitos distintos, com alçada e evidência próprias.

## Ficha mínima para homologar cada material

- Responsável técnico e data/versão da definição.
- Entidade, finalidade e aplicação; campos existentes que permanecem.
- Campo, unidade, formato, obrigatoriedade e condições de exibição.
- Faixas/combinações somente quando confirmadas, com origem da regra.
- Pelo menos um exemplo completo, um incompleto e um incompatível, com resultado esperado.
- Efeito da inclusão/alteração/vínculo e evidência de conferência na origem.
- Visibilidade pública/interna e conta/obras afetadas.

Esta ficha é um roteiro de definição, sem prazo ou obrigação de inventar modelo novo. Pode ser preenchida por material em lotes, sem aguardar Novo GEO. Nenhuma API, catálogo vivo ou execução automática GEO foi habilitada; MFA e scanner mantêm as decisões anteriores.
