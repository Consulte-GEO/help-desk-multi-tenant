"""Offline test loader for the COMPLETE application. Never substitutes app.js.
Only module URL specifiers and CSS resource loading are adapted to data URLs.
Fetch returns native Response objects from the Python synthetic transport.
Production sources are not modified by this loader. HTTP/CSP are NOT qualified.
"""
import base64,json,re
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from visual_fixture_html import without_scripts
from types import SimpleNamespace
from transport import ORIGIN

def setup_offline(page,fixture):
 root=fixture.repo;cache={};loading=set()
 def module(path):
  path=path.resolve()
  if path in cache:return cache[path]
  if path in loading:raise RuntimeError('Cyclic test-loader graph: '+str(path))
  if not path.is_relative_to(root.resolve()) or not path.is_file():raise RuntimeError('Missing native module: '+str(path))
  loading.add(path);source=path.read_text()
  source=re.sub(r'''(from\s*|import\s*)(['"])(\.[^'"]+)\2''',lambda m:m[1]+repr(module(path.parent/m[3])),source)
  source=re.sub(r'''import\((['"])(\.[^'"]+)\1\)''',lambda m:'import('+repr(module(path.parent/m[2]))+')',source)
  cache[path]='data:text/javascript;base64,'+base64.b64encode(source.encode()).decode();loading.remove(path);return cache[path]
 def css(path):
  return re.sub(r'''@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;''',lambda m:css(path.parent/m[1]),path.read_text())
 def fetch_binding(_source,v):
  class R:
   def __init__(self):
    self.request=SimpleNamespace(url=v['url'] if v['url'].startswith('https://') else ORIGIN+v['url'],method=v['method'],post_data=v['body'],headers=v['headers'],post_data_json=json.loads(v['body']) if v['body'] else None)
   def fulfill(self,**kw):self.response=kw
  r=R();fixture.dispatch(r);return r.response
 page.expose_binding('__ux09Fetch',fetch_binding)
 page.goto('about:blank')
 source=(root/'web/index.html').read_text()
 source=without_scripts(source)
 source=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+css(root/'web'/m[1].lstrip('/'))+'</style>',source)
 page.set_content(source)
 page.add_script_tag(content='''
 (()=>{
 // about:blank lacks the HTTPS-only randomUUID API. Test-only RFC4122 shim;
 // production receives no polyfill and must run under its existing HTTPS policy.
 if(!crypto.randomUUID)crypto.randomUUID=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const s=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return s.slice(0,8)+'-'+s.slice(8,12)+'-'+s.slice(12,16)+'-'+s.slice(16,20)+'-'+s.slice(20)};
 const blocks=new Map(),delayed=[];
 window.NETWORK_FIXTURE={block(key,prefix){blocks.set(key,prefix)},release(key){blocks.delete(key);for(const d of delayed.filter(x=>x.key===key)){delayed.splice(delayed.indexOf(d),1);d.run()}},pending(key){return delayed.filter(d=>d.key===key).length}};
 window.fetch=(url,init={})=>new Promise((resolve,reject)=>{
  const v={url:String(url),method:init.method??'GET',body:typeof init.body==='string'?init.body:null,headers:Object.fromEntries(new Headers(init.headers))};
  const run=()=>window.__ux09Fetch(v).then(r=>resolve(new Response(r.status===204?null:r.body,{status:r.status,headers:r.headers}))).catch(reject);
  const blocked=[...blocks].find(([,prefix])=>String(url).startsWith(prefix));if(blocked)delayed.push({key:blocked[0],run});else run();
 });})();''')
 page.add_script_tag(content=(root/'web/theme-init.js').read_text())
 page.add_script_tag(type='module',content='import '+repr(module(root/'web/app.js'))+'; import '+repr(module(root/'web/brand-shell.js'))+';')
 # Track original-source assets independent of URL adaptation; no missing resource is silently omitted.
 fixture.assets=[{'path':str(p.relative_to(root)), 'bytes':p.stat().st_size,'loader':'native-es-module/data-url'} for p in cache]
 return cache

def inline_logos(page,root):
 for name in ['consulte-geo-color.png','consulte-geo-white.png']:
  value='data:image/png;base64,'+base64.b64encode((root/'web/assets'/name).read_bytes()).decode()
  page.locator('img[src$="'+name+'"]').evaluate_all('(es,v)=>es.forEach(e=>e.src=v)',value)
