// =====================================================================
// v5.22.8 — DTOs do contrato real do frontend Vue (technical_json)
//
// Estes DTOs representam o JSON que o frontend POSTa para o endpoint
// /api/implantacao-estrutura/drafts/{id}/submit. Os DTOs antigos
// (ImplantacaoEstruturaDraftDto + JsonObject) continuam válidos para
// camada de persistência crua; estes DTOs aqui são para deserialização
// fortemente tipada.
//
// Compatível com System.Text.Json. Use [JsonPropertyName] quando o
// nome em camelCase diferir do PascalCase C#.
//
// STATUS: stub. Esta v5.22.8 não implanta nada nas tabelas reais do
// Consulte GEO (Ges_*, Con_*) — apenas persiste em setup_submissions_v52
// e retorna ticket_number gerado. A implantação real será feita em
// versão futura quando os endpoints definitivos estiverem prontos.
// =====================================================================

using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace ControleTecnologico.Domain.DTO.ImplantacaoEstrutura;

/// <summary>
/// Payload completo enviado pelo frontend ao submeter uma implantação
/// para validação. Espelha o que o jsonGeneratorService.ts gera.
/// </summary>
public sealed class TechnicalJsonDto
{
    [JsonPropertyName("metadata")]
    public TechnicalMetadataDto Metadata { get; set; } = new();

    [JsonPropertyName("customerInput")]
    public CustomerInputDto CustomerInput { get; set; } = new();

    /// <summary>
    /// Forma normalizada; opaca para o stub — guardamos como JsonObject.
    /// </summary>
    [JsonPropertyName("normalizedStructure")]
    public JsonObject? NormalizedStructure { get; set; }

    /// <summary>
    /// Mapeamento para tabelas alvo Ges_*, Con_* etc; opaco no stub.
    /// </summary>
    [JsonPropertyName("technicalMapping")]
    public JsonObject? TechnicalMapping { get; set; }

    [JsonPropertyName("validation")]
    public JsonObject? Validation { get; set; }

    [JsonPropertyName("renderTree")]
    public JsonObject? RenderTree { get; set; }

    [JsonPropertyName("audit")]
    public JsonArray? Audit { get; set; }
}

public sealed class TechnicalMetadataDto
{
    [JsonPropertyName("schemaVersion")]
    public string SchemaVersion { get; set; } = string.Empty;

    [JsonPropertyName("generatedAt")]
    public string? GeneratedAt { get; set; }

    [JsonPropertyName("projectName")]
    public string ProjectName { get; set; } = string.Empty;

    [JsonPropertyName("projectVersion")]
    public string? ProjectVersion { get; set; }

    [JsonPropertyName("environment")]
    public string? Environment { get; set; }

    [JsonPropertyName("draftId")]
    public string? DraftId { get; set; }

    [JsonPropertyName("submissionId")]
    public string? SubmissionId { get; set; }

    [JsonPropertyName("ticketNumber")]
    public string? TicketNumber { get; set; }

    [JsonPropertyName("clientMessage")]
    public string? ClientMessage { get; set; }

    /// <summary>v5.22.6: ISO timestamp quando o cliente reenviou após devolução.</summary>
    [JsonPropertyName("resubmittedAt")]
    public string? ResubmittedAt { get; set; }
}

public sealed class CustomerInputDto
{
    [JsonPropertyName("mode")]
    public string Mode { get; set; } = "estruturas";

    [JsonPropertyName("dadosBasicos")]
    public ObraDadosBasicosDto DadosBasicos { get; set; } = new();

    [JsonPropertyName("tipoEstrutura")]
    public string TipoEstrutura { get; set; } = string.Empty;

    [JsonPropertyName("grupos")]
    public List<GrupoDto> Grupos { get; set; } = new();

    [JsonPropertyName("concretos")]
    public List<ConcretoDto> Concretos { get; set; } = new();

    /// <summary>v5.22.6: usuários da obra (Etapa 6).</summary>
    [JsonPropertyName("usuariosObra")]
    public List<UsuarioObraDto> UsuariosObra { get; set; } = new();

    /// <summary>v5.22.7: fornecedores (Etapa 7).</summary>
    [JsonPropertyName("fornecedores")]
    public List<FornecedorDto> Fornecedores { get; set; } = new();
}

public sealed class ObraDadosBasicosDto
{
    [JsonPropertyName("obraNome")]
    public string ObraNome { get; set; } = string.Empty;

    [JsonPropertyName("obraCodigo")]
    public string? ObraCodigo { get; set; }

    [JsonPropertyName("cliente")]
    public string? Cliente { get; set; }

    [JsonPropertyName("regional")]
    public string? Regional { get; set; }

    [JsonPropertyName("obraEndereco")]
    public string? ObraEndereco { get; set; }

    [JsonPropertyName("cep")]
    public string? Cep { get; set; }

    [JsonPropertyName("municipio")]
    public string? Municipio { get; set; }

    [JsonPropertyName("uf")]
    public string? Uf { get; set; }

