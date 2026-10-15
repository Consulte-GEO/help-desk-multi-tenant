# Apoio Implantação — integração de 15/10/2026

## Entrega

O menu Apoio Implantação reúne Cadastro, Planilhas (pré-análise, conversão e pós-importação), Laudos, Rascunhos, Processos, Revisão e Ajuda contextual, dentro da interface e da sessão do Help Desk. O acesso é exclusivo de suporte e administradores, conforme decisão do titular. A autorização é conferida novamente no backend e no banco, por conta.

As fontes do Setup foram incorporadas em `modules/implantacao`, com proveniência em `SOURCE_IMPORT.json`. O site original, seus dados e suas identidades permanecem preservados. Não houve cópia de usuários antigos para o Auth do Help Desk. A integração preserva o monitor de e-mails, a Wiki e os workers existentes.

O salvamento usa controle de versão, recibos persistentes e recuperação de confirmação perdida. Falhas mantêm o rascunho como não salvo; uma nova tentativa conserva o identificador. Uma edição concorrente não é sobrescrita. Alternar entre telas preserva as correções ainda não salvas. Comentários, atividades e versões têm paginação; exportações recuperam o histórico completo.

SheetJS vendorizado atualizado de 0.18.5 para 0.20.3; modelos R02 conferidos pelos parsers e pelas exportações reais. IA adaptada ao SDK oficial no servidor, com modelos permitidos, consentimento para imagens, quotas, prazo máximo e preservação de divergências. Não foi executada inferência paga durante a homologação.

## Qualificação específica

Fonte executada: `b45457290b4d77dcac23cded31415455b0aba937`. [Workflow aprovado](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38792879323), artefato `12001175557`. Relatórios e imagens originais em `evidence/apoio-implantacao/ci-b454572`, sem edição dos bytes capturados.

- PostgreSQL 17.11: 20 verificações, contra as 21 migrações imutáveis do core 0.27, usando login real restrito e cluster descartável.
- Motores de importação: 140 testes aprovados, incluindo os testes de filesystem que exigem Linux.
- Motores de laudos: 105 verificações aprovadas.
- Contratos do frontend: 13 testes aprovados.
- Chromium: 24 jornadas aprovadas, incluindo PDF/worker, modelos/exportações, histórico extenso, autosave, confirmação perdida, edição concorrente, mobile, encerramento da sessão e CSP.
- Instalação limpa, tipos do grafo efetivamente compilado, build e auditoria npm aprovados.

As jornadas usam dados sintéticos e backend real sobre um store de teste. A qualificação SQL utiliza PostgreSQL real; nenhuma dessas provas representa uma jornada autenticada no provedor de produção. A revisão independente identificou perda de edição ao reativar a tela e truncamento de comentários pelo limite aplicado antes do filtro; ambos foram corrigidos e cobertos por testes.

## Banco de produção

O addon `implementation_support_private_addon_v1` foi aplicado pelo conector oficial ao projeto Help Desk `xaelbntjnvztznnpcvtm`, após a qualificação PG. A conferência posterior encontrou core 0.27 preservado, 88 tabelas anteriores com FORCE RLS e quatro tabelas novas, também com FORCE RLS. São sete políticas e três funções SECURITY INVOKER, sob o mesmo proprietário confiável do core. `anon`, `authenticated` e `service_role` não têm USAGE no schema privado. As quatro tabelas estavam vazias após a aplicação: nenhum registro de negócio foi criado para testar produção.

## Limites mantidos

O scanner foi cancelado pelo titular. PDFs e planilhas originais ficam na memória da sessão; o banco conserva os dados salvos e revisados. Imagens privadas de ajuda não recebem classificação de antivírus. Links compartilhados exigem login e autorização; envio de e-mail do módulo não é anunciado como entregue. A validação interna não é uma execução no Novo GEO.

Novo GEO permanece preparado por contratos e exportações. A integração real depende da URL, autenticação e contrato de API, ainda não fornecidos. Não foram criados recursos pagos no Render.

## Promoção

Homologação integral aprovada no [CI38792886071](https://github.com/Consulte-GEO/help-desk-multi-tenant/actions/runs/38792886071): 5.798 testes de aplicação, 697 PostgreSQL e 632 de interface, sem falhas, skips, cancelamentos ou todo. O recibo e os logs originais estão em `evidence/homologation/runs/9cefe85a-2adb-4a59-b2cd-75aaa34c49b5`; `latest.json` aponta para a mesma execução. SHA256 da fonte: `9e13d421a5ad457c254ad36a3609becdef46278260a9250525a9a8320c6cc70c`. A fonte local foi comparada ao relatório por `validateReport`, `verifyLogs` e `check:homologation`, sem alteração de contagens, datas ou hashes.

A publicação está em execução pelo [PR55](https://github.com/Consulte-GEO/help-desk-multi-tenant/pull/55). Este registro será atualizado após a conferência HTTPS.
