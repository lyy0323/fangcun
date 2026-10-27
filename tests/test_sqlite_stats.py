from concurrent.futures import ThreadPoolExecutor
import sqlite3

import api_keys
import app as app_module
from deploy.coco2.backup_stats import backup


def test_concurrent_counts_and_online_backup(tmp_path, monkeypatch):
    path = tmp_path / "stats.sqlite3"
    monkeypatch.setattr(api_keys, "DB_PATH", str(path))
    monkeypatch.setattr(api_keys, "STATS_SQLITE_PATH", str(path))
    # 显式 SQLite 配置必须覆盖环境中的失效 PG 连接。
    monkeypatch.setattr(api_keys, "POSTGRES_URL", "invalid-postgres-url")
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda _: api_keys.record_call("api", "/api/dictionary/allusion"), range(40)))
    rows = api_keys.get_route_stats()
    assert len(rows) == 1 and rows[0]["call_count"] == 40
    target = tmp_path / "backup.sqlite3"
    backup(path, target)
    with sqlite3.connect(target) as conn:
        assert conn.execute("SELECT SUM(call_count) FROM api_route_stats").fetchone()[0] == 40
    with sqlite3.connect(path) as conn:
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"


def test_tracking_failure_does_not_break_client(monkeypatch):
    def unavailable(*args):
        raise sqlite3.OperationalError("database is locked")
    monkeypatch.setattr(app_module, "record_call", unavailable)
    client = app_module.app.test_client()
    assert client.post("/api/_track", json={"event": "copy_text"}).status_code == 200
    assert client.post("/api/_ping", json={"route": "/api/dictionary/allusion"}).status_code == 200
