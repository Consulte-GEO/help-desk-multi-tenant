using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ControleTecnologico.Domain.Entities.ImplantacaoEstrutura;

[Table("Ges_ImplantacaoEstruturaProposta")]
public sealed class GesImplantacaoEstruturaProposta
{
    [Key]
    [Column("Ges_ImplantacaoEstruturaPropostaId")]
    public Guid GesImplantacaoEstruturaPropostaId { get; set; }

    [Column("Ges_ObraId")]
    public int GesObraId { get; set; }

    [MaxLength(30)]
    public string Protocolo { get; set; } = string.Empty;

    public short Situacao { get; set; }
    public int Versao { get; set; }
    public string JsonTecnico { get; set; } = "{}";

    [MaxLength(64)]
    public string HashJson { get; set; } = string.Empty;

    public DateTime CriadoEm { get; set; }

    [Column("CriadoPorSeg_UsuarioId")]
    public int CriadoPorSegUsuarioId { get; set; }

    public DateTime? AtualizadoEm { get; set; }

    [Column("AtualizadoPorSeg_UsuarioId")]
    public int? AtualizadoPorSegUsuarioId { get; set; }

    public DateTime? EnviadoValidacaoEm { get; set; }
    public DateTime? ImplantadoEm { get; set; }
}
