using System.Text.Json.Nodes;

namespace ControleTecnologico.Domain.DTO.ImplantacaoEstrutura;

public sealed class ImplantacaoEstruturaDraftDto
{
    public Guid? Id { get; set; }
    public int GesObraId { get; set; }
    public string Status { get; set; } = "draft";
    public JsonObject Payload { get; set; } = new();
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class ImplantacaoEstruturaOptionsDto
{
    public string[] TiposEstrutura { get; set; } = ["Bloco", "Torre", "Contenção", "Área Externa", "Anexos", "Apoio"];
    public string[] Etapas { get; set; } = ["Fundação", "Infraestrutura", "Estrutura", "Contenções", "Demais Estruturas"];
    public bool ProjetistaLivre { get; set; } = true;
    public int UtlTipoFornecimentoConcretoId { get; set; } = 1;
}

public sealed class ImplantacaoEstruturaResultDto
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public ImplantacaoEstruturaValidationDto Validation { get; set; } = new();
    public JsonObject Payload { get; set; } = new();
}

public sealed class ImplantacaoEstruturaValidationDto
{
    public IReadOnlyList<ValidationIssueDto> Bloqueantes { get; set; } = Array.Empty<ValidationIssueDto>();
    public IReadOnlyList<ValidationIssueDto> Alertas { get; set; } = Array.Empty<ValidationIssueDto>();
    public IReadOnlyList<ValidationIssueDto> Sugestoes { get; set; } = Array.Empty<ValidationIssueDto>();
    public IReadOnlyList<ValidationIssueDto> PendenciasInternas { get; set; } = Array.Empty<ValidationIssueDto>();
}

public sealed class ValidationIssueDto
{
    public string Campo { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public string Localizacao { get; set; } = string.Empty;
}
