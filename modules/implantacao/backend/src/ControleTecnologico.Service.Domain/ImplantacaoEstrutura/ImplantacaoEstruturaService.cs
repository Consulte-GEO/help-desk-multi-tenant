using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using ControleTecnologico.Domain.DTO.ImplantacaoEstrutura;
using ControleTecnologico.Domain.Entities.ImplantacaoEstrutura;
using ControleTecnologico.Repository.Specification.ImplantacaoEstrutura;
using ControleTecnologico.Service.Domain.Specification.ImplantacaoEstrutura;
using GemBox.Spreadsheet;
using Microsoft.AspNetCore.Mvc;

namespace ControleTecnologico.Service.Domain.ImplantacaoEstrutura;

public sealed class ImplantacaoEstruturaService(IImplantacaoEstruturaRepository repository) : IImplantacaoEstruturaService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public Task<ImplantacaoEstruturaOptionsDto> ObterOpcoesAsync(CancellationToken cancellationToken)
        => Task.FromResult(new ImplantacaoEstruturaOptionsDto());


    public async Task<ImplantacaoEstruturaResultDto> ObterRascunhoAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await repository.ObterAsync(id, cancellationToken) ?? throw new InvalidOperationException("Rascunho não encontrado.");
        return ToResult(entity, ValidatePayload(JsonNode.Parse(entity.JsonTecnico)!.AsObject()));
    }

    public async Task<ImplantacaoEstruturaResultDto> CriarRascunhoAsync(ImplantacaoEstruturaDraftDto request, int usuarioId, CancellationToken cancellationToken)
    {
        var json = request.Payload.ToJsonString(JsonOptions);
        var entity = new GesImplantacaoEstruturaProposta
        {
            GesImplantacaoEstruturaPropostaId = Guid.NewGuid(),
            GesObraId = request.GesObraId,
            Protocolo = $"IMP-EST-{DateTime.UtcNow:yyyyMMddHHmmss}",
            Situacao = 1,
            Versao = 1,
            JsonTecnico = json,
            HashJson = Sha256(json),
            CriadoEm = DateTime.UtcNow,
            CriadoPorSegUsuarioId = usuarioId
        };

        await repository.AdicionarAsync(entity, cancellationToken);
        await repository.SalvarAsync(cancellationToken);
        return ToResult(entity, ValidatePayload(request.Payload));
    }

    public async Task<ImplantacaoEstruturaResultDto> AtualizarRascunhoAsync(Guid id, ImplantacaoEstruturaDraftDto request, int usuarioId, CancellationToken cancellationToken)
    {
        var entity = await repository.ObterAsync(id, cancellationToken) ?? throw new InvalidOperationException("Rascunho não encontrado.");
        EnsureEditable(entity);
        var json = request.Payload.ToJsonString(JsonOptions);
        entity.JsonTecnico = json;
        entity.HashJson = Sha256(json);
        entity.AtualizadoEm = DateTime.UtcNow;
        entity.AtualizadoPorSegUsuarioId = usuarioId;
        await repository.SalvarAsync(cancellationToken);
        return ToResult(entity, ValidatePayload(request.Payload));
    }

    public async Task<ImplantacaoEstruturaValidationDto> ValidarAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await repository.ObterAsync(id, cancellationToken) ?? throw new InvalidOperationException("Rascunho não encontrado.");
        return ValidatePayload(JsonNode.Parse(entity.JsonTecnico)!.AsObject());
    }

    public async Task<ImplantacaoEstruturaResultDto> EnviarParaValidacaoAsync(Guid id, int usuarioId, CancellationToken cancellationToken)
    {
        var entity = await repository.ObterAsync(id, cancellationToken) ?? throw new InvalidOperationException("Rascunho não encontrado.");
        var validation = ValidatePayload(JsonNode.Parse(entity.JsonTecnico)!.AsObject());
        if (validation.Bloqueantes.Count > 0) throw new InvalidOperationException("Existem bloqueios antes do envio para validação.");
        entity.Situacao = 2;
        entity.EnviadoValidacaoEm = DateTime.UtcNow;
        entity.AtualizadoPorSegUsuarioId = usuarioId;
        entity.AtualizadoEm = DateTime.UtcNow;
        await repository.SalvarAsync(cancellationToken);
        return ToResult(entity, validation);
    }

    public async Task<ImplantacaoEstruturaResultDto> ImplantarAsync(Guid id, int usuarioId, CancellationToken cancellationToken)
    {
        var entity = await repository.ObterAsync(id, cancellationToken) ?? throw new InvalidOperationException("Rascunho não encontrado.");
        var payload = JsonNode.Parse(entity.JsonTecnico)!.AsObject();
        var validation = ValidatePayload(payload);
        if (validation.Bloqueantes.Count > 0) throw new InvalidOperationException("Não é possível implantar com bloqueios.");

        // Fluxo real de implantação em uma transação SQL:
        // 1. Resolver/criar Pro_Projetista por Descricao, a partir do campo livre Projetista.
        // 2. Resolver/criar Utl_Produto e Con_Concreto por FCK/especificação.
        // 3. Inserir Ges_UnidadeGrupo preservando tempId -> id real.
        // 4. Inserir Ges_UnidadeTipo resolvendo Ges_ClassificacaoId e Utl_ProdutoId.
        // 5. Inserir Ges_Unidade resolvendo Ges_UnidadeGrupoId e Ges_UnidadeTipoId.
        // 6. Registrar eventos de auditoria.
        entity.Situacao = 4;
        entity.ImplantadoEm = DateTime.UtcNow;
        entity.AtualizadoPorSegUsuarioId = usuarioId;
        entity.AtualizadoEm = DateTime.UtcNow;
        await repository.SalvarAsync(cancellationToken);
        return ToResult(entity, validation);
    }

    public async Task<FileContentResult> ExportarJsonAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await repository.ObterAsync(id, cancellationToken) ?? throw new InvalidOperationException("Rascunho não encontrado.");
        return new FileContentResult(Encoding.UTF8.GetBytes(entity.JsonTecnico), "application/json")
        {
            FileDownloadName = $"implantacao-estrutura-{entity.GesImplantacaoEstruturaPropostaId:N}.json"
        };
    }

    public async Task<FileContentResult> ExportarExcelAsync(Guid id, CancellationToken cancellationToken)
    {
        var entity = await repository.ObterAsync(id, cancellationToken) ?? throw new InvalidOperationException("Rascunho não encontrado.");
        var payload = JsonNode.Parse(entity.JsonTecnico)!.AsObject();
        SpreadsheetInfo.SetLicense("FREE-LIMITED-KEY");
        var workbook = new ExcelFile();
        AddResumo(workbook, payload);
        AddJsonArraySheet(workbook, "Entrada Cliente", payload["customerInput"]?["rows"]?.AsArray());
        AddJsonArraySheet(workbook, "Estruturas", payload["normalizedStructure"]?["structures"]?.AsArray());
        AddJsonArraySheet(workbook, "Tipos Tecnicos", payload["normalizedStructure"]?["unitTypes"]?.AsArray());
        AddJsonArraySheet(workbook, "Unidades", payload["normalizedStructure"]?["units"]?.AsArray());
        AddMappingSheet(workbook, payload["technicalMapping"]?["tables"]?.AsObject());
        AddValidationSheet(workbook, payload["validation"]?.AsObject());
        using var stream = new MemoryStream();
        workbook.Save(stream, SaveOptions.XlsxDefault);
        return new FileContentResult(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        {
            FileDownloadName = $"exportacao-tecnica-implantacao-{entity.GesImplantacaoEstruturaPropostaId:N}.xlsx"
        };
    }

    private static ImplantacaoEstruturaValidationDto ValidatePayload(JsonObject payload)
    {
        var bloqueantes = new List<ValidationIssueDto>();
        var alertas = new List<ValidationIssueDto>();
        var rows = payload["customerInput"]?["rows"]?.AsArray();
        if (rows is null || rows.Count == 0)
            bloqueantes.Add(new ValidationIssueDto { Campo = "Estruturas", Localizacao = "Entrada", Mensagem = "Inclua ao menos uma linha." });

        if (rows is not null)
        {
            for (var index = 0; index < rows.Count; index++)
            {
                var row = rows[index]!.AsObject();
                var loc = $"Linha {index + 1}";
                var projetista = row["projetista"]?.GetValue<string>() ?? string.Empty;
                var peca = row["peca"]?.GetValue<string>() ?? string.Empty;
                var nomenclatura = row["nomenclaturaSistema"]?.GetValue<string>() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(peca)) bloqueantes.Add(new ValidationIssueDto { Campo = "Peça", Localizacao = loc, Mensagem = "Peça é obrigatória." });
                if (projetista.Length > 50) bloqueantes.Add(new ValidationIssueDto { Campo = "Projetista", Localizacao = loc, Mensagem = "Máximo de 50 caracteres." });
                if (nomenclatura.Length > 50) bloqueantes.Add(new ValidationIssueDto { Campo = "Nomenclatura no Sistema", Localizacao = loc, Mensagem = "Máximo de 50 caracteres." });
                if (string.IsNullOrWhiteSpace(projetista)) alertas.Add(new ValidationIssueDto { Campo = "Projetista", Localizacao = loc, Mensagem = "Projetista não informado." });
            }
        }

        return new ImplantacaoEstruturaValidationDto
        {
            Bloqueantes = bloqueantes,
            Alertas = alertas,
            Sugestoes = Array.Empty<ValidationIssueDto>(),
            PendenciasInternas = new[] { new ValidationIssueDto { Campo = "Ges_MapaId", Localizacao = "Implantação", Mensagem = "Selecionar mapa padrão antes de gravar as estruturas." } }
        };
    }

    private static ImplantacaoEstruturaResultDto ToResult(GesImplantacaoEstruturaProposta entity, ImplantacaoEstruturaValidationDto validation)
        => new()
        {
            Id = entity.GesImplantacaoEstruturaPropostaId,
            Status = entity.Situacao.ToString(),
            Validation = validation,
            Payload = JsonNode.Parse(entity.JsonTecnico)!.AsObject()
        };

    private static void EnsureEditable(GesImplantacaoEstruturaProposta entity)
    {
        if (entity.Situacao == 4) throw new InvalidOperationException("Proposta já implantada.");
    }

    private static string Sha256(string value)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static void AddResumo(ExcelFile workbook, JsonObject payload)
    {
        var sheet = workbook.Worksheets.Add("Resumo");
        sheet.Cells[0, 0].Value = "Campo";
        sheet.Cells[0, 1].Value = "Valor";
        sheet.Cells[1, 0].Value = "Obra";
        sheet.Cells[1, 1].Value = payload["customerInput"]?["obra"]?["nome"]?.GetValue<string>() ?? string.Empty;
        sheet.Cells[2, 0].Value = "Código";
        sheet.Cells[2, 1].Value = payload["customerInput"]?["obra"]?["codigo"]?.GetValue<string>() ?? string.Empty;
        sheet.Cells[3, 0].Value = "Gerado em";
        sheet.Cells[3, 1].Value = payload["metadata"]?["generatedAt"]?.GetValue<string>() ?? string.Empty;
    }

    private static void AddJsonArraySheet(ExcelFile workbook, string name, JsonArray? rows)
    {
        var sheet = workbook.Worksheets.Add(name);
        if (rows is null || rows.Count == 0) return;
        var keys = rows.SelectMany(row => row!.AsObject().Select(x => x.Key)).Distinct().ToArray();
        for (var col = 0; col < keys.Length; col++) sheet.Cells[0, col].Value = keys[col];
        for (var rowIndex = 0; rowIndex < rows.Count; rowIndex++)
        {
            var obj = rows[rowIndex]!.AsObject();
            for (var col = 0; col < keys.Length; col++) sheet.Cells[rowIndex + 1, col].Value = obj[keys[col]]?.ToJsonString(JsonOptions) ?? string.Empty;
        }
    }

    private static void AddMappingSheet(ExcelFile workbook, JsonObject? tables)
    {
        var sheet = workbook.Worksheets.Add("Mapeamento Banco");
        sheet.Cells[0, 0].Value = "Tabela";
        sheet.Cells[0, 1].Value = "Payload";
        if (tables is null) return;
        var rowIndex = 1;
        foreach (var table in tables)
        {
            foreach (var item in table.Value!.AsArray())
            {
                sheet.Cells[rowIndex, 0].Value = table.Key;
                sheet.Cells[rowIndex, 1].Value = item!.ToJsonString(JsonOptions);
                rowIndex++;
            }
        }
    }

    private static void AddValidationSheet(ExcelFile workbook, JsonObject? validation)
    {
        var sheet = workbook.Worksheets.Add("Validacoes");
        sheet.Cells[0, 0].Value = "Tipo";
        sheet.Cells[0, 1].Value = "Item";
        if (validation is null) return;
        var rowIndex = 1;
        foreach (var bucket in validation)
        {
            foreach (var item in bucket.Value!.AsArray())
            {
                sheet.Cells[rowIndex, 0].Value = bucket.Key;
                sheet.Cells[rowIndex, 1].Value = item!.ToJsonString(JsonOptions);
                rowIndex++;
            }
        }
    }
}
