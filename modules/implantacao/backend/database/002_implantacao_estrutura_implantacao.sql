/*
  Pseudorroteiro transacional de implantação nas tabelas core.
  Este arquivo documenta a ordem de gravação. A lógica final deve ficar no service .NET com EF Core e transação.
*/

-- Ordem recomendada:
-- 1. Validar JSON técnico salvo em Ges_ImplantacaoEstruturaProposta.
-- 2. Resolver Ges_ObraId e Ges_MapaId.
-- 3. Upsert Pro_Projetista por Descricao (texto livre do usuário).
-- 4. Upsert Utl_Produto e Con_Concreto por FCK + especificação + aplicação.
-- 5. Criar CTe_PadraoMoldagem e CTe_TipoEnsaioProduto quando o traço novo exigir.
-- 6. Criar Ges_UnidadeTipo, usando QuantidadeProjeto para o volume por unidade.
-- 7. Criar Ges_UnidadeGrupo.
-- 8. Criar Ges_Unidade.
-- 9. Atualizar proposta para implantada e registrar auditoria.

BEGIN TRANSACTION;
-- Implementar em EF Core no serviço de domínio.
ROLLBACK TRANSACTION;
