# DealHound — ChatGPT Plugin

**Tell it once. It watches 24/7.**

DealHound for ChatGPT is a dots-native deal watcher: the user gives ChatGPT
their shopping list once — brands, categories, keywords — and the plugin keeps
watch over deal communities (Reddit deal subs, Slickdeals, Ben's Bargains,
Hip2Save) around the clock via scheduled tasks and MCP Events. When a price
drops on something they actually want, ChatGPT taps them with the deal and a
direct retailer link.

This package wraps the proven DealHound engine (`~/workspace/dealhound/`:
adapters, matcher, affiliate choke point, license tiers) in a dependency-free
MCP server, without modifying the engine.

## Layout

```
chatgpt-plugin/
├── server.py                 # stdio MCP server (JSON-RPC 2.0, zero dependencies)
├── plugin.json               # manifest: tools, annotations, commerce + positioning metadata
├── skills/dealhound/SKILL.md # ChatGPT skill: always-on framing, example prompts
├── tests/
│   ├── helpers.py            # stdio client + fixture-adapter harness
│   ├── test_plugin.py        # 26 tests: manifest, handshake, tool matrix, commerce sweep, engine regression
│   └── test_reviewer_cases.py# 8 tests: 5 positive + 3 negative reviewer cases as executable QA
├── landing/index.html        # standalone landing page (editorial "Good taste. Better prices." design)
├── COMPLIANCE.md             # fine-print compliance checklist (per-rule policy mapping)
├── LAUNCH_CHECKLIST.md       # what's done vs. remaining user-side blockers
└── README.md                 # this file
```

## Tools (8)

| Tool | What it does | Annotations |
|---|---|---|
| `watchlist_add` | Add a brand / category / keyword (free tier: 5 terms) | write, own-data only |
| `watchlist_remove` | Remove a term (reversible) | destructive to own list |
| `watchlist_list` | Show the watchlist + tier usage | read-only |
| `deal_scan` | Scan deal sources for matches now (24h dedupe, raw URLs) | read-only, open-world |
| `account_signin` | Honor an existing Pro license key (no purchase flow) | write, own-data only |
| `account_signout` | Clear local license state | write, own-data only |
| `account_status` | Tier + usage counts (no commerce language) | read-only |
| `alert_prefs` | Get/set digest preferences | write, own-data only |

## Commerce safety (read COMPLIANCE.md for the full mapping)

- **Nothing is sold inside the plugin.** Pro ($4.99 one-time) is purchased via
  external checkout on our own site — the approach the plugin commerce
  guidelines require. The plugin never shows prices, plans, or checkout links.
- Free-tier cap returns a neutral message —
  `"Watchlist is full (5 of 5 terms used). Remove a term to add a new one."`
  The engine's `upgrade_prompt()` (price + Stripe link) is intercepted and
  never surfaced. A test asserts this.
- **Affiliate links are OFF by default.** `plugin_outbound_link()` returns raw
  retailer URLs unless `DEALHOUND_PLUGIN_AFFILIATE=1`. Disclosure copy ships in
  the skill, landing page, and footer regardless. Do not enable without a
  written policy answer from OpenAI (see COMPLIANCE.md §4).

## Quickstart

```bash
# Run the server (stdio MCP)
cd ~/workspace/dealhound/chatgpt-plugin
python3 server.py   # speaks JSON-RPC 2.0 on stdin/stdout

# Run the full test suite (34 tests, ~1 min)
python3 tests/test_plugin.py        # 26 tests
python3 tests/test_reviewer_cases.py # 8 reviewer cases (5+/3-)
```

The server resolves engine state (`watchlist.yaml`, `seen.json`) under
`$XDG_CONFIG_HOME/dealhound/` (falls back to `~/.config/dealhound/`) — set
`XDG_CONFIG_HOME` to a temp dir in tests/automation to avoid touching real
user state.

### Test-only hooks (never set in production)

| Env var | Purpose |
|---|---|
| `DEALHOUND_PLUGIN_TEST_ADAPTER` | `module:Class` fixture adapter (bypasses network) |
| `DEALHOUND_PLUGIN_TEST_DEALS` | JSON file of deals the fixture adapter returns |
| `DEALHOUND_PLUGIN_TEST_PUBKEY` | Ed25519 pubkey override for license tests |
| `DEALHOUND_PLUGIN_AFFILIATE=1` | Enable affiliate URL rewriting (default off) |

## Test report (2026-09-30)

- `tests/test_plugin.py`: **26/26 passing** — manifest schema, MCP handshake,
  full tool matrix (valid / invalid / edge inputs), free-tier gating, Pro
  sign-in, fixture scans, cold start, MCP-event simulation with end-to-end
  24h dedupe, commerce-language sweep, engine regression (82/82 existing
  DealHound tests still green).
- `tests/test_reviewer_cases.py`: **8/8 passing** — the 5 positive and 3
  negative reviewer cases from the submission guidelines, run as executable QA.

## What's not in this package (by design)

- **No hosted HTTPS MCP server.** `server.py` is local stdio — the directory
  requires a public, verified production endpoint. That's a build + hosting
  step (see LAUNCH_CHECKLIST.md).
- **No legal URLs live yet.** Privacy / Terms / Support are stubbed as "coming
  soon" on the landing page; they must exist on our domain before submission.
- **No submission.** Nothing has been submitted anywhere; submission needs
  fresh, explicit user approval.

## License tier recap (engine behavior, honored — never sold — here)

- **Free:** 5 watchlist terms, daily digest.
- **Pro:** $4.99 one-time, unlimited terms, instant alerts. Existing keys
  verified offline (Ed25519); purchase happens on our site only.
