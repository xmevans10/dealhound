import importlib.util
import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from pathlib import Path

spec = importlib.util.spec_from_file_location('server', Path(__file__).parents[1] / 'server.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

class BetaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        s.DB = self.tmp.name + '/state.sqlite3'
    def tearDown(self):
        self.tmp.cleanup()
    def test_persistence_and_user_isolation(self):
        args = {'term_type': 'brand', 'value': 'Nike'}
        s.execute('watchlist_add', args, 'a')
        s.execute('watchlist_add', args, 'a')
        self.assertEqual(len(s.execute('watchlist_list', {}, 'a')['items']), 1)
        self.assertEqual(s.execute('watchlist_list', {}, 'b')['items'], [])
        s.execute('watchlist_remove', args, 'a')
        self.assertEqual(s.execute('watchlist_list', {}, 'a')['items'], [])
    def test_scan_query_works_without_watchlist_and_does_not_hide_results(self):
        with patch.object(s, 'feed', return_value=[{'title': 'Nike shoes', 'url': 'https://example.com'}]):
            for _ in range(2):
                self.assertEqual(len(s.execute('deal_scan', {'query': 'nike'}, 'a')['matches']), 1)
    def test_source_failure_is_distinct_from_no_matches(self):
        with patch.object(s, 'feed', side_effect=TimeoutError):
            self.assertFalse(s.execute('deal_scan', {'query': 'nike'}, 'a')['complete'])
    def test_invalid_inputs(self):
        for args in [{'limit': -1}, {'limit': True}, {'query': ' '}, {'source': 'unknown'}, {'limit': 1000}]:
            with self.assertRaises(ValueError):
                s.execute('deal_scan', args, 'a')
    def test_preferences_isolated(self):
        s.execute('alert_prefs', {'max_price': 100}, 'a')
        self.assertEqual(s.execute('alert_prefs', {}, 'b')['preferences'], {})
    def test_handshake_and_notifications(self):
        result = s.handle({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-03-26'}})
        self.assertEqual(result['result']['protocolVersion'], '2025-03-26')
        self.assertIsNone(s.handle({'jsonrpc': '2.0', 'method': 'notifications/initialized'}))
    def test_http_auth_and_transport(self):
        with patch.dict(os.environ, {'DEALHOUND_TOKENS': json.dumps({'secret-a': 'a', 'secret-b': 'b'})}):
            server = ThreadingHTTPServer(('127.0.0.1', 0), s.HTTP)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            url = 'http://127.0.0.1:%s/mcp' % server.server_port
            body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list'}).encode()
            try:
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(urllib.request.Request(url, body))
                self.assertEqual(error.exception.code, 401)
                req = urllib.request.Request(url, body, {'Authorization': 'Bearer secret-a', 'Content-Type': 'application/json'})
                with urllib.request.urlopen(req) as res:
                    self.assertEqual(len(json.load(res)['result']['tools']), 6)
            finally:
                server.shutdown()
                server.server_close()

if __name__ == '__main__':
    unittest.main()
