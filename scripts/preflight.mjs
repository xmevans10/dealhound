// Read-only public deployment checks; no credentials required.
const origin=process.argv[2]?.replace(/\/$/,'');
if(!origin||new URL(origin).protocol!=='https:')throw new Error('Usage: node scripts/preflight.mjs https://YOUR_ORIGIN');
let failures=0;
for(const path of ['/','/privacy.html','/terms.html','/support.html','/health','/ready']){
 try{const res=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(15000)});console.log(path,res.status);if(!res.ok)failures++;}catch{console.error(path,'unreachable');failures++;}
}
try{
 const res=await fetch(origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'}),signal:AbortSignal.timeout(15000)});
 const doc=await res.json();const tools=doc.result?.tools;
 if(!res.ok||tools?.length!==2||!tools.some(t=>t.name==='deal_scan')||!tools.some(t=>t.name==='purchase_link')||tools[0].securitySchemes?.[0]?.type!=='noauth'||res.headers.has('WWW-Authenticate')){console.error('Anonymous MCP tool check failed');failures++;}else console.log('Anonymous MCP OK');
}catch{console.error('MCP unreachable or invalid');failures++;}
if(failures)process.exit(1);
