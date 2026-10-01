# DealHound ChatGPT Plugin — Fine-Print Compliance Checklist

**Status:** pre-submission. No submission has been made. This file records every
policy rule we checked, the source we checked it against, and what in the
package satisfies it. Anything we could not verify against a live source is
marked **UNVERIFIED** — never assumed.

**Package:** `~/workspace/dealhound/chatgpt-plugin/`
(`server.py`, `plugin.json`, `skills/dealhound/SKILL.md`, `tests/`)

---

## 1. Sources consulted (2026-09-30)

| Source | How obtained | Standing |
|---|---|---|
| `~/workspace/connector-portfolio/chatgpt-plugin-readiness.md` §1.4 (commerce policy: no in-plugin digital sales/pricing/upsells; per-permission approvals; 5+/3− reviewer cases) | Internal research doc | VERIFIED (internal) |
| Community mirror of official plugin guidelines — "Commerce and monetization" section (via `llms-txt-archive/openai-platform`, search snippet, crawled ~2026-09-25) | Web search snippet, could not fetch full page (official URL 404s, mirror 404s) | MIRRORED — text quoted, treat as strong but secondary evidence |
| Community mirror of official app-submission guidelines — "Checkout" + "Advertising" sections (via `piercecohen1/openai-docs`, search snippet) | Web search snippet | MIRRORED |
| Community research doc on the official publishing flow (via `oscar-v4/apple-reminders`, crawled 2026-09-25) | Web search snippet | MIRRORED |
| `https://developers.openai.com/plugins/app-guidelines` (official) | Direct fetch 2026-09-30 | **404 — docs restructured, could not verify live** |
| Affiliate-link policy for plugins/apps | Two targeted searches 2026-09-30 | **UNVERIFIED — no official text found** |

---

## 2. Commerce and monetization — rule-by-rule mapping

Official-rules text (mirrored, see sources table):

> "Currently, plugins may conduct commerce **only for physical goods**.
> Selling digital products or services — including subscriptions, digital
> content, tokens, or credits — is not allowed, whether offered directly or
> indirectly (for example, through freemium upsells)."
>
> "Users may sign in to an existing paid account and access features already
> included in their subscription. Plugins must not display subscription plans,
> initiate new subscriptions, or promote upgrades."
>
> "Plugins **may**: explain that a certain feature is not available with the
> user's current plan or entitlement; link to an **informational page**
> describing available plans or entitlement options."
>
> "Plugins **may not**: link directly to a checkout or other transactional
> page; link to a page that explicitly initiates the process to upgrade,
> subscribe, or complete a purchase."

How DealHound complies:

| Rule | Implementation | Evidence |
|---|---|---|
| No digital-goods sale in plugin | Pro ($4.99 one-time) is never sold, priced, or checkout-linked inside the plugin. The only purchase path is external checkout on our own site (Stripe), which the mirrored guidelines name as "the required approach". | `server.py::_tier()` cap path; CommerceSweepTests |
| No freemium upsell | Free-tier cap returns a **neutral** message: `"Watchlist is full (5 of 5 terms used). Remove a term to add a new one."` — no price, no upgrade pitch, no link. The engine's `upgrade_prompt()` (which names price + Stripe link) is intercepted and never surfaced. | `server.py` `_watchlist_add`; test `test_free_tier_cap_blocks_sixth_term_neutrally` |
| No subscription plans displayed | `account_status` reports tier + term counts only. No plan names, no prices, no comparison table anywhere in tool output, skill, or manifest copy. | test `test_status_has_no_commerce_language` |
| Existing paid account sign-in allowed | `account_signin` honors a valid offline license key (Ed25519, existing DealHound Pro owners). It opens nothing, sells nothing — pure entitlement check. | test `test_signin_honors_valid_pro_key_then_signout` |
| Informational (not transactional) linking | The plugin itself links to **nothing commercial**. The landing page's Pro button links to our own site; checkout there is external, not embedded in any plugin UI. | `landing/index.html` (placeholder link, goes live with site) |
| Physical-goods commerce only | The plugin's commerce surface is deal alerts for **physical goods** (shoes, headphones, coffee gear…) from retailers. No digital goods are sold through the plugin. | engine adapters (Slickdeals, Ben's Bargains, Hip2Save, Reddit) |

---

## 3. Advertising rule

> "Plugins must not serve advertisements and must not exist primarily as an
> advertising vehicle. Every plugin must deliver clear, legitimate
> functionality that provides standalone value to users." (mirrored)

- DealHound's standalone value: an always-on personal deal watcher — watchlist
  management, scheduled scans, match alerts with retailer links. The user asks
  for this explicitly ("watch Nike running shoes").
- It is **not** a feed of sponsored placements: matches come from deal
  communities and are scored by the same matcher as the open-source engine.
- Risk note: a shopping assistant sits closer to this line than a pure
  utility. Mitigations: no sponsored slots, no ranking boosts for commission,
  affiliate engine default **OFF** in the plugin.

---

## 4. Affiliate links — ⚠️ UNVERIFIED (biggest open risk)

- No official plugin/app guideline text about affiliate links was found in any
  source we could reach (two searches + direct doc fetches, 2026-09-30).
