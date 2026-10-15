# Guia de implementação

## Frontend

1. Adicionar rota para `ImplantacaoEstruturaView.vue`.
2. Integrar autenticação e permissões já existentes do `ControleTecnologicoFront`.
3. Usar Vuex para manter rascunho, JSON técnico e status de validação.
4. Chamar `implantacaoEstruturaService` para salvar, validar, enviar e baixar exportações.
5. Manter os rótulos de cliente sem expor nomes internos do banco.

## Backend

1. Registrar service e repository no DI por namespace, mantendo o padrão do projeto.
2. Adicionar DbSet para `GesImplantacaoEstruturaProposta` e `GesImplantacaoEstruturaAuditoria`.
3. Aplicar DDL ou criar migration EF equivalente.
4. Implementar `ImplantarAsync` com transação EF Core.
5. Registrar auditoria em toda mutação.
6. Gerar Excel a partir do JSON salvo, nunca a partir de estado recalculado no frontend.

## Ordem transacional de implantação

1. Validar JSON e bloquear se houver `validation.bloqueantes`.
2. Resolver `Ges_ObraId` e `Ges_MapaId`.
3. Upsert de `Pro_Projetista` por `Descricao` quando houver texto.
4. Resolver/criar produtos e traços em `Utl_Produto` e `Con_Concreto`.
5. Criar parâmetros de ensaio em `CTe_PadraoMoldagem` e `CTe_TipoEnsaioProduto` quando aplicável.
6. Criar `Ges_UnidadeTipo`.
7. Criar `Ges_UnidadeGrupo`.
8. Criar `Ges_Unidade`.
9. Marcar proposta como implantada.
10. Registrar evento de auditoria.

## Regras de segurança

- Apenas usuários autenticados e autorizados podem acessar endpoints.
- Cliente pode criar e editar rascunho até envio.
- Equipe interna pode devolver, validar e implantar.
- Implantação deve ser idempotente por `HashJson` e protocolo.
