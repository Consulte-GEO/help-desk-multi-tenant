# HD-P06 — QR local para cadastro TOTP

Continuidade do cadastro próprio existente, primeiro ou adicional. QR é produzido apenas para um novo fator, após a preparação explícita; cadastros pendentes nunca reexibem a chave anterior. O Auth continua validando catálogo/identidade/AAL2 conforme o fluxo existente. Nenhuma remoção, alteração de configuração, concessão de escopo ou conta real nesta entrega.

O HTML do QR recebido do provedor e sua URI continuam descartados. A aplicação monta seu próprio otpauth a partir de chave Base32 limitada e UUID validado, issuer fixo Consulte Help Desk, identificador completo do fator, SHA1/seis dígitos/30 segundos; desenha módulos pretos/brancos inteiros com zona silenciosa de quatro módulos em canvas. Nada é enviado a gerador externo, URL de imagem, storage ou clipboard. Nome manual usa o mesmo UUID completo para distinguir fatores.

Fechar/cancelar/terminar limpa a chave, código e raster (width/height zero). Resposta tardia não repovoa o painel. Falha de desenho esconde/apaga bitmap e conserva a chave manual com orientação explícita; não cria outro fator nem faz retry. O usuário deve proteger também o QR, que contém a chave. Nenhuma exportação/download foi acrescentada.

Encoder MIT Project Nayuki fixado na revisão 3c6d0b3cefb4e049dc337e82237c9644399716a8, licença/proveniência em web/vendor/README.md. TypeScript original normalizado LF e JS compilado pelo TypeScript5.8.3 do lock, sem dependência de produção ou CDN; teste confere hashes fixos. [Fonte oficial](https://github.com/nayuki/QR-Code-generator/blob/3c6d0b3cefb4e049dc337e82237c9644399716a8/typescript-javascript/qrcodegen.ts).

## Decisões e limites

Remoção de fator pendente foi examinada e não implementada: a API de exclusão por ID não fornece precondição atômica de status; confirmar em outro dispositivo entre consulta/exclusão impediria garantir preservação do fator confirmado. [Contrato Supabase](https://supabase.com/docs/reference/javascript/auth-mfa-unenroll). A remoção permanece pendente de desenho de concorrência/contingência. O changelog foi conferido; nenhum breaking change de TOTP relevante para esta fatia.

QR usa dados locais validados e issuer fixo, ao custo de precisar manter o encoder e provar interoperabilidade com aplicativos reais. A chave manual permanece alternativa. Nenhum aplicativo/conta real foi usado; aceite Auth/MFA real, template recovery/SMTP/CAPTCHA, política administrativa/contingência e atendimento operacional continuam pendentes. Supabase/site/scopes/gates intactos.

## Evidência e estado

Unidades do módulo observadas RED por módulo ausente, depois GREEN4/4; painel RED2 falhas comportamentais (QR ausente e fallback não explicado), depois GREEN4/4, incluindo cancelamento, pendente e resposta tardia.27 focais de QR/enrollment/adicional passam. Matriz sintética244x244 foi decodificada por ZXing-C++2.3.0 independente em scratch e URI/parâmetros conferidos exatamente; isso prova o símbolo sintético, não aceite de autenticador real. Browser RED local ficou inconclusivo (deadline/saída vazia), sem alegação de regressão observada no DOM. Browser GREEN/CI/revisão/publicação pendentes. API/interface candidata0.27.0, schema0.19.0,12 migrations e19 operações preservados.

Revisão independente: sem Critical/Important;28 focais confirmados e encoder recompilado byte a byte. Minor de texto registrado: explicitar QR junto da chave no aviso visual (aria-label já o identifica como privado); refinamento posterior, não bloqueador. Limpeza refere-se ao estado acessível da aplicação, não a zeroização física/forense da memória. Testes não certificam todos os modos/versões QR; qualquer atualização do encoder exige nova validação. Windows em sandbox1669/1602/67: limitações de rede loopback/symlink/TLS/POSIX e mismatch de versão OpenAPI corrigido no gerador, com2 testes do contrato aprovados. Auditoria remota zero vulnerabilidades; não declarar Windows ou browser local aprovados.
