import {XMLParser, XMLValidator} from 'fast-xml-parser';
import {z} from 'zod';

export const termSchema = z.string().trim().min(1).max(120);
export const prefsSchema = z.object({
  max_price:z.number().finite().nonnegative().max(1000000).nullable().optional(),
  currency:z.enum(['USD','EUR','GBP','CAD','AUD']).optional(),
  country:z.enum(['US','GB','CA','AU','DE','FR','ES','IT','NL','IE']).optional(),
  min_discount_pct:z.number().finite().min(0).max(100).nullable().optional(),
  max_age_days:z.number().int().min(1).max(30).optional(),
});
export type Preferences = z.infer<typeof prefsSchema>;
export interface Deal {title:string;url:string;source:string;country:string;currency:string|null;price:number|null;discount_pct:number|null;published:string|null;checked_at?:string;price_updated?:string|null;image_url?:string|null;reference_price?:number|null;discount_basis?:string|null;source_payload?:Record<string,unknown>}
export interface Source {name:string;country:string;currency:string}
const blocked = /\b(ammunition|firearms?|rifles?|pistols?|shotguns?|vapes?|nicotine|tobacco|cigarettes?|cannabis|marijuana|THC|CBD|bongs?|sex toys?|porn|pepper spray|stun guns?|prescription|gift cards?|subscriptions?|memberships?|software|VPN|e-?books?|online courses?|digital downloads?|crypto|casino|lottery)\b/i;
export function isAllowed(title:string):boolean { return !blocked.test(title); }
export function parseFeed(xml:string,source:Source):Deal[] {
  if(xml.length>1000000 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml)!==true) throw new Error('Invalid feed');
  const parser = new XMLParser({ignoreAttributes:false,parseTagValue:false,processEntities:true});
  const doc=parser.parse(xml); const raw=doc.rss?.channel?.item;
  if(!doc.rss?.channel) throw new Error('Unsupported feed format');
  const items=raw ? (Array.isArray(raw)?raw:[raw]) : [];
  const seen=new Set<string>(); const result:Deal[]=[];
  for(const item of items.slice(0,200)) {
    const title=typeof item.title==='string'?item.title.trim():'';
    const url=typeof item.link==='string'?item.link.trim():'';
    let parsed:URL;try{parsed=new URL(url);}catch{continue;}
    if(parsed.protocol!=='https:' || parsed.username || parsed.password || !title || title.length>500 || seen.has(url) || !isAllowed(title)) continue;
    const amounts=[...title.matchAll(/(?:US\$|USD\s*|\$|€|EUR\s*|£|GBP\s*)(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi)];
    const candidate=amounts.length===1?amounts[0]:null;
    const amount=candidate && !/^\s*(off|credit|coupon)/i.test(title.slice(candidate.index!+candidate[0].length)) && !/(save|coupon|credit)\s*$/i.test(title.slice(0,candidate.index))?candidate:null;
    const currency=amount ? (/€|EUR/i.test(amount[0])?'EUR':/£|GBP/i.test(amount[0])?'GBP':/USD|US\$/i.test(amount[0])?'USD':source.currency) : null;
    const price=amount?Number(amount[1].replaceAll(',','')):null;
    const discount=title.match(/\b(\d{1,2}|100)%\s*off\b/i);
    const date=typeof item.pubDate==='string'?Date.parse(item.pubDate):NaN;
    seen.add(url);
    result.push({title,url,source:source.name,country:source.country,currency,price,discount_pct:discount && !/up to\s*$/i.test(title.slice(0,discount.index))?Number(discount[1]):null,published:Number.isFinite(date)?new Date(date).toISOString():null});
  }
  return result;
}
export function matches(deals:Deal[],terms:string[],prefs:Preferences,now=Date.now()):Deal[] {
  const queries=terms.map(t=>t.toLocaleLowerCase().split(/\s+/).filter(Boolean));
  return deals.filter(d=>{
    if(!queries.some(words=>words.every(w=>d.title.toLocaleLowerCase().includes(w)))) return false;
    if(prefs.country && d.country!==prefs.country) return false;
    if(prefs.currency && d.currency!==prefs.currency) return false;
    if(prefs.max_price!=null && (d.price==null || d.price>prefs.max_price || !prefs.currency || d.currency!==prefs.currency)) return false;
    if(prefs.min_discount_pct!=null && (d.discount_pct==null || d.discount_pct<prefs.min_discount_pct)) return false;
    // Live API observation is not a publication date. Explicit listing-age
    // filters require a real listing date; RSS always requires one.
    const stamp=d.published?Date.parse(d.published):prefs.max_age_days===undefined&&d.checked_at?Date.parse(d.checked_at):NaN;
    if(!Number.isFinite(stamp) || stamp>now+5*60000 || now-stamp>(prefs.max_age_days??7)*86400000) return false;
    return true;
  });
}
