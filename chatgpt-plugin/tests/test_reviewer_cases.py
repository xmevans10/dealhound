#!/usr/bin/env python3
"""Reviewer test cases for the DealHound ChatGPT plugin — executed as QA.

Mirrors the submission requirement (5+ positive, 3+ negative reviewer
test cases). Each case is written the way a directory reviewer would run
it: no special credentials, no MFA, no private network — the plugin must
work out of the box on the free tier.

Run:  python3 tests/test_reviewer_cases.py   (from chatgpt-plugin/)
"""
import json
import os
import secrets
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import (  # noqa: E402
    ClientTestBase, DEALHOUND_ROOT, PEGASUS, ULTRABOOST)

sys.path.insert(0, DEALHOUND_ROOT)
from dealhound import ed25519  # noqa: E402


class ReviewerPositiveCases(unittest.TestCase, ClientTestBase):
    """RP1..RP5 — the plugin does what the listing promises."""

    def test_RP1_add_brand_to_watchlist(self):
        """Reviewer adds a brand; it appears in the watchlist."""
        c = self._client()
        err, text = self.call(c, "watchlist_add",
                              {"term_type": "brand", "value": "Nike"})
        self.assertFalse(err, text)
        err, text = self.call(c, "watchlist_list")
        self.assertIn("Nike", json.loads(text)["user_brands"])

    def test_RP2_scan_returns_matching_deal(self):
        """Reviewer scans and gets a matching deal with price, discount,
        merchant, reasons, and a working link."""
        c = self._client()
        self.set_deals([PEGASUS])
        self.call(c, "watchlist_add",
                  {"term_type": "brand", "value": "nike"})
        err, text = self.call(c, "deal_scan")
        self.assertFalse(err, text)
        m = json.loads(text)["matches"][0]
        for field in ("title", "price", "discount_pct", "merchant",
                      "url", "reasons", "score"):
            self.assertIn(field, m)
        self.assertTrue(m["url"].startswith("https://"))

    def test_RP3_signin_with_valid_pro_key_unlocks(self):
        """Reviewer signs in with a valid Pro key (generated with a
        throwaway keypair + test pubkey override) and gets unlimited terms."""
        priv = secrets.token_bytes(32)
        pub = ed25519.publickey(priv)
        c = self._client({"DEALHOUND_PLUGIN_TEST_PUBKEY": pub.hex()})
        from dealhound import license as lic
        key = lic.issue_license_key("reviewer@example.com", priv, tier="pro")
        err, text = self.call(c, "account_signin", {"license_key": key})
        self.assertFalse(err, text)
        for i in range(6):
            err, _ = self.call(c, "watchlist_add",
                               {"term_type": "keyword", "value": f"rk{i}"})
            self.assertFalse(err)

    def test_RP4_alert_prefs_round_trip(self):
        """Reviewer sets alert filters; they persist and are returned."""
        c = self._client()
        err, text = self.call(c, "alert_prefs",
                              {"min_discount_pct": 30, "max_price": 200,
                               "max_age_days": 7})
        prefs = json.loads(text)
        self.assertEqual((prefs["min_discount_pct"], prefs["max_price"],
                          prefs["max_age_days"]), (30, 200, 7))

    def test_RP5_remove_term_stops_matching(self):
        """Reviewer removes a term; subsequent scans no longer match it."""
        c = self._client()
        self.set_deals([PEGASUS])
        self.call(c, "watchlist_add",
                  {"term_type": "brand", "value": "nike"})
        err, text = self.call(c, "deal_scan")
        self.assertEqual(len(json.loads(text)["matches"]), 1)
        self.call(c, "watchlist_remove",
                  {"term_type": "brand", "value": "nike"})
        err, text = self.call(c, "deal_scan")
        res = json.loads(text)
        self.assertEqual(res["matches"], [])
        self.assertIn("watchlist is empty", res["note"])


class ReviewerNegativeCases(unittest.TestCase, ClientTestBase):
    """RN1..RN3 — the plugin fails gracefully, never misleadingly."""

    def test_RN1_sixth_term_blocked_neutrally(self):
        """Reviewer fills the free watchlist; the 6th add is refused with
        a neutral message — no price, no payment link, no upsell."""
        c = self._client()
        for i in range(5):
            err, _ = self.call(c, "watchlist_add",
                               {"term_type": "keyword", "value": f"n{i}"})
            self.assertFalse(err)
        err, text = self.call(c, "watchlist_add",
                              {"term_type": "keyword", "value": "n5"})
        self.assertTrue(err)
        lowered = text.lower()
        for tok in ("$4.99", "buy.stripe.com", "upgrade", "checkout",
                    "payment link"):
            self.assertNotIn(tok, lowered)

    def test_RN2_invalid_license_key_rejected(self):
        """Reviewer signs in with a garbage key; clear rejection, no crash,
        account stays on free tier."""
        c = self._client()
        err, text = self.call(c, "account_signin",
                              {"license_key": "dh1_forged.payload"})
        self.assertTrue(err)
        self.assertIn("didn't check out", text)
        err, text = self.call(c, "account_status")
        self.assertEqual(json.loads(text)["tier"], "free")

    def test_RN3_empty_watchlist_scan_guides_user(self):
        """Reviewer scans with nothing watched; graceful guidance instead
        of an error or an empty spam response."""
        c = self._client()
        self.set_deals([PEGASUS, ULTRABOOST])
        err, text = self.call(c, "deal_scan")
        self.assertFalse(err)
        res = json.loads(text)
        self.assertEqual(res["matches"], [])
        self.assertIn("add a brand", res["note"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
