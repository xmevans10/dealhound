# DealHound ChatGPT Plugin — Launch Checklist

**Goal:** as launch-ready as possible. Everything doable without the user is
done. What remains needs the user (or an explicit approval) and is listed
with the exact action.

## ✅ Done (no user needed)

- [x] **MCP server** (`server.py`) — dependency-free stdio JSON-RPC 2.0 server,
      8 tools, wraps the existing DealHound engine without modifying it.
- [x] **Manifest** (`plugin.json`) — tool schemas, `readOnlyHint` /
      `destructiveHint` / `openWorldHint` annotations, dots-native
      positioning ("Tell it once. It watches 24/7."), 6 discovery-engineered
      example prompts, commerce-compliance block.
- [x] **Skill** (`skills/dealhound/SKILL.md`) — commerce-compliant,
      always-on / scheduled-task / MCP-Events framing.
- [x] **Tests: 34/34 green** (2026-09-30) — `tests/test_plugin.py` (26:
      manifest, handshake, tool matrix, free-tier gating, Pro sign-in,
      fixture scans, cold start, event simulation with 24h dedupe,
      commerce-language sweep, 82/82 engine regression) and
      `tests/test_reviewer_cases.py` (8: the 5 positive + 3 negative reviewer
      cases as executable QA).
- [x] **State isolation fixed** — server honors `XDG_CONFIG_HOME`; early test
      pollution of the real `~/.config/dealhound/` was cleaned up
      (`seen.json` restored to 342 entries, test keywords removed).
- [x] **Commerce hardening** — affiliate rewriting OFF by default (single
      choke point, env-gated); free-tier cap message neutral (no price, no
      pitch, no link); engine `upgrade_prompt()` never surfaced; banned-token
      sweep in tests.
- [x] **COMPLIANCE.md** — fine-print checklist: rule-by-rule mapping for
      commerce/monetization, advertising, prohibited goods, communication
      boundaries, per-permission approval justifications for all 8 tools,
      submission-requirements table, copy-language audit. Affiliate-link
      policy flagged **UNVERIFIED** (no official text found 2026-09-30).
- [x] **Landing page** (`landing/index.html`) — standalone page in the
      editorial "Good taste. Better prices." design language: dots-native
      positioning, how-it-works, Free vs Pro (Pro bought on our site, never
      in-plugin), affiliate disclosure, FAQ, Privacy/Terms/Support stubbed as
      "coming soon".
- [x] **README.md** — package overview, tool table, quickstart, test report.

## ⏳ Remaining — user-side blockers (in launch order)

1. **Site + domain (free path chosen).** The landing page and legal URLs need
   a live home. Direction already agreed: free subdomain (Cloudflare Pages or
   Netlify Drop), $0 forever — no domain picked yet.
   → User action: pick the subdomain/host; then we deploy `landing/index.html`
   as the site (or its plugin section).

2. **Legal URLs go live.** Privacy Policy, Terms of Service, Support contact
   must be public URLs on our domain before submission. Currently stubbed as
   "coming soon" on the landing page.
   → User action: approve the texts (we can draft them), then publish.

3. **Stripe Pro checkout link.** Pro ($4.99 one-time) is bought via external
   checkout on our site — the required approach. The engine already supports
   the flow; the payment link itself doesn't exist yet.
   → User action: create the Stripe payment link; we wire it into the site.

4. **Affiliate IDs + policy answer.** No real affiliate IDs yet, and OpenAI's
   stance on disclosed affiliate links in plugins is **unverified** — the #1
   revenue risk. Ship with affiliate rewriting OFF regardless.
   → User action: none yet; we ask OpenAI during submission review.

5. **Hosted HTTPS MCP server.** The directory requires a public, verified
   production MCP endpoint (Streamable HTTP). Current `server.py` is local
   stdio — submission-ready logic, not submission-ready transport.
   → Build + hosting step; needs the domain from (1). No approval needed to
   build, but hosting has a (tiny) cost surface — confirm $0 path first.

6. **Publisher identity verification.** OpenAI Platform org with
   `Apps Management: Write` access + verified individual/business identity.
   → User action: verify in the OpenAI Platform dashboard.

7. **Reviewer demo key.** If the reviewer exercises `account_signin`, supply a
   demo Pro license key (test hook `DEALHOUND_PLUGIN_TEST_PUBKEY` exists).
   Free tier needs no login.
   → We generate the key at submission time.

8. **Submission approval.** Nothing is submitted without fresh, explicit user
   approval. When 1–7 are resolved, we assemble the listing (name, category,
   description, logo, URLs, release notes) and ask for the go-ahead.

## Deliberately not done

- No submission made, no accounts created, no terms accepted, no spend, no
  hosting provisioned — per task bounds.
- Muse connector files untouched.
