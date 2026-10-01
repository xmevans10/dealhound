#!/usr/bin/env python3
"""DealHound ChatGPT-plugin MCP server (local build / dev).

Speaks MCP (JSON-RPC 2.0) over stdio with zero third-party dependencies.
Wraps the existing DealHound engine (~/workspace/dealhound/dealhound/)
without modifying the Muse connector packaging.

Tools:
  watchlist_add / watchlist_remove / watchlist_list
  deal_scan
  account_signin / account_signout / account_status
  alert_prefs

COMMERCE-POLICY COMPLIANCE (OpenAI plugin guidelines, see
../connector-portfolio/chatgpt-plugin-readiness.md §1.4):
  - No in-plugin checkout, no pricing display, no plan/upgrade promotion.
  - Pro is HONORED via sign-in to an existing license key, never sold here.
  - The engine's upgrade_prompt() (price + Stripe payment link) is NEVER
    surfaced: free-tier cap blocks return a neutral message only.

AFFILIATE POLICY (blocker, unverified):
  Affiliate links are disabled by default in this plugin build. The
  dealhound.affiliate.outbound_link() choke point stays wired behind the
  DEALHOUND_PLUGIN_AFFILIATE env flag (set to "1" to enable); until OpenAI
  confirms the affiliate policy, the build runs clean with raw URLs.

TEST-ONLY hooks (never set in production):
  DEALHOUND_PLUGIN_TEST_PUBKEY   hex Ed25519 pubkey overriding the vendor key
  DEALHOUND_PLUGIN_TEST_ADAPTER  "module.path:ClassName" stub adapter for scans

State: engine paths via XDG_CONFIG_HOME (isolate tests with a temp dir).
"""

import datetime
import json
import os
import sys

DEALHOUND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, DEALHOUND_ROOT)  # engine package + dh.py helpers

import dh  # noqa: E402  (CLI helpers: watchlist/seen load+save; safe to import)
from dealhound import license as lic  # noqa: E402
from dealhound import matcher  # noqa: E402
from dealhound.adapter import CheckMode  # noqa: E402
from dealhound.adapters import all_adapters  # noqa: E402

# State isolation: dh.py computes its paths from the real home dir at import
# time and ignores XDG_CONFIG_HOME. The plugin server must honor
# XDG_CONFIG_HOME (same semantics as license.data_dir()) so tests never
# touch the user's live watchlist. dh.py itself is NOT modified.
_xdg = os.environ.get("XDG_CONFIG_HOME") or os.path.join(
    os.path.expanduser("~"), ".config")
_dh_config_dir = os.path.join(_xdg, "dealhound")
os.makedirs(_dh_config_dir, exist_ok=True)
dh.WATCHLIST_PATH = os.path.join(_dh_config_dir, "watchlist.yaml")
dh.SEEN_PATH = os.path.join(_dh_config_dir, "seen.json")

SERVER_NAME = "dealhound-mcp"
SERVER_VERSION = "1.0.0"
PROTOCOL_VERSION = "2024-11-05"

# ---------------------------------------------------------------------------
# Test-only overrides (env-gated; production never sets these)
# ---------------------------------------------------------------------------
_test_pubkey = os.environ.get("DEALHOUND_PLUGIN_TEST_PUBKEY")
if _test_pubkey:
    lic.VENDOR_PUBLIC_KEY = bytes.fromhex(_test_pubkey)  # TEST ONLY

_TEST_ADAPTER = os.environ.get("DEALHOUND_PLUGIN_TEST_ADAPTER")

# ---------------------------------------------------------------------------
# Affiliate: wired through the choke point, DISABLED by default.
# ---------------------------------------------------------------------------
_AFFILIATE_ENABLED = os.environ.get("DEALHOUND_PLUGIN_AFFILIATE", "0") == "1"


def plugin_outbound_link(url):
    """Deal-URL presentation for the plugin.

    Routes through dealhound.affiliate.outbound_link() (the single choke
    point) only when explicitly enabled. Default: raw URL, zero monetized
    links — required until the affiliate policy is confirmed.
    """
    if not url:
        return url
    if not _AFFILIATE_ENABLED:
        return url
    from dealhound import affiliate
    return affiliate.outbound_link(url)


