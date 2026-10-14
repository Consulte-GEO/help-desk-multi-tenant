import type {OpeningRuntime} from './opening-flow.js';
export function mountOpeningWizard(doc?:Document):Readonly<{update(runtime:OpeningRuntime):void;open():void;reset():void;dispose():void}>;
