"""新手引导埋点事件：/api/_track 白名单放行，防 VALID_EVENTS 漏配导致事件丢失。"""

import pytest

import app as app_module

ONBOARDING_EVENTS = ["onboarding_show", "onboarding_done", "onboarding_skip"]


@pytest.mark.parametrize("event", ONBOARDING_EVENTS)
def test_onboarding_events_accepted(monkeypatch, event):
    recorded = []
    monkeypatch.setattr(app_module, "record_call", lambda source, route: recorded.append((source, route)))

    resp = app_module.app.test_client().post("/api/_track", json={"event": event, "source": "frontend"})

    assert resp.status_code == 200
    assert recorded == [("frontend", f"_event:{event}")]