# ---------------------------------------------------------------------------
# Watchlist helpers (mirror dh.py semantics; neutral cap message)
# ---------------------------------------------------------------------------

_TERM_KEYS = {"brand": "user_brands", "category": "user_categories",
              "keyword": "user_keywords"}

CAP_FULL_MESSAGE = ("Watchlist is full (5 of 5 terms used). "
                    "Remove a term before adding a new one.")


def _watchlist_add(term_type, value):
    term_type = (term_type or "").lower()
    if term_type not in _TERM_KEYS:
        return False, "term_type must be one of: brand, category, keyword"
    value = (value or "").strip()
    if not value:
        return False, "value must be a non-empty term"
    wl = dh.load_watchlist()
    key = _TERM_KEYS[term_type]
    existing = [x.lower() for x in (wl.get(key) or [])]
    if value.lower() in existing:
        return True, f"already watching {term_type}: {value}"
    # Freemium cap check — boolean only; the engine's upgrade prompt
    # (price + payment link) is NEVER surfaced in the plugin.
    tier = lic.current_tier()
    allowed, _ = lic.can_add_terms(len(dh.all_terms(wl)), 1, tier)
    if not allowed:
        return False, CAP_FULL_MESSAGE
    wl[key].append(value)
    dh.save_watchlist(wl)
    return True, f"added {term_type}: {value}"


def _watchlist_remove(term_type, value):
    term_type = (term_type or "").lower()
    if term_type not in _TERM_KEYS:
        return False, "term_type must be one of: brand, category, keyword"
    value = (value or "").strip()
    wl = dh.load_watchlist()
    key = _TERM_KEYS[term_type]
    before = len(wl.get(key) or [])
    wl[key] = [x for x in (wl.get(key) or []) if x.lower() != value.lower()]
    dh.save_watchlist(wl)
    if len(wl[key]) < before:
        return True, f"removed {term_type}: {value}"
    return False, f"not on the watchlist: {value}"


def _watchlist_list():
    wl = dh.load_watchlist()
    out = {}
    for key in ("brands", "categories", "keywords",
                "user_brands", "user_categories", "user_keywords"):
        out[key] = list(wl.get(key) or [])
    out["total_terms"] = len(dh.all_terms(wl))
    return out


# ---------------------------------------------------------------------------
# Deal scan
# ---------------------------------------------------------------------------

def _get_adapters():
    if _TEST_ADAPTER:
        mod_path, cls_name = _TEST_ADAPTER.rsplit(":", 1)
        import importlib
        mod = importlib.import_module(mod_path)
        return [getattr(mod, cls_name)()]
    return all_adapters()


def _deal_scan(query=None, limit=10, source=None):
    raw = dh.load_watchlist()
    merged = {
        "brands": list(raw.get("brands") or []) + list(raw.get("user_brands") or []),
        "categories": list(raw.get("categories") or []) + list(raw.get("user_categories") or []),
        "keywords": list(raw.get("keywords") or []) + list(raw.get("user_keywords") or []),
        "min_discount_pct": raw.get("min_discount_pct"),
        "max_price": raw.get("max_price"),
        "max_age_days": raw.get("max_age_days", 30),
        "synonyms": raw.get("synonyms") or {},
    }
    wl = matcher.Watchlist.from_dict(merged)
    queries = [query] if query else matcher.queries_from_watchlist(wl)
    if not queries:
        return {"matches": [], "note": "watchlist is empty — add a brand, category, or keyword first"}

    deals = []
    for adapter in _get_adapters():
        if source and adapter.name != source:
            continue
        try:
            deals.extend(adapter.search(queries, mode=CheckMode.DEAL))
        except Exception:
            continue  # one bad adapter must not kill the scan

    matches = matcher.match_deals(deals, wl)
    seen = dh.load_seen()
    dedupe_h = raw.get("dedupe_hours", 24)
    now = datetime.datetime.now(datetime.timezone.utc).timestamp()
    fresh = []
    for m in matches:
        ts = seen.get(m.deal.url)
        if ts and now - ts < dedupe_h * 3600:
            continue
        fresh.append(m)
        seen[m.deal.url] = now
    dh.save_seen(seen)

    out = []
    for m in fresh[: max(1, int(limit or 10))]:
        d = m.deal
        out.append({
            "title": d.title,
            "price": d.price,
            "original_price": d.original_price,
            "discount_pct": d.discount_pct,
            "merchant": d.merchant,
            "url": plugin_outbound_link(d.url),
            "source": d.source,
            "score": m.score,
            "reasons": m.reasons,
            "affiliate_monetized": _AFFILIATE_ENABLED,
        })
    return {"matches": out, "affiliate_monetized": _AFFILIATE_ENABLED}


