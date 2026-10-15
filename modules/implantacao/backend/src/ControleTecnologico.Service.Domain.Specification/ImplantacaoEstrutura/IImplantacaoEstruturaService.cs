using ControleTecnologico.Domain.DTO.ImplantacaoEstrutura;
using Microsoft.AspNetCore.Mvc;

namespace ControleTecnologico.Service.Domain.Specification.ImplantacaoEstrutura;

public interface IImplantacaoEstruturaService
{
    Task<ImplantacaoEstruturaOptionsDto> ObterOpcoesAsync(CancellationToken cancellationToken);
    Task<ImplantacaoEstruturaResultDto> ObterRascunhoAsync(Guid id, CancellationToken cancellationToken);
    Task<ImplantacaoEstruturaResultDto> CriarRascunhoAsync(ImplantacaoEstruturaDraftDto request, int usuarioId, CancellationToken cancellationToken);
    Task<ImplantacaoEstruturaResultDto> AtualizarRascunhoAsync(Guid id, ImplantacaoEstruturaDraftDto request, int usuarioId, CancellationToken cancellationToken);
    Task<ImplantacaoEstruturaValidationDto> ValidarAsync(Guid id, CancellationToken cancellationToken);
    Task<ImplantacaoEstruturaResultDto> EnviarParaValidacaoAsync(Guid id, int usuarioId, CancellationToken cancellationToken);
    Task<ImplantacaoEstruturaResultDto> ImplantarAsync(Guid id, int usuarioId, CancellationToken cancellationToken);
    Task<FileContentResult> ExportarJsonAsync(Guid id, CancellationToken cancellationToken);
    Task<FileContentResult> ExportarExcelAsync(Guid id, CancellationToken cancellationToken);
}
