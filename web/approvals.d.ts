import type {ReviewOptions,ReviewState} from './review-state.js';
export function mountApprovals(root:HTMLElement,options:ReviewOptions):Readonly<{state:ReviewState;destroy():void}>;
