# Backend .NET 8 — Skeleton de Implantação de Estruturas

Skeleton para encaixe no `ControleTecnologicoApi`, mantendo REST controllers, EF Core, Repository pattern, DTOs manuais, OpenIddict e auditoria em toda mutação.

## Endpoints principais

- `GET /api/implantacao-estrutura/opcoes`
- `POST /api/implantacao-estrutura/rascunhos`
- `GET /api/implantacao-estrutura/rascunhos/{id}`
- `PUT /api/implantacao-estrutura/rascunhos/{id}`
- `POST /api/implantacao-estrutura/rascunhos/{id}/validar`
- `POST /api/implantacao-estrutura/rascunhos/{id}/enviar-validacao`
- `POST /api/implantacao-estrutura/rascunhos/{id}/implantar`
- `GET /api/implantacao-estrutura/rascunhos/{id}/exportar-json`
- `GET /api/implantacao-estrutura/rascunhos/{id}/exportar-excel`

## Tabelas core impactadas na implantação

- `Ges_UnidadeGrupo`
- `Ges_UnidadeTipo`
- `Ges_Unidade`
- `Utl_Produto`
- `Con_Concreto`
- `CTe_PadraoMoldagem`
- `CTe_TipoEnsaioProduto`
- `Pro_Projetista`

As tabelas de staging estão no DDL `backend/database/001_implantacao_estrutura_staging.sql`.

---

## v5.22.8 — Stub experimental para contrato real do frontend

Os endpoints listados acima são o desenho **definitivo** quando o produto migrar para o backend oficial. Eles **não estão funcionais** ainda — são stubs sem implementação.

Para **provar que o contrato JSON do frontend protótipo Vue é portável para .NET 8 + SQL Server**, foi criado um controller separado `ImplantacaoEstruturaV52Controller` em `src/ControleTecnologico.Application.Api/Controllers/ImplantacaoEstruturaV52Controller.cs`.

### Endpoints v5.22.8 (stub)

- `POST /api/v52/implantacao-estrutura/drafts/{id}/submit` — recebe `TechnicalJsonDto` (mirror do `technical_json` que o frontend gera), gera `ticket_number CG-AAAA-NNNNNN`, retorna `SubmitImplantacaoResultDto` com `submissionId`, `ticketNumber`, `status='enviado'`, `receivedAt`, `schemaVersion` ecoado e `counts` (estruturas, peças, concretos, usuariosObra, fornecedores).
- `POST /api/v52/implantacao-estrutura/drafts/{id}/echo` — não persiste; ecoa o JSON com as contagens calculadas. Útil pro frontend validar contrato.

### DTOs v5.22.8

Em `src/ControleTecnologico.Domain.DTO/ImplantacaoEstrutura/TechnicalJsonDtos.cs`:

- `TechnicalJsonDto` — payload completo
- `CustomerInputDto` — com `Grupos[]`, `Concretos[]`, `UsuariosObra[]` (v5.22.6), `Fornecedores[]` (v5.22.7)
- `UsuarioObraDto`, `FornecedorDto` — entidades novas alinhadas com schema JSON

Todos usam `[JsonPropertyName]` para deserialização camelCase.

### Tabelas v5.22.8 (mirror do Supabase)

DDL em `database/003_setup_submissions_v52.sql`:

- `setup_submissions_v52` — submissões enviadas; `technical_json` em nvarchar(max) com CHECK ISJSON()
- `setup_tickets_v52` — numeração CG-AAAA-NNNNNN + tokens de acesso
- `setup_audit_events_v52` — trilha imutável
- `setup_review_comments_v52` — mensagens cliente↔equipe

**Estas tabelas NÃO substituem as tabelas reais do produto (Ges_*, Con_*, etc).** Elas armazenam o **estado intermediário** entre a submissão do cliente e a efetivação pela equipe Consulte GEO. Quando a equipe aprovar, um job de implantação (a ser implementado em versão futura) faz o INSERT nas tabelas reais.

### O que falta para sair de stub

1. Adicionar `[Authorize(Policy = "AuthPolicy")]` no controller v52
2. Implementar repository EF Core (`SetupSubmissionsV52Repository`) com Get/Create/Update/Delete
3. Implementar service `SetupSubmissionsV52Service` com lógica de geração de ticket_number via sequence SQL Server
4. Implementar endpoints completos: `/validate`, `/approve`, `/return`, `/implant`
5. Implementar job de implantação que mapeia `technical_json` → INSERTs em `Ges_*` (este é o ponto crítico — vai exigir muito mapeamento)
6. SMTP/Resend integration para emails (substituir Edge Function Supabase)
7. Tabela-tenant para suporte multi-cliente

Estes itens ficam para v5.23+.

---

## Compatibilidade entre Supabase e .NET 8

O contrato JSON é o **mesmo** nos dois ambientes. Ou seja: o mesmo `technical_json` gerado pelo frontend hoje (que vai para Supabase via Edge Function) pode ser enviado para o backend .NET amanhã sem alteração no frontend. Essa é a propriedade de portabilidade que o stub v5.22.8 valida.
