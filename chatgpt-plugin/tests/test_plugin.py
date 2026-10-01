#!/usr/bin/env python3
"""DealHound ChatGPT-plugin package tests.

1. plugin.json parses and matches the researched schema (tools, annotations,
   positioning, example prompts; no commerce-banned language in
   user-facing copy).
2. MCP server over stdio: handshake, full tool matrix (valid + invalid +
   edge inputs), free-tier gating, offline license sign-in, fixture scans,
   affiliate-disabled URLs, cold start, MCP-event simulation.
3. Existing engine suite still passes (regression).

Run:  python3 tests/test_plugin.py   (from chatgpt-plugin/)
"""
import json
import os
import secrets
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import (  # noqa: E402
    ClientTestBase, MCPClient, DEALHOUND_ROOT, PEGASUS, ULTRABOOST)

sys.path.insert(0, DEALHOUND_ROOT)
from dealhound import ed25519  # noqa: E402

PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Tokens that must never leak into ANY package surface: the actual price
# and payment link. (Deal prices like "$97" in scan output are the product
# working and are fine.)
HARD_BANNED_TOKENS = ["$4.99", "buy.stripe.com",
                      "REPLACE_WITH_YOUR_PAYMENT_LINK"]

# Upsell-pitch language: banned from USER-FACING copy (manifest user fields,
# tool descriptions, tool outputs). Allowed inside the compliance
# documentation itself, which must discuss the policy to enforce it.
PITCH_TOKENS = ["upgrade", "checkout"]

REQUIRED_MANIFEST_KEYS = ["manifest_version", "name", "display_name",
                          "description", "version", "publisher", "skills",
                          "mcp", "tools", "commerce_compliance",
                          "submission_blockers", "example_prompts",
                          "positioning"]
REQUIRED_ANNOTATIONS = ["readOnlyHint", "destructiveHint", "openWorldHint"]


# ---------------------------------------------------------------------------
# Manifest / skill validation
# ---------------------------------------------------------------------------

class ManifestTests(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(PLUGIN_DIR, "plugin.json")) as f:
            self.manifest = json.load(f)
        with open(os.path.join(PLUGIN_DIR, "skills", "dealhound", "SKILL.md")) as f:
            self.skill = f.read()

    def test_manifest_parses_and_has_required_keys(self):
        for key in REQUIRED_MANIFEST_KEYS:
            self.assertIn(key, self.manifest, f"plugin.json missing {key}")

    def test_tools_have_annotations(self):
        tools = self.manifest["tools"]
        self.assertGreaterEqual(len(tools), 8)
        for t in tools:
            self.assertIn("name", t)
            self.assertIn("description", t)
            for a in REQUIRED_ANNOTATIONS:
                self.assertIn(a, t["annotations"],
                              f"tool {t['name']} missing annotation {a}")

    def test_expected_tool_names(self):
        names = {t["name"] for t in self.manifest["tools"]}
        for expected in ("watchlist_add", "watchlist_remove", "watchlist_list",
                         "deal_scan", "account_signin", "account_signout",
                         "account_status", "alert_prefs"):
            self.assertIn(expected, names)

    def test_no_commerce_banned_language_in_user_facing_copy(self):
        user_facing = (self.manifest["display_name"] + " " +
                       self.manifest["description"] + " " +
                       self.manifest["positioning"]["tagline"] + " " +
                       " ".join(self.manifest["example_prompts"]) + " " +
                       " ".join(t["name"] + " " + t["description"]
                                 for t in self.manifest["tools"]))
        for tok in HARD_BANNED_TOKENS + PITCH_TOKENS:
            self.assertNotIn(tok, user_facing.lower(),
                             f"banned token {tok!r} in user-facing manifest copy")
        blob = json.dumps(self.manifest) + self.skill
        for tok in HARD_BANNED_TOKENS:
            self.assertNotIn(tok, blob, f"price/payment leak {tok!r} in package")

    def test_affiliate_disabled_by_default_in_manifest(self):
        rules = " ".join(self.manifest["commerce_compliance"]["rules_enforced"])
        self.assertIn("DISABLED", rules)

    def test_example_prompts_look_like_discovery_triggers(self):
        prompts = self.manifest["example_prompts"]
        self.assertGreaterEqual(len(prompts), 5)
        joined = " ".join(prompts).lower()
        # discovery triggers: deal intent + watch/alert verbs
        self.assertTrue(any(w in joined for w in
                            ["deal", "price drop", "sale"]))
        self.assertTrue(any(w in joined for w in
                            ["watch", "alert", "tell me when", "track"]))

    def test_positioning_is_always_on(self):
        pos = self.manifest["positioning"]
        self.assertIn("always-on", pos["tagline"].lower() +
                      pos["differentiator"].lower())


# ---------------------------------------------------------------------------
# Server tests
# ---------------------------------------------------------------------------

