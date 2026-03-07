#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone

STATE_DIR = os.path.expanduser(os.getenv('OPENCLAW_STATE_DIR', '~/.openclaw'))
LOG_PATH = os.path.join(STATE_DIR, 'logs', 'token-usage.log')
OUT_PATH = os.path.join(os.path.dirname(__file__), 'token-monitor', 'data', 'token-usage.json')


def as_int(v):
    try:
        return int(v or 0)
    except Exception:
        return 0


def load_records_from_log(path):
    records = []
    if not os.path.exists(path):
        return records
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            ts = obj.get('timestamp')
            if not ts:
                continue
            records.append({
                'timestamp': ts,
                'input': as_int(obj.get('input')),
                'output': as_int(obj.get('output')),
                'total': as_int(obj.get('total')),
                'source': 'log',
            })
    return records


def load_records_from_sessions(state_dir):
    records = []
    idx_path = os.path.join(state_dir, 'agents', 'main', 'sessions', 'sessions.json')
    if not os.path.exists(idx_path):
        return records
    try:
        index = json.load(open(idx_path, 'r', encoding='utf-8'))
    except Exception:
        return records

    for session_key, meta in index.items():
        if not session_key.startswith('agent:main:feishu:'):
            continue
        session_file = meta.get('sessionFile') or os.path.join(
            state_dir,
            'agents',
            'main',
            'sessions',
            f"{meta.get('sessionId', '')}.jsonl",
        )
        if not session_file or not os.path.exists(session_file):
            continue

        try:
            with open(session_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        row = json.loads(line)
                    except Exception:
                        continue
                    if row.get('type') != 'message':
                        continue
                    msg = row.get('message', {})
                    if msg.get('role') != 'assistant':
                        continue
                    usage = msg.get('usage')
                    if not usage:
                        continue
                    ts = row.get('timestamp') or msg.get('timestamp')
                    if not ts:
                        continue
                    inp = as_int(usage.get('input', usage.get('inputTokens')))
                    out = as_int(usage.get('output', usage.get('outputTokens')))
                    total = as_int(usage.get('totalTokens'))
                    if total <= 0:
                        total = inp + out
                    records.append({
                        'timestamp': ts,
                        'input': inp,
                        'output': out,
                        'total': total,
                        'source': 'session',
                    })
        except Exception:
            continue

    return records


def dedupe(records):
    by_key = {}
    for r in records:
        key = (r['timestamp'], r['input'], r['output'], r['total'])
        by_key[key] = r
    merged = []
    for (_, _, _, _), r in by_key.items():
        merged.append({
            'timestamp': r['timestamp'],
            'input': r['input'],
            'output': r['output'],
            'total': r['total'],
        })
    merged.sort(key=lambda x: x['timestamp'])
    return merged


def main():
    from_log = load_records_from_log(LOG_PATH)
    from_sessions = load_records_from_sessions(STATE_DIR)

    records = dedupe(from_log + from_sessions)
    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'records': records,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    non_zero = sum(1 for r in records if r['input'] or r['output'])
    print(f'STATE_DIR={STATE_DIR}')
    print(f'Wrote {len(records)} records ({non_zero} non-zero) -> {OUT_PATH}')


if __name__ == '__main__':
    main()
