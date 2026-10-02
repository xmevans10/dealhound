import {z} from 'zod';
import {isAllowed,type Deal,type Preferences} from './domain';
import {getDeals,type FeedConfig} from './feed';
export const sourceSchema=z.enum(['bestbuy','ebay','rss']);
export type SourceId=z.infer<typeof sourceSchema>;
export interface SourceConfig extends FeedConfig {BESTBUY_ENABLED?:string;BESTBUY_API_KEY?:string;EBAY_ENABLED?:string;EBAY_CLIENT_ID?:string;EBAY_CLIENT_SECRET?:string}
export interface SourceStatus {source:SourceId;status:'ok'|'not_configured'|'unavailable'|'unsupported_market';listings:number}
const markets:Record<string,string>={US:'EBAY_US',GB:'EBAY_GB',DE:'EBAY_DE',FR:'EBAY_FR',ES:'EBAY_ES',IT:'EBAY_IT',NL:'EBAY_NL',IE:'EBAY_IE',CA:'EBAY_CA',AU:'EBAY_AU'};
export function enabledSources(env:SourceConfig):SourceId[]{return [...(env.BESTBUY_ENABLED==='true'&&env.BESTBUY_API_KEY?['bestbuy' as const]:[]),...(env.EBAY_ENABLED==='true'&&env.EBAY_CLIENT_ID&&env.EBAY_CLIENT_SECRET?['ebay' as const]:[]),...(env.SOURCE_AUTHORIZED==='true'?['rss' as const]:[])];}
const safeUrl=(value:unknown,hosts:string[])=>{try{if(typeof value!=='string')return null;const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?value:null;}catch{return null;}};
const money=(value:unknown)=>{if((typeof value!=='number'&&typeof value!=='string')||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=100000000?n:null;};
const date=(value:unknown)=>{const n=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(n)?new Date(n).toISOString():null;};
const amountSchema=z.union([z.string(),z.number()]);
const bestbuyProduct=z.object({name:z.string().min(1).max(500),url:z.string(),salePrice:amountSchema,regularPrice:amountSchema.optional(),onSale:z.boolean().optional(),digital:z.boolean().optional(),type:z.string().optional(),image:z.string().optional(),sku:z.union([z.string(),z.number()]).optional(),salePriceUpdated:z.string().optional(),onlineAvailability:z.boolean().optional()}).passthrough();
const ebayItem=z.object({title:z.string().min(1).max(500),itemWebUrl:z.string(),price:z.object({value:amountSchema,currency:z.string()}),itemCreationDate:z.string().optional(),image:z.object({imageUrl:z.string()}).optional(),marketingPrice:z.object({originalPrice:z.object({value:amountSchema,currency:z.string()}).optional()}).passthrough().optional()}).passthrough();
export function parseBestBuy(data:unknown,checkedAt:string):Deal[]{
 const parsed=z.object({products:z.array(z.unknown()).max(100)}).parse(data);
 return parsed.products.flatMap(raw=>{const p=bestbuyProduct.safeParse(raw);if(!p.success)return [];const v=p.data;const url=safeUrl(v.url,['bestbuy.com','api.bestbuy.com']);const price=money(v.salePrice),regular=money(v.regularPrice);
  if(!url||price===null||!isAllowed(v.name)||v.digital!==false||v.type!=='HardGood'||v.onlineAvailability!==true||regular===null||regular<=price)return [];
  return [{title:v.name,url,source:'Best Buy',country:'US',currency:'USD',price,discount_pct:Math.floor((regular-price)/regular*100),published:null,checked_at:checkedAt,price_updated:date(v.salePriceUpdated),image_url:safeUrl(v.image,['bestbuy.com','bbystatic.com']),reference_price:regular,discount_basis:'retailer_reference_price',source_payload:v}];
 });
}
export function parseEbay(data:unknown,country:string,checkedAt:string):Deal[]{
 const parsed=z.object({itemSummaries:z.array(z.unknown()).max(200).optional(),total:z.number().optional()}).parse(data);
 if(!parsed.itemSummaries&&parsed.total!==0)throw new Error('Invalid provider response');
 return (parsed.itemSummaries??[]).flatMap(raw=>{const p=ebayItem.safeParse(raw);if(!p.success)return [];const v=p.data;const url=safeUrl(v.itemWebUrl,['ebay.com','ebay.co.uk','ebay.de','ebay.fr','ebay.es','ebay.it','ebay.nl','ebay.ie','ebay.ca','ebay.com.au']);const price=money(v.price.value);const original=v.marketingPrice?.originalPrice;const regular=original?.currency===v.price.currency?money(original.value):null;
  if(!url||price===null||!isAllowed(v.title))return [];
  return [{title:v.title,url,source:'eBay',country,currency:v.price.currency,price,discount_pct:regular!==null&&regular>price?Math.floor((regular-price)/regular*100):null,published:date(v.itemCreationDate),checked_at:checkedAt,image_url:safeUrl(v.image?.imageUrl,['ebayimg.com']),reference_price:regular,discount_basis:regular!==null&&regular>price?'seller_reference_price':null,source_payload:v}];
 });
}
// Bound both streamed bodies and provider timeouts. No response bodies, tokens,
// query URLs or API keys are included in errors/logs or shared response caches.
async function requestJson(url:string,init:RequestInit={}):Promise<unknown>{
 const res=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw new Error('Provider request failed');
 const reader=res.body?.getReader();if(!reader)throw new Error('Empty response');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw new Error('Response too large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
async function bestbuy(env:SourceConfig,queries:string[]):Promise<Deal[]>{
 const groups=queries.map(q=>{const words=q.match(/[\p{L}\p{N}]+/gu)?.slice(0,12);if(!words?.length)throw new Error('Unsupported query');return '('+words.map(w=>'search='+encodeURIComponent(w)).join('&')+')';});
 const url=new URL('https://api.bestbuy.com/v1/products(type=HardGood&digital=false&onlineAvailability=true&onSale=true&('+groups.join('|')+'))');
 url.search=new URLSearchParams({apiKey:env.BESTBUY_API_KEY!,format:'json',pageSize:'100',show:'sku,name,salePrice,regularPrice,onSale,digital,type,url,image,salePriceUpdated,onlineAvailability',sort:'salePrice.asc'}).toString();
 return parseBestBuy(await requestJson(url.href),new Date().toISOString());
}
async function ebay(env:SourceConfig,queries:string[],country:string):Promise<Deal[]>{
 const token=z.object({access_token:z.string().min(1),token_type:z.string()}).parse(await requestJson('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+btoa(env.EBAY_CLIENT_ID+':'+env.EBAY_CLIENT_SECRET),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',scope:'https://api.ebay.com/oauth/api_scope'}).toString()}));
 const batches=await Promise.all(queries.map(async query=>{const url=new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');url.search=new URLSearchParams({q:query,limit:'30',filter:'buyingOptions:{FIXED_PRICE}'}).toString();return parseEbay(await requestJson(url.href,{headers:{Authorization:'Bearer '+token.access_token,'X-EBAY-C-MARKETPLACE-ID':markets[country],Accept:'application/json'}}),country,new Date().toISOString());}));return batches.flat();
}
export async function searchSources(env:SourceConfig,queries:string[],prefs:Preferences,requested?:SourceId[],cache?:Cache){
 const selected=requested??(['bestbuy','ebay','rss'] as SourceId[]);const active=enabledSources(env);const statuses:SourceStatus[]=[];
 const batches=await Promise.all([...new Set(selected)].map(async source=>{
  if(!active.includes(source)){statuses.push({source,status:'not_configured',listings:0});return [];}
  if(source==='bestbuy'&&prefs.country&&prefs.country!=='US'){statuses.push({source,status:'unsupported_market',listings:0});return [];}
  try{const deals=source==='bestbuy'?await bestbuy(env,queries):source==='ebay'?await ebay(env,queries,prefs.country??'US'):await getDeals(env,cache);statuses.push({source,status:'ok',listings:deals.length});return deals;}catch{statuses.push({source,status:'unavailable',listings:0});return [];}
 }));const seen=new Set<string>();const deals=batches.flat().filter(d=>{if(seen.has(d.url))return false;seen.add(d.url);return true;});
 statuses.sort((a,b)=>selected.indexOf(a.source)-selected.indexOf(b.source));return {deals,statuses};
}
