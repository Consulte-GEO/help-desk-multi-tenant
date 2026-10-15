using ControleTecnologico.Domain.Entities.ImplantacaoEstrutura;

namespace ControleTecnologico.Repository.Specification.ImplantacaoEstrutura;

public interface IImplantacaoEstruturaRepository
{
    Task<GesImplantacaoEstruturaProposta?> ObterAsync(Guid id, CancellationToken cancellationToken);
    Task AdicionarAsync(GesImplantacaoEstruturaProposta entity, CancellationToken cancellationToken);
    Task SalvarAsync(CancellationToken cancellationToken);
}
