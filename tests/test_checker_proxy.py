"""checker 透传代理：调用量计入后端统计 + 请求/响应透传契约。

覆盖：
- POST/GET 透传（url、方法、body、query 原样转发）
- 透传响应状态码与 JSON 原样返回
- 成功（<400）计入 record_call；checker 报错/网络失败不计入
- 失败兜底：HTTPError 透传状态码、连接错误返回 502
"""

import json

import urllib.request
import urllib.error

import app as app_module


class _FakeResp:
    def __init__(self, body: bytes, status: int = 200, content_type: str = "application/json"):
        self._body = body
        self.status = status
        self.headers = {"Content-Type": content_type}

    def read(self):
        return self._body

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
        return False


class _FakeErrFile:
    def __init__(self, body: bytes):
        self._body = body

    def read(self):
        return self._body

    def close(self):
        pass


def _install_fake_checker(monkeypatch, responder, captured: dict):
    monkeypatch.setattr(app_module, "record_call", lambda source, route: captured.setdefault("recorded", []).append((source, route)))

    def fake_urlopen(req, timeout=None, context=None):
        captured["url"] = req.full_url
        captured["method"] = req.get_method()
        captured["body"] = req.data
        captured["content_type"] = req.headers.get("Content-type")
        return responder(req)

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)


def test_validate_meter_passthrough_and_recorded(monkeypatch):
    captured = {}
    _install_fake_checker(
        monkeypatch,
        lambda req: _FakeResp(json.dumps({"is_valid": True}).encode()),
        captured,
    )

    resp = app_module.app.test_client().post(
        "/api/validate_meter",
        json={"poem_text": "床前明月光", "genre": "Shi", "rhyme_book_name": "Pingshuiyun"},
    )

    assert resp.status_code == 200
    assert resp.get_json() == {"is_valid": True}
    # 转发到 checker 原路径，POST 方法、JSON body 原样
    assert captured["url"] == app_module.CHECKER_URL + "/api/validate_meter"
    assert captured["method"] == "POST"
    assert json.loads(captured["body"])["poem_text"] == "床前明月光"
    assert captured["content_type"] == "application/json"
    # 成功响应计入后端调用量
    assert captured["recorded"] == [("api", "/api/validate_meter")]


def test_char_lookup_get_preserves_query_and_recorded(monkeypatch):
    captured = {}
    _install_fake_checker(monkeypatch, lambda req: _FakeResp('{"char": "中"}'.encode()), captured)

    resp = app_module.app.test_client().get("/api/char/lookup?char=中&book=Pingshuiyun")

    assert resp.status_code == 200
    assert resp.get_json() == {"char": "中"}
    assert captured["url"] == app_module.CHECKER_URL + "/api/char/lookup?char=%E4%B8%AD&book=Pingshuiyun"
    assert captured["method"] == "GET"
    assert captured["recorded"] == [("api", "/api/char/lookup")]


def test_char_lookup_query_keeps_existing_percent_encoding(monkeypatch):
    """已百分号编码的 query（浏览器行为）不得二次编码。"""
    captured = {}
    _install_fake_checker(monkeypatch, lambda req: _FakeResp(b"{}"), captured)

    resp = app_module.app.test_client().get("/api/char/lookup?char=%E4%B8%AD&book=Pingshuiyun")

    assert resp.status_code == 200
    assert captured["url"] == app_module.CHECKER_URL + "/api/char/lookup?char=%E4%B8%AD&book=Pingshuiyun"


def test_rhyme_list_and_rules_list_also_recorded(monkeypatch):
    captured = {}
    _install_fake_checker(monkeypatch, lambda req: _FakeResp(b"[]"), captured)

    client = app_module.app.test_client()
    assert client.get("/api/rhyme/list?book=Pingshuiyun").status_code == 200
    assert client.get("/api/rules/list?genre=Shi").status_code == 200

    assert captured["recorded"] == [("api", "/api/rhyme/list"), ("api", "/api/rules/list")]


def test_checker_http_error_passthrough_not_recorded(monkeypatch):
    captured = {}
    err = urllib.error.HTTPError("http://checker", 400, "Bad Request", {}, _FakeErrFile(b'{"error": "invalid genre"}'))
    _install_fake_checker(monkeypatch, lambda req: (_ for _ in ()).throw(err), captured)

    resp = app_module.app.test_client().post("/api/validate_meter", json={"poem_text": "x", "genre": "Bad"})

    assert resp.status_code == 400
    assert resp.get_json() == {"error": "invalid genre"}
    # 状态码 >= 400：不计入调用量
    assert "recorded" not in captured or captured["recorded"] == []


def test_checker_connection_error_returns_502_not_recorded(monkeypatch):
    captured = {}
    err = urllib.error.URLError("connection refused")
    _install_fake_checker(monkeypatch, lambda req: (_ for _ in ()).throw(err), captured)

    resp = app_module.app.test_client().post("/api/free_rhyme", json={"lines": ["a"]})

    assert resp.status_code == 502
    assert "checker" in resp.get_json()["error"]
    assert captured.get("recorded", []) == []
