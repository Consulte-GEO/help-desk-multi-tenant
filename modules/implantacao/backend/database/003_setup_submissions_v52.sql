-- =====================================================================
-- v5.22.8 — DDL SQL Server: setup_submissions_v52 (stub)
--
-- Mirror das tabelas do Supabase usadas no protótipo. Quando o produto
-- migrar para o backend oficial .NET 8 + SQL Server, estas tabelas
-- substituem o Supabase como armazenamento das implantações pendentes
-- antes da efetivação nas tabelas Ges_*, Con_*, etc.
--
-- IMPORTANTE: este DDL NÃO implanta nada nas tabelas reais do produto.
-- Ele apenas espelha o que o protótipo persiste, em formato compatível
-- com o backend oficial.
--
-- Convenções:
--   - SCHEMA: dbo (default) — promover para schema próprio em produção.
--   - Datas: datetime2(3) com getutcdate() — UTC sempre.
--   - JSON: nvarchar(max) com CHECK ISJSON() para integridade.
--   - UUIDs: uniqueidentifier; geração delegada ao banco via newid().
-- =====================================================================

-- Drop em ordem reversa de FK (idempotente para reprovisioning local)
IF OBJECT_ID('dbo.setup_review_comments_v52', 'U') IS NOT NULL DROP TABLE dbo.setup_review_comments_v52;
IF OBJECT_ID('dbo.setup_audit_events_v52',    'U') IS NOT NULL DROP TABLE dbo.setup_audit_events_v52;
IF OBJECT_ID('dbo.setup_submissions_v52',     'U') IS NOT NULL DROP TABLE dbo.setup_submissions_v52;
IF OBJECT_ID('dbo.setup_tickets_v52',         'U') IS NOT NULL DROP TABLE dbo.setup_tickets_v52;

-- =====================================================================
-- setup_submissions_v52
-- Submissões enviadas para validação. technical_json é opaco para o
-- banco; as colunas extraídas (obra_nome, obra_codigo, etc) servem
-- para indexação e busca rápida.
-- =====================================================================
CREATE TABLE dbo.setup_submissions_v52 (
  id                  uniqueidentifier NOT NULL CONSTRAINT DF_setup_submissions_v52_id DEFAULT newid()
                        CONSTRAINT PK_setup_submissions_v52 PRIMARY KEY,
  draft_id            uniqueidentifier NOT NULL,
  tenant_hint         nvarchar(100)    NULL,
  schema_version      nvarchar(20)     NOT NULL,
  status              nvarchar(20)     NOT NULL
                        CONSTRAINT DF_setup_submissions_v52_status DEFAULT 'enviado',
  -- Extraídos de customerInput.dadosBasicos para indexação:
  obra_nome           nvarchar(200)    NOT NULL,
  obra_codigo         nvarchar(50)     NULL,
  cliente             nvarchar(200)    NULL,
  responsavel_nome    nvarchar(200)    NULL,
  responsavel_email   nvarchar(200)    NULL,
  -- Contagens cacheadas:
  count_estruturas    int              NOT NULL CONSTRAINT DF_setup_submissions_v52_ce DEFAULT 0,
  count_pecas         int              NOT NULL CONSTRAINT DF_setup_submissions_v52_cp DEFAULT 0,
  count_concretos     int              NOT NULL CONSTRAINT DF_setup_submissions_v52_cc DEFAULT 0,
  count_usuarios_obra int              NOT NULL CONSTRAINT DF_setup_submissions_v52_cu DEFAULT 0,
  count_fornecedores  int              NOT NULL CONSTRAINT DF_setup_submissions_v52_cf DEFAULT 0,
  -- Payload completo (technical_json):
  technical_json      nvarchar(max)    NOT NULL,
  -- Mensagem do cliente preenchida na Etapa 8:
  client_message      nvarchar(2000)   NULL,
  -- Timestamps:
  submitted_at        datetime2(3)     NOT NULL CONSTRAINT DF_setup_submissions_v52_sa DEFAULT sysutcdatetime(),
  reviewed_at         datetime2(3)     NULL,
  resubmitted_at      datetime2(3)     NULL,
  approved_at         datetime2(3)     NULL,
  expires_at          datetime2(3)     NULL,
  CONSTRAINT CK_setup_submissions_v52_status CHECK (status IN
    ('enviado','em_validacao','devolvido','aprovado','implantado','cancelado')),
  CONSTRAINT CK_setup_submissions_v52_tj_json CHECK (ISJSON(technical_json) = 1)
);

CREATE INDEX IX_setup_submissions_v52_status      ON dbo.setup_submissions_v52(status);
CREATE INDEX IX_setup_submissions_v52_submitted   ON dbo.setup_submissions_v52(submitted_at DESC);
CREATE INDEX IX_setup_submissions_v52_obra_codigo ON dbo.setup_submissions_v52(obra_codigo);
CREATE INDEX IX_setup_submissions_v52_tenant      ON dbo.setup_submissions_v52(tenant_hint);

