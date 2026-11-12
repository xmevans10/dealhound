import {afterEach,expect,it,vi} from 'vitest';
import {parseAmazon} from '../src/amazon';
import {searchSources} from '../src/sources';
import {matches} from '../src/domain';

const tag='xmevans10-20';
const url='https://www.amazon.com/dp/B0015VHIF8?tag='+tag+'&linkCode=osi&th=1';
const offer={
 availability:{type:'IN_STOCK'},
 price:{money:{amount:14,currency:'USD'},savingBasis:{money:{amount:20,currency:'USD'}}},
 isBuyBoxWinner:true,
};
const product={
 asin:'B0015VHIF8',detailPageURL:url,
 itemInfo:{title:{displayValue:'Balega Hidden Comfort Socks'}},
 offersV2:{listings:[offer]},
};
const fixture=(items:unknown[])=>({searchResult:{items}});
const env={
 AMAZON_CREATORS_ENABLED:'true',AMAZON_CREATORS_CLIENT_ID:'test-id',
 AMAZON_CREATORS_CLIENT_SECRET:'test-secret',AMAZON_ASSOCIATE_TAG:tag,
 SOURCE_AUTHORIZED:'false',FEED_URL:'https://example.com',FEED_NAME:'RSS',FEED_COUNTRY:'US',FEED_CURRENCY:'USD',
};
const now=Date.now();
const checkedAt=new Date(now).toISOString();
afterEach(()=>vi.unstubAllGlobals());

it('preserves the full attributed URL and skips wrong tags, ASINs, hosts, and unsupported items',()=>{
 const {deals}=parseAmazon(fixture([
  product,{...product,detailPageURL:url.replace(tag,'other-20')},
  {...product,detailPageURL:url.replace('amazon.com','amazon.com.example')},
  {...product,asin:'B012345678'},
  {...product,itemInfo:{title:{displayValue:'Nicotine'}}},
 ]),tag,checkedAt);
 expect(deals).toHaveLength(1);
 expect(deals[0]).toMatchObject({
  url,price:14,reference_price:20,discount_pct:30,checked_at:checkedAt,
  published:null,disclosure:'As an Amazon Associate I earn from qualifying purchases.',
 });
});

it('keeps matches without a price and applies strict budget and listing-age filters',()=>{
 const {deals}=parseAmazon(fixture([
  {...product,offersV2:{listings:[{...offer,availability:{type:'OUT_OF_STOCK'}},{...offer,violatesMAP:true},{...offer,dealDetails:{accessType:'PRIME_EXCLUSIVE'}},{...offer,type:'SUBSCRIBEAND_SAVE'},{...offer,dealDetails:{accessType:'ALL',endTime:'2020-01-01T00:00:00Z'}}]}},
 ]),tag,checkedAt);
 const providerMatches=new Set(deals);
 expect(deals[0]).toMatchObject({url,price:null,discount_pct:null});
 expect(matches(deals,['running socks'],{},now,providerMatches)).toEqual(deals);
 expect(matches(deals,['running socks'],{currency:'USD',max_price:15},now,providerMatches)).toEqual([]);
 expect(matches(deals,['running socks'],{max_age_days:7},now,providerMatches)).toEqual([]);
});

it('calls US catalog search with the configured tag and price ceiling',async()=>{
 const fetcher=vi.fn(async (address:string,_init:RequestInit)=>
  Response.json(address.includes('/auth/')?{access_token:'test-token'}:fixture([product])));
 vi.stubGlobal('fetch',fetcher);
 const result=await searchSources(env,['Running socks','running  socks'],{currency:'USD',max_price:15});
 expect(result.statuses[0]).toEqual({source:'amazon',status:'ok',listings:1});
 expect(result.deals[0].url).toBe(url);
 expect(fetcher).toHaveBeenCalledTimes(2);
 const [address,request]=fetcher.mock.calls[1];
 expect(address).toBe('https://creatorsapi.amazon/catalog/v1/searchItems');
 expect(request.headers).toMatchObject({Authorization:'Bearer test-token','x-marketplace':'www.amazon.com'});
 expect(JSON.parse(String(request.body))).toMatchObject({keywords:'running socks',partnerTag:tag,maxPrice:1501});
 expect(JSON.stringify(result)).not.toContain('test-token');
});

it('leaves explicit existing source selections alone and skips disabled or non-US discovery',async()=>{
 const fetcher=vi.fn();
 vi.stubGlobal('fetch',fetcher);
 expect((await searchSources({...env,AMAZON_CREATORS_CLIENT_SECRET:undefined},['socks'],{})).deals).toEqual([]);
 expect((await searchSources(env,['socks'],{country:'GB'})).statuses[0].status).toBe('unsupported_market');
 expect((await searchSources(env,['socks'],{max_age_days:7})).statuses[0].status).toBe('unsupported_filter');
 await searchSources(env,['socks'],{},['rss']);
 expect(fetcher).not.toHaveBeenCalled();
});

it('distinguishes an empty catalog from an upstream failure without leaking credentials',async()=>{
 expect(parseAmazon({searchResult:{totalResultCount:0}},tag,checkedAt)).toEqual({deals:[],partial:false});
 const fetcher=vi.fn(async(address:string)=>
  address.includes('/auth/')?Response.json({access_token:'test-token'}):new Response('test-secret',{status:429}));
 vi.stubGlobal('fetch',fetcher);
 const result=await searchSources(env,['socks'],{});
 expect(result.statuses[0]).toEqual({source:'amazon',status:'unavailable',listings:0});
 expect(JSON.stringify(result)).not.toContain('test-secret');
});
