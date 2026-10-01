# DealHound

Account-free, on-demand physical product deal search in your agent. The agent supplies interests and filters on every request. No website watchlist, server-side shopping profile, OAuth, purchases or automatic alerts.

Production target: `worker/` uses the official TypeScript MCP SDK on Cloudflare Workers with static assets, anonymous read-only search, bounded feed fetching and a shared request limit. No database or identity provider is required. Legacy Python files in `chatgpt-plugin/` are historical prototypes and must not be deployed.

## Check and build
```sh
npm ci --prefix worker
npm run check --prefix worker
npm test --prefix worker
node scripts/build-site.mjs
npm run build --prefix worker
```

See [deployment](docs/DEPLOYMENT.md), [launch plan](docs/LAUNCH_PLAN.md), [source review](docs/SOURCE_REVIEW.md) and [submission](docs/SUBMISSION.md).

Public launch still requires a permitted source, Cloudflare sign-in/configuration, private support/publisher details, real ChatGPT testing and directory approval. Muse support is planned. Feed fetching is disabled until reuse terms are verified; public availability alone is not a license to repackage content.
