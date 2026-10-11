import type {ReviewOptions,ReviewState} from './review-state.js';
export function mountFormReview(root:HTMLElement,options:ReviewOptions&{savedDraft:()=>Promise<{draftId:string;expectedDraftRevision:number;comment:string}>}):Readonly<{state:ReviewState;destroy():void}>;
