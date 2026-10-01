# Cloudflare deployment

Target: Workers Free with static assets and a rate-limit binding. No D1, OAuth, Auth0 or paid plan is required. Free quotas still apply; check Cloudflare's dashboard and live CPU usage before launch.

## Configure
1. Run `npm ci --prefix worker` and `node scripts/build-site.mjs`.
2. From `worker/`, run `npx wrangler login` and complete browser sign-in. Authentication stays outside Git. No API token is needed for interactive deployment.
3. Determine the account's workers.dev subdomain. Set PUBLIC_ORIGIN in wrangler.jsonc to the exact deployed origin, such as https://dealhound.YOUR_SUBDOMAIN.workers.dev, without a trailing slash. A custom domain is optional.
4. Set FEED_URL, FEED_NAME, FEED_COUNTRY and FEED_CURRENCY. The adapter requires RSS 2.0 with item title, HTTPS link and pubDate. Verify reuse terms, attribution and filtering rights; record the source terms URL and conclusion in SOURCE_REVIEW.md. Only then set SOURCE_AUTHORIZED to true. Keep existing source links intact.
5. Add a real private support email and publisher identity to legal/support pages and the listing. Confirm data disclosures.
6. Run `npm run deploy --prefix worker`. No database migrations are needed.
7. Run `node scripts/preflight.mjs https://YOUR_ORIGIN` and test real queries through an independent MCP client and ChatGPT developer mode. Choose No Authentication. Inspect real source results and failure behavior.

## Domain verification and release
When OpenAI supplies a domain-verification challenge, set it securely with `npx wrangler secret put OPENAI_CHALLENGE` from worker/. The service returns that exact text at /.well-known/openai-apps-challenge. This is a verification value, not a user login credential.

Record the reviewer walkthrough, run all review cases, package with scripts/package-plugin.py and submit as documented in SUBMISSION.md. Once approved and published, set chatgpt_install_url in launch.json to the actual directory URL and redeploy. Do not publish a placeholder install link. Obtain actual Muse onboarding requirements before setting its URL.

## Operations
Anonymous search has an approximate aggregate 120-request/minute limit per Cloudflare location, without storing user identifiers. A busy shared quota returns 429 and Retry-After. Feeds are bounded to 1 MB, cached five minutes and fetched with a timeout; requests are bounded to 64 KB. Hosting-level abuse controls may be needed with traffic growth. Application request logging is disabled; Cloudflare may retain platform/security metadata. No private shopping data requires application backups.

Readiness checks configuration and the source enablement flag, not upstream availability. Live source checks and actual host testing remain release requirements. Roll back through Cloudflare deployment history if a new build fails.
