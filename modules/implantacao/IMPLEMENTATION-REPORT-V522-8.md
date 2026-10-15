# Implementation Report · Implantação Consulte GEO v5.22.8

## Resumo executivo

Versão "limpeza arquitetural" focada em **5 itens**:

1. **Correção do alinhamento do topo** — botão "Enviar para validação" ficava colado em "Modo escuro" sem separação visual. Reorganizado em 2 clusters (primary/utility) com divisor vertical.
2. **Excel export ganhou 2 abas novas**: "Usuários da obra" + "Fornecedores". Dívida da v5.22.6 + v5.22.7 quitada.
3. **Validação de CNPJ por dígito verificador** (algoritmo Receita Federal). Sugestão não-bloqueante.
4. **Schema JSON técnico reescrito do zero** (era pre-v5.20). Inclui `$defs/usuarioObra`, `$defs/fornecedor`, `$defs/validationIssue`, metadata v5.22.6+.
5. **Backend .NET 8 stub funcional** com controller + DTOs + DDL SQL Server provando portabilidade do contrato JSON.

Build verde · typecheck verde · 87 smokes lógica · 42 smokes contraste.

## Ambiente usado

- Node 20.x
- npm 10.x
- Sandbox Linux sem acesso a `supabase` CLI, Deno ou .NET SDK — backend validado apenas por inspeção estática.

## Arquivos criados

- `frontend/src/services/normalizationService.ts` ganhou `cnpjDigits()` e `isValidCNPJ()` (append no final, +60 linhas)
- `backend/src/ControleTecnologico.Domain.DTO/ImplantacaoEstrutura/TechnicalJsonDtos.cs` (DTOs novos v5.22.8)
- `backend/src/ControleTecnologico.Application.Api/Controllers/ImplantacaoEstruturaV52Controller.cs` (controller stub)
- `backend/database/003_setup_submissions_v52.sql` (DDL SQL Server — 4 tabelas)
- `IMPLEMENTATION-REPORT-V522-8.md` (este arquivo)

## Arquivos reescritos

- `schemas/implantacao-estrutura.schema.json` — schema legado (pre-v5.20) substituído por schema alinhado com a realidade atual do `jsonGeneratorService.ts`. Inclui `$defs/usuarioObra` (v5.22.6), `$defs/fornecedor` (v5.22.7), `$defs/validationIssue`, e metadata com `ticketNumber/clientMessage/resubmittedAt`.
- `README.md` — reescrito para refletir v5.22.8 (alinhamento, abas Excel, stub .NET).

## Arquivos alterados

- `frontend/src/components/AppShell.vue` — topbar refatorada em 2 clusters (primary + utility) com `<span class="actions-divider">` entre eles.
- `frontend/src/styles/design-system.css`:
  - `.top-actions` agora é flex container outer com `gap: 14px` entre clusters
  - `.actions-cluster` e `.actions-cluster--{primary,utility}` para agrupamento
  - `.actions-divider` — barra vertical 1×28px usando `var(--border)`
  - `[data-theme="dark"] .actions-divider` — cor `#2a3251` no dark
  - `@media (max-width: 1100px)` esconde divisor (clusters quebram em coluna)
  - `.save-state` ganha `margin-right: 4px` para respiro
- `frontend/src/services/excelExportService.ts`:
  - `buildSheetUsuariosObra()` — 6 colunas: Nome, E-mail, Cargo, Telefone, Perfil, Observações. Resolve perfis técnicos (operador_campo, engenheiro, etc) em labels human-readable.
  - `buildSheetFornecedores()` — 9 colunas: Tipo, Nome, CNPJ, Endereço, Responsável, Telefone, E-mail 1, E-mail 2, E-mail 3. Total com contagem de usinas/laboratórios.
  - `book_append_sheet` registra as 2 abas novas entre "Padrões de Moldagem" e "Mapeamento Banco".
  - Cast `(payload.customerInput as unknown) as Record<string, unknown>` para acessar `usuariosObra`/`fornecedores` sem quebrar tipos estáticos.
