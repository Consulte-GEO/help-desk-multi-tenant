# Endpoints REST

Base: `/api/implantacao-estrutura`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/opcoes` | Retorna listas controladas da tela, incluindo Tipo de Estrutura e etapas. |
| POST | `/rascunhos` | Cria rascunho com JSON técnico. |
| GET | `/rascunhos/{id}` | Consulta rascunho salvo. |
| PUT | `/rascunhos/{id}` | Atualiza rascunho salvo. |
| POST | `/rascunhos/{id}/validar` | Valida o JSON salvo. |
| POST | `/rascunhos/{id}/enviar-validacao` | Envia proposta para validação interna. |
| POST | `/rascunhos/{id}/implantar` | Converte JSON validado em registros core. |
| GET | `/rascunhos/{id}/exportar-json` | Exporta JSON técnico. |
| GET | `/rascunhos/{id}/exportar-excel` | Exporta planilha Excel preenchida. |

## Status da proposta

| Código | Status |
|---:|---|
| 1 | Rascunho |
| 2 | Enviado para validação |
| 3 | Devolvido |
| 4 | Implantado |
| 9 | Cancelado |

## Auditoria obrigatória

Toda mutação deve gravar uma linha em `Ges_ImplantacaoEstruturaAuditoria` com usuário, ação, campo alterado, valor anterior, valor novo, IP e user-agent quando disponíveis. O mesmo evento também pode entrar no fluxo transversal de `LogUtilizacao` já existente.
