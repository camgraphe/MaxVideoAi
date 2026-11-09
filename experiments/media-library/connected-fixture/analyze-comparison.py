"""Offline, allowlisted projection of root IAB observations; never contacts a runtime."""
import argparse
import hashlib
import json
import statistics
from collections import Counter, defaultdict
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('input', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
raw = args.input.read_bytes()
records = json.loads(raw)
valid = [r for r in records if not r.get('excludedFromPairedAggregate')]
excluded = [r for r in records if r.get('excludedFromPairedAggregate')]
assert len(records) == 250 and len(valid) == 240 and len(excluded) == 10
passes = defaultdict(list)
groups = defaultdict(list)
exact_image = []
functional = Counter()
for r in valid:
    identity = (r['variant'], r['viewport'], r['cacheCondition'], r['round'])
    passes[identity].append(r['operation'])
    groups[identity[:3] + (r['operation'],)].append(r)
    assert not r['network']['truncated']
    assert not r['observation'].get('timeout') and not r.get('timeout')
    observation = r['observation']
    if r['operation'] in ('image-close', 'video-close'):
        assert observation['dialogs'] == 0 and not observation['readers']
        functional['closesWithoutReaders'] += 1
    if r['operation'] == 'exact097-first-Play':
        readers = observation['readers']
        assert len(readers) == 1
        video = readers[0]
        assert (video['width'], video['height'], video['duration']) == (960, 540, 5)
        assert video['error'] is None and not video['paused'] and video['currentTime'] > 0
        functional['videoPlays'] += 1
    if r['operation'] == 'exact097-save':
        assert r['savedFeedback']
        assert r['saveRequests'] == [{'jobId': 'fixture-job-0', 'outputId': 'fixture-097'}]
        functional['exactOutputSaves'] += 1
    if r['operation'] == 'exact012-image-click':
        images = [i for i in observation['images'] if i['role'] == 'viewer']
        assert len(images) == 1 and images[0]['complete']
        assert (images[0]['naturalWidth'], images[0]['naturalHeight']) == (1024, 1536)
        functional['exactImageDecodes'] += 1
        requests = [q for q in r['network']['requests'] if 'fixture-012' in q['path'] and q['role'] in ('original', 'display')]
        assert len(requests) == 1
        q = requests[0]
        assert q['transport'] == 'private-S3-HTTP' and q['status'] == 200 and q['completed']
        expected = 2280434 if r['variant'] == 'baseline' else 91534
        assert q['declaredContentLength'] == expected
        if r['cacheCondition'] == 'cold-disabled':
            assert not q.get('fromDiskCache') and not q.get('fromServiceWorker') and not q.get('servedFromCache')
            assert q['decodedDataBytes'] == expected
        exact_image.append(dict(zip(('variant', 'viewport', 'cacheCondition', 'round'), identity)) | {
            'role': q['role'], 'resourceSha256': q['sourceSha256'], 'declaredBodyBytes': expected,
            'decodedDataBytes': q['decodedDataBytes'], 'browserEncodedDataLength': q['browserEncodedDataLength'],
            'fromDiskCache': q.get('fromDiskCache', False), 'fromServiceWorker': q.get('fromServiceWorker', False),
            'servedFromCache': q.get('servedFromCache', False), 'completed': True,
            'cdpStartToFinishMs': round((q['finish'] - q['start']) * 1000, 3),
            'cdpStartToResponseEventMs': round((q['responseAt'] - q['start']) * 1000, 3),
            'observedGeometry': [1024, 1536]})
assert len(passes) == 24 and all(len(v) == 10 and len(set(v)) == 10 for v in passes.values())
assert all(len(v) == 3 for v in groups.values())

def spread(values):
    return {'min': min(values), 'median': statistics.median(values), 'max': max(values)}

summaries = []
for (variant, viewport, cache, operation), rows in sorted(groups.items()):
    summaries.append({'variant': variant, 'viewport': viewport, 'cacheCondition': cache, 'operation': operation,
                      'n': 3, 'rpcWallMsNotProductLatency': spread([r['wallMs'] for r in rows]),
                      'mountedCards': spread([r['observation']['cards'] for r in rows]),
                      'networkEventsNotDeduplicatedAcrossOperations': [len(r['network']['requests']) for r in rows]})
result = {
    'inputBasename': args.input.name, 'inputSha256': hashlib.sha256(raw).hexdigest(),
    'sourceRevisions': {v: sorted({r['revision'] for r in valid if r['variant'] == v}) for v in ('baseline', 'candidate')},
    'rawRecords': len(records), 'excludedQualificationRecords': len(excluded), 'validRecords': len(valid), 'passes': len(passes),
    'excludedRpcWallMs': [{'operation': r['operation'], 'wallMs': r['wallMs']} for r in excluded],
    'functional': dict(functional), 'timeouts': 0, 'truncatedCaptures': 0,
    'exactImageBodyReductionPercent': round((1 - 91534 / 2280434) * 100, 4),
    'exactImageRequests': exact_image, 'operationGroups': summaries,
    'limits': [
        'RPC wall durations include controller/tool overhead and different interaction primitives; not product latency or CWV.',
        'First-page sets differ at timestamp-tied boundary030/031; no whole-page causal speedup claim.',
        'Cache enabled and explicitly primed does not establish private cache hits; actual cache flags are retained.',
        'CDP start/finish and response event timestamps are retained separately; event timing ordering can differ.',
        'Public synthetic bodies use narrowly scoped IAB non-Document fulfillment; private image012 uses actual S3 HTTP.',
        'Body bytes, browser encoded counts, queued public bodies, decoded geometry and visual fidelity are different quantities.',
        'WebP display is lossy despite equal decoded dimensions; original identity remains available separately.',
        'No real device, WAN/CDN, field CWV, paid generation, native gated Creator/Studio or production deployment claim.'
    ]}
args.output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: result[k] for k in ('inputSha256', 'rawRecords', 'validRecords', 'passes', 'functional', 'exactImageBodyReductionPercent')}))