- Current posture (defensive by design):
  - Affiliate rewriting is **OFF by default** in the plugin
    (`plugin_outbound_link()` returns the raw retailer URL unless
    `DEALHOUND_PLUGIN_AFFILIATE=1`).
  - Affiliate disclosure exists in user-facing surfaces anyway:
    skill (`SKILL.md`), landing page footer, and the package README —
    "we may earn a commission at no extra cost to you."
  - A single choke point (`affiliate.outbound_link()`) means it can be
    flipped on only after written policy clearance, without code changes.
- **Action before monetizing links:** get an explicit answer from OpenAI
  (submission reviewer Q&A or policy contact) on whether disclosed affiliate
  links in deal alerts are permitted. Ship with them OFF regardless.

---

## 5. Prohibited goods & services

DealHound surfaces deals on mainstream physical goods only. It does not touch
any prohibited category (adult, gambling, drugs, weapons, tobacco, counterfeit,
malware, financial services) and executes no money/crypto/investment transfers.
No tool moves user funds. ✅

---

## 6. Communication & listing boundaries

- The plugin **does not imply it is made or endorsed by OpenAI.** Name:
  "DealHound". Description and skill copy say "for ChatGPT", never "by
  OpenAI" / "official". (mirrored rule: plugins "must not imply they are made
  or endorsed by OpenAI")
- Stable and complete, not a trial/demo: the free tier is a real, working
  product (5 terms, daily digest); Pro is an existing paid tier honored via
  offline keys, not a demo gate.
- Clear, accurate name and description. ✅
- Suitable for general audiences (13–17): shopping deal alerts; no mature
  content. ✅

---

## 7. Per-permission approval mapping (for the submission form)

Every tool carries `readOnlyHint` / `destructiveHint` / `openWorldHint`
annotations (`plugin.json`, asserted by `test_tools_have_annotations`). The
non-read-only tools and their justifications:

| Tool | Annotations | Why the permission is needed (reviewer-facing) |
|---|---|---|
| `watchlist_add` | readOnly=false, destructive=false, openWorld=false | Core function: the user tells the plugin what to watch. Writes only to the user's own watchlist; no external side effects. |
| `watchlist_remove` | readOnly=false, destructive=**true**, openWorld=false | Lets the user remove a term they no longer want. Destructive only to their own list; reversible by re-adding. |
| `watchlist_list` | readOnly=true | Reads back the user's own list. |
| `deal_scan` | readOnly=true, openWorld=**true** | Fetches public deal listings from deal communities/retailers. Open-world because it reads third-party sites; writes nothing. |
| `account_signin` | readOnly=false, destructive=false, openWorld=false | Validates an existing Pro license key the user already owns. No purchase flow, no external call. |
| `account_signout` | readOnly=false, destructive=false, openWorld=false | Clears the local license state. |
| `account_status` | readOnly=true | Reports tier + usage counts. No commerce language. |
| `alert_prefs` | readOnly=false, destructive=false, openWorld=false | User's own notification preferences (digest on/off, channel). |

No tool takes credentials, touches payment instruments, or performs
irreversible external actions.

---

## 8. Submission requirements checklist (mirrored publishing flow)

| Requirement | State |
|---|---|
| Accurate tool schemas + annotations | ✅ Done (`plugin.json`, tests) |
| 5 positive + 3 negative reviewer test cases | ✅ Done (`tests/test_reviewer_cases.py`, 8/8 passing) |
| Privacy / Terms / Support URLs | ❌ **TBD** — stubs on landing page, must go live on our domain |
| Public production MCP endpoint (Streamable HTTP, verified domain) | ❌ **Not built** — current server is local stdio |
| Publisher identity verification | ❌ **User action** — OpenAI Platform org |
| Reviewer demo access | ⚠️ Free tier needs no login; if the reviewer tests `account_signin`, we must supply a **demo license key** (test hook exists: `DEALHOUND_PLUGIN_TEST_PUBKEY`) |
| MCP responses exclude personal data/secrets/debug | ✅ Verified — outputs contain only watchlist terms, deal fields, and tier status |

---

## 9. Copy-language audit

- `CommerceSweepTests.test_no_banned_language_in_any_tool_output` scans every
  tool's output for hard-banned tokens (`$4.99`, `buy.stripe.com`,
  payment-link placeholder) — passing.
- Manifest/skill/user-facing copy scanned for the same — passing.
- The words "upgrade"/"checkout" appear **only** inside compliance
  documentation that must discuss the policy (this file, plugin.json's
  compliance block); never in user-facing copy. The test suite distinguishes
  `HARD_BANNED_TOKENS` from `PITCH_TOKENS` for exactly this reason.
- No "official", "endorsed by OpenAI", or "best" superlatives in the listing
  copy.

---

## 10. Open questions (do not ship-block the build, do block launch)

1. **Affiliate links:** permitted with disclosure? (UNVERIFIED — ask OpenAI
   during submission; ship with them OFF.)
2. **Scheduled tasks / MCP Events framing:** skill copy claims always-on
   behavior via ChatGPT features (scheduled tasks, MCP Events). If the
   directory's reviewer tests on a surface without them, the fallback is
   on-demand `deal_scan` — the skill already presents both paths honestly.
3. **Category placement:** which directory category a "deal watcher" lands in
   (Shopping vs Utilities) — decide at listing time.

---

*Last updated 2026-09-30. Re-verify §1 sources against live official docs
before submission — the docs restructured at least once in September 2026.*
