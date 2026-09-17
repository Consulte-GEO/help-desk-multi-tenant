# Revisão local — v0.12.0

Sem subagente/revisor independente. Revistos os três módulos, integração com app, cenários de corrida, opções de rede, declaração de tipos, contrato oficial Auth, build/demo, runner de browser e diffs. API de autorização/SQL e oito migrations não foram modificados.

Achados locais corrigidos: deadline de corpo não cancelava reader; Content-Length comprimido comparado com bytes decodificados; rotação imediata para lifetime curto; erro pré-envio confundido com incerteza pós-envio; parse UTF8/JSON inválido confundido com indisponibilidade. Red/green nos logs. Corrigidas duas tipagens de teste e uma referência CSS sem variável definida; cancelamento do login usa botão secundário legível. Asserções browser ajustadas ao texto efetivo, mas não chamadas de aprovadas pois navegação bloqueada.

Revisar em homologação: cancelamento enquanto usuário troca de conta, contrato do Auth instalado e expiração/relógio; consequências de refresh recusado após perda de resposta; token copiado antes de logout; política administrativa de sessão/MFA; CSP/CORS reais e eventos de usuário sem grants. Nenhuma promessa de revogação imediata, persistência, SSO ou segurança contra XSS.

Cinco testes HTTP novos unem transporte + estado + handler/auth do backend usando resolvedor SQL controlado e servidor Auth sintético no loopback. Não simulam RLS nem constituem Auth Supabase real. 32HTTP antigos usam a demonstração. As novas5 asserções DOM usam fetch sintético do provedor e respostas API; somente assets/DOM seriam reais se navegador executasse.
