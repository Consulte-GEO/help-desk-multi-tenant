import {consulteGeoConfigurationFixture} from './consultegeo-configuration-fixture.ts';
import {createConsulteGeoConfigurationAdministration} from '../../src/application/consultegeo-configuration.ts';
import {createConsulteGeoConfigurationDraft} from '../../src/integrations/consultegeo/configuration.ts';
export async function publishedCustomerFixture(service:any='user_access'){
 const f=consulteGeoConfigurationFixture(),a=createConsulteGeoConfigurationAdministration({store:f.store,clock:f.clock}),definition=createConsulteGeoConfigurationDraft(service,'00000000-0000-4000-8000-000000000811',1,{startDate:'2026-10-09',endDate:'2027-10-09',holidays:[]});
 const draft=await f.withProof((p,proof)=>a.execute(p,proof,{action:'save',definition,expectedRevision:1,expectedEntityRevision:0,reason:'Synthetic form preparation'},'customer-form-save-001'));
 const pub=await f.withProof((p,proof)=>a.execute(p,proof,{action:'publish',id:definition.id,version:1,expectedRevision:2,expectedEntityRevision:1,reason:'Synthetic published form'},'customer-form-publish-01'));
 return {f,definition,draft:draft.record,record:pub.record};
}
