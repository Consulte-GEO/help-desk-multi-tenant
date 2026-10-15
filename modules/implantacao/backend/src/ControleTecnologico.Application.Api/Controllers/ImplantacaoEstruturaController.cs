using ControleTecnologico.Domain.DTO.ImplantacaoEstrutura;
using ControleTecnologico.Service.Domain.Specification.ImplantacaoEstrutura;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControleTecnologico.Application.Api.Controllers;

[ApiController]
[Authorize(Policy = "AuthPolicy")]
[Route("api/implantacao-estrutura")]
public sealed class ImplantacaoEstruturaController(IImplantacaoEstruturaService service) : ControllerBase
{
    [HttpGet("opcoes")]
    public async Task<ActionResult<ImplantacaoEstruturaOptionsDto>> Opcoes(CancellationToken cancellationToken)
        => Ok(await service.ObterOpcoesAsync(cancellationToken));

    [HttpPost("rascunhos")]
    public async Task<ActionResult<ImplantacaoEstruturaResultDto>> CriarRascunho([FromBody] ImplantacaoEstruturaDraftDto request, CancellationToken cancellationToken)
        => Ok(await service.CriarRascunhoAsync(request, UsuarioId(), cancellationToken));


    [HttpGet("rascunhos/{id:guid}")]
    public async Task<ActionResult<ImplantacaoEstruturaResultDto>> ObterRascunho([FromRoute] Guid id, CancellationToken cancellationToken)
        => Ok(await service.ObterRascunhoAsync(id, cancellationToken));

    [HttpPut("rascunhos/{id:guid}")]
    public async Task<ActionResult<ImplantacaoEstruturaResultDto>> AtualizarRascunho([FromRoute] Guid id, [FromBody] ImplantacaoEstruturaDraftDto request, CancellationToken cancellationToken)
        => Ok(await service.AtualizarRascunhoAsync(id, request, UsuarioId(), cancellationToken));

    [HttpPost("rascunhos/{id:guid}/validar")]
    public async Task<ActionResult<ImplantacaoEstruturaValidationDto>> Validar([FromRoute] Guid id, CancellationToken cancellationToken)
        => Ok(await service.ValidarAsync(id, cancellationToken));

    [HttpPost("rascunhos/{id:guid}/enviar-validacao")]
    public async Task<ActionResult<ImplantacaoEstruturaResultDto>> EnviarParaValidacao([FromRoute] Guid id, CancellationToken cancellationToken)
        => Ok(await service.EnviarParaValidacaoAsync(id, UsuarioId(), cancellationToken));

    [HttpPost("rascunhos/{id:guid}/implantar")]
    public async Task<ActionResult<ImplantacaoEstruturaResultDto>> Implantar([FromRoute] Guid id, CancellationToken cancellationToken)
        => Ok(await service.ImplantarAsync(id, UsuarioId(), cancellationToken));

    [HttpGet("rascunhos/{id:guid}/exportar-json")]
    public Task<FileContentResult> ExportarJson([FromRoute] Guid id, CancellationToken cancellationToken)
        => service.ExportarJsonAsync(id, cancellationToken);

    [HttpGet("rascunhos/{id:guid}/exportar-excel")]
    public Task<FileContentResult> ExportarExcel([FromRoute] Guid id, CancellationToken cancellationToken)
        => service.ExportarExcelAsync(id, cancellationToken);

    private int UsuarioId()
    {
        var raw = User.FindFirst("codigoUsuario")?.Value ?? User.FindFirst("sub")?.Value;
        return int.TryParse(raw, out var id) ? id : 0;
    }
}
