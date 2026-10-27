"""Analytics event and north-star summary contracts."""

import app as app_module


def test_copy_image_is_accepted_and_recorded(monkeypatch):
    recorded = []
    monkeypatch.setattr(app_module, "record_call", lambda source, route: recorded.append((source, route)))

    response = app_module.app.test_client().post(
        "/api/_track",
        json={
            "event": "copy_image",
            "props": {"theme": "素白", "genre": "Shi"},
            "source": "frontend",
        },
    )

    assert response.status_code == 200
    assert recorded == [("frontend", "_event:copy_image:genre=Shi:theme=素白")]


def test_summary_reports_north_star_events_without_double_counting_android_sub_events(monkeypatch):
    rows = [
        {"route": "_event:export_image:genre=Shi", "call_count": 7, "source": "frontend"},
        {"route": "_event:copy_image:genre=Shi", "call_count": 3, "source": "frontend"},
        {"route": "_event:copy_text", "call_count": 5, "source": "frontend"},
        {"route": "_event:save_image:genre=Shi", "call_count": 2, "source": "android"},
        {"route": "_event:long_press_image:genre=Shi", "call_count": 4, "source": "android"},
        {"route": "/api/dictionary/search", "call_count": 11, "source": "api"},
    ]
    monkeypatch.setattr(app_module, "get_route_stats", lambda date=None: rows)

    response = app_module.app.test_client().get("/api/stats/summary?date=2026-07-19")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["export_image"] == 7
    assert payload["copy_image"] == 3
    assert payload["copy_text"] == 5
    assert payload["north_star_total"] == 15
    assert payload["total_events"] == 21
    assert payload["total_api_calls"] == 11
