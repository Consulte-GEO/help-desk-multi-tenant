# Revisão local do incremento v0.14.0

Não houve revisor independente/subagente. Foram lidos diff, casos de uso, histórico de migrations e novas fronteiras.

- Revalidação precede retorno da resposta armazenada; invalid/nullish inesperado não segue para o callback de escrita.
- Operações existentes usam guard obrigatório. Criação resolve o recurso atual autorizado sem escolher uma nova cobertura para replay.
- Snapshots anteriores sem assignedTo mantêm a ausência; JSONB com chaves reordenadas compara sem reescrever conteúdo histórico.
- Prioridade/transição/atribuição repetidas podem devolver versão antiga, nunca uma versão maior que a atual. Campos imutáveis permanecem ligados ao recurso; isso não autentica criptograficamente todo o histórico.
- Child replay verifica ator/corpo/recurso; papel histórico humano não é recalculado após promoção de requester a operador.
- Parser SQL aceita os três formatos definidos na migration008 e um NULL explícito; não possui poderes de repair ou SELECT global.
- Leitor Auth usa o mesmo abort signal dos headers, limite decodificado, cancelamento best-effort e UTF-8 fatal. Não confunde Content-Length comprimido com tamanho descomprimido. Metadata não vira autorização.
- R14-04/05/06 são lacunas de configuração/invariantes documentadas, NÃO correções SQL aplicadas.
- Manifesto das oito migrations preservado. Nenhuma dependência ou permissão foi adicionada.
- M1 não encerrado; mocks não comprovam SQL nem serviços de hospedagem. Nova política de tamanho do perfil humano precisa ser homologada com o provedor.

Regressão real: 54 falhas em63 casos de replay na base; depois63 aprovados. Leitura Auth:4 falhas em6casos; depois13 aprovados com revisão. Três casos adicionais por socket aprovados. Suite868 final aprovada. Git diff --check sem erros.
