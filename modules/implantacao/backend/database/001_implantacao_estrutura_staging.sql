/*
  Consulte GEO Concreto - Implantação Simplificada de Estruturas
  Tabelas de staging para armazenar proposta, JSON técnico e auditoria antes da gravação nas tabelas core.
  Banco: SQL Server / database-per-tenant / GeoClienteContext.
*/

CREATE TABLE dbo.Ges_ImplantacaoEstruturaProposta (
    Ges_ImplantacaoEstruturaPropostaId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_Ges_ImplantacaoEstruturaProposta_Id DEFAULT NEWID(),
    Ges_ObraId INT NULL,
    Protocolo VARCHAR(30) NOT NULL,
    Situacao SMALLINT NOT NULL CONSTRAINT DF_Ges_ImplantacaoEstruturaProposta_Situacao DEFAULT 1,
    Versao INT NOT NULL CONSTRAINT DF_Ges_ImplantacaoEstruturaProposta_Versao DEFAULT 1,
    JsonTecnico NVARCHAR(MAX) NOT NULL,
    HashJson CHAR(64) NOT NULL,
    CriadoEm DATETIME2 NOT NULL CONSTRAINT DF_Ges_ImplantacaoEstruturaProposta_CriadoEm DEFAULT SYSUTCDATETIME(),
    CriadoPorSeg_UsuarioId INT NOT NULL,
    AtualizadoEm DATETIME2 NULL,
    AtualizadoPorSeg_UsuarioId INT NULL,
    EnviadoValidacaoEm DATETIME2 NULL,
    ValidadoEm DATETIME2 NULL,
    ValidadoPorSeg_UsuarioId INT NULL,
    ImplantadoEm DATETIME2 NULL,
    ImplantadoPorSeg_UsuarioId INT NULL,
    MensagemRetorno NVARCHAR(2000) NULL,
    CONSTRAINT PK_Ges_ImplantacaoEstruturaProposta PRIMARY KEY (Ges_ImplantacaoEstruturaPropostaId),
    CONSTRAINT UQ_Ges_ImplantacaoEstruturaProposta_Protocolo UNIQUE (Protocolo),
    CONSTRAINT CK_Ges_ImplantacaoEstruturaProposta_Json CHECK (ISJSON(JsonTecnico) = 1),
    CONSTRAINT FK_Ges_ImplantacaoEstruturaProposta_Ges_Obra FOREIGN KEY (Ges_ObraId) REFERENCES dbo.Ges_Obra(Ges_ObraId),
    CONSTRAINT FK_Ges_ImplantacaoEstruturaProposta_CriadoPor FOREIGN KEY (CriadoPorSeg_UsuarioId) REFERENCES dbo.Seg_Usuario(Seg_UsuarioId),
    CONSTRAINT FK_Ges_ImplantacaoEstruturaProposta_AtualizadoPor FOREIGN KEY (AtualizadoPorSeg_UsuarioId) REFERENCES dbo.Seg_Usuario(Seg_UsuarioId),
    CONSTRAINT FK_Ges_ImplantacaoEstruturaProposta_ValidadoPor FOREIGN KEY (ValidadoPorSeg_UsuarioId) REFERENCES dbo.Seg_Usuario(Seg_UsuarioId),
    CONSTRAINT FK_Ges_ImplantacaoEstruturaProposta_ImplantadoPor FOREIGN KEY (ImplantadoPorSeg_UsuarioId) REFERENCES dbo.Seg_Usuario(Seg_UsuarioId)
);
GO

CREATE INDEX IX_Ges_ImplantacaoEstruturaProposta_Ges_ObraId_Situacao
ON dbo.Ges_ImplantacaoEstruturaProposta (Ges_ObraId, Situacao)
INCLUDE (Protocolo, Versao, CriadoEm);
GO

CREATE TABLE dbo.Ges_ImplantacaoEstruturaAuditoria (
    Ges_ImplantacaoEstruturaAuditoriaId BIGINT IDENTITY(1,1) NOT NULL,
    Ges_ImplantacaoEstruturaPropostaId UNIQUEIDENTIFIER NOT NULL,
    DataHora DATETIME2 NOT NULL CONSTRAINT DF_Ges_ImplantacaoEstruturaAuditoria_DataHora DEFAULT SYSUTCDATETIME(),
    Seg_UsuarioId INT NOT NULL,
    Acao NVARCHAR(80) NOT NULL,
    Campo NVARCHAR(200) NULL,
    ValorAnterior NVARCHAR(MAX) NULL,
    ValorNovo NVARCHAR(MAX) NULL,
    JsonDiff NVARCHAR(MAX) NULL,
    IpOrigem VARCHAR(45) NULL,
    UserAgent NVARCHAR(500) NULL,
    CONSTRAINT PK_Ges_ImplantacaoEstruturaAuditoria PRIMARY KEY (Ges_ImplantacaoEstruturaAuditoriaId),
    CONSTRAINT CK_Ges_ImplantacaoEstruturaAuditoria_JsonDiff CHECK (JsonDiff IS NULL OR ISJSON(JsonDiff) = 1),
    CONSTRAINT FK_Ges_ImplantacaoEstruturaAuditoria_Proposta FOREIGN KEY (Ges_ImplantacaoEstruturaPropostaId) REFERENCES dbo.Ges_ImplantacaoEstruturaProposta(Ges_ImplantacaoEstruturaPropostaId) ON DELETE CASCADE,
    CONSTRAINT FK_Ges_ImplantacaoEstruturaAuditoria_Usuario FOREIGN KEY (Seg_UsuarioId) REFERENCES dbo.Seg_Usuario(Seg_UsuarioId)
);
GO

CREATE INDEX IX_Ges_ImplantacaoEstruturaAuditoria_Proposta_DataHora
ON dbo.Ges_ImplantacaoEstruturaAuditoria (Ges_ImplantacaoEstruturaPropostaId, DataHora DESC);
GO

CREATE TABLE dbo.Ges_ImplantacaoEstruturaExportacaoLog (
    Ges_ImplantacaoEstruturaExportacaoLogId BIGINT IDENTITY(1,1) NOT NULL,
    Ges_ImplantacaoEstruturaPropostaId UNIQUEIDENTIFIER NOT NULL,
    DataHora DATETIME2 NOT NULL CONSTRAINT DF_Ges_ImplantacaoEstruturaExportacaoLog_DataHora DEFAULT SYSUTCDATETIME(),
    Seg_UsuarioId INT NOT NULL,
    TipoExportacao NVARCHAR(20) NOT NULL,
    NomeArquivo NVARCHAR(200) NOT NULL,
    HashArquivo CHAR(64) NULL,
    CONSTRAINT PK_Ges_ImplantacaoEstruturaExportacaoLog PRIMARY KEY (Ges_ImplantacaoEstruturaExportacaoLogId),
    CONSTRAINT FK_Ges_ImplantacaoEstruturaExportacaoLog_Proposta FOREIGN KEY (Ges_ImplantacaoEstruturaPropostaId) REFERENCES dbo.Ges_ImplantacaoEstruturaProposta(Ges_ImplantacaoEstruturaPropostaId) ON DELETE CASCADE,
    CONSTRAINT FK_Ges_ImplantacaoEstruturaExportacaoLog_Usuario FOREIGN KEY (Seg_UsuarioId) REFERENCES dbo.Seg_Usuario(Seg_UsuarioId)
);
GO
