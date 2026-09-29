# Tarefa Codex — integrar M1-R2 + M1-R3 e fechar os gates de evidência

## Objetivo
Integrar o incremento revisado do diagnóstico privado, executar as verificações reais ainda pendentes e manter o Help Desk genérico. Não iniciar M2 ou ligar a flag de atendimento para fazer os testes passarem.

## Fonte
Repo `Consulte-GEO/help-desk-multi-tenant`; última base consultada `b9481b9fabde2fd9c442e44099bc17608b59571a`, branch `codex/m1-reproducibilidade`. Reinspecione agora: o remoto pode avançar. Leia PROJECT_HELP_DESK, README, AGENTS, docs04/05 reais e docs29–33 do ZIP.

## Integração sem sobreposição
O pacote oferece duas variantes alternativas:
- `patches/helpdesk-m1-r2-r3.patch`: usar quando R2 ainda não foi integrado; inclui todo R2 revisado e R3 sobre os arquivos de b948.
- `patches/helpdesk-m1-r3-only.patch`: usar se a fonte já contém o R2 entregue, antes das correções R3.

Não aplicar ambas. Conferir `git status --short`, branch/HEAD, hashes do manifesto, preimages e inexistência de caminhos novos. Com mudanças concorrentes, revisar e conciliar; nunca `reset --hard`, `clean -fdx`, aplicação forçada, troca de checksum ou force-push. Preparar branch local própria.

```sh
# Escolha exatamente UMA variante segundo o manifesto e o estado do checkout.
git apply --check /caminho/do/pacote/patches/VARIANTE_ESCOLHIDA.patch
git apply /caminho/do/pacote/patches/VARIANTE_ESCOLHIDA.patch
git diff --check
```

Overlay não é instalador nem código completo para publicar no Netlify. A história local foi recuperada e não pode substituir a remota. README/AGENTS/docs04/05 do remoto foram deliberadamente preservados pelo patch.

## Revisão técnica obrigatória
Em runtime-preflight, conferir listener do cliente antes de SQL, preservação de listeners de terceiros, verificação antes/depois de consultas, ausência de nova consulta após erro fatal e recusa de socket destruído/encerrado. Erro de query sem quebra ainda tenta rollback; quebra não pode resultar em rollback falsamente confirmado. Descartar/encerrar recursos próprios uma vez. Relatório não imprime objetos Error, SQL, connection string, dados ou secrets. Nenhuma mudança em helpers SQL, grants, onze migrations, lock ou domínio.

TLS local utiliza certificados efêmeros OpenSSL e Node real; não usa pg nem simula PostgreSQL. Não chamar isso de SQL_EXECUTADO. Aguardar prova separada com pg8.16.3. Confirmar que OpenSSL está disponível antes de rodar a suíte; o CI inclui esse pré-requisito.

## Verificações a executar
```sh
openssl version
npm run check:lock
npm ci --ignore-scripts
npm run verify
npm audit --audit-level=high
npm run test:tls:local
npm run test:db:local
npm run test:ui:local
npm run homologate:local
npm run check:homologation
```

Aceite mínimo:1114aplicação,204PostgreSQL,71HTTP/browser; zero falha/cancelamento/skip/TODO. Os6TLS estão incluídos em1114: não somar duas vezes. Instalação e typecheck devem usar dependências locais, não as globais suplementares usadas no ambiente anterior. Fingerprint esperado do código entregue: `7ea5f2ff652f5a26e729e13400b7898a6a417350499cf268aab6d2afbe82196b`. Se houver alteração legítima, reexecutar e produzir nova evidência; não alterar o relatório antigo para casar hashes.

## Validação do destino — somente com autorização atual
Não solicitar segredo em texto/chat. Usar configuração protegida do ambiente aprovado. Primeiro executar o diagnóstico pelo driver real restrito e confirmar TLS, schema/role/policies, queda de conexão, rollback e encerramento. A suíte SQL descartável nunca pode apontar para o Supabase hospedado. Planejar execução privada na Function e Auth/M2M antes de publicar/abrir qualquer endpoint. Esta tarefa não autoriza criar/alterar credenciais, dados, usuários, MFA, policies, secrets, buckets ou HELPDESK_RELEASE_APPROVED.

## Fechamento
Revisar diff integral e evidências, preservar falhas, obter revisão independente quando disponível e atualizar docs04/05 do checkout, handoff/backlog e manifesto. Informar base/branch/commit, arquivos, SQL/browser/dependências/deploy/homologação separadamente. M1 permanece aberto enquanto runtime/Auth, carga, restore e governança não estiverem comprovados. Sem push/PR/merge/deploy ou outras escritas remotas sem autorização explícita atual.
