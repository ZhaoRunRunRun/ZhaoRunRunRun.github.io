#!/usr/bin/env python3
import json
import os
from datetime import datetime, timezone

LOG_PATH = os.path.expanduser('~/.openclaw/logs/token-usage.log')
OUT_PATH = os.path.join(os.path.dirname(__file__), 'token-monitor', 'data', 'token-usage.json')


def load_records(path):
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
            records.append({
                'timestamp': obj.get('timestamp'),
                'input': int(obj.get('input', 0) or 0),
                'output': int(obj.get('output', 0) or 0),
                'total': int(obj.get('total', 0) or 0),
            })
    records = [r for r in records if r.get('timestamp')]
    records.sort(key=lambda x: x['timestamp'])
    return records


def main():
    records = load_records(LOG_PATH)
    payload = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'records': records,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f'Wrote {len(records)} records -> {OUT_PATH}')


if __name__ == '__main__':
    main()
