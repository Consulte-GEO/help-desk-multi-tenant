# Validações

As validações são classificadas como **Erro**, **Alerta**, **Sugestão** ou **Pendência interna**. Erros bloqueiam envio/implantação. Alertas permitem seguir, mas pedem conferência. Sugestões melhoram qualidade do cadastro. Pendências internas ficam visíveis para a equipe Consulte GEO.

| Código | Nível | Regra | Mensagem |
|---|---|---|---|
| VAL-001 | Erro | Tipo de Estrutura obrigatório e dentro da lista permitida | Selecione Bloco, Torre, Contenção, Área Externa, Anexos ou Apoio. |
| VAL-002 | Erro | Número da Estrutura obrigatório para Bloco e Torre | Informe número, intervalo ou lista. |
| VAL-003 | Erro | Número da Estrutura deve ter intervalo válido | Use formatos como `1 A 4`, `1 e 2`, `1, 2, 3` ou `-`. |
| VAL-004 | Erro | Nomenclatura no Sistema obrigatória | Informe como a peça aparecerá no sistema. |
| VAL-005 | Erro | Nomenclatura no Sistema com máximo técnico de 50 caracteres | Reduza o texto para caber no campo técnico. |
| VAL-006 | Erro | Peça obrigatória | Informe a peça, pavimento ou local. |
| VAL-007 | Erro | Peça com máximo técnico de 100 caracteres | Reduza a descrição da peça. |
| VAL-008 | Erro | FCK obrigatório | Informe FCK em MPa. |
| VAL-009 | Erro | FCK deve ser numérico | Use apenas número, por exemplo `30`. |
| VAL-010 | Erro | FCK menor ou igual a zero | Informe valor positivo. |
| VAL-011 | Erro | FCK fora de faixa operacional | Confirme se o valor foi digitado corretamente. |
| VAL-012 | Erro | Projetista com máximo técnico de 50 caracteres | Abrevie ou cadastre nome padrão. |
| VAL-013 | Erro | Linha duplicada exata | Remova duplicidade ou ajuste a regra aplicada. |
| VAL-014 | Erro | JSON fora do schema | Corrija o payload antes de salvar. |
| VAL-015 | Erro | Tentativa de implantação com bloqueantes | Resolva erros antes de implantar. |
| VAL-016 | Erro | Estrutura gerada sem identificador temporário | Recalcule a normalização. |
| VAL-017 | Erro | Unidade gerada sem vínculo com estrutura | Recalcule a normalização. |
| VAL-018 | Erro | Unidade gerada sem vínculo com tipo técnico | Recalcule a normalização. |
| VAL-019 | Erro | Código da obra acima do limite técnico | Use até 10 caracteres. |
| VAL-020 | Erro | Nome da obra obrigatório | Informe a obra. |
| VAL-021 | Alerta | Volume por unidade em branco | O cadastro pode seguir, mas ficará como pendência interna. |
| VAL-022 | Alerta | Volume por unidade igual a zero | Confirme se a peça não exige volumetria. |
| VAL-023 | Alerta | Range com volume informado | Confirme que o volume é por unidade, não volume agregado. |
| VAL-024 | Alerta | Projetista não informado | O campo é livre, mas recomendado para rastreabilidade. |
| VAL-025 | Alerta | Estrutura única com número em branco | Use `-` para deixar explícito. |
| VAL-026 | Alerta | Área Externa com número preenchido | Normalmente é estrutura única; confirme. |
| VAL-027 | Alerta | Anexos com volume preenchido | Confirme se o volume é aplicável. |
| VAL-028 | Alerta | Regra Aplicada em branco | Explique o motivo do agrupamento. |
| VAL-029 | Alerta | Descrição completa acima de 200 caracteres após expansão | Revise nomenclatura para evitar truncamento. |
| VAL-030 | Alerta | Chave técnica acima de 30 caracteres após normalização | Backend fará abreviação controlada. |
| VAL-031 | Alerta | FCK divergente entre linhas de mesma nomenclatura | Confirme se são peças distintas. |
| VAL-032 | Alerta | Volume divergente entre linhas de mesma nomenclatura | Confirme se são tipos técnicos diferentes. |
| VAL-033 | Alerta | Etapa não encontrada no catálogo | Será feita resolução interna para classificação. |
| VAL-034 | Alerta | Tipo de estrutura Apoio sem regra aplicada | Informe o contexto do apoio. |
| VAL-035 | Sugestão | Estruturas com mesmo conjunto de peças | Agrupe para reduzir manutenção. |
| VAL-036 | Sugestão | Projetista escrito com variações | Confirme se as grafias representam a mesma pessoa ou empresa. |
| VAL-037 | Sugestão | Peça de área externa sem etapa | Sugerir Demais Estruturas. |
| VAL-038 | Sugestão | FCK com texto livre `FCK 30 MPa` | O sistema normalizará para `30`. |
| VAL-039 | Sugestão | Volume com vírgula decimal | O sistema normalizará para ponto decimal no JSON técnico. |
| VAL-040 | Sugestão | Intervalo descendente | O sistema ordenará automaticamente do menor para o maior. |
| VAL-041 | Sugestão | Lista longa de números | Avaliar se intervalo é mais legível. |
| VAL-042 | Sugestão | Peça com pavimentos agrupados | Confirmar volume por pavimento. |
| VAL-043 | Pendência interna | `Ges_MapaId` não definido | Selecionar ou criar mapa padrão antes de implantar grupos. |
| VAL-044 | Pendência interna | Traço não encontrado | Criar ou vincular `Utl_Produto` e `Con_Concreto`. |
| VAL-045 | Pendência interna | Classificação não resolvida | Mapear etapa para `Ges_Classificacao`. |
| VAL-046 | Pendência interna | Padrão de moldagem não definido | Criar `CTe_PadraoMoldagem` do traço. |
| VAL-047 | Pendência interna | Parâmetros de ensaio fresco não encontrados | Criar `CTe_TipoEnsaioProduto` quando necessário. |
| VAL-048 | Pendência interna | Projetista novo | Confirmar se deve criar `Pro_Projetista`. |
| VAL-049 | Pendência interna | Centro de custo não informado | Definir default da obra ou deixar nulo. |
| VAL-050 | Pendência interna | Forma obrigatória por cliente | Ajustar flag `FormaObrigatorio` no tipo técnico. |
