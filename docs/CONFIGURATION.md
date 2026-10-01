# Values needed for deployment and submission

No Auth0, OAuth client secret, database ID or user-login credentials are needed.

## Deployment
- PUBLIC_ORIGIN: exact Cloudflare workers.dev origin or your existing custom domain. If unknown, complete `cd worker && npx wrangler login`; the account's subdomain can then be discovered.
- FEED_URL: a permitted RSS 2.0 product-deal feed.
- FEED_NAME: public attribution name.
- FEED_COUNTRY: source market, e.g. US.
- FEED_CURRENCY: currency used by bare dollar amounts, e.g. USD.
- SOURCE_TERMS_URL and permission basis: documentation permitting this use. Public accessibility is insufficient; do not set SOURCE_AUTHORIZED until reviewed.
- SUPPORT_EMAIL: a public support/privacy inbox.
- PUBLISHER_NAME: the person or business responsible for the product and listing.

## Generated later
- OPENAI_CHALLENGE: supplied by the submission portal; enter locally through `wrangler secret put OPENAI_CHALLENGE`.
- DEMO_RECORDING_URL: reviewer-accessible HTTPS walkthrough after live testing.
- CHATGPT_INSTALL_URL: actual published listing URL, after approval and publication.

Use interactive Cloudflare login rather than sending passwords or API tokens in chat. No affiliate credentials are needed for this release. Muse-specific values are unknown until its integration requirements are verified.
