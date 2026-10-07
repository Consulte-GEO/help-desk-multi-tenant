# HD-P06 — Outro autenticador TOTP da própria conta

Incremento sobre o primeiro cadastro publicado no PR15 e a consulta da segurança do PR16. Novo botão “Adicionar outro autenticador” após /me, inclusive quando o atendimento está fechado. Abrir apenas apresenta o diálogo; preparar executa GET Auth /user, valida a mesma pessoa e catálogo inteiro limitado, exige pelo menos um fator confirmado e claims AAL2/sub/exp do bearer enviado ao provedor. JWT parsing não valida assinatura: o próprio Auth deve validar o bearer exato, e sua política live de enrollment continua sendo autoridade para o POST.

Sem fator confirmado, orientar primeiro cadastro e preservar a sessão. Sem AAL2, encerrar e pedir entrada com MFA. Catálogo inválido ou de outra pessoa não autoriza escrita. Se há TOTP pendente, retomar seus IDs sem outro POST ou retorno da chave antiga. Se não há pendente e o catálogo chegou a20 fatores, recusar antes de criar fator fora da capacidade suportada.

Criação restrita a TOTP e issuer fixo. Friendly name controlado com UUID aleatório evita colisão com o primeiro nome; não aceita nomes, contatos, metadata ou segredo enviados pelo usuário. Resposta nova não pode reutilizar qualquer ID do catálogo lido. Nome sugerido no aplicativo usa o prefixo do novo fator para distinguir contas; segredo manual Base32 via textContent, sem QR/SVG/URI/storage/log.

A sessão reutiliza enrolling_mfa e toda sua serialização/cleanup: bloquear novos requests/refresh/senha, confirmar somente fator pendente owned, retry de código somente explícito, logout e nova entrada depois da confirmação. Cancelar durante resultado aguarda cleanup; nenhum seed ou bearer tardio é instalado. Fatores confirmados antigos não são removidos pela aplicação. O provedor pode limpar outros fatores não verificados e invalidar sessões segundo a política ao verificar um fator; o diálogo informa esse efeito antes de preparar/confirmar. O catálogo prévio não é lock global entre abas.

## Decisões e limites

A primeira configuração continua separada e recusa fatores verificados; a adição exige fator confirmado e AAL2. Custo: nova entrada com MFA se a sessão ainda for AAL1. Chave manual e nenhuma remoção/reset/QR nesta etapa: pendente sem chave pode exigir revisão do provedor. Não ampliar scopes, grants, política administrativa ou limites/configuração real para fazer o fluxo funcionar.

Referências primárias: [Supabase enroll](https://supabase.com/docs/reference/javascript/auth-mfa-enroll) e [Auth validateFactors/enrollTOTP/verify](https://github.com/supabase/auth/blob/master/internal/api/mfa.go), consultadas em07/10/2026. Fonte corrente indica AAL2 para conta com fator verificado, limites e nomes únicos; isso não confirma a versão/configuração implantada no projeto. Índice changelog.md ficou indisponível nesta consulta; nenhuma configuração/SDK foi atualizado por inferência.

## Verificação e estado

Dez testes novos observados RED e GREEN e29 focais aprovados. Casos: AAL1/sub divergente, sem fator, catálogo inválido/duplicado/outra pessoa, limite, colisão de ID, nome distinto, retomar pendente, confirmação de fator antigo recusada, guia sem efeito e cancelamento. Interface observada RED e112/112 GREEN (35HTTP,39 browser de memória,38 sessão humana), três cenários novos. Typecheck, contratos, lock, migrations, scan e build aprovados. Revisão independente:47 focais passaram, nenhum Critical/Important. Ajuste minor de texto do primeiro cadastro ficou registrado para continuidade: mensagem antiga ainda diz gestão adicional indisponível; o novo botão funciona. Artefato local temporário CRLF será retirado da difusão e evidência da fonte virá do Linux com bytes/hashes preservados. Windows1629/1606/23 conserva as mesmas limitações conhecidas (POSIX/symlink/TLS), sem nova falha. CI Linux ainda pendente.

API/interface candidata0.23.0; schema0.19.0,12 migrations,25 tabelas,19 operações. Nenhuma migration ou nova operação Help Desk nesta fatia. Atendimento fechado; M1 operacional/SMTP/Auth/M2M reais, recuperação/remoção/QR/admin MFA obrigatório e aceite de fatores múltiplos pendentes. Nenhum fator ou OTP real criado/exercitado no desenvolvimento.
