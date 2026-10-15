# Blueprint: Portar v5.22.25 e v5.22.26 para o backend .NET 8

> **Status**: documento orientativo, nenhuma linha aqui foi compilada.
> Quando o time .NET assumir a portabilidade do backend, use estes
> snippets como ponto de partida. O contrato JSON do frontend (Vue) e
> da Edge Function (Deno) é a fonte de verdade — qualquer divergência
> entre estes snippets e o código real do frontend deve ser resolvida
> a favor do frontend.

## Sumário

1. [StepMappingService.cs](#stepmappingservicecs) — espelho de
   `stepMappingService.ts` (v5.22.25)
2. [ShareDraftService.cs](#sharedraftservicecs) — espelho da Edge
   Function `share-draft-link` (v5.22.26)
3. [Endpoint controller](#endpoint-controller)
4. [DTOs](#dtos)
5. [Configuração de Resend e variáveis de ambiente](#configuração-de-resend-e-variáveis-de-ambiente)
6. [Testes mínimos](#testes-mínimos)

---

## StepMappingService.cs

Equivalente C# do helper TypeScript `stepMappingService.ts`. Razões para
existir do lado .NET:

- Validação server-side dos drafts (no
  `POST /api/.../drafts/{id}/validate`) precisa gerar `localizacao` no
  mesmo formato `"Etapa N · Título"` que o frontend mostra. Sem isso,
  o cliente compara strings client-side vs server-side e vê
  divergência.
- Excel técnico exportado pelo backend (`GET .../exportar-excel`) lê
  a `localizacao` direto na coluna. Se backend e frontend usarem
  fontes diferentes, dá inconsistência cross-canal.

```csharp
// src/ControleTecnologico.Service.Domain/ImplantacaoEstrutura/StepMappingService.cs
using System.Text.RegularExpressions;

namespace ControleTecnologico.Service.Domain.ImplantacaoEstrutura;

/// <summary>
/// Espelho .NET do helper stepMappingService.ts (frontend Vue, v5.22.25).
/// Lê WIZARD_STEPS estaticamente para garantir consistência com o
/// frontend. Se o wizard mudar, este arquivo precisa mudar junto.
/// </summary>
public static class StepMappingService
{
    /// <summary>
    /// Numeração pós-v5.22.11. Espelha WIZARD_STEPS do frontend
    /// (src/models/setup.models.ts).
    /// </summary>
    public static readonly IReadOnlyDictionary<int, string> WizardSteps =
        new Dictionary<int, string>
        {
            [1] = "Dados básicos",
            [2] = "Blocos e torres",
            [3] = "Concretos",
            [4] = "Pavimentos e peças",
            [5] = "Usuários da obra",
            [6] = "Fornecedores",
            [7] = "Revisão e envio",
            // Etapas exclusivas da equipe (em ReviewView)
            [8] = "Validação para Implantação",
            [9] = "Acompanhamento",
        };

    private static readonly (Regex Pattern, int StepId)[] PathRules = new[]
    {
        (new Regex(@"^metadata\."),                  1),
        // pecas precisa vir antes de grupos genérico — share-prefix
        (new Regex(@"^grupos(\[[^\]]*\])?\.pecas"),  4),
        (new Regex(@"^grupos"),                      2),
        (new Regex(@"^concretos"),                   3),
        (new Regex(@"^usuariosObra"),                5),
        (new Regex(@"^fornecedores"),                6),
    };

    /// <summary>
    /// Mapeia o `path` de um ValidationIssue para o ID da etapa onde
    /// o usuário deve corrigir. Fallback defensivo: Etapa 1 (nunca
    /// deveria acontecer se as regras cobrirem todos os paths).
    /// </summary>
    public static int PathToStep(string path)
    {
        if (string.IsNullOrEmpty(path)) return 1;
        foreach (var (pattern, stepId) in PathRules)
        {
            if (pattern.IsMatch(path)) return stepId;
        }
        return 1;
    }

    /// <summary>
    /// Retorna o título da etapa (ex.: "Blocos e torres"). Lê direto
    /// de WizardSteps. Se stepId inválido, devolve "Etapa N" como
    /// último recurso.
    /// </summary>
    public static string StepTitle(int stepId)
        => WizardSteps.TryGetValue(stepId, out var title) ? title : $"Etapa {stepId}";

    /// <summary>
    /// Retorna a localizacao padrão a partir do path do issue.
    /// Formato: "Etapa N · Título".
    /// </summary>
    public static string LocalizacaoForPath(string path)
    {
        var stepId = PathToStep(path);
        return $"Etapa {stepId} · {StepTitle(stepId)}";
    }
}
```

### Teste mínimo

```csharp
// tests/.../StepMappingServiceTests.cs
using Xunit;
using ControleTecnologico.Service.Domain.ImplantacaoEstrutura;

public class StepMappingServiceTests
{
    [Theory]
    [InlineData("metadata.obraNome", 1)]
    [InlineData("grupos[0].pecas[0].fck", 4)]  // peca antes de grupo
    [InlineData("grupos[0].nome", 2)]
    [InlineData("concretos[0].nome", 3)]
    [InlineData("usuariosObra[0].email", 5)]
    [InlineData("fornecedores[0].cnpj", 6)]
    [InlineData("", 1)]                          // fallback
    [InlineData("unknown.path", 1)]              // fallback
    public void PathToStep_MapsCorrectly(string path, int expected)
    {
        Assert.Equal(expected, StepMappingService.PathToStep(path));
    }

    [Fact]
    public void LocalizacaoForPath_ReturnsFormattedTitle()
    {
        Assert.Equal("Etapa 2 · Blocos e torres",
            StepMappingService.LocalizacaoForPath("grupos[0].nome"));
        Assert.Equal("Etapa 6 · Fornecedores",
            StepMappingService.LocalizacaoForPath("fornecedores[0].cnpj"));
    }
}
```

---

## ShareDraftService.cs

Equivalente C# da Edge Function `supabase/functions/share-draft-link`
(v5.22.26). Vantagens sobre a Edge Function:

- Audit server-side **dentro da transação** (a Edge Function delegou
  para o frontend via `addAuditLocal`)
- Validação de existência do `draftId` antes de gastar Resend
- Quando houver auth real, suporte a tokens de acesso por link em
  vez de UUID exposto

```csharp
// src/ControleTecnologico.Service.Domain.Specification/ImplantacaoEstrutura/IShareDraftService.cs
public interface IShareDraftService
{
    Task<ShareDraftResult> ShareLinkAsync(
        Guid draftId,
        ShareDraftLinkRequest request,
        int usuarioId,
        CancellationToken cancellationToken);
}

public sealed record ShareDraftLinkRequest(
    string RecipientEmail,
    string? RecipientName,
    string? SenderName,
    string? Message);

public sealed record ShareDraftResult(
    bool Ok,
    string? EmailId,
    string? Error,
    string? SentTo);
```

```csharp
// src/ControleTecnologico.Service.Domain/ImplantacaoEstrutura/ShareDraftService.cs
using System.Net.Mail;
using System.Text.Json;
using System.Text.RegularExpressions;
using ControleTecnologico.Repository.Specification.ImplantacaoEstrutura;
using ControleTecnologico.Service.Domain.Specification.ImplantacaoEstrutura;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ControleTecnologico.Service.Domain.ImplantacaoEstrutura;

public sealed class ShareDraftService(
    IImplantacaoEstruturaRepository repository,
    IResendClient resend,           // wrapper HTTP do Resend
    IAuditService audit,
    IOptions<ShareDraftOptions> options,
    ILogger<ShareDraftService> logger)
    : IShareDraftService
{
    private static readonly Regex EmailRegex =
        new(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.Compiled);
    private readonly ShareDraftOptions _opts = options.Value;

    public async Task<ShareDraftResult> ShareLinkAsync(
        Guid draftId,
        ShareDraftLinkRequest request,
        int usuarioId,
        CancellationToken ct)
    {
        // 1. Validação de payload (espelha share-draft-link/index.ts)
        if (string.IsNullOrWhiteSpace(request.RecipientEmail) ||
            !EmailRegex.IsMatch(request.RecipientEmail.Trim()))
        {
            return new ShareDraftResult(false, null, "invalid_recipient_email", null);
        }
        if (request.Message is { Length: > 2000 })
            return new ShareDraftResult(false, null, "message_too_long", null);
        if (request.RecipientName is { Length: > 200 })
            return new ShareDraftResult(false, null, "recipient_name_too_long", null);
        if (request.SenderName is { Length: > 200 })
            return new ShareDraftResult(false, null, "sender_name_too_long", null);

        // 2. Existência do draft — defesa que a Edge Function NÃO tinha
        var draft = await repository.ObterAsync(draftId, ct);
        if (draft is null)
            return new ShareDraftResult(false, null, "draft_not_found", null);

        // 3. Monta link e conteúdo
        var link = $"{_opts.AppUrlBase.TrimEnd('/')}/?draft={draftId}";
        var subject = !string.IsNullOrWhiteSpace(request.SenderName)
            ? $"{request.SenderName} compartilhou um cadastro de obra com você"
            : "Cadastro de obra compartilhado com você";

        // 4. Envia via Resend
        var resendResult = await resend.SendAsync(new ResendEmail
        {
            From = _opts.EmailFrom,
            To = [request.RecipientEmail.Trim()],
            Subject = subject,
            Html = BuildHtml(request, link),
            Text = BuildText(request, link),
        }, ct);

        // 5. Audit DENTRO da transação — vantagem sobre Edge Function
        await audit.RegistrarAsync(new AuditEvent
        {
            EntityId = draftId,
            EntityType = "setup_drafts",
            Action = resendResult.Ok ? "link_compartilhado_email" : "share_email_falhou",
            ActorUsuarioId = usuarioId,
            DetailsJson = JsonSerializer.Serialize(new
            {
                recipient = request.RecipientEmail,
                hasMessage = !string.IsNullOrWhiteSpace(request.Message),
                error = resendResult.Error,
            }),
        }, ct);

        return new ShareDraftResult(
            resendResult.Ok,
            resendResult.EmailId,
            resendResult.Error,
            resendResult.Ok ? request.RecipientEmail.Trim() : null);
    }

    private string BuildHtml(ShareDraftLinkRequest req, string link)
    {
        // Espelha buildHtmlBody do share-draft-link/index.ts.
        // EscapeHtml aplicado em TODOS os campos derivados do usuário.
        // Use System.Net.WebUtility.HtmlEncode em produção.
        // ... (~50 linhas; pode ser extraído para Razor template)
        throw new NotImplementedException("Migrar de buildHtml do TS");
    }

    private string BuildText(ShareDraftLinkRequest req, string link)
    {
        // Espelha buildTextBody.
        throw new NotImplementedException("Migrar de buildText do TS");
    }
}

public sealed class ShareDraftOptions
{
    public required string AppUrlBase { get; init; }   // "https://setup.consultegeo.org"
    public required string EmailFrom { get; init; }    // "Consulte GEO <noreply@pozzo.dev>"
    public required string ResendApiKey { get; init; }
}
```

---

## Endpoint controller

```csharp
// src/ControleTecnologico.Application.Api/Controllers/ImplantacaoEstruturaController.cs
[HttpPost("rascunhos/{id:guid}/compartilhar")]
public async Task<ActionResult<ShareDraftResult>> CompartilharLink(
    [FromRoute] Guid id,
    [FromBody] ShareDraftLinkRequest request,
    CancellationToken ct)
{
    var result = await shareService.ShareLinkAsync(id, request, UsuarioId(), ct);
    return result.Ok
        ? Ok(result)
        : StatusCode(StatusCodes.Status400BadRequest, result);
}
```

> **Nota sobre route**: a Edge Function usa
> `share-draft-link` (kebab-case). Em .NET o padrão é
> `compartilhar` (português) por consistência com os outros endpoints
> do controller (`rascunhos`, `validar`, `enviar-validacao`).

---

## DTOs

Já documentados em `ShareDraftLinkRequest` / `ShareDraftResult` acima.
Para JSON Schema, adicionar à pasta `schemas/` o seguinte fragmento:

```json
{
  "$ref": "#/definitions/ShareDraftLinkRequest",
  "definitions": {
    "ShareDraftLinkRequest": {
      "type": "object",
      "required": ["recipientEmail"],
      "properties": {
        "recipientEmail": {
          "type": "string",
          "pattern": "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"
        },
        "recipientName": { "type": "string", "maxLength": 200 },
        "senderName":    { "type": "string", "maxLength": 200 },
        "message":       { "type": "string", "maxLength": 2000 }
      },
      "additionalProperties": false
    }
  }
}
```

---

## Configuração de Resend e variáveis de ambiente

```json
// appsettings.json (defaults)
{
  "ShareDraft": {
    "AppUrlBase": "https://setup.consultegeo.org",
    "EmailFrom": "Consulte GEO <noreply@pozzo.dev>"
  }
}
```

```json
// appsettings.Production.json (sobrescreve)
{
  "ShareDraft": {
    "ResendApiKey": "${RESEND_API_KEY}"
  }
}
```

```csharp
// Program.cs
builder.Services.Configure<ShareDraftOptions>(
    builder.Configuration.GetSection("ShareDraft"));
builder.Services.AddScoped<IShareDraftService, ShareDraftService>();
builder.Services.AddHttpClient<IResendClient, ResendClient>(c =>
{
    c.BaseAddress = new Uri("https://api.resend.com");
});
```

---

## Testes mínimos

```csharp
public class ShareDraftServiceTests
{
    [Fact]
    public async Task ShareLink_RejectsInvalidEmail()
    {
        var sut = CreateSut();
        var result = await sut.ShareLinkAsync(
            Guid.NewGuid(),
            new("foo@bar", null, null, null),
            usuarioId: 1,
            CancellationToken.None);
        Assert.False(result.Ok);
        Assert.Equal("invalid_recipient_email", result.Error);
    }

    [Fact]
    public async Task ShareLink_RejectsNonExistentDraft()
    {
        var sut = CreateSut(/* repository devolve null */);
        var result = await sut.ShareLinkAsync(
            Guid.NewGuid(),
            new("ok@example.com", null, null, null),
            usuarioId: 1,
            CancellationToken.None);
        Assert.False(result.Ok);
        Assert.Equal("draft_not_found", result.Error);
    }

    [Fact]
    public async Task ShareLink_RegistersAuditOnSuccess()
    {
        var auditMock = new Mock<IAuditService>();
        var sut = CreateSut(audit: auditMock.Object);
        await sut.ShareLinkAsync(/* ... payload válido ... */);
        auditMock.Verify(a => a.RegistrarAsync(
            It.Is<AuditEvent>(e => e.Action == "link_compartilhado_email"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

---

## Riscos conhecidos e estratégias de mitigação

| Risco | Mitigação |
|---|---|
| Drift de versões entre TS e C# após nova mudança no wizard | Adicionar smoke test estrutural no pipeline .NET que compara `StepMappingService.WizardSteps` com um JSON gerado pelo frontend |
| Audit duplicado (Edge Function ainda ativa + .NET) | Decidir cutover: ou desativa Edge Function quando o .NET subir, ou frontend roteia baseado em flag de feature |
| Token de acesso vs UUID exposto | Quando OIDC estiver pronto, gerar `setup_draft_share_tokens` com TTL de 7 dias; o link passa a ser `?share_token=xxx` em vez de `?draft=:id` |
| Resend rate limits | Implementar Polly retry policy no `ResendClient`; cair em fila SQL Server se falhar 3x |

## Próximos passos quando começar a portabilidade

1. Criar projetos `ControleTecnologico.Service.Domain` (já existe) e
   adicionar este `StepMappingService.cs`
2. Adicionar testes unitários em `tests/`
3. Validar com smoke test estrutural rodando paralelo ao pipeline TS
4. Quando Edge Function for desativada, o frontend troca o endpoint
   chamado (`setupShareService.ts`) sem mudança de UI
