"""Shared test helpers: stdio MCP client + fixture-adapter writer."""
import json
import os
import subprocess
import sys
import tempfile

PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(PLUGIN_DIR, "server.py")
DEALHOUND_ROOT = os.path.dirname(PLUGIN_DIR)

STUB_ADAPTER_SRC = '''
import json, os
from dealhound.adapter import DealAdapter, Deal, CheckMode

class FixtureAdapter(DealAdapter):
    name = "fixture"
    description = "test fixture adapter (reads deals from a JSON file)"
    def search(self, query_terms, mode=CheckMode.DEAL):
        path = os.environ.get("DEALHOUND_PLUGIN_TEST_DEALS")
        if not path or not os.path.exists(path):
            return []
        with open(path) as f:
            raw = json.load(f)
        return [Deal(**d) for d in raw]
'''

PEGASUS = {
    "title": "Nike Pegasus 41 running shoes $97 (was $140)",
    "price": 97.0, "original_price": 140.0, "discount_pct": 31.0,
    "merchant": "TestMart", "url": "https://example.com/pegasus41",
    "source": "fixture",
}
ULTRABOOST = {
    "title": "Adidas Ultraboost Light $110 (was $190) 42% off",
    "price": 110.0, "original_price": 190.0, "discount_pct": 42.0,
    "merchant": "TestMart", "url": "https://example.com/ultraboost",
    "source": "fixture",
}


class MCPClient:
    """Minimal newline-delimited JSON-RPC client for the stdio server."""

    def __init__(self, extra_env=None):
        env = dict(os.environ)
        env["PYTHONPATH"] = DEALHOUND_ROOT + os.pathsep + \
            env.get("PYTHONPATH", "")
        if extra_env:
            env.update(extra_env)
        self.p = subprocess.Popen(
            [sys.executable, SERVER], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, bufsize=1, env=env)
        self._id = 0
        init = self.request("initialize", {
            "protocolVersion": "2024-11-05", "capabilities": {},
            "clientInfo": {"name": "qa", "version": "0"}})
        assert init["result"]["serverInfo"]["name"] == "dealhound-mcp"
        self.notify("notifications/initialized")

    def request(self, method, params=None):
        self._id += 1
        msg = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            msg["params"] = params
        self.p.stdin.write(json.dumps(msg) + "\n")
        self.p.stdin.flush()
        while True:
            line = self.p.stdout.readline()
            if not line:
                raise RuntimeError("server closed stdout: " +
                                   self.p.stderr.read())
            resp = json.loads(line)
            if resp.get("id") == self._id:
                return resp

    def notify(self, method, params=None):
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        self.p.stdin.write(json.dumps(msg) + "\n")
        self.p.stdin.flush()

    def call(self, name, args=None):
        res = self.request("tools/call",
                           {"name": name, "arguments": args or {}})["result"]
        texts = [c["text"] for c in res.get("content", [])
                 if c.get("type") == "text"]
        return res.get("isError", False), "\n".join(texts)

    def close(self):
        try:
            self.p.stdin.close()
        except Exception:
            pass
        self.p.wait(timeout=10)


class ClientTestBase:
    """Mixin: isolated client with temp config dir + fixture adapter."""

    def _client(self, extra_env=None):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        fixdir = tempfile.TemporaryDirectory()
        self.addCleanup(fixdir.cleanup)
        with open(os.path.join(fixdir.name, "stub_adapter.py"), "w") as f:
            f.write(STUB_ADAPTER_SRC)
        deals_file = os.path.join(fixdir.name, "deals.json")
        with open(deals_file, "w") as f:
            json.dump([], f)
        env = {"XDG_CONFIG_HOME": tmp.name,
               "PYTHONPATH": fixdir.name,
               "DEALHOUND_PLUGIN_TEST_ADAPTER": "stub_adapter:FixtureAdapter",
               "DEALHOUND_PLUGIN_TEST_DEALS": deals_file}
        if extra_env:
            env.update(extra_env)
        c = MCPClient(extra_env=env)
        self.addCleanup(c.close)
        self._deals_file = deals_file
        self._texts = []
        return c

    def set_deals(self, deals):
        with open(self._deals_file, "w") as f:
            json.dump(deals, f)

    def call(self, client, name, args=None):
        is_err, text = client.call(name, args)
        self._texts.append(text)
        return is_err, text
