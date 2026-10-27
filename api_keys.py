#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
API 调用统计 — 双后端（SQLite 本地 / Postgres 线上）

设置 STATS_SQLITE_PATH 时使用指定 SQLite；否则 POSTGRES_URL 存在时使用 Postgres。
仅记录调用统计，不管理 API Key。
"""

import os
import sqlite3
import threading
from datetime import datetime, timezone, timedelta
from typing import List, Dict

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
STATS_SQLITE_PATH = os.environ.get("STATS_SQLITE_PATH")
DB_PATH = STATS_SQLITE_PATH or os.path.join(DATA_DIR, "api_keys.db")

POSTGRES_URL = os.environ.get("POSTGRES_URL")

_UTC8 = timezone(timedelta(hours=8))
_sqlite_init_lock = threading.Lock()
_sqlite_initialized = set()

_CREATE_ROUTE_STATS_SQL = """
    CREATE TABLE IF NOT EXISTS api_route_stats (
        date        TEXT NOT NULL,
        source      TEXT NOT NULL,
        route       TEXT NOT NULL,
        call_count  INTEGER NOT NULL DEFAULT 0,
        last_called_at TEXT,
        PRIMARY KEY (date, source, route)
    )
"""


def _sqlite_conn() -> sqlite3.Connection:
    db_path = os.path.abspath(DB_PATH)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=5)
    conn.row_factory = sqlite3.Row
    try:
        with _sqlite_init_lock:
            if db_path not in _sqlite_initialized:
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute(_CREATE_ROUTE_STATS_SQL)
                conn.commit()
                _sqlite_initialized.add(db_path)
        conn.execute("PRAGMA busy_timeout=5000")
    except Exception:
        conn.close()
        raise
    return conn


def _pg_conn():
    import psycopg
    conn = psycopg.connect(POSTGRES_URL)
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute(_CREATE_ROUTE_STATS_SQL)
    conn.commit()
    return conn


def _use_pg() -> bool:
    return bool(POSTGRES_URL) and not STATS_SQLITE_PATH


def record_call(source: str, route: str):
    now = datetime.now(_UTC8)
    today = now.strftime("%Y-%m-%d")
    now_iso = now.isoformat()

    if _use_pg():
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO api_route_stats (date, source, route, call_count, last_called_at)
                       VALUES (%s, %s, %s, 1, %s)
                       ON CONFLICT (date, source, route)
                       DO UPDATE SET call_count = api_route_stats.call_count + 1, last_called_at = %s""",
                    (today, source, route, now_iso, now_iso),
                )
            conn.commit()
        finally:
            conn.close()
    else:
        conn = _sqlite_conn()
        try:
            conn.execute(
                """INSERT INTO api_route_stats (date, source, route, call_count, last_called_at)
                   VALUES (?, ?, ?, 1, ?)
                   ON CONFLICT (date, source, route)
                   DO UPDATE SET call_count = call_count + 1, last_called_at = ?""",
                (today, source, route, now_iso, now_iso),
            )
            conn.commit()
        finally:
            conn.close()


def get_route_stats(date: str = None) -> List[Dict]:
    if date:
        where, params_pg, params_sq = "WHERE date = %s", (date,), (date,)
    else:
        where, params_pg, params_sq = "", (), ()

    if _use_pg():
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT date, source, route, call_count, last_called_at FROM api_route_stats {where} ORDER BY date DESC, call_count DESC",
                    params_pg,
                )
                return [
                    {"date": r[0], "source": r[1], "route": r[2], "call_count": r[3], "last_called_at": r[4]}
                    for r in cur.fetchall()
                ]
        finally:
            conn.close()
    else:
        conn = _sqlite_conn()
        try:
            sql = f"SELECT date, source, route, call_count, last_called_at FROM api_route_stats {where} ORDER BY date DESC, call_count DESC"
            rows = conn.execute(sql.replace("%s", "?"), params_sq).fetchall()
            return [
                {"date": r["date"], "source": r["source"], "route": r["route"], "call_count": r["call_count"], "last_called_at": r["last_called_at"]}
                for r in rows
            ]
        finally:
            conn.close()
