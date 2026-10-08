> **HD-P06 — 08/10/2026:** conclusão de recuperação por link direto integrada/publicada pelo PR18; API/interface0.24.0/schema0.19.0. Contexto privado só de senha, MFA preservado, sem workspace/scopes; nenhum e-mail/callback/PKCE nesta fatia. [Entrega e limites](129-HD-P06-CONCLUIR-RECUPERACAO-POR-LINK.md). CI1644/229/115 aprovado; Important corrigido e minor de texto registrado. Merged9932d4 e produção6ac77fa0 verificados; atendimento fechado, envio/PKCE/callback/recuperação real pendentes.

> **HD-P06 — 07/10/2026:** outro TOTP da própria conta integrado/publicado pelo PR17; API/interface0.23.0/schema0.19.0. Exige catálogo vivo verificado/AAL2, retoma pendente ou cria com nome distinto; preserva fatores confirmados e não amplia scopes. [Entrega e limites](128-HD-P06-OUTRO-AUTENTICADOR-TOTP.md). CI1629/229/112 aprovado e revisão sem Critical/Important; minor de texto registrado. Mergedf3d2b9 e produção6ac6f2d7 verificados. Atendimento fechado; recuperação/remoção/QR/admin MFA e aceite real pendentes.

> **HD-P06 — 07/10/2026:** consulta da segurança da própria conta integrada/publicada pelo PR16; API/interface0.22.1/schema0.19.0. Catálogo vivo limitado, fatores confirmados/pendentes e AAL consultivo; dados privados descartados e resposta tardia isolada. Nenhuma gestão/remoção de fatores ou ampliação de scopes. [Entrega e limites](127-HD-P06-CONSULTA-DA-SEGURANCA.md). Revisão corrigida com10 testes; CI1619/229/109 aprovado. Merge4c663a2 e produção6ac6b8ee verificados. Atendimento fechado; gestão de fatores/recovery/admin obrigatório e aceite real pendentes.

> **HD-P06 — 07/10/2026:** primeiro TOTP opcional da própria conta integrado/publicado pelo PR15; API0.22.0/schema0.19.0. Chave manual, catálogo vivo e confirmação, pendente retomado sem criar outro, sem remoção/reset de fatores. Segredo retirado do DOM ao encerrar e nova entrada após confirmação. [Entrega e limites](126-HD-P06-PRIMEIRO-AUTENTICADOR-TOTP.md).9 novos/27 focais/106 interface aprovados; revisão sem achados. Atendimento fechado; fatores adicionais/recovery/QR/admin obrigatório e aceite real pendentes. CI1609/229/106 aprovado; merge912bea2 e produção6ac6ad5e verificados.

> **HD-P06 — 07/10/2026:** login TOTP existente e guard MFA integrados/publicados pelo PR14; API0.21.0/schema0.19.0. Auth valida bearer exato antes de exigir AAL2 para fatores verificados e antes dos vínculos; grants/scopes vivos preservados. Login espera código antes de workspace, cleanup privado e resposta antiga protegidos. [Entrega e limites](125-HD-P06-LOGIN-TOTP-E-VALIDACAO-DE-MFA.md).73 focais/103 interface aprovados; enrollment/recovery/MFA administrativo obrigatório e aceite real pendentes. Atendimento fechado; CI1600/229/103 aprovado; merge24559ce e produção6ac6991e verificados.

> **HD-P06 — 07/10/2026:** código adicional para troca de senha integrado/publicado pelo PR13; API0.20.4/schema0.19.0. Solicitação explícita ao próprio canal cadastrado e nonce opcional, sem reenvio automático ou configuração alterada. Corrigida corrida de despacho concorrente com código/senha;67 focais e99 interface aprovados. [Entrega e limites](124-HD-P06-CODIGO-PARA-TROCA-DE-SENHA.md). Atendimento fechado; SMTP/MFA/recuperação e M1 operacional pendentes. CI1565/229/99 aprovado; merge1c04c76 e produção6ac68492 verificados.

> **HD-P06 — 07/10/2026:** troca da própria senha integrada/publicada pelo PR12; API0.20.3/schema0.19.0. Payload Auth restrito, campos limpos no envio, requisição única e nova entrada após resultado; respeita recusas MFA/autenticação recente sem alterar configuração. [Entrega e limites](123-HD-P06-TROCA-DE-SENHA-AUTENTICADA.md). Atendimento fechado; senha/MFA/SMTP reais, recuperação completa e M1 operacional pendentes. CI1554/229/96 aprovado; merge33c2f86 e produção6ac67460 verificados.

