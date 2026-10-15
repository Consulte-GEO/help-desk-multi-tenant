// composables/useDragReorder.ts · v5.22.38
//
// Helper de reordenação por drag-and-drop usando a HTML5 Drag and
// Drop API nativa (sem dependência externa, respeitando a stack
// fechada do projeto).
//
// MODELO "ARMAR PELO HANDLE":
//   O elemento arrastável só fica draggable quando o usuário pressiona
//   o handle (⠿). Isso evita que o drag capture o mousedown de inputs/
//   selects dentro da linha (que impediria seleção de texto).
//
//   No template:
//     <tr :draggable="dnd.armed === index"
//         @dragstart="dnd.onDragStart(index, $event)"
//         @dragover.prevent="dnd.onDragOver(index, $event)"
//         @drop.prevent="onDrop(index)"
//         @dragend="dnd.onDragEnd()">
//       <td><span class="drag-handle"
//              @mousedown="dnd.arm(index)"
//              @touchstart="dnd.arm(index)">⠿</span></td>
//       ...inputs livres para edição...
//     </tr>
//
// Por que HTML5 DnD nativo e não uma lib (SortableJS, vuedraggable)?
//   - Stack fechada: não adicionar dependências sem necessidade
//   - Reordenação de lista vertical não justifica ~30KB de lib
//
// Estado é reativo porque o objeto é criado em data() (Vue 3 torna
// suas propriedades reativas).

export interface DragReorderState {
  armed: number | null;
  draggingIndex: number | null;
  overIndex: number | null;
  arm(index: number): void;
  onDragStart(index: number, ev: DragEvent): void;
  onDragOver(index: number, ev: DragEvent): void;
  onDragEnd(): void;
  resolveDrop(dropIndex: number): { from: number; to: number } | null;
}

export function createDragReorder(): DragReorderState {
  return {
    armed: null as number | null,
    draggingIndex: null as number | null,
    overIndex: null as number | null,

    /** Chamado no mousedown/touchstart do handle: arma o drag desta linha. */
    arm(index: number) {
      this.armed = index;
    },

    onDragStart(index: number, ev: DragEvent) {
      // Só inicia se a linha foi armada pelo handle
      if (this.armed !== index) {
        ev.preventDefault();
        return;
      }
      this.draggingIndex = index;
      this.overIndex = index;
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'move';
        try {
          ev.dataTransfer.setData('text/plain', String(index));
        } catch {
          /* ignore */
        }
      }
    },

    onDragOver(index: number, ev: DragEvent) {
      if (this.draggingIndex === null) return;
      this.overIndex = index;
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    },

    onDragEnd() {
      this.armed = null;
      this.draggingIndex = null;
      this.overIndex = null;
    },

    resolveDrop(dropIndex: number): { from: number; to: number } | null {
      const from = this.draggingIndex;
      this.armed = null;
      this.draggingIndex = null;
      this.overIndex = null;
      if (from === null || from === dropIndex) return null;
      return { from, to: dropIndex };
    },
  };
}
