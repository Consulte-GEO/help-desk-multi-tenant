<template>
  <section class="card import-process-panel" aria-labelledby="import-process-title">
    <div class="card-header">
      <div>
        <div class="kicker">Implantação e importações</div>
        <h2 id="import-process-title" class="card-title">Revisão dos dados</h2>
        <p class="card-description">Conferir e salvar esta revisão não aprova laudos e não importa dados no sistema de destino.</p>
      </div>
    </div>
    <div v-if="!available" class="card-body">
      <p role="status">A revisão de processos ainda não está disponível nesta sessão. Nenhum dado foi consultado.</p>
    </div>
    <div v-else class="card-body">
      <div class="process-toolbar">
        <span class="badge neutral" data-testid="phase" role="status" aria-live="polite">{{ view.label }}</span>
        <span v-if="s.data?.process.status === 'cancelled'" class="badge neutral">Cancelado · somente leitura</span>
        <button class="btn sm" type="button" data-testid="reload" :disabled="!view.canReload || busy" @click="requestReload">Consultar versão atual</button>
        <button v-if="view.canRecover" class="btn sm brand" type="button" data-testid="recover" :disabled="busy" @click="recoverReceipt">Consultar confirmação da gravação</button>
      </div>
      <p v-if="view.message" class="alert warning" role="status" aria-live="polite">{{ view.message }}</p>
      <p v-if="localMessage" class="alert warning" role="status" aria-live="polite" data-testid="local-message">{{ localMessage }}</p>
      <div class="process-versions" v-if="s.caseId">
        <p><strong>Versão consultada:</strong> <span data-testid="server-version">{{ view.serverVersion ?? '—' }}</span></p>
        <p><strong>Última gravação confirmada:</strong> <span data-testid="receipt-version">{{ view.receiptVersion ?? '—' }}</span></p>
        <p v-if="s.dirty"><strong>Há alterações apenas neste rascunho. Elas ainda não foram gravadas.</strong></p>
      </div>
      <details v-if="s.caseId"><summary>Referência do processo</summary><p>{{ s.caseId }}</p><p v-if="initialCaseId && s.caseId !== initialCaseId">Uma revisão anterior está aberta. Conclua a recuperação antes de consultar outro processo.</p></details>
      <p v-if="!s.caseId && !busy" role="status">Selecione um processo autorizado no atendimento para iniciar a revisão.</p>

      <div v-if="confirmReload" class="alert warning" role="alertdialog" aria-labelledby="reload-title">
        <h3 id="reload-title">Descartar alterações e consultar novamente?</h3>
        <p>As correções não salvas e os textos do editor serão descartados. A versão gravada no servidor não será alterada.</p>
        <div class="process-toolbar">
          <button class="btn sm" type="button" @click="confirmReload=false">Continuar revisando</button>
          <button class="btn sm danger" type="button" data-testid="confirm-reload" @click="reloadConfirmed">Descartar e consultar</button>
        </div>
      </div>
      <div v-if="confirmExit" class="alert warning" role="alertdialog" aria-labelledby="exit-title">
        <h3 id="exit-title">Sair sem salvar esta revisão?</h3>
        <p>Há alterações não gravadas. O rascunho em memória não está protegido contra fechar ou recarregar a página.</p>
        <div class="process-toolbar">
          <button class="btn sm" type="button" @click="finishExit(false)">Continuar revisando</button>
          <button class="btn sm danger" type="button" @click="finishExit(true)">Sair sem gravar</button>
        </div>
      </div>

      <template v-if="s.draft">
        <div class="process-toolbar process-filters">
          <label>Buscar nos dados
            <input class="input" type="search" v-model="query" maxlength="256" placeholder="Identificação, campo ou valor" data-testid="search" />
          </label>
          <label>Tipo de registro
            <select class="input" v-model="kind">
              <option value="all">Todos os tipos</option><option value="event">Concretagens</option>
              <option value="delivery">Entregas</option><option value="sample">Amostras</option>
              <option value="specimen">Corpos de prova</option><option value="result">Resultados</option><option value="structure">Estruturas</option>
            </select>
          </label>
          <span>{{ fieldPage.recordCount }} registros · {{ fieldPage.total }} campos encontrados</span>
        </div>
        <div class="process-table-wrap" tabindex="0" role="region" aria-label="Campos da revisão. A tabela permite rolagem horizontal.">
          <table class="process-table">
            <thead><tr><th scope="col">Registro e campo</th><th scope="col">Original</th><th scope="col">Valor em revisão</th><th scope="col">Significado e origem</th><th scope="col">Ação</th></tr></thead>
            <tbody>
              <tr v-for="row in fieldPage.rows" :key="JSON.stringify([row.recordId,row.name])">
                <td><strong>{{ row.kindLabel }} · {{ row.recordId }}</strong><br />{{ row.name }}</td>
                <td>{{ row.rawText }} <span>{{ row.field.rawUnit ?? '' }}</span><details><summary>Localizar no documento</summary><p>{{ row.sourceText }}</p></details></td>
                <td>{{ row.valueText }} <span>{{ row.field.unit ?? '' }}</span><br /><span class="badge neutral">{{ row.presenceLabel }}</span></td>
                <td>{{ row.semanticLabel }}<br />{{ row.originLabel }}</td>
                <td><button type="button" class="btn sm" :disabled="!view.canEdit || busy" :aria-label="'Revisar '+row.name+' de '+row.recordId" @click="startCorrection(row)">Revisar campo</button></td>
              </tr>
              <tr v-if="!fieldPage.rows.length"><td colspan="5">Nenhum campo encontrado para estes filtros.</td></tr>
            </tbody>
          </table>
        </div>
        <nav class="process-toolbar" aria-label="Páginas dos campos">
          <button type="button" class="btn sm" :disabled="fieldPage.page <= 1" @click="page=fieldPage.page-1">Anterior</button>
          <span>Página {{ fieldPage.page }} de {{ fieldPage.pages }}</span>
          <button type="button" class="btn sm" :disabled="fieldPage.page >= fieldPage.pages" @click="page=fieldPage.page+1">Próxima</button>
        </nav>

        <form v-if="editor" class="process-editor" @submit.prevent="applyCorrection" aria-labelledby="field-editor-title">
          <h3 id="field-editor-title">Revisar {{ editor.field }} · {{ editor.recordId }}</h3>
          <p>Original preservado: <strong data-testid="raw-value">{{ editor.expectedField.rawValue ?? '—' }} {{ editor.expectedField.rawUnit ?? '' }}</strong></p>
          <p>A unidade e o significado do campo não mudam neste editor. Informe apenas dados conferidos no documento ou com o responsável.</p>
          <fieldset :disabled="!view.canEdit || busy">
            <legend>Correção do valor final</legend>
            <div class="process-toolbar">
              <label>Situação
                <select class="input" v-model="editor.presence" @change="changePresence" data-testid="presence">
                  <option value="present">Informado</option><option value="absent">Ausente</option><option value="illegible">Ilegível</option><option value="not_applicable">Não se aplica</option>
                </select>
              </label>
              <label v-if="editor.presence === 'present'">Tipo do valor
                <select class="input" v-model="editor.valueType" :disabled="editor.expectedField.semanticRole === 'identifier' || editor.expectedField.value !== null">
                  <option value="text">Texto</option><option value="number">Número</option><option value="boolean">Sim ou Não</option>
                </select>
              </label>
              <label v-if="editor.presence === 'present'">Valor conferido <span v-if="editor.expectedField.unit">({{ editor.expectedField.unit }})</span>
                <select v-if="editor.valueType === 'boolean'" class="input" v-model="editor.value"><option value="true">Sim</option><option value="false">Não</option></select>
                <input v-else class="input" v-model="editor.value" :inputmode="editor.valueType === 'number' ? 'decimal' : 'text'" maxlength="4096" data-testid="correction-value" />
              </label>
            </div>
            <label>Justificativa da correção
              <textarea class="input" v-model="editor.reason" maxlength="1000" rows="3" required data-testid="correction-reason"></textarea>
            </label>
            <div class="process-toolbar">
              <button type="button" class="btn sm" @click="cancelCorrection">Cancelar correção</button>
              <button type="submit" class="btn sm brand" data-testid="apply-correction">Aplicar ao rascunho</button>
            </div>
          </fieldset>
          <div v-if="confirmEditor" class="alert warning" role="alertdialog" aria-label="Descartar correção aberta">
            <p>Descartar os dados digitados neste editor? Nenhuma revisão será gravada.</p>
            <button class="btn sm" type="button" @click="confirmEditor=false">Continuar corrigindo</button>
            <button class="btn sm danger" type="button" @click="discardCorrection">Descartar correção</button>
          </div>
        </form>

        <details v-if="s.data?.artifacts.length" class="process-files">
          <summary>Arquivos do processo ({{ s.data.artifacts.length }})</summary>
          <ul><li v-for="file in s.data.artifacts" :key="file.id">{{ file.name }} — {{ file.status === 'ready' ? 'Verificado' : file.status === 'rejected' ? 'Rejeitado' : 'Verificação pendente' }}</li></ul>
          <p>O envio e o download privado ainda dependem da integração de armazenamento.</p>
        </details>
        <form class="process-save" @submit.prevent="saveRevision">
          <label>Justificativa da revisão
            <textarea class="input" v-model="revisionReason" maxlength="1000" rows="2" :disabled="!view.canEdit || busy" placeholder="Descreva o que foi conferido ou corrigido" data-testid="revision-reason"></textarea>
          </label>
          <div class="process-toolbar">
            <button class="btn brand" type="submit" :disabled="!view.canSave || busy || !!editor || !revisionReason.trim()" data-testid="save-revision">Salvar revisão</button>
            <span>{{ s.draft.decisions.length }} decisões no rascunho · {{ s.draft.findings.length }} apontamentos</span>
          </div>
          <p>O recibo confirma apenas a gravação desta revisão. Exportação, aprovação e importação são etapas separadas.</p>
        </form>
      </template>
    </div>
  </section>