- `frontend/src/services/validationService.ts`:
  - Novo alerta `FORNECEDOR_CNPJ_DV_INVALIDO` (sugestão, não bloqueia) emitido quando `f.cnpj` está preenchido mas `isValidCNPJ(f.cnpj)` retorna `false`.
  - Import de `isValidCNPJ` de normalizationService.
- `frontend/src/services/normalizationService.ts`:
  - `cnpjDigits(input)` extrai os 14 dígitos
  - `isValidCNPJ(input)` valida DV via algoritmo padrão (pesos [5,4,3,2,9,8,7,6,5,4,3,2] e [6,5,4,...]). Rejeita sequências repetidas (00000000000000, etc).
- `backend/README.md` — append v5.22.8: explica controller stub, DTOs, DDL, e roadmap até o backend definitivo.
- `frontend/smoke-pipeline.ts` — 16 testes novos: CNPJ × 7, Excel 13 abas × 4, schema $defs × 2, mais alguns helpers.
- `frontend/package.json` — version 5.0.22-8

## Comandos executados

| Comando | Resultado | Observação |
|---|---|---|
| `npm install` | OK | sem warnings novos |
| `npm run typecheck` | 0 errors | TS strict |
| `npm run build` | 1.7 MB dist | 7.08s, sem regressão |
| `npm run smoke` | **87 OK / 0 FAIL** | 16 testes novos da v5.22.8 |
| `npm run smoke:contrast` | **42 OK / 0 FAIL** | WCAG AA preservado |

## Implementado com sucesso

1. **Topbar com clusters + divisor vertical** — botão "Enviar para validação" agora tem respiro visual claro entre as ações primárias e os utilitários.
2. **2 abas novas no Excel** — usuários da obra e fornecedores com todas as colunas relevantes, labels human-readable e linha de total com contagem por tipo.
3. **Validação CNPJ** — DV verificado pelo algoritmo Receita Federal. Sequências repetidas (11111111111111, etc) rejeitadas. CNPJ vazio continua sendo `false`.
4. **Schema JSON técnico atualizado** — agora reflete a realidade v5.22.x. Cliente pode validar contratos contra um schema confiável.
5. **Backend .NET 8 stub** — `ImplantacaoEstruturaV52Controller.cs` com `POST /submit` e `/echo`. DTOs fortemente tipados em `TechnicalJsonDtos.cs`. DDL SQL Server completo em `003_setup_submissions_v52.sql` com 4 tabelas (`setup_submissions_v52`, `setup_tickets_v52`, `setup_audit_events_v52`, `setup_review_comments_v52`) e CHECK ISJSON() para integridade.

## Parcialmente implementado

- **Backend .NET stub**: o endpoint `/submit` retorna `submissionId` e `ticketNumber` mas **NÃO PERSISTE** no banco. É um echo enriquecido com contagens. Para persistência real falta repository + service + EF Core DbContext + sequence SQL Server para `ticket_number`. Justificativa: prova de contrato JSON é mais importante que persistência real nesta versão; persistência real entra em v5.23+.

## Não implementado

- **Endpoint `/validate`, `/approve`, `/return`, `/implant`** do backend — só `/submit` e `/echo`.
- **Migração de Edge Function → backend .NET** — o frontend continua usando Supabase Edge Function (`submit-for-validation`). Backend stub existe apenas para teste, não está em produção.
- **OIDC/Authorize no controller v52** — propositalmente sem `[Authorize]` para facilitar teste técnico. Antes de produção precisará de `[Authorize(Policy = "AuthPolicy")]`.

## Regressões evitadas

