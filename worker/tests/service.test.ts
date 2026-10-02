import {describe,it,expect,vi,afterEach} from 'vitest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {parseFeed,matches,prefsSchema} from '../src/domain';
import {createServer} from '../src/mcp';
import {getDeals} from '../src/feed';
const config={PUBLIC_ORIGIN:'https://dealhound.example',FEED_URL:'https://source.example/rss',FEED_NAME:'Test Source',FEED_COUNTRY:'US',FEED_CURRENCY:'USD',SOURCE_AUTHORIZED:'true'};
const date=new Date().toUTCString();
const xml=`<rss><channel><item><title>Nike shoes $90 25% off</title><link>https://store.example/shoes?ref=original</link><pubDate>${date}</pubDate></item><item><title>Nike shoes €85</title><link>https://store.example/euro</link><pubDate>${date}</pubDate></item><item><title>Nike shoes on sale</title><link>https://store.example/unknown</link><pubDate>${date}</pubDate></item><item><title>Nicotine sale $5</title><link>https://store.example/blocked</link><pubDate>${date}</pubDate></item></channel></rss>`;
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('source and effective preferences',()=>{
 it('parses currencies, prices, dates, attribution and preserves referral links',()=>{const deals=parseFeed(xml,{name:'Source',country:'US',currency:'USD'});expect(deals).toHaveLength(3);expect(deals[0]).toMatchObject({price:90,currency:'USD',discount_pct:25,url:'https://store.example/shoes?ref=original',source:'Source'});});
 it('does not compare unrelated currencies or missing amounts',()=>{const deals=parseFeed(xml,{name:'Source',country:'US',currency:'USD'});expect(matches(deals,['Nike shoes'],{currency:'USD',max_price:100})).toHaveLength(1);expect(matches(deals,['Nike'],{max_price:100})).toHaveLength(0);expect(matches(deals,['Nike'],{country:'GB'})).toHaveLength(0);});
 it('rejects old, missing and future publication dates',()=>{const deal=parseFeed(xml,{name:'Source',country:'US',currency:'USD'})[0];expect(matches([{...deal,published:null},{...deal,published:'2020-01-01T00:00:00Z'},{...deal,published:'2100-01-01T00:00:00Z'}],['Nike'],{})).toHaveLength(0);});
 it('rejects entity declarations and unsafe urls',()=>{expect(()=>parseFeed('<!DOCTYPE rss><rss/>',{name:'s',country:'US',currency:'USD'})).toThrow();expect(parseFeed(xml.replaceAll('https://store.example','javascript:bad'),{name:'s',country:'US',currency:'USD'})).toHaveLength(0);});
 it('does not mistake coupon savings for a product price',()=>{const feed=xml.replace('Nike shoes $90 25% off','Nike shoes save $90');const d=parseFeed(feed,{name:'Source',country:'US',currency:'USD'})[0];expect(d.price).toBeNull();});
 it('validates filter ranges and null clearing',()=>{expect(prefsSchema.safeParse({max_price:-1}).success).toBe(false);expect(prefsSchema.safeParse({max_price:null}).success).toBe(true);expect(prefsSchema.safeParse({max_age_days:0}).success).toBe(false);});
 it('fails closed for unauthorized sources and errors on failed fetch',async()=>{await expect(getDeals({...config,SOURCE_AUTHORIZED:'false'})).rejects.toThrow('not enabled');vi.stubGlobal('fetch',vi.fn(async()=>new Response('blocked',{status:403})));await expect(getDeals(config)).rejects.toThrow('unavailable');vi.unstubAllGlobals();});
});

describe('account-free independent MCP SDK client',()=>{
 async function client(source='true'){
  const c=new Client({name:'launch-test',version:'1'});
  await c.connect(new StreamableHTTPClientTransport(new URL(config.PUBLIC_ORIGIN+'/mcp'),{fetch:async(input,init)=>{
   const server=createServer({...config,SOURCE_AUTHORIZED:source});
   const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
   await server.connect(transport);const response=await transport.handleRequest(new Request(input,init));await server.close();return response;
  }}));return c;
 }
 it('publishes only anonymous read-only search and no profile/write tools',async()=>{const c=await client();try{const tools=await c.listTools();expect(tools.tools.map(t=>t.name)).toEqual(['deal_scan','purchase_link']);expect(tools.tools[0]._meta?.securitySchemes).toEqual([{type:'noauth'}]);expect(tools.tools[0].annotations?.readOnlyHint).toBe(true);}finally{await c.close();}});
 it('searches without credentials and has no remembered interests or budget',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>new Response(xml)));const c=await client();try{const filtered=await c.callTool({name:'deal_scan',arguments:{queries:['Nike'],currency:'USD',max_price:100}});expect(JSON.stringify(filtered)).toContain('shoes?ref=original');expect(JSON.stringify(filtered)).not.toContain('store.example/euro');expect(JSON.stringify(filtered)).not.toContain('store.example/unknown');const unfiltered=await c.callTool({name:'deal_scan',arguments:{queries:['Nike']}});expect(JSON.stringify(unfiltered)).toContain('store.example/euro');expect((await c.callTool({name:'deal_scan',arguments:{}})).isError).toBe(true);}finally{await c.close();}});
 it('rejects invalid/unknown arguments and missing budget currency',async()=>{const c=await client();try{for(const args of [{queries:[]},{queries:['Nike'],limit:-1},{queries:['Nike'],user_id:'someone'},{queries:['Nike'],query:'old'}])expect((await c.callTool({name:'deal_scan',arguments:args})).isError).toBe(true);expect(JSON.stringify(await c.callTool({name:'deal_scan',arguments:{queries:['Nike'],max_price:100}}))).toContain('needs_currency');}finally{await c.close();}});
 it('distinguishes unsupported queries, disabled sources and fetch failures from zero matches',async()=>{const c=await client('false');try{expect(JSON.stringify(await c.callTool({name:'deal_scan',arguments:{queries:['nicotine']}}))).toContain('unsupported');expect(JSON.stringify(await c.callTool({name:'deal_scan',arguments:{queries:['Nike']}}))).toContain('source_unavailable');}finally{await c.close();}vi.stubGlobal('fetch',vi.fn(async()=>new Response('bad',{status:500})));const live=await client();try{const result=await live.callTool({name:'deal_scan',arguments:{queries:['Nike']}});expect(result.isError).toBe(true);expect(JSON.stringify(result)).toContain('source_unavailable');}finally{await live.close();}});
});