> **HD-P06 — 07/10/2026:** encerramento global das próprias sessões integrado/publicado pelo PR11; API0.20.2/schema0.19.0. Confirmação explícita, limpeza local imediata, novo login bloqueado enquanto o pedido aguarda resultado; logout local continua padrão. [Entrega e limites](122-HD-P06-ENCERRAMENTO-GLOBAL-DE-SESSOES.md). Atendimento fechado; aceite Auth entre dispositivos, MFA/recuperação/administração e M1 operacional permanecem pendentes. CI1544/229/92 aprovado; merge e6ed434 e produção6ac66dae verificados.

> **Estado 07/10/2026 — PR10:** troca segura de workspace publicada com nova autenticação e limpeza do contexto anterior. API0.20.1/schema0.19.0; CI1536/229/89 aprovado. Sem mudanças no banco ou escopos; atendimento bloqueado e M1 operacional aberto. [Evidência e limites](121-HD-P05-TROCA-SEGURA-DE-WORKSPACE.md). Este checkpoint prevalece sobre os estados históricos abaixo.

> **Estado 07/10/2026:** PR9 integrado/publicado; API0.20.0, schema0.19.0,12 migrations/25 tabelas/19 operações, CI1536/229/85 aprovado. Descoberta de workspace no login com UUID opcional; vínculos/scopes preservados. Atendimento fechado e M1 operacional aberto. [Evidência e limites](120-HD-P05-DESCOBERTA-DE-WORKSPACES.md); este checkpoint prevalece sobre os estados históricos abaixo.

> **Continuidade HD-P03 — produção:** clientes read/Auth/write adaptados a production, três exemplos de site separado removidos e 140 testes focais aprovados. CI Linux run37560232763 aprovado: 1.450 aplicação, 215 PostgreSQL e 79 interface. PR4 integrado em0789dc3 e código publicado em produção (deploy6ac5aaaf); aceite operacional pendente. [Política e evidência](116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **HD-P03 — 06/10/2026:** homologação hospedada na mesma base/site HelpDesk, conforme decisão do usuário. CI Linux 1.447/215/79 aprovado; PR4 pronto para revisão. Aceite Auth/Function/base atual permanece pendente. Leia [116-HD-P03-VALIDACAO-EM-PRODUCAO.md](116-HD-P03-VALIDACAO-EM-PRODUCAO.md).

> **Decisão do usuário — 06/10/2026:** O único ambiente do Help Desk é produção: site helpdesk-consultegeo e projeto Supabase HelpDesk xaelbntjnvztznnpcvtm. Desenvolvimento, implantação e validação hospedada usam esse destino. Não solicitar ambiente ou credenciais de teste ao usuário.

> **HD-P02 — 06/10/2026:** recuperação da abertura corrigida;14 testes focais e79 verificações de interface aprovados. Windows1447/1424/23 (mesmas falhas anteriores); CI novo/aceite hosted pendentes. Leia [115-HD-P02-RECUPERACAO-DA-ABERTURA.md](115-HD-P02-RECUPERACAO-DA-ABERTURA.md). M1 operacional aberto.

> **Estado pós-merge — 06/10/2026:** leia [HD-P01](114-HD-P01-ESTADO-POS-R24.md), que prevalece sobre o histórico abaixo. CI R24 1436/215/71; gate hospedado fechado; M1 operacional aberto.

# Estado corrente — Help Desk M1-R24 / 05-10-2026

Fonte atual: [113-M1-R24-REVISAO-E-ESTADO.md](113-M1-R24-REVISAO-E-ESTADO.md). Base R23 `072287f`, R20–R22 integrados. M1 operacional aberto; M2 não iniciado.

Instalação, audit, typecheck, contratos, segredos, build e conferência das evidências passaram localmente. Node Windows: 1.413 aprovados, 23 falhas, sem skips; Docker/Chromium indisponíveis. CI Linux histórico R23: 1.436 Node, 215 PostgreSQL e 71 HTTP/browser aprovados. Esses estados não se substituem.

Site atual `helpdesk-consultegeo`, ID `9781cd85-7dc1-4ef5-868b-947e389a9d4d`; frontend respondeu HTTP 200 e a Function R23 respondeu 503 `release_gate_closed`. Supabase HelpDesk: onze migrations e 25 tabelas privadas com ENABLE/FORCE RLS; `helpdesk_app` sem superuser/BYPASSRLS. A introspecção não comprova TLS/grants/login dentro da Function ou homologação hospedada.

Registro anterior preservado em [histórico R23](history/r23-04-ESTADO-E-EVIDENCIAS.md).
