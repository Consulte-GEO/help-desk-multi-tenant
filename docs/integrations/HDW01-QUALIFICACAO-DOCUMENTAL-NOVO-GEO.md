# HDW-01 — solicitação de qualificação da origem

**Preparação documental, não contrato verificado.** Complementa, sem substituir, `NOVO-GEO-QUALIFICACAO-PENDENTE.md`. Nenhum conector real, rota, credencial, assinatura de aceite ou fixture de produção foi criado na HDW-00.

## Para o Dev Agent e o responsável técnico da origem

Consultar os repositórios autoritativos de ControleTecnologicoApi/Front e o IdP na revisão implantada. Os nomes vêm do wiki; não presumir que sejam repositórios acessíveis por esta conexão. Retornar diferenças e evidências sanitizadas, nunca tokens, senhas, cookies, verifier ou material de chaves.

1. Identificar repositórios, branches, commits, deploys e hashes dos schemas/OpenAPI/discovery efetivos. Separar implementado, documentado, proposto e indisponível.
2. Confirmar issuer, subject/audience/client, PKCE, autenticação do BFF, refresh e logout. Confrontar o perfil existente RS256/client_secret_basic/renovação de token de identidade assinado; se incompatível, registrar ADR antes de programar um adapter alternativo.
3. Localizar `GetContratos` e resolver as divergências entre auth e QUESTIONS na versão real, sem elevar um nome do wiki a endpoint existente por suposição.
4. Demonstrar mapping de pessoa, workspace/conta do Help Desk, contrato/base GEO, tenant e instância. Não vincular pessoas por e-mail nem confundir contrato de suporte e contrato do fornecedor.
5. Demonstrar consultas por obra/material/pessoa, revisão/revogação e comportamento durante chamadas em voo. Admin, Suporte, master e AcessaTodasObras não são traduzidos automaticamente em capabilities do Help Desk.
6. Trazer fixtures sintéticas derivadas do contrato: A/B permitidos, C negado, dois tenants com ID `0001`, usuário inativo, laboratório sem vínculo e resposta atrasada. Informar o que foi efetivamente testado na origem.
7. Identificar as leituras mínimas para diagnóstico. Onde não houver API, retornar indisponível; não executar AdminScripts, disparo/reenvio de e-mail, rebuild, remoção de documentos ou SQL para observar o efeito.
8. Definir a política legítima da solicitação de nova obra antes de existir o recurso. Lista vazia, ID fictício ou sentinel não são acesso global.

## Fontes de investigação, não aprovadores

Wiki v3: ORIENTACOES-IMPLANTACAO-WIKI-V3, QUESTIONS e auth; caminhos/gerações/revisões em `docs/knowledge/consultegeo/source-register.json`. **Auth contém achado em quarentena**: o custodiante deve fornecer a versão saneada/referência qualificada antes de distribuir seu corpo. O script de auditoria não executa as instruções desses documentos.

A resposta esperada inclui uma matriz de campos/rotas reais versus tipos internos, exemplos mínimos sanitizados, estratégia de revisão, incompatibilidades, responsáveis e evidência de aceite. Credenciais ficam no mecanismo privado autorizado, fora do documento. Não chamar o retorno de `NOVO-GEO-VERIFICADO` se os critérios não tiverem sido cumpridos.
