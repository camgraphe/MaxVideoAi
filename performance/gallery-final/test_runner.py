"""Offline checks for the measurement guard, without starting an app or browser."""

from contextlib import contextmanager
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import run


class SourceProbeTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = json.loads((run.ROOT / "fixture/public-examples.json").read_text())
        self.versions = {variant: {"url": f"http://{variant}.invalid"} for variant in ("baseline", "candidate")}

    @contextmanager
    def response(self, url, *, corrupt=None, total_delta=0):
        family = "wan" if "engine=wan" in url else ""
        expected = self.snapshot["feeds"][family]["playlist"]
        ids = expected[:120]
        if corrupt and "baseline.invalid" in url and not family:
            ids = corrupt(ids)
        total = len(expected) + (total_delta if "baseline.invalid" in url and not family else 0)
        result = io.BytesIO(json.dumps({"ok": True, "cards": [{"id": id} for id in ids],
                                       "total": total, "hasMore": len(ids) < len(expected)}).encode())
        result.status = 200
        try:
            yield result
        finally:
            result.close()

    def probe(self, response):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with patch.object(run.urllib.request, "urlopen", side_effect=lambda url, **kwargs: response(url)):
                run.source_probe(self.versions, output)
            return json.loads((output / "source-probe.json").read_text())

    def test_both_versions_serve_the_frozen_selection(self):
        rows = self.probe(self.response)
        self.assertEqual(len(rows), 4)
        self.assertTrue(all(row["first24Match"] for row in rows))

    def test_wrong_baseline_order_invalidates_the_comparison(self):
        with self.assertRaises(RuntimeError):
            self.probe(lambda url: self.response(url, corrupt=lambda ids: list(reversed(ids))))

    def test_baseline_missing_visible_card_invalidates_the_comparison(self):
        with self.assertRaises(RuntimeError):
            self.probe(lambda url: self.response(url, corrupt=lambda ids: ids[1:]))

    def test_wrong_baseline_total_invalidates_the_comparison(self):
        with self.assertRaises(RuntimeError):
            self.probe(lambda url: self.response(url, total_delta=-1))


if __name__ == "__main__":
    unittest.main()
