export function amazonLink(productUrl:string,tag:string|undefined){
 let url:URL;try{url=new URL(productUrl);}catch{return {supported:false,reason:'Invalid product URL.'};}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!['www.amazon.com','amazon.com'].includes(url.hostname))return {supported:false,reason:'Only direct HTTPS Amazon.com product URLs are supported. No redirects are followed.'};
 const asin=url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1];
 if(!asin)return {supported:false,reason:'A product URL with an ASIN is required; search and checkout URLs are unsupported.'};
 const existing=url.searchParams.getAll('tag');
 if(existing.some(t=>t!==tag))return {supported:false,reason:'Existing publisher attribution is preserved. Find the product independently on the retailer site.'};
 if(!tag||!/^[-a-zA-Z0-9]+-20$/.test(tag))return {supported:false,reason:'Amazon Associate ID is not configured.'};
 const purchase=new URL('https://www.amazon.com/dp/'+asin.toUpperCase());purchase.searchParams.set('tag',tag);
 return {supported:true,purchase_url:purchase.href,merchant:'Amazon.com',affiliate:true,disclosure:'As an Amazon Associate I earn from qualifying purchases.',notice:'Product-page link, not a checkout session. Commission depends on program eligibility, account approval and a qualifying purchase. Price and availability must be checked at the live retailer. Historical deal posts do not verify a current sale. If not verified, label the offer unverified and do not use its sale price in current comparisons.'};
}
