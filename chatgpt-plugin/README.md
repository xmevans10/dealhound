# DealHound beta 0.2

Self-contained Python 3 service for saved shopping interests and on-demand
DealNews RSS searches. SQLite state is separated by authenticated user.
No third-party runtime dependencies. No affiliate rewriting or purchases.

## Run and test

From this directory:

```sh
python3 server.py  # local MCP stdio
python3 -m unittest discover -s tests -v
```

Private HTTP beta (behind a TLS reverse proxy):

```sh
export DEALHOUND_TOKENS='{"your-long-random-secret":"your-user-id"}'
export DEALHOUND_DB='/persistent/path/dealhound.sqlite3'
python3 server.py --http --port 8000
```

The service binds localhost. POST MCP JSON-RPC to `/mcp`, with
`Authorization: Bearer your-long-random-secret`. GET `/health` is public.
It uses stateless Streamable HTTP JSON responses; notifications return 202.
Tokens are server provisioned and must be unique, random and kept out of Git.
Browser Origins are rejected unless explicitly listed in
`DEALHOUND_ALLOWED_ORIGINS` (comma separated).

`mcp.json` configures local stdio. For public deployment replace its server
entry with `{"type":"streamable-http","url":"https://YOUR_DOMAIN/mcp"}`.
The relative server path assumes launch from the plugin directory.

## Current limits and release work

- On-demand RSS listings only, with substring matching and source timestamps.
  Listings may be expired; no verified price history, numeric price filtering,
  region/currency matching, automatic scans or notifications.
- Preferences are stored but explicitly reported as not applied.
- No paid licenses. The old wrapper depended on an engine not in this repository.
  Previous engine-dependent tests are retained under tests/legacy as reference;
  their historical pass claims are not current verification.
- OAuth 2.1, authorization metadata and user consent must replace private beta
  bearer provisioning for public account linking.
- Production TLS hosting, rate limits, logs, backups, source caching and source
  usage permission review remain required. The stdlib HTTP server is for beta,
  not an internet-facing production server.
- Background worker and signed MCP Events subscription/delivery lifecycle are
  required before promising alerts. No sidebar UI exists yet.
- Public legal/support URLs, publisher/domain verification, schema validation,
  review scenarios and walkthrough recording remain before directory submission.
- Older landing and compliance documents retain proposed features; do not publish
  them as a description of this beta.

## Muse

Reuse the authenticated service and tool implementations. Muse connector
submission is supported publicly, but its technical onboarding contract has not
been obtained. There is no certified Muse package here. Confirm transport/auth
requirements before writing a platform adapter. No directory submission was made.
