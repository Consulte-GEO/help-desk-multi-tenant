# HDA-00 — Qualificação do Claude CLI / E01

Estado: **instalação real não inspecionada**. O ambiente local desta execução não tinha o comando `claude`; isso não descreve a estação/servidor do Dev Agent do usuário. Não foi enviada solicitação a um agente real nem consumido um serviço de geração.

## O que foi implementado

`src/connectors/dev-agent/contract.ts` valida um envelope já decodificado com propriedades próprias de dados `type:result`, `subtype:success`, `is_error:false` e `structured_output`. Metadados do provedor não são copiados para o domínio. A saída estruturada é validada novamente por action-key, job, operação, revisão e referências permitidas.

`buildAgentAnalysisOutputSchema` prepara um JSON Schema candidato vinculado à tarefa. Ele limita a forma da resposta, não concede autorização e não substitui o parser do servidor. A compatibilidade desse schema com a CLI instalada permanece pendente.

A documentação oficial consultada foi [execução programática Claude Code](https://code.claude.com/docs/en/headless). Sua existência não qualifica o host, a versão, as ferramentas, a autenticação ou os hooks do agente do usuário.

## Ponto importante do protocolo

O helper recebe **um objeto já decodificado**, não stdout bruto. HDA-04 deverá limitar bytes, tempo, profundidade e memória ao ler stdout, verificar UTF-8, rejeitar chaves duplicadas e selecionar o envelope final correto na versão instalada. Metadados de custo podem conter decimais: o parser restrito `hda-cjson-v1` NÃO é um decoder genérico do envelope de fornecedor. Canonicalizar somente o contrato de negócio, após extrair e validar `structured_output`.

## Qualificação necessária antes do runner real

| Fronteira | Verificação a executar |
|---|---|
| Binário | Caminho confiável, versão exata e estratégia de atualização; rejeitar versão não qualificada |
| Execução | Não interativa; processo próprio; sem concatenação shell; stdin controlado |
| Configuração | Inventário dos settings, hooks, plugins, MCPs, arquivos de instruções e diretórios realmente carregados |
| Isolamento | HOME/diretório temporário dedicados; sem acesso à sessão humana ou a `.env` e outros clientes |
| Ambiente | Allowlist de variáveis; sem herdar DSN, chave do executor, token de sessão humana ou credencial ampla |
| Ferramentas/rede | Somente as ferramentas de leitura necessárias, previamente qualificadas; sem Bash/SQL/API de escrita livre |
| Recursos | Timeout, turnos, bytes e orçamento limitados por configuração do servidor; matar só a árvore de processos própria |
| Autenticação | Método suportado pela instalação/conta; custódia restrita; renovação sem tokens em logs |
| Jobs | Claim durável, lease, heartbeat e fence do banco; não tratar o contador do domínio como emissor de lease |
| Retorno | Dedupe persistente, validação da versão da entrada e gravação atômica da análise/rascunho |
| Erro | Offline/timeout/saída inválida não perde o chamado nem resulta em aprovação |
| Conhecimento | Somente referências editoriais autorizadas, pinadas por hash; link `/wiki/` não libera o corpus interno |

## Teste do processo real exigido

Usar fixture sintética, sem ferramentas de escrita, cobrindo proposta, necessidade de complemento, campo proibido, resposta fora de versão, Unicode, duplicidade de chave, custo decimal no envelope, saída acima do limite, queda de processo e estação indisponível. Observar o processo real e provar que as credenciais de escrita não estão presentes. HDA-04 não está concluído pela existência dos parsers E01.
