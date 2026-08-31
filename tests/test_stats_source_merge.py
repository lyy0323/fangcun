"""统计来源归一：checker 透传端点统一计入 api（后端调用），与前端事件分离。

覆盖：
- checker 端点无论 source（api/frontend/android）都并入 api 来源桶
- 其他端点的 frontend 来源保持原样（不误并）
- 后端调用量（total_api_calls）与前端事件（total_events）口径互不串算
"""

import app as app_module


def test_summary_merges_checker_routes_into_api_source(monkeypatch):
    rows = [
        {"route": "/api/char/lookup", "call_count": 5, "source": "api"},
        {"route": "/api/char/lookup", "call_count": 3, "source": "frontend"},
        {"route": "/api/validate_meter", "call_count": 2, "source": "android"},
        {"route": "/api/rhyme/list", "call_count": 1, "source": "frontend"},
        {"route": "/api/dictionary/search", "call_count": 1, "source": "frontend"},
        {"route": "_event:create_board", "call_count": 4, "source": "frontend"},
    ]
    monkeypatch.setattr(app_module, "get_route_stats", lambda date=None: rows)

    payload = app_module.app.test_client().get("/api/stats/summary?date=2026-09-01").get_json()

    # checker 端点（char/lookup 5+3、validate_meter 2、rhyme/list 1）全部并入 api
    assert payload["sources"] == {"api": 11, "frontend": 5}
    # 后端调用量包含透传端点；前端事件不混入
    assert payload["total_api_calls"] == 12  # 5+3+2+1+1（dictionary/search 前端来源也计入后端调用）
    assert payload["total_events"] == 4
    assert payload["api_calls"]["char/lookup"] == 8
    assert payload["api_calls"]["validate_meter"] == 2


def test_summary_keeps_non_checker_frontend_source_untouched(monkeypatch):
    rows = [
        {"route": "/api/dictionary/search", "call_count": 3, "source": "frontend"},
        {"route": "/api/dictionary/search", "call_count": 2, "source": "api"},
    ]
    monkeypatch.setattr(app_module, "get_route_stats", lambda date=None: rows)

    payload = app_module.app.test_client().get("/api/stats/summary?date=2026-09-01").get_json()

    # 非 checker 端点：frontend 来源保留原桶
    assert payload["sources"] == {"api": 2, "frontend": 3}
    assert payload["total_api_calls"] == 5
