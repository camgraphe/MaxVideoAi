"""Early functional fixture check; final measurements still use production builds."""
import json
import os
from pathlib import Path
import signal
import sys
import run

baseline, candidate, output = map(lambda value: Path(value).resolve(), sys.argv[1:])
projection = json.loads((output / 'api-projections.json').read_text())
db_url = os.environ['DATABASE_URL']
if '127.0.0.1' not in db_url or 'default_transaction_read_only' not in db_url:
    raise RuntimeError('Preflight requires the disposable read-only database')
versions = {}
servers = []
try:
    for variant, checkout, port in (('baseline', baseline, 3211), ('candidate', candidate, 3212)):
        process, stream = run.server(checkout, port, output / f'{variant}-preflight-server.log', db_url, mode='dev')
        servers.append((process, stream))
        versions[variant] = {'url': f'http://127.0.0.1:{port}'}
        run.ready(versions[variant]['url'], process)
    run.source_probe(versions, output, projection['versions'])
    run.command(['node', str(run.ROOT / 'browser-check.mjs'), 'play', versions['baseline']['url'],
                 versions['candidate']['url'], str(output / 'preflight-play.json')], output / 'preflight-play.log', timeout=300)
finally:
    for process, stream in servers:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except Exception:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
        stream.close()