class HandshakeTests(unittest.TestCase, ClientTestBase):
    def test_tools_list(self):
        c = self._client()
        res = c.request("tools/list")["result"]["tools"]
        self.assertEqual(len(res), 8)
        for t in res:
            for a in REQUIRED_ANNOTATIONS:
                self.assertIn(a, t["annotations"])

    def test_unknown_tool_errors_cleanly(self):
        c = self._client()
        err, text = self.call(c, "no_such_tool")
        self.assertTrue(err)
        self.assertIn("unknown tool", text)

    def test_unknown_method_errors_cleanly(self):
        c = self._client()
        res = c.request("nope/method")
        self.assertEqual(res["error"]["code"], -32601)


class WatchlistTests(unittest.TestCase, ClientTestBase):
    def test_add_list_remove(self):
        c = self._client()
        err, _ = self.call(c, "watchlist_add",
                           {"term_type": "brand", "value": "Nike"})
        self.assertFalse(err)
        err, text = self.call(c, "watchlist_list")
        wl = json.loads(text)
        self.assertIn("Nike", wl["user_brands"])
        self.assertEqual(wl["total_terms"], 1)
        err, _ = self.call(c, "watchlist_remove",
                           {"term_type": "brand", "value": "nike"})
        self.assertFalse(err)
        err, text = self.call(c, "watchlist_list")
        self.assertNotIn("Nike", json.loads(text)["user_brands"])

    def test_add_is_idempotent_on_duplicates(self):
        c = self._client()
        err, text = self.call(c, "watchlist_add",
                              {"term_type": "keyword", "value": "creatine"})
        self.assertFalse(err)
        self.assertIn("added", text)
        err, text = self.call(c, "watchlist_add",
                              {"term_type": "keyword", "value": "Creatine"})
        self.assertFalse(err)
        self.assertIn("already watching", text)
        err, text = self.call(c, "watchlist_list")
        self.assertEqual(json.loads(text)["total_terms"], 1)

    def test_add_rejects_bad_inputs(self):
        c = self._client()
        for args in ({"term_type": "color", "value": "red"},
                     {"term_type": "brand", "value": "  "},
                     {"term_type": "brand"}):
            err, _ = self.call(c, "watchlist_add", args)
            self.assertTrue(err, f"should reject {args}")

    def test_remove_missing_term(self):
        c = self._client()
        err, text = self.call(c, "watchlist_remove",
                              {"term_type": "brand", "value": "nosuchbrand"})
        self.assertTrue(err)
        self.assertIn("not on the watchlist", text)

    def test_free_tier_cap_blocks_sixth_term_neutrally(self):
        c = self._client()
        for i in range(5):
            err, _ = self.call(c, "watchlist_add",
                               {"term_type": "keyword", "value": f"term{i}"})
            self.assertFalse(err, f"add {i} should succeed on free tier")
        err, text = self.call(c, "watchlist_add",
                              {"term_type": "keyword", "value": "term5"})
        self.assertTrue(err, "6th term must be blocked on free tier")
        self.assertIn("5 of 5", text)
        for tok in HARD_BANNED_TOKENS + PITCH_TOKENS:
            self.assertNotIn(tok, text.lower(),
                             f"cap message must stay neutral, found {tok!r}")


class AccountTests(unittest.TestCase, ClientTestBase):
    def test_signin_rejects_bad_and_empty_keys(self):
        c = self._client()
        for key in ("dh1_bogus.key", "", "   ", "notakey"):
            err, text = self.call(c, "account_signin", {"license_key": key})
            self.assertTrue(err, f"should reject {key!r}")

    def test_signin_honors_valid_pro_key_then_signout(self):
        priv = secrets.token_bytes(32)
        pub = ed25519.publickey(priv)
        c = self._client({"DEALHOUND_PLUGIN_TEST_PUBKEY": pub.hex()})
        from dealhound import license as lic
        key = lic.issue_license_key("buyer@example.com", priv, tier="pro")
        err, text = self.call(c, "account_signin", {"license_key": key})
        self.assertFalse(err, text)
        self.assertIn("pro", text)
        err, text = self.call(c, "account_status")
        status = json.loads(text)
        self.assertEqual(status["tier"], "pro")
        self.assertTrue(status["signed_in"])
        self.assertIsNone(status["watchlist_cap"])  # unlimited
        for i in range(7):
            err, _ = self.call(c, "watchlist_add",
                               {"term_type": "keyword", "value": f"p{i}"})
            self.assertFalse(err, f"pro add {i} should succeed")
        err, _ = self.call(c, "account_signout")
        self.assertFalse(err)
        err, text = self.call(c, "account_status")
        status = json.loads(text)
        self.assertEqual(status["tier"], "free")
        self.assertFalse(status["signed_in"])

    def test_status_has_no_commerce_language(self):
        c = self._client()
        err, text = self.call(c, "account_status")
        self.assertFalse(err)
        for tok in HARD_BANNED_TOKENS + PITCH_TOKENS:
            self.assertNotIn(tok, text.lower())


