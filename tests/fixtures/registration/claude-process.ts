import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
/** Synthetic offline CLI fixture. It is not Claude, makes no network calls and has no production credentials. */
export function claudeProcessFixture(mode='success'){
 const dir=mkdtempSync(join(tmpdir(),'hda-cli-fixture-')),exe=join(dir,'claude');
 const source=`#!${process.execPath}\nconst fs=require('node:fs');
 if(process.argv.includes('--version')){process.stdout.write('${mode==='version_mismatch'?'2.1.285':'2.1.286'} (Claude Code)\\n');process.exit(0);}
 let raw='';process.stdin.on('data',x=>raw+=x);process.stdin.on('end',()=>{
 const r=JSON.parse(raw), mode=${JSON.stringify(mode)};
 const output={schema:1,...r.correlation,disposition:'proposal',proposedFields:{kind:'add_work_link',preserveExistingLinks:true},missingFields:[],warnings:[],knowledgeRefs:[]};
 const ok={type:'result',subtype:'success',is_error:false,structured_output:output,total_cost_usd:0.01};
 if(mode==='inspect')output.warnings=[JSON.stringify({args:process.argv.slice(2).map(s=>s.length>200?'[fixed-long-argument]':s),env:Object.keys(process.env).sort(),home:process.env.HOME,cwd:process.cwd()}).slice(0,1999)];
 if(mode==='invalid')return process.stdout.write('invalid private raw output');
 if(mode==='duplicate')return process.stdout.write('{"type":"result","type":"result"}');
 if(mode==='large')return process.stdout.write('x'.repeat(262145));
 if(mode==='stderr_large'){process.stderr.write('x'.repeat(16385));setTimeout(()=>process.stdout.write(JSON.stringify(ok)),500);return;}
 if(mode==='stderr_private')process.stderr.write('secret-in-stderr-database-password');
 if(mode==='provider_error'){ok.is_error=true;ok.subtype='error_during_execution';}
 if(mode==='delay'||mode==='ignoreterm'){if(mode==='ignoreterm')process.on('SIGTERM',()=>{});setTimeout(()=>process.stdout.write(JSON.stringify(ok)),5000);return;}
 if(mode==='wrong_job')output.jobId='00000000-0000-4000-8000-000000000001';
 process.stdout.write(JSON.stringify(ok));if(mode==='nonzero')process.exitCode=1;
 });\n`;
 writeFileSync(exe,source,{mode:0o700});
 const config={executablePath:exe,executableSha256:createHash('sha256').update(source).digest('hex'),cliVersion:'2.1.286',agentVersionRef:'cli.v1',modelId:'claude-qualified-model-20260101',maxBudgetUsd:'0.25',timeoutMs:1000};
 return {dir,exe,config,close:()=>rmSync(dir,{recursive:true,force:true})};
}
