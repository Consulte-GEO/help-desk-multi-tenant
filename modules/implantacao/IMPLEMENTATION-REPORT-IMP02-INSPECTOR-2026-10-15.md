# IMP-02 — inspector ativado e scanner preparado

Fonte integrada em `main`: `62a197157306a4c2c8fd52911d17f662d099f551`. Publicação Netlify `6ad0fdb835c7256043d10590`, domínio https://setup.consultegeo.org. Manifesto hospedado conferido:50/50 entradas, incluindo a transformação existente de pretty links. As APIs de sessão/listagem recusam chamadas sem autenticação com401.

## Armazenamento real

Inspector técnico criado pela API oficial de administração Auth, sem perfil administrativo ou concessões de negócio. O CLI oficial Supabase já autenticado forneceu a credencial administrativa apenas na memória do operador; ela não foi transferida ao runtime. O provisionador revisado limitou a criação ao email técnico fixo e entregou a nova senha cifrada. Apenas email, senha e UUID dessa identidade foram salvos em secrets Functions/production da Netlify.

A tentativa GitHub38767617409 falhou no acesso às chaves do projeto com403, sem criar usuário. O token existente do workflow não foi substituído. A representação de chave moderna obtida pelo CLI2.76 foi recusada pelo Auth com401; a chave legada existente foi qualificada por uma consulta administrativa somente leitura200 e utilizada somente no operador local. Esses fatos não qualificam aquele workflow como operacional com o token atual.

O provider de produção autentica por senha, confirma a identidade e a flag administrativa confiável no Auth e renova JWTs curtos, com cache limitado e falha fechada. Não utiliza JWT estático nem chave administrativa nas inspeções normais. A autenticação real pelo próprio provider foi conferida; a identidade não tem `is_admin`, concessões IMP-02 ou processos de negócio.

Bucket `setup-import-artifacts` privado, limite62914560bytes. A leitura real de seu metadado retornou200. Listagens autenticadas do bucket e de `exports`/`step-help-images` retornaram arrays vazios. Nenhum arquivo de cliente ou processo fictício foi criado para essas verificações.

A revisão reproduziu permissões antigas que permitiam ao inspector ler e inserir em `exports`. A migration oficial `20261015155558_imp02_inspector_storage_restrictions.sql`, SHA256 `40652774f3869e481fbfe3dafbf00b6729b4238dbc028a752c745a10b1b98514`, adiciona oito políticas restritivas em Storage. A identidade marcada só pode ler o bucket dedicado e não pode escrever objetos ou metadados de buckets, mesmo sob políticas permissivas antigas. As permissões dos demais usuários foram preservadas. Aplicada e conferida no projeto `yglcnirbnbwjqpvalqif`.

## Scanner

ClamAV1.5.4 oficial fixado por digest, assinaturas atualizadas, gateway autenticado com resposta vinculada a SHA256/tamanho/MIME dos bytes e parsers reais para PDF, PNG, JPEG, XLS e XLSX. O subprocesso Linux tem limites de memória/CPU/prazo; falhas, assinaturas antigas e documentos não qualificados nunca produzem aprovação.

A revisão independente reproduziu dois desvios: fórmulas XLSX em nomes definidos e fórmulas BIFF em XLS. Corrigidos com testes que primeiro falharam: importação aceita valores estáticos; fórmulas em células, nomes, validações, regras condicionais e colunas calculadas são recusadas. Nomes XLSX permitem apenas áreas literais, incluindo áreas de impressão usuais. O README explica como exportar uma cópia com valores.

**Scanner não hospedado nem ativado.** O usuário não aprovou os US$85/mês do serviço Render4GB. Nenhum serviço pago foi criado e nenhuma URL/token de scanner foi configurada. Sem scanner qualificado, o backend mantém os anexos sem aprovação para processamento. Execução por lotes ou sob demanda exige escolha e qualificação próprias antes de ativação.

## Verificação e limites

- [CI integral38767133840](https://github.com/Consulte-GEO/setup-implantacao-obras/actions/runs/38767133840): aprovado;347 testes de processo, tipos/build, integridade e verificações existentes. PostgreSQL17 real:11 verificações do contrato e30 do esquema de produção/Storage, sem falhas.
- [Scanner Linux38767133705](https://github.com/Consulte-GEO/setup-implantacao-obras/actions/runs/38767133705): aprovado;18 testes, engine real, cinco formatos seguros, PDF ativo recusado e EICAR detectado. Assinaturas28154 de15/10/2026. Não constitui prova de hospedagem do scanner.
- Evidências sanitizadas em `evidence/imp02-inspector-scanner-20261015`.

Novo GEO permanece preparado: contrato, URLs, autenticação e referências autorizadas ainda não foram fornecidos. Não existem concessões/processos de negócio criados por esta ativação. Backend e armazenamento real não equivalem a um fluxo de importação completo enquanto faltarem a origem e o scanner hospedado. Não foram fabricados resultados de inspeção, dados da origem ou cadastros concluídos.

Os advisors do projeto também registram cinco views públicas antigas com SECURITY DEFINER, fora dos schemas IMP-02 (`vw_scan_summary`, `vw_recent_scans`, `vw_market_trends`, `vw_port_volume_history`, `vw_freight_comparison`). Não foram alteradas nesta ativação; exigem revisão específica de permissões e consumidores antes de modificação: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view . Não declarar o projeto inteiro livre de avisos de segurança.
