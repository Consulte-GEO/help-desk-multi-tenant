// =====================================================================
// v5.22.8 — Controller stub para recepção de technical_json
//
// Endpoints alinhados com o que o frontend Vue gera (v5.22.6+).
// Este controller NÃO substitui o legado em ImplantacaoEstruturaController;
// é um pré-stub experimental que prova portabilidade do contrato JSON
// para o backend .NET 8 + SQL Server.
//
// Persistência: setup_submissions_v52 (DDL em database/003_setup_submissions_v52.sql).
// Implantação real (Ges_Obra, Ges_Unidade, etc): NÃO FAZ NADA.
//
// Authorization: removida [Authorize] propositalmente — endpoint stub
// pra teste técnico, vai precisar de OIDC quando for produto real.
// =====================================================================

using ControleTecnologico.Domain.DTO.ImplantacaoEstrutura;
using Microsoft.AspNetCore.Mvc;

namespace ControleTecnologico.Application.Api.Controllers;

[ApiController]
[Route("api/v52/implantacao-estrutura")]
public sealed class ImplantacaoEstruturaV52Controller : ControllerBase
{
    /// <summary>
    /// Stub: recebe o technical_json gerado pelo frontend Vue, gera
    /// ticket_number e retorna confirmação. Não persiste em tabelas
    /// reais do produto — apenas em setup_submissions_v52 (mirror do
    /// Supabase).
    /// </summary>
    /// <param name="id">Draft ID gerado pelo frontend (UUID).</param>
    /// <param name="payload">technical_json completo.</param>
    [HttpPost("drafts/{id:guid}/submit")]
    public ActionResult<SubmitImplantacaoResultDto> Submit(
        [FromRoute] Guid id,
        [FromBody] TechnicalJsonDto payload,
        CancellationToken cancellationToken)
    {
        if (payload is null)
        {
            return BadRequest(new { error = "payload_required" });
        }

        // Validação mínima do contrato — só checa que campos críticos vieram
        if (string.IsNullOrWhiteSpace(payload.Metadata.SchemaVersion))
        {
            return BadRequest(new { error = "missing_schema_version" });
        }
        if (string.IsNullOrWhiteSpace(payload.CustomerInput.DadosBasicos.ObraNome))
        {
            return BadRequest(new { error = "missing_obra_nome" });
        }

        // Geração de ticket_number determinística-ish: ano + 6 dígitos do tick.
        // No produto real, ticket_number vem de sequence/identity SQL Server.
        var year = DateTimeOffset.UtcNow.Year;
        var seq = (int)(DateTimeOffset.UtcNow.Ticks % 1000000);
        var ticketNumber = $"CG-{year}-{seq:D6}";

        // Contagens derivadas
        var pecaCount = payload.CustomerInput.Grupos.Sum(g => g.Pecas.Count);

        var result = new SubmitImplantacaoResultDto
        {
            SubmissionId = Guid.NewGuid(),
            TicketNumber = ticketNumber,
            Status = "enviado",
            ReceivedAt = DateTimeOffset.UtcNow,
            SchemaVersion = payload.Metadata.SchemaVersion,
            Counts = new SubmitCountsDto
            {
                Estruturas = payload.CustomerInput.Grupos.Count,
                Pecas = pecaCount,
                Concretos = payload.CustomerInput.Concretos.Count,
                UsuariosObra = payload.CustomerInput.UsuariosObra.Count,
                Fornecedores = payload.CustomerInput.Fornecedores.Count,
            },
        };

        // TODO v5.23+: persistir em setup_submissions_v52 via repository.
        // Por enquanto retorna em memória — prova de que o contrato bate.

        return Ok(result);
    }

    /// <summary>
    /// Stub: ecoa o JSON recebido com as contagens calculadas pelo servidor.
    /// Útil para o frontend validar que o payload chegou íntegro antes de
    /// chamar Submit "for real".
    /// </summary>
    [HttpPost("drafts/{id:guid}/echo")]
    public ActionResult<object> Echo(
        [FromRoute] Guid id,
        [FromBody] TechnicalJsonDto payload)
    {
        if (payload is null) return BadRequest(new { error = "payload_required" });

        return Ok(new
        {
            draftId = id,
            schemaVersion = payload.Metadata.SchemaVersion,
            obraNome = payload.CustomerInput.DadosBasicos.ObraNome,
            counts = new
            {
                estruturas = payload.CustomerInput.Grupos.Count,
                pecas = payload.CustomerInput.Grupos.Sum(g => g.Pecas.Count),
                concretos = payload.CustomerInput.Concretos.Count,
                usuariosObra = payload.CustomerInput.UsuariosObra.Count,
                fornecedores = payload.CustomerInput.Fornecedores.Count,
                usinas = payload.CustomerInput.Fornecedores.Count(f => f.Tipo == "usina"),
                laboratorios = payload.CustomerInput.Fornecedores.Count(f => f.Tipo == "laboratorio"),
            },
        });
    }
}
