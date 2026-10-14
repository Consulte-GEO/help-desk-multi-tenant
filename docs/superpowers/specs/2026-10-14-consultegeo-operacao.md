# Operação Consulte GEO sem Novo GEO

Pedido de 14/10/2026: resolver a restrição do banco e continuar para liberar atendimento e emails. A integração externa com o Novo GEO está adiada. As decisões de produto já foram delegadas pelo usuário. Publicação e alterações necessárias estão autorizadas.

## Banco

O destino PG17 usa operador NOSUPERUSER CREATEROLE BYPASSRLS, proprietário comum dos quatro schemas privados. CREATE ROLE gera uma associação administrativa pelo bootstrap OID10, ADMIN=true, INHERIT=false, SET=false. Admitir exclusivamente esse perfil para o proprietário qualificado e os dois papéis reservados. Qualquer associação em que um serviço seja membro, grantor diferente, membro adicional, flags diferentes, direitos extras ou defaults fora da allowlist deve recusar. Não afirmar que catálogo prova criação automática: M05 recusa memberships preexistentes e cria os papéis dentro da transação; runtime verifica somente o perfil.

Preservar byte a byte migrations001–012 implantadas, seis corpos candidatos qualificados e fixtures históricos. Revisar explicitamente somente guards finais de M05/M06/M09b/M09c ainda não implantadas, com mapa hash antigo/novo e transformação enumerada. Schema permanece0.23, sem alterar funções/tabelas/policies. Acrescentar validação dos defaults do proprietário no readiness. Provar instalação numa segunda instância PG17 isolada pelo operador não superusuário, incluindo rollback e recusas; preservar suite superusuária. Upgrade remoto somente após CI original completo e revisão.

## Atendimento local

Fonte local deve usar contas, obras e vínculos reais persistidos, com revisões e cobertura completa. Não simular origem Novo GEO, principal, AAL2, grants ou protocolo legado confirmado. Administração exige capability e MFA atuais. Clientes serão cadastrados localmente; nenhum cliente fictício de homologação será criado em produção. Protocolo novo deve ter namespace distinto do legado se o último número não estiver confirmado. Gate de atendimento só abre com configuração publicada, catálogo autorizado e stores duráveis realmente compostos.

## Email

Reutilizar o canal Resend e a máquina de entrega existente. Persistir planos/leases/tentativas/ACK e revisar ACL imediatamente antes do despacho. Timeout/ACK incerto não autoriza reenvio com chave nova. Webhook Resend precisa verificar assinatura nativa e correlação com mensagem aceita; o verificador do envelope normalizado não pode ser montado diretamente no payload nativo. Template Consulte GEO adaptado, dados mínimos e nenhuma nota/checklist interno ou arquivo no corpo. Remetente deve estar verificado; segredo deve ser privado em Functions Production. Teste real somente para destinatário explicitamente autorizado.

Não consultar conjuntos amplos de segredos: revisão automática recusou getAllEnvVars. Consultas específicas e configuração segura pelo usuário continuam possíveis. Não copiar credenciais do GeoLab. Não modificar GlobalCad.
