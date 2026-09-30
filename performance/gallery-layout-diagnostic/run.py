#!/usr/bin/env python3
"""CI-only causal layout diagnostic against a disposable fixture."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
from urllib.parse import urlparse

if os.environ.get('CI') not in ('1', 'true'):
    raise RuntimeError('Gallery layout diagnostic is CI-only')
root = Path(__file__).resolve().parents[2]
output = Path(sys.argv[1]).resolve()
db = os.environ.get('FIXTURE_DATABASE_URL', '')
if urlparse(db).hostname != '127.0.0.1':
    raise RuntimeError('Diagnostic requires the disposable loopback database')
spec = importlib.util.spec_from_file_location('gallery_final', root / 'performance/gallery-final/run.py')
support = importlib.util.module_from_spec(spec)
spec.loader.exec_module(support)
fixture = support.manifest()
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
subprocess.run(['git', 'diff', '--quiet', fixture['candidateApplicationCommit'], 'HEAD', '--',
                'frontend', 'neon/migrations', 'scripts', 'package.json', 'pnpm-lock.yaml'], cwd=root, check=True)
output.mkdir(parents=True, exist_ok=True)
metadata = {'status': 'incomplete', 'candidateCommit': commit, 'applicationCommit': fixture['candidateApplicationCommit'],
            'fixture': fixture, 'buildId': (root / 'frontend/.next/BUILD_ID').read_text().strip(),
            'design': 'desktop 1350x940 DPR1 CPU4; separate normal/reduced-motion profiles; seed excluded then six warm visits per cohort, alternating order',
            'scope': 'causal instrumentation only; no Lighthouse equivalence, release score, field INP or ranking prediction'}
(output / 'metadata.json').write_text(json.dumps(metadata, indent=2))
readonly = db + ('&' if '?' in db else '?') + 'options=-c%20default_transaction_read_only%3Don'
process, stream = support.server(root, 3212, output / 'server.log', readonly)
try:
    support.ready('http://127.0.0.1:3212', process)
    support.command(['node', str(root / 'performance/gallery-layout-diagnostic/browser-check.mjs'),
                     'http://127.0.0.1:3212', str(output)], output / 'browser.log', timeout=480)
    metadata['status'] = 'complete'
finally:
    os.killpg(process.pid, signal.SIGTERM)
    process.wait(timeout=10)
    stream.close()
    (output / 'metadata.json').write_text(json.dumps(metadata, indent=2))