# ---------------------------------------------------------------------------
# Account (sign-in honors an EXISTING license; nothing is sold here)
# ---------------------------------------------------------------------------

def _account_signin(license_key):
    if not license_key or not str(license_key).strip():
        return False, "no license key provided"
    try:
        payload = lic.activate(str(license_key))
    except ValueError as e:
        return False, f"that key didn't check out: {e}"
    tier = lic.resolve_tier(payload)
    return True, {"tier": tier, "email": payload.get("email")}


def _account_signout():
    p = lic.license_path()
    try:
        if os.path.exists(p):
            os.remove(p)
    except OSError:
        pass
    return True, "signed out — now on the free tier"


def _account_status():
    # Factual only: tier state, usage, cadence. No prices, no payment
    # links, no upgrade prompts — per plugin commerce policy.
    tier = lic.current_tier()
    wl = dh.load_watchlist()
    n_terms = len(dh.all_terms(wl))
    cap = lic.term_cap_for_tier(tier)
    return {
        "signed_in": lic.is_licensed(),
        "tier": tier,
        "watchlist_terms": n_terms,
        "watchlist_cap": cap,          # null = unlimited
        "alert_cadence": lic.TIER_CADENCE[tier],
        "affiliate_monetized": _AFFILIATE_ENABLED,
    }


def _alert_prefs(min_discount_pct=None, max_price=None, max_age_days=None):
    wl = dh.load_watchlist()
    changed = []
    for field, val in (("min_discount_pct", min_discount_pct),
                       ("max_price", max_price),
                       ("max_age_days", max_age_days)):
        if val is not None:
            wl[field] = float(val)
            changed.append(field)
    if changed:
        dh.save_watchlist(wl)
    return {
        "min_discount_pct": wl.get("min_discount_pct"),
        "max_price": wl.get("max_price"),
        "max_age_days": wl.get("max_age_days", 30),
        "updated": changed,
    }


# ---------------------------------------------------------------------------
# Tool registry (annotations per plugin submission requirements)
# ---------------------------------------------------------------------------

def _ann(ro=False, dest=False, ow=False, idem=True):
    return {"readOnlyHint": ro, "destructiveHint": dest,
            "openWorldHint": ow, "idempotentHint": idem}


TOOLS = [
    {
        "name": "watchlist_add",
        "description": "Add a brand, category, or keyword to the deal watchlist.",
        "inputSchema": {"type": "object", "properties": {
            "term_type": {"type": "string",
                          "enum": ["brand", "category", "keyword"]},
            "value": {"type": "string"}}, "required": ["term_type", "value"]},
        "annotations": _ann(ro=False, idem=False),
    },
    {
        "name": "watchlist_remove",
        "description": "Remove a brand, category, or keyword from the deal watchlist.",
        "inputSchema": {"type": "object", "properties": {
            "term_type": {"type": "string",
                          "enum": ["brand", "category", "keyword"]},
            "value": {"type": "string"}}, "required": ["term_type", "value"]},
        "annotations": _ann(ro=False, idem=True),
    },
    {
        "name": "watchlist_list",
        "description": "List the current deal watchlist (brands, categories, keywords).",
        "inputSchema": {"type": "object", "properties": {}},
        "annotations": _ann(ro=True),
    },
    {
        "name": "deal_scan",
        "description": ("Scan deal sources for price drops matching the watchlist "
                        "(or a one-off query). Returns ranked matches with price, "
                        "discount, merchant, reasons, and link."),
        "inputSchema": {"type": "object", "properties": {
            "query": {"type": "string"},
            "limit": {"type": "integer", "default": 10},
            "source": {"type": "string"}}, "required": []},
        "annotations": _ann(ro=True, ow=True),
    },
    {
        "name": "account_signin",
        "description": ("Sign in with an existing DealHound Pro license key "
                        "(from a purchase made on the DealHound website). "
                        "The key is verified offline; nothing is sold here."),
        "inputSchema": {"type": "object", "properties": {
            "license_key": {"type": "string"}}, "required": ["license_key"]},
        "annotations": _ann(ro=False, idem=True),
    },
    {
        "name": "account_signout",
        "description": "Sign out of the DealHound account on this device.",
        "inputSchema": {"type": "object", "properties": {}},
        "annotations": _ann(ro=False, idem=True),
    },
    {
        "name": "account_status",
        "description": "Show account state: tier, watchlist usage, alert cadence.",
        "inputSchema": {"type": "object", "properties": {}},
        "annotations": _ann(ro=True),
    },
    {
        "name": "alert_prefs",
        "description": ("Get or set deal alert filters: minimum discount percent, "
                        "maximum price, maximum listing age in days."),
        "inputSchema": {"type": "object", "properties": {
            "min_discount_pct": {"type": "number"},
            "max_price": {"type": "number"},
            "max_age_days": {"type": "number"}}, "required": []},
        "annotations": _ann(ro=False, idem=True),
    },
]


