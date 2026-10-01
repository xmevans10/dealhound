import {parseFeed,type Deal} from './domain';
export interface FeedConfig {FEED_URL:string;FEED_NAME:string;FEED_COUNTRY:string;FEED_CURRENCY:string;SOURCE_AUTHORIZED:string}
export async function getDeals(env:FeedConfig,cache?:Cache):Promise<Deal[]>{
  if(env.SOURCE_AUTHORIZED!=='true')throw new Error('Deal source is not enabled for public use yet.');
  const url=new URL(env.FEED_URL);
  if(url.protocol!=='https:' || url.username || url.password)throw new Error('Invalid source configuration.');
  const request=new Request(url);
  let response=cache?await cache.match(request):undefined;
  if(!response){
    response=await fetch(request,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'DealHound/1.0 RSS reader','Accept':'application/rss+xml, application/xml, text/xml'}});
    if(!response.ok)throw new Error('Deal source is temporarily unavailable.');
    if(Number(response.headers.get('content-length')??0)>1000000)throw new Error('Deal source response is too large.');
    const reader=response.body?.getReader();if(!reader)throw new Error('Empty source response.');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){await reader.cancel();throw new Error('Deal source response is too large.');}chunks.push(value);}
    const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    response=new Response(data,{headers:{'Content-Type':'application/xml','Cache-Control':'public,max-age=300'}});
    // Validate before caching so invalid feeds do not poison the cache.
    parseFeed(await response.clone().text(),{name:env.FEED_NAME,country:env.FEED_COUNTRY,currency:env.FEED_CURRENCY});
    if(cache)await cache.put(request,response.clone());
  }
  return parseFeed(await response.text(),{name:env.FEED_NAME,country:env.FEED_COUNTRY,currency:env.FEED_CURRENCY});
}