class ScanTests(unittest.TestCase, ClientTestBase):
    def test_scan_fixture_match_and_raw_url(self):
        c = self._client()
        self.set_deals([PEGASUS])
        err, _ = self.call(c, "watchlist_add",
                           {"term_type": "brand", "value": "nike"})
        self.assertFalse(err)
        err, text = self.call(c, "deal_scan", {"limit": 5})
        self.assertFalse(err, text)
        res = json.loads(text)
        self.assertFalse(res["affiliate_monetized"],
                         "affiliate must be disabled by default")
        self.assertEqual(len(res["matches"]), 1)
        m = res["matches"][0]
        self.assertIn("Pegasus", m["title"])
        self.assertEqual(m["price"], 97.0)
        self.assertEqual(m["url"], "https://example.com/pegasus41")
        self.assertGreaterEqual(m["score"], 0.3)
        self.assertTrue(m["reasons"])

    def test_scan_empty_watchlist(self):
        c = self._client()
        self.set_deals([PEGASUS])
        err, text = self.call(c, "deal_scan")
        self.assertFalse(err)
        self.assertIn("watchlist is empty", json.loads(text)["note"])

    def test_scan_limit_edge_values(self):
        # limit=0 and limit=-3 both behave as limit=1 (server clamps).
        # A fresh client per limit so the 24h dedupe doesn't suppress the
        # second scan's match.
        for limit in (0, -3):
            c = self._client()
            self.set_deals([PEGASUS])
            self.call(c, "watchlist_add",
                      {"term_type": "brand", "value": "nike"})
            err, text = self.call(c, "deal_scan", {"limit": limit})
            self.assertFalse(err)
            self.assertEqual(len(json.loads(text)["matches"]), 1)


class EventSimulationTests(unittest.TestCase, ClientTestBase):
    """Simulate the MCP-Events path end-to-end: event -> scan -> only the
    NEW deal surfaces (24h dedupe), with raw URLs."""

    def test_event_scan_surfaces_only_new_deals(self):
        c = self._client()
        self.set_deals([PEGASUS])
        self.call(c, "watchlist_add",
                  {"term_type": "brand", "value": "nike"})
        # also watch adidas so the second deal matches
        self.call(c, "watchlist_add",
                  {"term_type": "brand", "value": "adidas"})
        err, text = self.call(c, "deal_scan")
        first = json.loads(text)["matches"]
        self.assertEqual(len(first), 1)
        # "event": a new deal appears at the source
        self.set_deals([PEGASUS, ULTRABOOST])
        err, text = self.call(c, "deal_scan")
        second = json.loads(text)["matches"]
        self.assertEqual(len(second), 1, "dedupe must suppress the old deal")
        self.assertIn("Ultraboost", second[0]["title"])
        self.assertEqual(second[0]["url"], "https://example.com/ultraboost")
        self.assertFalse(second[0]["affiliate_monetized"])


class ColdStartTests(unittest.TestCase, ClientTestBase):
    def test_fresh_config_dir_behaves(self):
        c = self._client()
        err, text = self.call(c, "watchlist_list")
        self.assertFalse(err)
        self.assertEqual(json.loads(text)["total_terms"], 0)
        err, text = self.call(c, "account_status")
        status = json.loads(text)
        self.assertEqual(status["tier"], "free")
        self.assertFalse(status["signed_in"])
        self.assertEqual(status["watchlist_cap"], 5)


class AlertPrefsTests(unittest.TestCase, ClientTestBase):
    def test_get_and_set(self):
        c = self._client()
        err, text = self.call(c, "alert_prefs")
        prefs = json.loads(text)
        self.assertIsNone(prefs["min_discount_pct"])
        err, text = self.call(c, "alert_prefs",
                              {"min_discount_pct": 25, "max_price": 150})
        prefs = json.loads(text)
        self.assertEqual(prefs["min_discount_pct"], 25)
        self.assertEqual(prefs["max_price"], 150)
        self.assertEqual(prefs["updated"], ["min_discount_pct", "max_price"])
        # set is idempotent
        err, text = self.call(c, "alert_prefs", {"min_discount_pct": 25})
        self.assertFalse(err)


class CommerceSweepTests(unittest.TestCase, ClientTestBase):
    def test_no_banned_language_in_any_tool_output(self):
        c = self._client()
        self.set_deals([PEGASUS])
        self.call(c, "watchlist_add", {"term_type": "brand", "value": "Nike"})
        self.call(c, "watchlist_list")
        self.call(c, "deal_scan", {"limit": 3})
        self.call(c, "account_status")
        self.call(c, "alert_prefs")
        self.call(c, "account_signin", {"license_key": "dh1_bogus.key"})
        for text in self._texts:
            for tok in HARD_BANNED_TOKENS:
                self.assertNotIn(tok, text)
            for tok in PITCH_TOKENS:
                self.assertNotIn(tok, text.lower())


# ---------------------------------------------------------------------------
# Engine regression: the existing 82-test suite must still pass
# ---------------------------------------------------------------------------

class EngineRegressionTests(unittest.TestCase):
    def test_existing_engine_suite_passes(self):
        r = subprocess.run(
            [sys.executable, "-m", "unittest", "discover", "-s", "tests",
             "-t", "."],
            cwd=DEALHOUND_ROOT, capture_output=True, text=True, timeout=300)
        self.assertEqual(r.returncode, 0,
                         f"engine suite failed:\n{r.stdout}\n{r.stderr}")
        self.assertIn("OK", r.stderr + r.stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
