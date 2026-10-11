/** Synthetic source contract only; not a real category or acceptance. */
import {requestHash} from '../../src/domain/canonical.ts';
import {FORM_TYPES} from '../../shared/form-rules.js';
import {manifest,cohort,u,resource} from './release-fixtures.ts';
export function rawExpansion(){
 const contract:any={schema:1,system:'NOVO_GEO',profileId:'SYNTHETIC_PROFILE',revision:'origin-r2',sourceRef:'SYNTHETIC-ORIGIN',definitions:[{categoryId:'SYNTHETIC_NEW',channelId:'portal',critical:true,requiredFields:[{key:'target',type:'select'}],requiredFeatures:['core']}]};
 const form:any={id:u(901),version:1,status:'published',title:'Synthetic operation',fields:[{key:'target',type:'select',label:'Target',required:true,public:true,config:{options:[{value:'A',label:'A'},{value:'B',label:'B'}]}}]};
 const proposal:any={schema:1,id:u(902),profileId:'SYNTHETIC_PROFILE',previousVersion:1,nextVersion:2,contractHash:requestHash(contract),forms:[{categoryId:'SYNTHETIC_NEW',channelId:'portal',form}]};
 const before:any=manifest(),after:any={...manifest(),releaseId:u(903),cohorts:[cohort(),{...cohort(),id:u(904),categoryId:'SYNTHETIC_NEW'}]};
 const registry={types:[...FORM_TYPES],lookups:[],files:false,downloads:[]};
 return {contract,proposal,before,after,registry};
}
