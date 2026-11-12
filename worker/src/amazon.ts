import {setTimeout as wait} from 'node:timers/promises';
import {z} from 'zod';
import {amazonLink} from './affiliate';
import {isAllowed,type Deal,type Preferences} from './domain';
import {requestJson} from './provider-http';

export interface AmazonConfig {
 AMAZON_CREATORS_ENABLED?:string;
 AMAZON_CREATORS_CLIENT_ID?:string;
 AMAZON_CREATORS_CLIENT_SECRET?:string;
 AMAZON_ASSOCIATE_TAG?:string;
}

export function amazonConfigured(env:AmazonConfig){
 return env.AMAZON_CREATORS_ENABLED==='true'
  && Boolean(env.AMAZON_CREATORS_CLIENT_ID?.trim()&&env.AMAZON_CREATORS_CLIENT_SECRET?.trim())
  && /^[-a-zA-Z0-9]+-20$/.test(env.AMAZON_ASSOCIATE_TAG??'');
}

const marketplace='www.amazon.com';
const tokenSchema=z.object({access_token:z.string().min(1).max(8192)});
const money=z.object({amount:z.number().finite().min(0).max(1000000),currency:z.literal('USD')});
const listing=z.object({
 availability:z.object({type:z.string()}),
 price:z.object({money,savingBasis:z.object({money}).nullish()}),
 isBuyBoxWinner:z.boolean().nullish(),
 dealDetails:z.object({accessType:z.string(),startTime:z.string().nullish(),endTime:z.string().nullish()}).nullish(),
 type:z.string().nullish(),
 violatesMAP:z.boolean().nullish(),
});
const item=z.object({
 asin:z.string().regex(/^[A-Z0-9]{10}$/),
 detailPageURL:z.string().max(2048),
 itemInfo:z.object({title:z.object({displayValue:z.string().trim().min(1).max(500)})}),
 offersV2:z.object({listings:z.array(z.unknown()).max(100).nullish()}).nullish(),
});
const response=z.object({
 searchResult:z.object({items:z.array(z.unknown()).max(10).optional(),totalResultCount:z.number().int().nonnegative().optional()}),
 errors:z.array(z.unknown()).optional(),
});

export function parseAmazon(data:unknown,tag:string,checkedAt:string){
 const {searchResult,errors}=response.parse(data);
 if(!searchResult.items&&searchResult.totalResultCount!==0)throw new Error('Missing Amazon search results');
 const deals:Deal[]=[];
 const observed=Date.parse(checkedAt);
 for(const raw of searchResult.items??[]){
  const parsed=item.safeParse(raw);
  if(!parsed.success)continue;
  const {asin,detailPageURL,itemInfo,offersV2}=parsed.data;
  const title=itemInfo.title.displayValue;
  if(!isAllowed(title))continue;
  const link=amazonLink(detailPageURL,tag);
  if(!link.purchase_url||new URL(link.purchase_url).pathname!=='/dp/'+asin)continue;
  // Creators API attribution requires retaining every parameter it returned.
  const url=new URL(detailPageURL);
  const tags=url.searchParams.getAll('tag');
  if(tags.length!==1||tags[0]!==tag)continue;
  const offers=(offersV2?.listings??[]).flatMap(rawOffer=>{
   const result=listing.safeParse(rawOffer);
   if(!result.success)return [];
   const value=result.data;
   const deal=value.dealDetails;
   const restricted=deal&&(deal.accessType!=='ALL'
    ||(deal.startTime&&!(Date.parse(deal.startTime)<=observed))
    ||(deal.endTime&&!(Date.parse(deal.endTime)>observed)));
   return value.availability.type==='IN_STOCK'&&value.violatesMAP!==true
    &&value.type!=='SUBSCRIBEAND_SAVE'&&!restricted?[value]:[];
  });
  const offer=offers.find(value=>value.isBuyBoxWinner)??offers[0];
  const price=offer?.price.money.amount??null;
  const basis=offer?.price.savingBasis?.money.amount;
  const referencePrice=price!==null&&basis!==undefined&&basis>price?basis:null;
  deals.push({
   title,url:detailPageURL,source:'Amazon.com',country:'US',currency:'USD',price,
   discount_pct:referencePrice!==null&&price!==null?Math.floor((referencePrice-price)/referencePrice*100):null,
   reference_price:referencePrice,discount_basis:referencePrice!==null?'retailer_reference_price':null,
   published:null,checked_at:checkedAt,disclosure:link.disclosure,
  });
 }
 if(errors?.length&&!deals.length)throw new Error('Amazon search failed');
 return {deals,partial:Boolean(errors?.length)};
}

export async function searchAmazon(env:AmazonConfig,queries:string[],prefs:Preferences){
 if(!amazonConfigured(env))throw new Error('Amazon source is disabled');
 const tag=env.AMAZON_ASSOCIATE_TAG!;
 const signal=AbortSignal.timeout(15000);
 const jsonHeaders={'Content-Type':'application/json'};
 const {access_token}=tokenSchema.parse(await requestJson('https://api.amazon.com/auth/o2/token',{
  method:'POST',headers:jsonHeaders,signal,body:JSON.stringify({
   grant_type:'client_credentials',client_id:env.AMAZON_CREATORS_CLIENT_ID,
   client_secret:env.AMAZON_CREATORS_CLIENT_SECRET,scope:'creatorsapi::default',
  }),
 }));
 const deals=new Map<string,Deal>();
 let partial=false;
 let successes=0;
 const uniqueQueries=[...new Set(queries.map(query=>query.replace(/\s+/g,' ').toLowerCase()))];
 for(const keywords of uniqueQueries){
  try{
   if(successes)await wait(1050,undefined,{signal});
   const result=await requestJson('https://creatorsapi.amazon/catalog/v1/searchItems',{
    method:'POST',signal,
    headers:{...jsonHeaders,Authorization:'Bearer '+access_token,'x-marketplace':marketplace},
    body:JSON.stringify({
     keywords,marketplace,partnerTag:tag,itemCount:10,condition:'New',
     ...(prefs.max_price!=null&&prefs.currency==='USD'?{maxPrice:Math.round(prefs.max_price*100)+1}:{}),
     resources:['itemInfo.title','offersV2.listings.price','offersV2.listings.availability','offersV2.listings.isBuyBoxWinner','offersV2.listings.dealDetails','offersV2.listings.type'],
    }),
   });
   const parsed=parseAmazon(result,tag,new Date().toISOString());
   for(const deal of parsed.deals){
    const product=amazonLink(deal.url,tag);
    if(product.purchase_url&&!deals.has(product.purchase_url))deals.set(product.purchase_url,deal);
   }
   successes++;
   partial||=parsed.partial;
  }catch{
   if(!successes)throw new Error('Amazon search failed');
   partial=true;
   break;
  }
 }
 return {deals:[...deals.values()],partial};
}
