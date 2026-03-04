#!/usr/bin/env python3
"""Build homepage navigation data for GitHub Pages.

It discovers route candidates from workspace directories, probes reachability
on the live site, and writes a compact routes.json used by index.html.
"""

import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import List, Tuple, Union

SITE_BASE = "https://zhaorunrunrun.github.io"
ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
OUT_FILE = ROOT / "routes.json"

# Known route metadata keeps presentation stable while allowing auto-discovery.
META = {
    "token-monitor": {
        "title": "Token Monitor",
        "desc": "查看会话 token 输入/输出趋势、分页明细与统计汇总。",
        "group": "工具",
        "badge": "数据看板",
        "emoji": "📊",
        "featured": True,
    },
    "tech-news": {
        "title": "日知录",
        "desc": "每日科技与时事资讯聚合，含热点、报告与 AI 专栏。",
        "group": "内容",
        "badge": "资讯站",
        "emoji": "📰",
        "featured": True,
    },
    "3dgs-tracker": {
        "title": "3DGS Tracker",
        "desc": "3D Gaussian Splatting 研究追踪页，用于技术学习和选题。",
        "group": "研究",
        "badge": "追踪",
        "emoji": "🧠",
        "featured": True,
    },
}


def discover_candidates() -> List[str]:
    names: set[str] = set(META.keys())

    for child in WORKSPACE.iterdir():
        if not child.is_dir() or child.name.startswith("."):
            continue
        if child.name == ROOT.name:
            continue

        if (child / "index.html").exists() or (child / "docs" / "index.html").exists():
            names.add(child.name)

    return sorted(names)


def route_alive(path, timeout=6.0):
    req = urllib.request.Request(f"{SITE_BASE}/{path}/", method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            code = getattr(resp, "status", 200)
            return 200 <= code < 400, code
    except urllib.error.HTTPError as e:
        return False, e.code
    except Exception:
        return False, "ERR"


def to_item(path, status):
    meta = META.get(path, {})
    title = meta.get("title") or path.replace("-", " ").title()
    return {
        "path": f"/{path}/",
        "slug": path,
        "title": title,
        "desc": meta.get("desc", "自动发现的页面。"),
        "group": meta.get("group", "其他"),
        "badge": meta.get("badge", "页面"),
        "emoji": meta.get("emoji", "🔗"),
        "featured": bool(meta.get("featured", False)),
        "status": status,
    }


def main():
    candidates = discover_candidates()
    alive_items = []

    for name in candidates:
        ok, code = route_alive(name)
        if ok:
            alive_items.append(to_item(name, code))

    alive_items.sort(key=lambda x: (not x["featured"], x["group"], x["title"]))

    payload = {
        "site": SITE_BASE,
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "count": len(alive_items),
        "items": alive_items,
    }
    OUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_FILE} with {len(alive_items)} routes")


if __name__ == "__main__":
    main()
