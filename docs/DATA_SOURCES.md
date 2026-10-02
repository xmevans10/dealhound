# Production sources

Best Buy Products API and eBay Browse API adapters are implemented. Neither is enabled without credentials and its explicit flag. Public availability of a page does not establish permission to republish it. The optional RSS adapter remains disabled pending source-specific permission.

## Activation

Register your own production credentials at https://developer.bestbuy.com and https://developer.ebay.com. Confirm applicable production access and terms before enabling. Then, from `worker/`, store credentials directly with Wrangler (never paste them into chat or commit them):

```
npx wrangler secret put BESTBUY_API_KEY
npx wrangler secret put EBAY_CLIENT_ID
npx wrangler secret put EBAY_CLIENT_SECRET
```

Set `BESTBUY_ENABLED` and/or `EBAY_ENABLED` to `"true"` in `wrangler.jsonc`, then deploy. Best Buy supports US searches; eBay selects the requested supported marketplace. End users do not log in: eBay's application credential exchange happens server-side.

`deal_scan` accepts optional `sources: ["bestbuy", "ebay", "rss"]`, reports each provider's status, and preserves successes when another provider fails. Queries go to enabled API providers; full conversations and agent accounts do not. Requests have bounded bodies, deadlines and fixed provider URLs. No private credentials are returned or logged. eBay mints one token per scan: monitor provider token/search quotas before increasing traffic. There is no background monitoring.

Best Buy returns online-available physical sale products. eBay returns fixed-price listings, which may have no discount. Percentages compare provider-reported reference prices, never verified price history. Unknown discounts fail minimum-discount filters. Observed-at timestamps do not establish listing age; explicit age filters exclude undated results. Country is marketplace, not shipping eligibility. Returned provider URLs are unchanged.

## Affiliate configuration

Skimlinks publisher `310329X1798801` and Amazon Associate ID `xmevans10-20` are recorded for future server-side affiliate integration. No Skimlinks script runs on the landing page. These identifiers are not product-search API credentials. Source API result URLs remain unchanged. Independently discovered Amazon product URLs can be attributed through purchase_link; Skimlinks integration and distribution approval remain pending. The site discloses potential commissions. Automatic monitoring requires agent-side scheduling; the connector is currently on demand.

## Agent-first purchase links

The agent may discover products using its own authorized browsing tools, then call `purchase_link` with an independently obtained direct Amazon.com physical product URL. The service returns a canonical product-page link carrying the configured Associate tag and an explicit disclosure. It rejects other domains, shortened links, checkout links and competing affiliate tags; it does not fetch arbitrary URLs. Attribution is not a guarantee of commission. Confirm the deployed domain and agent distribution are approved properties in the relevant affiliate programs before release. Skimlinks Link API configuration remains pending; the supplied browser snippet alone does not establish supported server-side API parameters or merchant eligibility.

## Requested deal publishers: review on 2026-10-02

- Ben's Bargains offers RSS, but its linked Internet Brands terms prohibit aggregation and redistribution, including via RSS, absent an exception. Needs permission for this commercial service. https://bensbargains.com/rss-feeds/ and https://www.internetbrands.com/ibterms
- DealNews allows public RSS attribution but prohibits adding/removing feed display content and modifying links/referral codes. Current filtered/normalized tool needs clarification; our affiliate tags cannot replace theirs. https://www.dealnews.com/pages/rss.html
- Slickdeals requires express written permission for automated access and republishing offers. https://corp-site.slickdeals.net/content-list-slickdeals-terms-of-service/
- Reddit commercial Data API use requires express written approval/separate agreement. https://redditinc.com/policies/data-api-terms

These four are not enabled or advertised as integrated feeds. Native agent browsing does not give our server a license to ingest or reaffiliate their content. The generic RSS adapter can ingest an approved feed once source-specific permission and its feed endpoint are configured. Reddit requires a dedicated approved API integration.
