import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {createServer,type ServiceEnv} from './mcp';
interface Env extends ServiceEnv {ASSETS:Fetcher;RATE_LIMITER:RateLimit;OPENAI_CHALLENGE?:string}
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const configured=(env:ServiceEnv)=>{try{const u=new URL(env.PUBLIC_ORIGIN);return u.protocol==='https:'&&u.origin===env.PUBLIC_ORIGIN&&!env.PUBLIC_ORIGIN.includes('REPLACE');}catch{return false;}};
export default {
 async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  const url=new URL(request.url);
  if(url.pathname==='/health')return json({status:'ok'});
  if(url.pathname==='/ready')return json({ready:configured(env)&&env.SOURCE_AUTHORIZED==='true'},configured(env)&&env.SOURCE_AUTHORIZED==='true'?200:503);
  if(url.pathname==='/.well-known/openai-apps-challenge')return env.OPENAI_CHALLENGE?new Response(env.OPENAI_CHALLENGE,{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}}):new Response('Not configured',{status:404});
  if(url.pathname.startsWith('/.well-known/oauth-'))return new Response('Not found',{status:404});
  if(url.pathname!=='/mcp')return env.ASSETS.fetch(request);
  if(!configured(env))return json({error:'Service configuration is incomplete.'},503);
  if(url.origin!==env.PUBLIC_ORIGIN)return json({error:'Invalid host.'},403);
  if(request.headers.has('Origin')&&request.headers.get('Origin')!==env.PUBLIC_ORIGIN)return json({error:'Origin is not allowed.'},403);
  if(!['POST','GET','DELETE'].includes(request.method))return json({error:'Method not allowed.'},405,{'Allow':'POST, GET, DELETE'});
  if(Number(request.headers.get('Content-Length')??0)>65536)return json({error:'Request is too large.'},413);
  try{
   // Aggregate limit avoids retaining user identifiers. Shared quota is approximate
   // per Cloudflare location; the cached source further bounds upstream requests.
   if(!(await env.RATE_LIMITER.limit({key:'public-mcp'})).success)return json({error:'Service is busy. Try again in one minute.'},429,{'Retry-After':'60'});
   const server=createServer(env,typeof caches==='undefined'?undefined:caches.default);
   const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxRequestBodySize:65536});
   await server.connect(transport);
   const response=await transport.handleRequest(request);
   ctx.waitUntil(server.close());
   return response;
  }catch{return json({error:'Service unavailable. Please try later.'},503);}
 }
};
