# HDA-00 — Qualificação da origem / E01

Data: 14/10/2026. Estado: **parcial; origem real não qualificada**. É proibido interpretar este documento como `ApprovedIntegrationManifest` ou autorização para escrita.

## Evidência disponível

Repositório Help Desk inspecionado em `511523bea50c053a3bf1ac027be7a4ff01414930`, branch `codex/m1-reproducibilidade`. O checkpoint atual em [AGENTS.md](https://github.com/Consulte-GEO/help-desk-multi-tenant/blob/511523bea50c053a3bf1ac027be7a4ff01414930/AGENTS.md) e os relatórios [150 — Cadastros](https://github.com/Consulte-GEO/help-desk-multi-tenant/blob/511523bea50c053a3bf1ac027be7a4ff01414930/docs/150-CONSULTEGEO-CADASTROS-2026-10-14.md) e [151 — E-mails](https://github.com/Consulte-GEO/help-desk-multi-tenant/blob/511523bea50c053a3bf1ac027be7a4ff01414930/docs/151-CONSULTEGEO-EMAILS-2026-10-14.md) registram API/interface 0.31.0, schema 0.24.0, 17 migrations, atendimento ativo no recorte autorizado e worker de e-mails publicado. São registros do repositório; não houve reinspeção hospedada nesta execução. A integração real Novo GEO continua adiada.

O cabeçalho histórico de `PROJECT_HELP_DESK.md` não deve reverter esses avanços. A leitura do estado atual precisa confrontar os checkpoints mais recentes. A E01 não altera esse arquivo, não fecha o atendimento existente e não muda a configuração do worker.

Foi realizada pesquisa por `SegUsuarioService` na organização Consulte-GEO pelo conector GitHub: os resultados disponíveis eram documentação da wiki, não o código autoritativo do serviço. Essa busca não prova inexistência do repositório ou do serviço. Nenhuma rota foi inferida como disponível a partir da wiki.

## Contrato mínimo que ainda precisa ser comprovado

| Item | Evidência necessária | Estado E01 |
|---|---|---|
| Código executado na origem | Repositório/caminho, branch, commit e versão implantada da API e do IdP | Não inspecionado |
| Vínculo usuário–obra | Serviço/DTO reais que adicionam um vínculo sem substituir os anteriores | Não qualificado |
| Identidade técnica | Audience, credencial restrita, action-key, instância/tenant e regra de revogação | Não qualificado |
| Alvo | Associação legítima workspace/conta ↔ conexão/instância/contrato/obra/beneficiário | Apenas tipo candidato local |
| Prévia | Método sem inserção, job, e-mail, convite ou alteração de sessão | Apenas parser candidato local |
| Efeito | Transação de negócio e ledger idempotente na mesma base | Não implementado nesta entrega |
| Consulta do resultado | Retorno recuperável por executionIntentId e escopo original | Não qualificado |
| Concorrência | Mudança de acesso/regra entre prévia e escrita; IDs coincidentes entre tenants | Casos locais de correlação, não prova da API |
| Interoperabilidade | Vetores fixos Node e .NET com mesmo perfil e bytes | Node/Python locais; .NET pendente |

O contrato de leitura criado em `src/connectors/novo-geo/registration-read.ts` não contém URL, autenticação ou implementação HTTP. A saída `validated_preview_candidate` mantém `liveAdapterAllowed:false` e `executionAllowed:false`. Uma declaração `effectsExecuted:false` no retorno também não prova ausência de efeitos: os testes reais da origem devem verificar isso.

## Sequência para concluir HDA-00

1. Identificar os serviços autoritativos e inspecionar DTOs, FKs, validações e autorizações da revisão efetivamente implantada.
2. Documentar a ação piloto exata, inclusive inexistência de alteração de perfil, convite, acesso global e substituição de vínculos.
3. Qualificar leituras mínimas por identidade composta; não resolver pessoa só por e-mail e não aceitar IDs de cliente como autoridade.
4. Confrontar o contrato candidato E01 com a origem. Qualquer diferença que altere bytes/hashes ou semântica exige nova versão explícita, não adaptação silenciosa.
5. Produzir fixtures sintéticas de dois tenants com IDs coincidentes, beneficiário/obra inativos, acesso revogado e resposta tardia.
6. Definir autenticação técnica, emissão/validação da prova de autorização e consulta recuperável do efeito, sem armazenar token humano no job.
7. Executar prévia e ação em ambiente autorizado segundo a política existente do projeto. Não criar outro ambiente hospedado por conta própria, não executar AdminScripts/SQL livre e não usar clientes reais como fixture.

**Saída esperada:** matriz serviço/DTO/rota/evidência, revisão da origem, hash do contrato, cenários executados, divergências e aceite técnico. Segredos ficam fora do Git, prompt e pacote.