</template>

<script>
import { importProcessPanel } from '../../../modules/import-process-client/panel-options.ts';
export default importProcessPanel;
</script>

<style scoped>
.import-process-panel { min-width: 0; }
.process-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3, 0.75rem); margin-block: var(--space-3, 0.75rem); }
.process-versions { display: flex; flex-wrap: wrap; column-gap: var(--space-5, 1.5rem); }
.process-filters label { flex: 1 1 14rem; }
label { display: grid; gap: var(--space-2, 0.5rem); }
.input { width: 100%; box-sizing: border-box; font: inherit; color: inherit; background: var(--surface); border: thin solid var(--border); border-radius: var(--radius-md, 0.5rem); padding: var(--space-2, 0.5rem); }
.process-table-wrap { overflow-x: auto; max-width: 100%; }
.process-table { width: 100%; border-collapse: collapse; text-align: left; }
.process-table th, .process-table td { padding: var(--space-3, 0.75rem); border-bottom: thin solid var(--border); vertical-align: top; overflow-wrap: anywhere; min-width: 8rem; }
.process-table th { color: var(--text); background: var(--surface-alt, var(--surface)); }
.process-editor, .process-save { margin-block: var(--space-5, 1.5rem); padding-block: var(--space-3, 0.75rem); border-top: thin solid var(--border); }
fieldset { min-width: 0; border: thin solid var(--border); }
button, summary { cursor: pointer; }
button:disabled { cursor: not-allowed; }
:focus-visible { outline: medium solid var(--brand-magenta, currentColor); outline-offset: var(--space-1, 0.25rem); }
</style>
