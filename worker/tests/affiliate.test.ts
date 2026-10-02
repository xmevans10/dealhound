import {it,expect} from 'vitest';
import {amazonLink} from '../src/affiliate';
it('produces a disclosed Amazon product link without making a purchase',()=>{expect(amazonLink('https://amazon.com/dp/B012345678?ref=abc','xmevans10-20')).toMatchObject({supported:true,purchase_url:'https://www.amazon.com/dp/B012345678?tag=xmevans10-20',affiliate:true});});
it('rejects spoofed hosts, credentials, redirects, checkout and existing competing attribution',()=>{for(const url of ['https://amazon.com.evil.com/dp/B012345678','https://user@amazon.com/dp/B012345678','https://amzn.to/short','https://amazon.com/checkout','https://amazon.com/dp/B012345678?tag=other-20'])expect(amazonLink(url,'xmevans10-20').supported).toBe(false);});
it('requires a configured valid associate ID',()=>{expect(amazonLink('https://amazon.com/dp/B012345678',undefined).supported).toBe(false);});