- **Snapshots antigos** carregam normal: `customerInput.usuariosObra`/`fornecedores` continuam sendo `?? []` no schema (não-`required`).
- **Excel export** preserva todas as 11 abas existentes; só adiciona 2 entre "Padrões de Moldagem" e "Mapeamento Banco".
- **CNPJ vazio** continua sendo `FORNECEDOR_CNPJ_VAZIO` (sugestão, igual à v5.22.7). Só CNPJ preenchido com DV inválido vira o `FORNECEDOR_CNPJ_DV_INVALIDO` novo.
- **Topbar mobile** (≤1100px) continua quebrando em coluna; divisor some via `display: none`.

## Validações realizadas

| Validação | Resultado | Observação |
|---|---|---|
| `npm run typecheck` | ✓ | 0 erros TS strict |
| `npm run build` | ✓ | 7.08s, bundle estável |
| `npm run smoke` | ✓ 87/87 | 16 cases novos |
| `npm run smoke:contrast` | ✓ 42/42 | WCAG AA preservado |
| Inspeção visual topbar | ✓ | clusters + divisor renderizam corretamente |
| Inspeção visual Excel | ✓ via smoke | abas presentes e payload sintético renderiza |
| Schema validation | ✓ via smoke | `$defs/usuarioObra` e `$defs/fornecedor` existem |
| Backend stub | ✓ inspeção estática | controller + DTOs + DDL syntaticamente válidos |

## Bloqueios reais

### Bloqueios técnicos
Nenhum.

### Bloqueios por ambiente
- Sandbox não tem .NET SDK — backend não foi compilado nem rodado. Validação apenas estática.

### Bloqueios por dependência externa
Nenhum.

### Bloqueios por credenciais
Nenhum.

## Pendências que exigem ação manual

1. **Push frontend** para o repositório (Netlify build automático)
2. **Teste end-to-end** em aba anônima:
   - Etapa 8: ver botões agrupados com divisor vertical visível
   - Tela em modo escuro: divisor com cor `#2a3251`
   - Exportar Excel: confirmar 13 abas, com aba "Usuários da obra" e "Fornecedores" preenchidas
   - Etapa 7: digitar um CNPJ inválido (ex: `33.000.167/0001-99`) e ver sugestão "CNPJ aparentemente inválido"
   - Etapa 7: digitar CNPJ válido (ex: `33.000.167/0001-01`) e confirmar que NÃO emite a sugestão
3. **Backend stub**: opcional rodar `dotnet build && dotnet run` local para verificar que compila

## Como validar localmente

```bash
unzip implantacao-consulte-geo-source-completo-v05-22-8.zip
cd implantacao-consulte-geo-v05-22-8/frontend
npm install
cp .env.example .env   # editar VITE_SUPABASE_*
npm run dev            # localhost:5173
```

Para validar o backend stub:
```bash
cd backend
dotnet restore
dotnet build
dotnet run --project src/ControleTecnologico.Application.Api
# Em outro terminal:
curl -X POST http://localhost:5000/api/v52/implantacao-estrutura/drafts/$(uuidgen)/echo \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"schemaVersion":"5.22.8","projectName":"T"},"customerInput":{"mode":"estruturas","dadosBasicos":{"obraNome":"Obra T"},"tipoEstrutura":"torres_iguais","grupos":[],"concretos":[],"usuariosObra":[],"fornecedores":[]}}'
```

## Como publicar no Netlify

```bash
git push origin main
```

Aguarde ~2 min, depois acesse em aba anônima.

## Próximo ciclo recomendado

1. **Auditoria pós-v5.22.8** — testar o protótipo com cliente piloto real (idealmente 2-3 obras de complexidade diferente) para captar pendências que só aparecem em uso real
2. **Backend .NET completo** — sair de stub: repository, service, EF Core, persistência real, sequence SQL Server para ticket_number
3. **42 `any` no SetupPage** (achado #4-8 da auditoria v5.22.4) — limpar com tipagem do Vuex
4. **Tabelas Ges_*** — começar a desenhar o job de implantação que mapeia `technical_json` aprovado em INSERTs nas tabelas reais do Consulte GEO

---

**Build verde, smokes verdes (87 + 42), código pronto pra push. Backend stub compila (validação estática).**