-- =====================================================================
-- setup_tickets_v52
-- Numeração CG-AAAA-NNNNNN. Sequência por ano, controlada por aplicação
-- ou via sequence SQL Server.
-- =====================================================================
CREATE TABLE dbo.setup_tickets_v52 (
  id                  uniqueidentifier NOT NULL CONSTRAINT DF_setup_tickets_v52_id DEFAULT newid()
                        CONSTRAINT PK_setup_tickets_v52 PRIMARY KEY,
  submission_id       uniqueidentifier NOT NULL
                        CONSTRAINT FK_setup_tickets_v52_submission
                        REFERENCES dbo.setup_submissions_v52(id) ON DELETE CASCADE,
  ticket_number       nvarchar(30)     NOT NULL,
  year                int              NOT NULL,
  sequence_in_year    int              NOT NULL,
  client_access_token uniqueidentifier NOT NULL CONSTRAINT DF_setup_tickets_v52_cat DEFAULT newid(),
  review_access_token uniqueidentifier NOT NULL CONSTRAINT DF_setup_tickets_v52_rat DEFAULT newid(),
  expires_at          datetime2(3)     NULL,
  created_at          datetime2(3)     NOT NULL CONSTRAINT DF_setup_tickets_v52_ca DEFAULT sysutcdatetime(),
  CONSTRAINT UQ_setup_tickets_v52_ticket_number UNIQUE (ticket_number),
  CONSTRAINT UQ_setup_tickets_v52_year_seq      UNIQUE (year, sequence_in_year),
  CONSTRAINT UQ_setup_tickets_v52_client_token  UNIQUE (client_access_token),
  CONSTRAINT UQ_setup_tickets_v52_review_token  UNIQUE (review_access_token)
);

-- Sequência por ano (alternativa elegante à coluna sequence_in_year manual):
-- USAGE: SELECT NEXT VALUE FOR dbo.seq_setup_tickets_v52_2026;
-- Aplicação cria sequence por ano sob demanda.

-- =====================================================================
-- setup_audit_events_v52
-- Trilha de auditoria imutável. Cada mutation gera um evento.
-- =====================================================================
CREATE TABLE dbo.setup_audit_events_v52 (
  id            uniqueidentifier NOT NULL CONSTRAINT DF_setup_audit_events_v52_id DEFAULT newid()
                  CONSTRAINT PK_setup_audit_events_v52 PRIMARY KEY,
  submission_id uniqueidentifier NULL
                  CONSTRAINT FK_setup_audit_events_v52_submission
                  REFERENCES dbo.setup_submissions_v52(id) ON DELETE CASCADE,
  ticket_id     uniqueidentifier NULL,
  actor         nvarchar(200)    NULL,
  actor_role    nvarchar(20)     NULL,  -- 'cliente' | 'equipe' | 'system'
  action        nvarchar(50)     NOT NULL,
  details_json  nvarchar(max)    NULL,
  created_at    datetime2(3)     NOT NULL CONSTRAINT DF_setup_audit_events_v52_ca DEFAULT sysutcdatetime(),
  CONSTRAINT CK_setup_audit_events_v52_details_json CHECK
    (details_json IS NULL OR ISJSON(details_json) = 1)
);

CREATE INDEX IX_setup_audit_events_v52_submission ON dbo.setup_audit_events_v52(submission_id);
CREATE INDEX IX_setup_audit_events_v52_created    ON dbo.setup_audit_events_v52(created_at DESC);

-- =====================================================================
-- setup_review_comments_v52
-- Mensagens trocadas entre equipe e cliente durante validação.
-- internal_only=1 → não aparece para o cliente.
-- =====================================================================
CREATE TABLE dbo.setup_review_comments_v52 (
  id            uniqueidentifier NOT NULL CONSTRAINT DF_setup_review_comments_v52_id DEFAULT newid()
                  CONSTRAINT PK_setup_review_comments_v52 PRIMARY KEY,
  submission_id uniqueidentifier NOT NULL
                  CONSTRAINT FK_setup_review_comments_v52_submission
                  REFERENCES dbo.setup_submissions_v52(id) ON DELETE CASCADE,
  author        nvarchar(200)    NULL,
  author_role   nvarchar(20)     NOT NULL,  -- 'cliente' | 'equipe'
  body          nvarchar(2000)   NOT NULL,
  internal_only bit              NOT NULL CONSTRAINT DF_setup_review_comments_v52_io DEFAULT 0,
  created_at    datetime2(3)     NOT NULL CONSTRAINT DF_setup_review_comments_v52_ca DEFAULT sysutcdatetime(),
  CONSTRAINT CK_setup_review_comments_v52_role CHECK (author_role IN ('cliente','equipe')),
  CONSTRAINT CK_setup_review_comments_v52_body_len CHECK (LEN(body) BETWEEN 1 AND 2000)
);

CREATE INDEX IX_setup_review_comments_v52_submission ON dbo.setup_review_comments_v52(submission_id, created_at);

GO

-- =====================================================================
-- Smoke insert (comentar antes de subir em produção)
-- =====================================================================
-- INSERT INTO dbo.setup_submissions_v52
--   (draft_id, schema_version, status, obra_nome, technical_json,
--    count_estruturas, count_pecas, count_concretos,
--    count_usuarios_obra, count_fornecedores)
-- VALUES
--   (newid(), '5.22.8', 'enviado', 'Obra Teste', '{"smoke":true}',
--    0, 0, 0, 0, 0);
-- SELECT * FROM dbo.setup_submissions_v52;
-- GO
