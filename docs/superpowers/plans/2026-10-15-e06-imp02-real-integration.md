# Integração hospedada E06 e IMP-02 — plano

**Objetivo:** montar os adaptadores reais de servidor, autenticação e armazenamento privado. Novo GEO permanece preparado e desabilitado conforme resposta do usuário de 15/10/2026: API/contrato ainda indisponíveis.

**Arquitetura:** E06 reutiliza Principal, escopo por obra e transações existentes; projeções públicas distintas das internas. IMP-02 reutiliza serviço CAS/recibos e Postgres sob setup_import_app, autoridade persistida por vínculo, Supabase Auth vivo, Storage privado imutável e inspeção externa vinculada ao hash. Nenhuma metadata do cliente cria autorização. Sem novo sistema de destino ou execução automática.

**Restrições:** preservar produção HelpDesk0.24 e candidato0.25; não promover SQL descartável de HDA cegamente; sem identidades/obras fictícias, service_role em requests ou scanner limpo simulado.

- [ ] E06: testes negativos de endpoint, leitura PostgreSQL/projeção e helper de instalação preparado; montar rota sem liberar automação.
- [ ] IMP-02: testes auth/revogação/locate/limite/host, runtime Netlify e migração oficial separada com ACL e Storage RLS; qualificar instalação em PG17.
- [ ] Storage: bytes imutáveis, hash/MIME/tamanho, signed upload autorizado, inspeção inconclusiva recusa; transporte HTTP real contra fixtures locais.
- [ ] Frontend: registro Vuex a partir de sessão/capacidades reais, Bearer só para mesmo origin, abortar/limpar ao logout/troca de identidade; listar processos autorizados.
- [ ] Instalar/auditar dependências fixas, executar regressão/tipos/build/PG/browser, revisão independente e correções com RED→GREEN.
- [ ] Commit/PR/merge e deploy autorizados; verificar rotas/assets sem credencial e documentar configurações que impedem ativação.

**Riscos cobertos:** sessão tardia após logout; seleção de conta alheia; recibo perdido sem reenvio; upload sobrescrito; scanner indisponível ou resultado de outro hash. Testes focais pertencem aos respectivos módulos.

**Ruling:** autorização vigente permite executar e publicar sem novo aceite do plano e sem Claude. A origem real não será presumida nem marcada concluída. Grants operacionais só com correspondência real, nunca inferidos do administrador.
