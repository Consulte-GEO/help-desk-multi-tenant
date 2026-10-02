# M1-R21 — integração do R20 para execução do CI

Data: 02/10/2026. Base: `9fa74499f2f81a61de044d5826fbc398c5e167b3`, R19 integrado. Esta rodada integra o código e os exemplos do pacote R20 numa branch separada; não altera o núcleo de atendimento, migrations, permissões, dependências, Functions ou o workflow. Não fazer merge ou liberar atendimento automaticamente.

## Base e integridade
Pacote de origem: `HelpDesk_M1_R20_Destino_Homologacao_2026-10-02.zip`, SHA-256 `8b31c205c3d1d0c0d24eac9f6d9d1d15201dc69ec6745520935d9aeb8e10524f`. Os 408 arquivos da recuperação foram conferidos contra o manifesto. Fingerprint executável: `659e9ad6d69d822888486a59b2c9c6bf5d39c7a3ec1391ee29fd048c0e9a6a82`.

Os objetos Git de scripts, tests, src, shared, supabase, web, netlify, .github e examples foram conferidos contra a fonte local. A integração usa a árvore upstream como base, preservando todos os demais arquivos e a história publicada. Os documentos publicados do R19 não são substituídos por cópias antigas de recuperação. A documentação detalhada R20 acompanha o pacote original; este documento passa a registrar o andamento da integração.

## Especificação preservada do R20
`netlifySiteName` opcional permite selecionar explicitamente um site de homologação nos clientes de leitura e Auth; na escrita, fica em `readFixture`. Sem o campo, permanecem o site legado, os hashes e as chaves existentes. O destino exige HTTPS e permalink imutável com deploy ID de 24 caracteres, correspondência literal do site e ausência de alias, caminho, porta, parâmetros ou domínio alternativo. O nome selecionado não prova propriedade do site ou isolamento do backend.

## Evidências antes do CI
A fonte R20 foi reexecutada nesta rodada: 1436 testes Node aprovados, zero falhas, skips, TODO e cancelamentos. Neste container o registry não resolve e PostgreSQL/Docker não estão disponíveis. Esses resultados locais não substituem instalação padrão, PostgreSQL ou navegador. O CI existente será a execução efetiva a conferir; nenhuma aprovação é antecipada.

## Critério de saída
Exigir na mesma fonte: lock, npm ci, audit, typecheck e verify; 1436 Node, 215 PostgreSQL 17 e 71 HTTP/browser sem skips, TODO ou cancelamentos. Validar fingerprint, contagens e hashes dos logs originais de uma única execução. A evidência R19 não aprova R20. Qualquer falha deve permanecer registrada e ser investigada antes de outra tentativa; não reduzir pisos ou remover checks.

## Backlog e limites
1. Integração do código R20 em branch separada: preparada.
2. CI R20: pendente de execução/conferência nesta versão do documento.
3. Revisão independente do R20: pendente.
4. Site, banco, Auth e outbox de homologação isolados: dependem de autorização específica; nenhum recurso foi criado nesta rodada.
5. Aceitação hospedada: executar somente após os itens anteriores com identidades e fixtures reais de teste autorizadas; planos com IDs fictícios não constituem provisionamento.
6. Correlação privada no destino, concorrência, capacidade, restore, residência/RPO/RTO e aceite operacional: pendentes.

M1 permanece aberto; M2 não iniciado. API/interface 0.19.0, schema 0.18.0, 11 migrations e lockfile preservados. CI aprovado não autoriza abertura de HELPDESK_RELEASE_APPROVED, uso de produção como laboratório, mutações remotas ou publicação operacional.
