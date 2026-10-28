"""Fetch an explicitly pinned public benchmark extraction into a new local JSON file.
Usage: python3 scripts/fetch-independent-benchmark.py /absolute/path/new-file.json
Issue text stays in that file and is not printed or committed by this script.
"""
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import urlencode
from urllib.request import urlopen

DATASET = 'SWE-bench/SWE-bench_Verified'
REVISION = '78f471bf655a3137b2e8a75af1501690ec009ec3'
EXPECTED_SHA256 = '9a52902f16c871361c0acf739ef3aa6eeef8ed433d43ac1bb35fb72130a4e33b'
if len(sys.argv) != 2 or not Path(sys.argv[1]).is_absolute():
    raise SystemExit('Supply an absolute path for a new output file')
output = Path(sys.argv[1])
if output.exists():
    raise SystemExit('Refusing to overwrite an existing file')

def revision():
    with urlopen('https://huggingface.co/api/datasets/' + DATASET, timeout=30) as response:
        return json.load(response).get('sha')

if revision() != REVISION:
    raise SystemExit('Dataset HEAD has changed; review and pin the new version before evaluation')
rows = []
for offset in range(0, 500, 100):
    query = urlencode({'dataset': DATASET, 'config': 'default', 'split': 'test', 'offset': offset, 'length': 100})
    with urlopen('https://datasets-server.huggingface.co/rows?' + query, timeout=60) as response:
        data = json.load(response)
    rows.extend({'id': item['row']['instance_id'], 'difficulty': item['row']['difficulty'], 'prompt': item['row']['problem_statement']} for item in data['rows'])
if revision() != REVISION or len(rows) != 500:
    raise SystemExit('Dataset revision or row count changed during download')
digest = hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
if digest != EXPECTED_SHA256:
    raise SystemExit('Dataset content differs from the pinned extraction')
with output.open('x', encoding='utf-8') as destination:
    json.dump(rows, destination, ensure_ascii=False)
print(json.dumps({'dataset': DATASET, 'revision': REVISION, 'rows': len(rows), 'sha256': digest}))
