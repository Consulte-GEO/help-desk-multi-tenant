# Apoio Implantação

O módulo fica no menu lateral do Help Desk. O acesso exige uma pessoa autenticada com papel de administrador do workspace ou concessão de suporte na conta atendida. As operações conferem a associação vigente no banco; um link de rascunho não concede acesso.

## Organização

| Área | Recursos |
| --- | --- |
| Cadastro | Sete etapas da obra, estruturas, concretos, peças, usuários, fornecedores e revisão; modelos R02; exportação Excel e JSON para GEO Controle. |
| Planilhas | Pré-análise, passagem do mesmo arquivo para conversão, mapeamento, propostas, validações, pendências, proveniência e auditoria pós-importação. |
| Laudos | Leitura local de PDF, perfis de laboratório, revisão de campos, extração assistida opcional e exportação. |
| Rascunhos e processos | Salvamento por conta, versões, retomada dos dados e cancelamento. |
| Revisão | Protocolo de implantação, comentários, devolução, preservação da entrada original e reenvio. |
| Ajuda contextual | Conteúdo por etapa e imagens privadas, com acesso pela mesma sessão. |

## Dados e limites

O código de origem está em `modules/implantacao`; `SOURCE_IMPORT.json` identifica o commit e os arquivos trazidos antes das adaptações. O site Setup e seu histórico permanecem preservados. Usuários e identificadores de autenticação do sistema antigo não são copiados para o Help Desk.

A cópia vendorizada do SheetJS foi atualizada de 0.18.5 para 0.20.3. O arquivo foi obtido do [CDN oficial](https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js), conforme a [instalação oficial](https://docs.sheetjs.com/docs/getting-started/installation/standalone/). SHA-256: `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`. A versão anterior está abrangida pelo [aviso de prototype pollution do fabricante](https://cdn.sheetjs.com/advisories/CVE-2023-30533). Esta dependência está fora do inventário do npm; sua versão e os testes de leitura/gravação são verificados separadamente.

O addon `helpdesk_implantacao` armazena dados estruturados, rascunhos, resultados revisados, histórico e recibos de operação. Os vinte arquivos de migração e a versão 0.26 do core permanecem independentes. Alterações concorrentes exigem a versão lida anteriormente; reenvios com a mesma chave não repetem uma gravação confirmada.

Planilhas e PDFs originais ficam na memória da sessão. Retomar um processo recupera os dados salvos; uma nova leitura do arquivo exige selecioná-lo novamente. A troca de conta e a saída descartam arquivos, URLs temporárias e tarefas pendentes. Imagens de ajuda são privadas e não recebem classificação de antivírus.

O scanner foi excluído desta entrega por decisão do usuário. A análise de formato e os motores de planilhas/PDF continuam disponíveis. Nenhuma etapa deve apresentar um arquivo como verificado por antivírus.

Links compartilhados exigem login e autorização na conta. Envio de e-mail não é anunciado como concluído sem uma entrega implementada e confirmada. A revisão pode validar um cadastro; isso não equivale a executar uma implantação no Novo GEO.

## IA e Novo GEO

A IA utiliza o SDK oficial no servidor e credenciais injetadas pelo Netlify. Os modelos padrão são `gpt-6-luna` para a leitura inicial e `gpt-6.1-sol` para releitura condicional, verificados no catálogo oficial e no catálogo do gateway durante a implementação. O navegador não recebe chave nem escolhe destinos de API.

Laudos exigem consentimento explícito para envio da imagem. Há validação de entrada, prazo máximo, limite persistente de utilização, cancelamento e conservação das divergências entre leituras. A revisão humana e as validações de exportação continuam necessárias.

O Novo GEO permanece preparado por meio dos contratos e das exportações existentes. A conexão com o serviço real depende de URL, autenticação e contrato de API ainda não fornecidos.

## Compilação e qualificação

`npm run build` instala o frontend pelo lockfile, compila a biblioteca nativa e copia somente o grafo público revisado para `dist/implantacao`. HTML antigo, SQL, fontes administrativas, mapas e diretórios privados não são publicados.

O workflow `implantacao.yml` qualifica o addon contra PostgreSQL 17 e a cadeia completa do core, os motores originais, os contratos novos e as jornadas no Chromium. O workflow principal mantém os gates completos do Help Desk e a evidência vinculada ao código, incluindo as fontes e os locks do módulo.