def _call_tool(name, args):
    args = args or {}
    if name == "watchlist_add":
        ok, msg = _watchlist_add(args.get("term_type"), args.get("value"))
    elif name == "watchlist_remove":
        ok, msg = _watchlist_remove(args.get("term_type"), args.get("value"))
    elif name == "watchlist_list":
        return {"content": [{"type": "text",
                             "text": json.dumps(_watchlist_list(), indent=2)}],
                "isError": False}
    elif name == "deal_scan":
        return {"content": [{"type": "text", "text": json.dumps(
            _deal_scan(args.get("query"), args.get("limit", 10),
                       args.get("source")), indent=2)}], "isError": False}
    elif name == "account_signin":
        ok, res = _account_signin(args.get("license_key"))
        msg = res if isinstance(res, str) else json.dumps(res)
    elif name == "account_signout":
        ok, msg = _account_signout()
    elif name == "account_status":
        return {"content": [{"type": "text",
                             "text": json.dumps(_account_status(), indent=2)}],
                "isError": False}
    elif name == "alert_prefs":
        return {"content": [{"type": "text", "text": json.dumps(
            _alert_prefs(args.get("min_discount_pct"), args.get("max_price"),
                         args.get("max_age_days")), indent=2)}],
                "isError": False}
    else:
        return {"content": [{"type": "text",
                             "text": f"unknown tool: {name}"}],
                "isError": True}
    return {"content": [{"type": "text", "text": msg}], "isError": not ok}


# ---------------------------------------------------------------------------
# Minimal MCP-over-stdio loop (JSON-RPC 2.0, newline-delimited)
# ---------------------------------------------------------------------------

def _result(rid, result):
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _error(rid, code, message):
    return {"jsonrpc": "2.0", "id": rid,
            "error": {"code": code, "message": message}}


def _handle(msg):
    method = msg.get("method")
    rid = msg.get("id")
    params = msg.get("params") or {}

    if method == "initialize":
        return _result(rid, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION}})
    if method in ("notifications/initialized", "notifications/cancelled"):
        return None
    if method == "ping":
        return _result(rid, {})
    if method == "tools/list":
        return _result(rid, {"tools": TOOLS})
    if method == "tools/call":
        return _result(rid, _call_tool(params.get("name"),
                                       params.get("arguments")))
    if rid is None:
        return None  # unknown notification: ignore
    return _error(rid, -32601, f"method not found: {method}")


def main():
    inp = sys.stdin
    out = sys.stdout
    for line in inp:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        try:
            resp = _handle(msg)
        except Exception as e:  # never kill the loop on a tool error
            rid = msg.get("id") if isinstance(msg, dict) else None
            resp = _error(rid, -32603, f"internal error: {e}") \
                if rid is not None else None
        if resp is not None:
            out.write(json.dumps(resp) + "\n")
            out.flush()


if __name__ == "__main__":
    main()
