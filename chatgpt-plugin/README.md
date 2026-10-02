# DealHound plugin package

`plugin.json`, `mcp.json`, `assets/icon.svg` and `skills/dealhound/` describe the account-free hosted release. The package builder supplies deployed URLs and excludes backend code and secrets.

The production server is `../worker/`, not the legacy Python prototype. Production tools are anonymous and read-only: `deal_scan` takes queries and filters on every request; `purchase_link` prepares a disclosed Amazon product link. No OAuth, profile, watchlist or persistent preferences.

See `../docs/DEPLOYMENT.md` and `../docs/SUBMISSION.md`. Do not publish before source terms, live host and real ChatGPT behavior are verified.
