#!/usr/bin/env python3
"""Paired, frozen-fixture Lighthouse comparison for the gallery release gate."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
CELLS = {
    "hub": "/examples",
    "family": "/examples/wan",
    "landscape": "/video/wan-match-cut-film",
    "portrait": "/video/3df64f8c-969b-42b0-b83d-71a680503e52",
}
METRICS = ("largest-contentful-paint", "first-contentful-paint", "cumulative-layout-shift",
           "total-blocking-time", "speed-index", "server-response-time")


def manifest():
    data = json.loads((ROOT / "manifest.json").read_text())
    for relative, key in (("fixture/public-examples.json", "snapshotSha256"),
                          ("fixture/editorial-fixture.sql", "editorialSqlSha256"),
                          ("../../neon/migrations/53_playlist_opening.sql", "migration53Sha256")):
        actual = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
        if actual != data[key]:
            raise RuntimeError(f"Frozen fixture changed: {relative}: {actual} != {data[key]}")
    snapshot = json.loads((ROOT / "fixture/public-examples.json").read_text())
    if (len(snapshot["cards"]), len(snapshot["feeds"]), len(snapshot["feeds"][""]["playlist"])) != (data["cards"], data["feeds"], data["hub"]):
        raise RuntimeError("Frozen fixture counts changed")
    return data


def command(argv, log, timeout=180):
    with log.open("w") as stream:
        process = subprocess.Popen(argv, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            raise RuntimeError(f"Timed out after {timeout}s: {argv[0]} (see {log})")
    if code:
        raise RuntimeError(f"Exit {code}: {argv[0]} (see {log})")


def server(checkout, port, log, db_url):
    env = os.environ.copy()
    env.update(DATABASE_URL=db_url, NEXT_PUBLIC_SUPABASE_URL="https://fixture.invalid",
               NEXT_PUBLIC_SUPABASE_ANON_KEY="fixture-anon-key")
    stream = log.open("w")
    process = subprocess.Popen(["node", "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", str(port)],
                               cwd=checkout / "frontend", env=env, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
    return process, stream


def ready(base, process):
    for _ in range(90):
        if process.poll() is not None:
            raise RuntimeError(f"Next exited during startup: {base}: {process.returncode}")
        try:
            with urllib.request.urlopen(base + "/examples", timeout=5) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(2)
    raise RuntimeError(f"Next did not become ready: {base}")


def source_probe(versions, output):
    snapshot = json.loads((ROOT / "fixture/public-examples.json").read_text())
    rows = []
    for variant, item in versions.items():
        for family, query in (("hub", "sort=playlist&limit=120"), ("wan", "sort=playlist&engine=wan&limit=120")):
            url = item["url"] + "/api/examples?" + query
            with urllib.request.urlopen(url, timeout=45) as response:
                data = json.load(response)
                if response.status != 200 or not data.get("ok"):
                    raise RuntimeError(f"Public API fixture probe failed: {variant} {family}: {response.status}")
            ids = [card["id"] for card in data["cards"]]
            unknown = [id for id in ids if id not in snapshot["cards"]]
            if unknown or not ids:
                raise RuntimeError(f"Public API outside fixture: {variant} {family}: {unknown}")
            expected = snapshot["feeds"]["" if family == "hub" else "wan"]["playlist"]
            row = {"variant": variant, "family": family, "url": url, "total": data["total"],
                   "returned": len(ids), "hasMore": data["hasMore"], "first24": ids[:24],
                   "expectedFirst24": expected[:24], "first24Match": ids[:24] == expected[:24]}
            rows.append(row)
            (output / "source-probe.json").write_text(json.dumps(rows, indent=2) + "\n")
            if variant == "candidate" and (data["total"] != len(expected) or not row["first24Match"]):
                raise RuntimeError(f"Candidate API did not serve expected curated fixture: {family}: {row}")


def cache_proof(path):
    events = json.loads(path.read_text())
    cached = []
    uncached = []
    for event in events:
        if event.get("method") != "Network.responseReceived":
            continue
        response = event.get("params", {}).get("response", {})
        url = response.get("url", "")
        if "/_next/image?" not in url and "/_next/static/css/" not in url:
            continue
        (cached if response.get("fromDiskCache") else uncached).append(url)
    return {"cached": len(cached), "uncached": len(uncached), "uncachedUrls": uncached}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--candidate-commit")
    args = parser.parse_args()
    fixture = manifest()
    if args.verify_only:
        print(json.dumps({"verified": True, "fixture": fixture["snapshotSha256"], "cards": fixture["cards"]}))
        return
    if not all((args.baseline, args.candidate, args.output, args.candidate_commit)):
        parser.error("--baseline, --candidate, --output and --candidate-commit are required")
    baseline = args.baseline.resolve()
    candidate = args.candidate.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    lighthouse = list((candidate / "node_modules/.pnpm").glob("lighthouse@12.6.1*/node_modules/lighthouse/cli/index.js"))
    if len(lighthouse) != 1:
        raise RuntimeError(f"Expected one pinned Lighthouse 12.6.1 CLI; found {lighthouse}")
    chrome = os.environ.get("CHROME_PATH")
    if not chrome or not Path(chrome).is_file():
        raise RuntimeError("CHROME_PATH must point to the installed CI Chrome binary")
    db_url = os.environ.get("FIXTURE_DATABASE_URL", "")
    if "127.0.0.1" not in db_url and "localhost" not in db_url:
        raise RuntimeError("Only the disposable local fixture database is allowed")
    readonly_url = db_url + ("&" if "?" in db_url else "?") + "options=-c%20default_transaction_read_only%3Don"
    versions = {"baseline": {"checkout": baseline, "url": "http://127.0.0.1:3211", "commit": fixture["baselineCommit"]},
                "candidate": {"checkout": candidate, "url": "http://127.0.0.1:3212", "commit": args.candidate_commit}}
    for item in versions.values():
        actual = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=item["checkout"], text=True).strip()
        if actual != item["commit"]:
            raise RuntimeError(f"Checkout ref mismatch: {item['checkout']}: {actual} != {item['commit']}")
        item["buildId"] = (item["checkout"] / "frontend/.next/BUILD_ID").read_text().strip()
    metadata = {"status": "incomplete", "fixture": fixture, "versions": {v: {k: str(value) for k, value in d.items()} for v, d in versions.items()},
                "chrome": chrome, "lighthouse": "12.6.1", "cells": CELLS,
                "design": "3 cold visits per version; separate persistent warm profiles, seed discarded then 2 retained; alternating version order",
                "scope": "lab navigation only; does not measure field INP or predict GSC status"}
    (output / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    servers = []
    logs = []
    rows = []
    try:
        for variant, item in versions.items():
            process, stream = server(item["checkout"], int(item["url"].rsplit(":", 1)[1]), output / f"{variant}-server.log", readonly_url)
            servers.append(process)
            logs.append(stream)
            ready(item["url"], process)
        for device in ("mobile", "desktop"):
            for name, route in CELLS.items():
                for variant, item in versions.items():
                    with urllib.request.urlopen(item["url"] + route, timeout=45) as response:
                        if response.status != 200:
                            raise RuntimeError(f"Route smoke failed: {variant} {device} {route}: {response.status}")
        source_probe(versions, output)
        command(["node", str(ROOT / "browser-check.mjs"), "prewarm", versions["baseline"]["url"], versions["candidate"]["url"], str(output / "prewarm.json")],
                output / "prewarm.log", timeout=300)
        # Catch playback regressions before the long Lighthouse matrix. This probe uses
        # throwaway browser contexts, never the persistent warm Lighthouse profiles.
        command(["node", str(ROOT / "browser-check.mjs"), "play", versions["baseline"]["url"], versions["candidate"]["url"], str(output / "first-play.json")],
                output / "first-play.log", timeout=240)
        with tempfile.TemporaryDirectory(prefix="gallery-ci-profiles-") as temp:
            for mode in ("cold", "warm"):
                for device in ("mobile", "desktop"):
                    for cell, route in CELLS.items():
                        group = []
                        for iteration in range(3):
                            order = ("baseline", "candidate") if iteration % 2 == 0 else ("candidate", "baseline")
                            for variant in order:
                                item = versions[variant]
                                stem = f"{mode}-{device}-{cell}-{variant}-{iteration}"
                                target = output / stem
                                flags = "--headless --no-sandbox"
                                if mode == "warm":
                                    profile = Path(temp) / f"{device}-{cell}-{variant}"
                                    profile.mkdir(exist_ok=True)
                                    flags += " --user-data-dir=" + str(profile)
                                argv = ["node", str(lighthouse[0]), item["url"] + route,
                                        "--config-path=" + str(ROOT / f"lighthouse-{device}.cjs"), "--output=json",
                                        "--output-path=" + str(target) + ".json", "--save-assets", "--chrome-flags=" + flags, "--quiet"]
                                if mode == "warm":
                                    argv.append("--disable-storage-reset")
                                print(json.dumps({"start": stem}), flush=True)
                                command(argv, target.with_suffix(".log"), timeout=150)
                                raw = json.loads(target.with_suffix(".json").read_text())
                                if raw.get("runtimeError") or raw.get("runWarnings"):
                                    raise RuntimeError(f"Warned/incomplete Lighthouse run: {stem}: {raw.get('runtimeError')} {raw.get('runWarnings')}")
                                audits = raw["audits"]
                                devtools = output / f"{stem}-0.devtoolslog.json"
                                if not devtools.exists():
                                    raise RuntimeError(f"Missing raw DevTools log: {devtools}")
                                cache = cache_proof(devtools) if mode == "warm" and iteration > 0 else None
                                if cache and (cache["uncached"] or cache["cached"] == 0):
                                    raise RuntimeError(f"Warm cache unverified: {stem}: {cache}")
                                row = {"mode": mode, "device": device, "cell": cell, "variant": variant, "iteration": iteration,
                                       "retained": mode == "cold" or iteration > 0, "fetchTime": raw["fetchTime"],
                                       "benchmarkIndex": raw.get("environment", {}).get("benchmarkIndex"),
                                       "lighthouseTotalMs": raw.get("timing", {}).get("total"),
                                       "metrics": {key: audits[key].get("numericValue") for key in METRICS},
                                       "score": raw["categories"]["performance"]["score"], "cache": cache,
                                       "images": [r for r in audits["network-requests"]["details"]["items"] if r.get("resourceType") == "Image"],
                                       "media": [r for r in audits["network-requests"]["details"]["items"] if r.get("resourceType") == "Media"],
                                       "raw": str(target.name) + ".json"}
                                rows.append(row)
                                group.append(row)
                                (output / "runs.json").write_text(json.dumps(rows, indent=2) + "\n")
                                trace = output / f"{stem}-0.trace.json"
                                if trace.exists() and iteration < 2:
                                    trace.unlink()  # Keep the last paired trace per group plus every LHR/DevTools log.
                                print(json.dumps({"done": stem, "lcp": row["metrics"]["largest-contentful-paint"], "score": row["score"]}), flush=True)
                        indices = [r["benchmarkIndex"] for r in group if isinstance(r["benchmarkIndex"], (int, float))]
                        if len(indices) != 6 or min(indices) <= 0 or max(indices) / min(indices) > 1.2:
                            raise RuntimeError(f"Host CPU drift over 20% in {mode} {device} {cell}: {indices}")
        summary = []
        for mode in ("cold", "warm"):
            for device in ("mobile", "desktop"):
                for cell in CELLS:
                    pair = {"mode": mode, "device": device, "cell": cell}
                    for variant in versions:
                        selected = [r for r in rows if r["mode"] == mode and r["device"] == device and r["cell"] == cell and r["variant"] == variant and r["retained"]]
                        pair[variant] = {"n": len(selected), "scoreMedian": statistics.median(r["score"] for r in selected),
                                         "metricsMedian": {key: statistics.median(r["metrics"][key] for r in selected) for key in METRICS}}
                    pair["lcpDeltaMs"] = pair["candidate"]["metricsMedian"]["largest-contentful-paint"] - pair["baseline"]["metricsMedian"]["largest-contentful-paint"]
                    summary.append(pair)
        (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        metadata["status"] = "complete"
    except Exception as error:
        metadata["error"] = str(error)
        raise
    finally:
        (output / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
        for process in servers:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
        for process in servers:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
        for stream in logs:
            stream.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
