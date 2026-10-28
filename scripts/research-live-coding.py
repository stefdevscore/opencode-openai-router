"""Small live outcome experiment, not a routing evaluation. Uses only authorized synthetic inputs.
Usage: python3 scripts/research-live-coding.py /absolute/opencode openai/model-a openai/model-b
Makes four real model calls and leaves synthetic sessions in the host data store.
The source validator is a narrow experimental filter, not a security sandbox;
run only trusted test models in an appropriately isolated environment.
"""
import ast
import copy
import json
import os
import signal
from pathlib import Path
import subprocess
import sys
import tempfile
import time

if len(sys.argv) != 4 or not Path(sys.argv[1]).is_absolute():
    raise SystemExit('Provide an absolute host binary and exactly two model references')
tasks = json.loads((Path(__file__).parent.parent / 'research/live-coding/tasks.json').read_text())
allowed_builtins = {'len': len, 'sorted': sorted, 'range': range, 'min': min, 'max': max, 'list': list, 'tuple': tuple, 'enumerate': enumerate, 'reversed': reversed, 'str': str, 'int': int, 'bool': bool}
allowed_methods = {'strip', 'lower', 'casefold', 'append', 'sort', 'copy', 'extend'}
forbidden = (ast.Import, ast.ImportFrom, ast.While, ast.With, ast.AsyncWith, ast.AsyncFor, ast.Lambda, ast.ClassDef, ast.Global, ast.Nonlocal, ast.Try, ast.Raise, ast.Delete, ast.Yield, ast.YieldFrom, ast.Await)

def verify(code, task):
    def timeout_handler(_signum, _frame):
        raise TimeoutError('fixture verification exceeded two seconds')
    previous = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(2)
    try:
        tree = ast.parse(code)
        if len(tree.body) != 1 or not isinstance(tree.body[0], ast.FunctionDef) or tree.body[0].name != task['function'] or tree.body[0].decorator_list:
            return 'invalid_source', 0
        for node in ast.walk(tree):
            if isinstance(node, forbidden) or isinstance(node, ast.Attribute) and (node.attr not in allowed_methods or node.attr.startswith('_')):
                return 'disallowed_source', 0
            if isinstance(node, ast.Name) and node.id.startswith('_'):
                return 'disallowed_source', 0
            if isinstance(node, ast.Call) and not (isinstance(node.func, ast.Name) and node.func.id in allowed_builtins or isinstance(node.func, ast.Attribute) and node.func.attr in allowed_methods):
                return 'disallowed_source', 0
        scope = {'__builtins__': allowed_builtins}
        exec(compile(tree, '<fixture>', 'exec'), scope)
        passed = 0
        for case in task['cases']:
            args = copy.deepcopy(case['args'])
            before = copy.deepcopy(args)
            result = scope[task['function']](*args)
            if result == case['expected'] and args == before:
                passed += 1
        return ('passed' if passed == len(task['cases']) else 'failed'), passed
    except Exception:
        return 'verification_error', 0
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)

results = []
with tempfile.TemporaryDirectory(prefix='router-live-coding-') as root:
    config = Path(root) / 'config'
    config.mkdir()
    env = {k: os.environ[k] for k in ('PATH','HOME','TMPDIR') if k in os.environ}
    env.update({'XDG_CONFIG_HOME': str(config), 'OPENCODE_DISABLE_AUTOUPDATE': 'true'})
    for task in tasks:
        for model in sys.argv[2:]:
            started = time.monotonic()
            try:
                result = subprocess.run([sys.argv[1], 'run', '--standalone', '--model', model, '--format', 'json', task['prompt']], cwd=root, env=env, capture_output=True, text=True, timeout=90)
                parts = []
                for line in result.stdout.splitlines():
                    try:
                        event = json.loads(line)
                        if event.get('type') == 'text': parts.append(event.get('part', {}).get('text', ''))
                    except json.JSONDecodeError: pass
                code = ''.join(parts).strip()
                status, count = verify(code, task) if result.returncode == 0 else ('host_error', 0)
            except subprocess.TimeoutExpired:
                status, count = 'timeout', 0
            results.append({'task': task['id'], 'modelRole': 'first' if model == sys.argv[2] else 'second', 'status': status, 'checksPassed': count, 'checksTotal': len(task['cases']), 'elapsedSeconds': round(time.monotonic() - started, 2)})
print(json.dumps({'scope':'two synthetic pure-function tasks; not a routing or agent evaluation', 'attempts':results}, indent=2))
