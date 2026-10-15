using ControleTecnologico.Domain.Entities.ImplantacaoEstrutura;
using ControleTecnologico.Repository.Configuration.Contexts;
using ControleTecnologico.Repository.Specification.ImplantacaoEstrutura;
using Microsoft.EntityFrameworkCore;

namespace ControleTecnologico.Repository.ImplantacaoEstrutura;

public sealed class ImplantacaoEstruturaRepository(GeoClienteContext context) : IImplantacaoEstruturaRepository
{
    public Task<GesImplantacaoEstruturaProposta?> ObterAsync(Guid id, CancellationToken cancellationToken)
        => context.Set<GesImplantacaoEstruturaProposta>().FirstOrDefaultAsync(x => x.GesImplantacaoEstruturaPropostaId == id, cancellationToken);

    public async Task AdicionarAsync(GesImplantacaoEstruturaProposta entity, CancellationToken cancellationToken)
        => await context.Set<GesImplantacaoEstruturaProposta>().AddAsync(entity, cancellationToken);

    public Task SalvarAsync(CancellationToken cancellationToken)
        => context.SaveChangesAsync(cancellationToken);
}