    [JsonPropertyName("responsavelNome")]
    public string? ResponsavelNome { get; set; }

    [JsonPropertyName("responsavelEmail")]
    public string? ResponsavelEmail { get; set; }

    [JsonPropertyName("responsavelTelefone")]
    public string? ResponsavelTelefone { get; set; }

    [JsonPropertyName("observacoes")]
    public string? Observacoes { get; set; }
}

public sealed class GrupoDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("nome")] public string Nome { get; set; } = string.Empty;
    [JsonPropertyName("edificacoesInput")] public string? EdificacoesInput { get; set; }
    [JsonPropertyName("tipoEdificacao")] public string? TipoEdificacao { get; set; }
    [JsonPropertyName("projetista")] public string? Projetista { get; set; }
    [JsonPropertyName("observacoes")] public string? Observacoes { get; set; }
    [JsonPropertyName("pecas")] public List<PecaDto> Pecas { get; set; } = new();
}

public sealed class PecaDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("local")] public string Local { get; set; } = string.Empty;
    [JsonPropertyName("etapa")] public string? Etapa { get; set; }
    [JsonPropertyName("fck")] public string? Fck { get; set; }
    /// <summary>
    /// Volume bruto digitado. Aceita vírgula ou ponto. Máximo 2 casas
    /// decimais (validado pelo frontend; backend não revalida no stub).
    /// </summary>
    [JsonPropertyName("volume")] public string? Volume { get; set; }
    [JsonPropertyName("concretoId")] public string? ConcretoId { get; set; }
    [JsonPropertyName("observacoes")] public string? Observacoes { get; set; }
    [JsonPropertyName("ordem")] public int? Ordem { get; set; }
}

public sealed class ConcretoDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("descricao")] public string Descricao { get; set; } = string.Empty;
    [JsonPropertyName("aplicacao")] public string? Aplicacao { get; set; }
    [JsonPropertyName("fck")] public string? Fck { get; set; }
    [JsonPropertyName("moldagem")] public string? Moldagem { get; set; }
}

/// <summary>
/// v5.22.6: usuário da obra cadastrado pelo cliente.
/// Perfis fixos no produto: operador_campo, engenheiro, qualidade,
/// laboratorio, analista_gestor.
/// </summary>
public sealed class UsuarioObraDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("nome")] public string Nome { get; set; } = string.Empty;
    [JsonPropertyName("email")] public string Email { get; set; } = string.Empty;
    [JsonPropertyName("cargo")] public string? Cargo { get; set; }
    [JsonPropertyName("telefone")] public string? Telefone { get; set; }
    [JsonPropertyName("perfil")] public string Perfil { get; set; } = string.Empty;
    [JsonPropertyName("observacoes")] public string? Observacoes { get; set; }
}

/// <summary>
/// v5.22.7: fornecedor cadastrado pelo cliente. Tipo é discriminador
/// (usina | laboratorio). Aceita até 3 emails de programação.
/// </summary>
public sealed class FornecedorDto
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("tipo")] public string Tipo { get; set; } = "usina";
    [JsonPropertyName("nome")] public string Nome { get; set; } = string.Empty;
    [JsonPropertyName("cnpj")] public string? Cnpj { get; set; }
    [JsonPropertyName("endereco")] public string? Endereco { get; set; }
    [JsonPropertyName("responsavel")] public string? Responsavel { get; set; }
    [JsonPropertyName("telefone")] public string? Telefone { get; set; }
    [JsonPropertyName("observacoes")] public string? Observacoes { get; set; }
    /// <summary>Até 3 emails. Mínimo 1 slot, podendo estar vazio.</summary>
    [JsonPropertyName("emailsProgramacao")]
    public List<string> EmailsProgramacao { get; set; } = new();
}

/// <summary>
/// Resposta do endpoint POST /api/implantacao-estrutura/drafts/{id}/submit.
/// </summary>
public sealed class SubmitImplantacaoResultDto
{
    /// <summary>UUID gerado pelo backend ao persistir.</summary>
    public Guid SubmissionId { get; set; }

    /// <summary>Ticket número CG-AAAA-NNNNNN.</summary>
    public string TicketNumber { get; set; } = string.Empty;

    /// <summary>Status no momento da resposta. Sempre 'enviado' no stub.</summary>
    public string Status { get; set; } = "enviado";

    /// <summary>Timestamp ISO 8601 quando foi persistido.</summary>
    public DateTimeOffset ReceivedAt { get; set; }

    /// <summary>Eco do schemaVersion recebido para o cliente confirmar contrato.</summary>
    public string SchemaVersion { get; set; } = string.Empty;

    /// <summary>
    /// Contagens derivadas para o cliente exibir confirmação imediata
    /// sem ter que parsear o payload de novo.
    /// </summary>
    public SubmitCountsDto Counts { get; set; } = new();
}

public sealed class SubmitCountsDto
{
    public int Estruturas { get; set; }
    public int Pecas { get; set; }
    public int Concretos { get; set; }
    public int UsuariosObra { get; set; }
    public int Fornecedores { get; set; }
}
