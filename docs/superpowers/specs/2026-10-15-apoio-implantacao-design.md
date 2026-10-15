# Apoio Implantação no Help Desk

Pedido: reunir todo o código da Implantação no repositório Help Desk e disponibilizar seus recursos em um item lateral Apoio Implantação com a UI do Help Desk. O usuário confirmou acesso exclusivo à equipe interna de suporte e administradores e cancelou o scanner. Autorização vigente inclui implementar melhorias, commit, merge e publicação sem Claude.

## Experiência e paridade

O Help Desk mantém login, sidebar, workspace, tema, navegação móvel e atendimento. O módulo é carregado na área de conteúdo, sem iframe e sem encaminhar a operação a um site externo. Áreas internas: cadastro de obra em sete etapas; planilhas (pré-análise, conversão e pós-importação); laudos; rascunhos/processos; revisão e ajuda das etapas.

Preservar edição em lote, importação dos modelos, estruturas/concretos/peças/usuários/fornecedores, validação, geração XLSX/JSON GEO Controle, revisão/devolução/reenvio, auditoria e exportações. Na conversão, manter mapeamento, referências/políticas, propostas com aceite humano, correção, proveniência, planilha final/rascunho/pendências/sugestões e auditoria posterior. Pré-análise entrega o arquivo real e diagnóstico à conversão. Laudos mantêm PDF local, perfis, múltiplos arquivos, correção/revisão, cancelamento e seis abas de exportação.

Reutilizar os motores testados e o adapter IMP-01v1.1.0. A apresentação usa componentes existentes e tokens `--hd-*`, sem outro login, sidebar duplicada ou gradientes de outro produto. A URL singular laudo é tratada como alias quando montada no host.

## Fonte e compilação

439 arquivos rastreados foram trazidos de Setup32cfe03 para `modules/implantacao`; `SOURCE_IMPORT.json` registra SHA256/tamanho originais. Código, tipos, schemas, testes, modelos, parser e histórico backend permanecem no repositório. ClamAV, workflow de scanner e evidências voláteis foram excluídos. Funções/migrations antigas são referências históricas, nunca automaticamente publicadas/aplicadas.

Frontend Vue compilado como biblioteca ESM `support-app.js`, carregada sob `/implantacao/`, com recursos públicos explicitamente selecionados. SQL, funções administrativas, fontes privadas, testes, relatórios, fixtures e segredos não entram no diretório publicado. Evitar o antigo prebuild destrutivo cleanup-legacy. A homologação inclui as novas fontes/locks e ignora dependências e saídas geradas.

Interface de montagem: `mountImplementationSupportApplication({root,request,session:{id,workspaceId},signal}) -> Promise<{destroy()}>`. O transporte é fornecido pelo Help Desk, sem expor tokens ao módulo. Desmontagem/logout cancela trabalho e remove dados, URLs de objetos, listeners e respostas tardias. Persistência local é segregada por identidade/workspace; nenhum segredo de IA fica no navegador.

## Autoridade e persistência

Todas as rotas privadas sob `/v1/implementation-support` autenticam pelo resolvedor vivo Help Desk. Exigir pessoa humana administradora ou concessão agent vigente; workspace_role agent isolado não basta. Recursos associados a contas usam `isOperator` na conta concreta, sem aceitar autoridade por metadata, UUID, token antigo ou header do navegador.

Adicionar schema privado `helpdesk_implantacao` com RLS e grants mínimos do login restrito, sem modificar quatro schemas/core0.26 ou o prefixo das20 migrations. Armazenar rascunhos/processos versionados, snapshots/submissões, eventos/comentários/exports, ajuda e quota/telemetria. Escritas têm CAS, idempotência e auditoria; erro de autorização não produz efeito. Nenhum postgres/service_role/BYPASSRLS atende requests normais.

Preservar os dados do projeto Setup. Não transplantar29 migrations públicas ou IDs de outro Auth. Novos registros usam identidade Help Desk. Migração histórica só por mapeamento explícito ou importação revisada de dados, nunca por equivalência presumida de pessoas/contas.

## Arquivos e IA

Sem scanner antivírus/ClamAV, contratação ou estado clean fictício. Parsing local e validações estruturais continuam; resultados/proveniência podem ser persistidos. Arquivos originais não devem virar anexos ready por dispensar o scanner. Caso sejam armazenados, explicitar estado sem inspeção antivírus e não executá-los.

IA somente no servidor autenticado, com consentimento para visão, quota persistente, prazo/cancelamento, saída estruturada validada e aceite humano dos resultados. SDK oficial OpenAI via credenciais de runtime Netlify AI Gateway; nenhum proxy público antigo, chave do usuário em localStorage ou URL arbitrária do provedor. Modelos verificados na documentação oficial e catálogo Netlify em15/10/2026: GPT-6Luna para rotina, GPT-6.1Sol para revisão/retry; configuração controlada no servidor. Motores locais continuam disponíveis sem chamada de IA. Não enviar documentos de cliente nos testes nem fazer inferência paga para fabricar evidência.

## Verificação e aceite

Testes negativos de cliente/integração/conta cruzada/revogação; CAS/replay; PostgreSQL17 real com addon e contrato core intacto; ações de planilhas/PDF/modelos/exportações; ciclo de pré-análise→conversão; logout/cancelamento tardio; tema/mobile/teclado. CI completo, lock/audit/build e fingerprint da fonte nova antes de publicar. Qualificar publicação, endpoints, manifesto e migração no destino real. Exportação técnica não significa cadastro executado no Novo GEO, que permanece preparado.
