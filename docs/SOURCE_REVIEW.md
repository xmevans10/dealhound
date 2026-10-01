# Public data-source review — October 1, 2026

No private or authenticated APIs, bypassing 403 responses, scraping blocked sites,
or affiliate URL rewriting is implemented. User preference: public sources only.

DealNews explicitly publishes RSS for reuse, with conditions:
https://www.dealnews.com/pages/rss.html
- Attribute DealNews when displayed publicly.
- Do not add/remove content within feed display or alter links/referral codes.
- Do not include content in public browser extensions.

This product is a hosted MCP service, not a browser extension. However, a filtered
and normalized tool result is not clearly established as compliant with the feed
content-display restriction, and OpenAI separately disallows unauthorized and
unofficial pass-through integrations. No agreement has been obtained. Therefore
SOURCE_AUTHORIZED remains false for production; FEED_URL is an unconfigured placeholder. Returning attributed titles with
unchanged links alone is not proof that every condition is satisfied.

Release paths:
1. Confirm public terms cover filtered listings plus added normalized metadata,
   with original item content preserved as needed and source attribution.
2. Obtain clarification/permission from DealNews for this precise display.
3. Replace with a retailer or syndication feed whose published terms explicitly
   permit the intended reuse. Configure URL/name/market/currency; add a fixture
   and verify it independently. No need to pay for a feed solely to finish code.

Do not present unavailable data as empty search results. Public launch needs
functional source access: deployment without a source is a private integration test,
not a complete discovery product. Do not submit a demo-only data source.
