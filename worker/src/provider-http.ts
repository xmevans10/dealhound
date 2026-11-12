// Bound both streamed bodies and provider timeouts. No response bodies, tokens,
// query URLs or API keys are included in errors/logs or shared response caches.
export async function requestJson(url:string,init:RequestInit={}):Promise<unknown>{
 const res=await fetch(url,{...init,redirect:'error',signal:init.signal??AbortSignal.timeout(8000)});
 if(!res.ok)throw new Error('Provider request failed');
 const reader=res.body?.getReader();if(!reader)throw new Error('Empty response');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw new Error('Response too large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
