#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
API Key 管理 — 双后端（SQLite 本地 / Postgres 线上）

环境变量 POSTGRES_URL 存在时使用 Postgres，否则使用 SQLite。
"""

import hashlib
import os
import secrets
import sqlite3
from datetime import datetime, timezone, timedelta
from typing import List, Dict

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DATA_DIR, "api_keys.db")

KEY_PREFIX = "fc_"

POSTGRES_URL = os.environ.get("POSTGRES_URL")

_CREATE_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS api_keys (
        key_hash    TEXT PRIMARY KEY,
        key_prefix  TEXT NOT NULL,
        name        TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        is_active   INTEGER NOT NULL DEFAULT 1,
        call_count  INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT
    )
"""

_UTC8 = timezone(timedelta(hours=8))

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

# 旧表无 date 列，需要重建
_REBUILD_ROUTE_STATS_SQL = "DROP TABLE IF EXISTS api_route_stats"

_MIGRATE_COLUMNS = [
    ("call_count", "INTEGER NOT NULL DEFAULT 0"),
    ("last_used_at", "TEXT"),
]


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


# ---------------------------------------------------------------------------
# SQLite 后端
# ---------------------------------------------------------------------------

def _sqlite_conn() -> sqlite3.Connection:
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(_CREATE_TABLE_SQL)
    conn.execute(_CREATE_ROUTE_STATS_SQL)
    conn.commit()
    _migrate_sqlite(conn)
    return conn


def _migrate_sqlite(conn: sqlite3.Connection):
    cur = conn.execute("PRAGMA table_info(api_keys)")
    existing = {row["name"] for row in cur.fetchall()}
    for col, col_def in _MIGRATE_COLUMNS:
        if col not in existing:
            conn.execute(f"ALTER TABLE api_keys ADD COLUMN {col} {col_def}")
    # 重建 api_route_stats（旧表无 date 列）
    cur2 = conn.execute("PRAGMA table_info(api_route_stats)")
    stats_cols = {row["name"] for row in cur2.fetchall()}
    if stats_cols and "date" not in stats_cols:
        conn.execute(_REBUILD_ROUTE_STATS_SQL)
        conn.execute(_CREATE_ROUTE_STATS_SQL)
    conn.commit()


# ---------------------------------------------------------------------------
# Postgres 后端
# ---------------------------------------------------------------------------

def _pg_conn():
    import psycopg2
    import psycopg2.extras
    conn = psycopg2.connect(POSTGRES_URL)
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute(_CREATE_TABLE_SQL)
        cur.execute(_CREATE_ROUTE_STATS_SQL)
    conn.commit()
    _migrate_pg(conn)
    return conn


def _migrate_pg(conn):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'api_keys'"
        )
        existing = {row[0] for row in cur.fetchall()}
        for col, col_def in _MIGRATE_COLUMNS:
            if col not in existing:
                cur.execute(f"ALTER TABLE api_keys ADD COLUMN {col} {col_def}")
        # 重建 api_route_stats（旧表无 date 列）
        cur.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'api_route_stats'"
        )
        stats_cols = {row[0] for row in cur.fetchall()}
        if stats_cols and "date" not in stats_cols:
            cur.execute(_REBUILD_ROUTE_STATS_SQL)
            cur.execute(_CREATE_ROUTE_STATS_SQL)
    conn.commit()


# ---------------------------------------------------------------------------
# 统一接口
# ---------------------------------------------------------------------------

def _use_pg() -> bool:
    return bool(POSTGRES_URL)


def create_key(name: str) -> str:
    """创建新 API Key，返回明文 key（仅此一次可见）"""
    raw = secrets.token_urlsafe(24)
    key = f"{KEY_PREFIX}{raw}"
    key_hash = _hash_key(key)
    prefix = key[:12] + "..."
    now = datetime.now(timezone.utc).isoformat()

    if _use_pg():
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO api_keys (key_hash, key_prefix, name, created_at, is_active) VALUES (%s, %s, %s, %s, 1)",
                    (key_hash, prefix, name, now),
                )
            conn.commit()
        finally:
            conn.close()
    else:
        conn = _sqlite_conn()
        try:
            conn.execute(
                "INSERT INTO api_keys (key_hash, key_prefix, name, created_at, is_active) VALUES (?, ?, ?, ?, 1)",
                (key_hash, prefix, name, now),
            )
            conn.commit()
        finally:
            conn.close()
    return key


def verify_key(key: str) -> str | None:
    """验证 API Key，有效时返回 key name（truthy），无效返回 None（falsy）"""
    if not key or not key.startswith(KEY_PREFIX):
        return None
    key_hash = _hash_key(key)
    now = datetime.now(timezone.utc).isoformat()

    if _use_pg():
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT is_active, name FROM api_keys WHERE key_hash = %s", (key_hash,))
                row = cur.fetchone()
                if row and row[0]:
                    cur.execute(
                        "UPDATE api_keys SET call_count = call_count + 1, last_used_at = %s WHERE key_hash = %s",
                        (now, key_hash),
                    )
                    conn.commit()
                    return row[1]
                return None
        finally:
            conn.close()
    else:
        conn = _sqlite_conn()
        try:
            row = conn.execute(
                "SELECT is_active, name FROM api_keys WHERE key_hash = ?", (key_hash,)
            ).fetchone()
            if row and row["is_active"]:
                conn.execute(
                    "UPDATE api_keys SET call_count = call_count + 1, last_used_at = ? WHERE key_hash = ?",
                    (now, key_hash),
                )
                conn.commit()
                return row["name"]
            return None
        finally:
            conn.close()


def revoke_key(key: str) -> bool:
    """吊销 API Key，返回是否成功"""
    key_hash = _hash_key(key)

    if _use_pg():
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE api_keys SET is_active = 0 WHERE key_hash = %s AND is_active = 1",
                    (key_hash,),
                )
                affected = cur.rowcount
            conn.commit()
            return affected > 0
        finally:
            conn.close()
    else:
        conn = _sqlite_conn()
        try:
            cur = conn.execute(
                "UPDATE api_keys SET is_active = 0 WHERE key_hash = ? AND is_active = 1",
                (key_hash,),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def record_call(source: str, route: str):
    """记录一次 API 调用（按日期 UTC+8 + source + route 聚合）"""
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
    """返回调用统计。可选按日期过滤（YYYY-MM-DD，UTC+8）"""
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


def list_keys_summary() -> List[Dict]:
    """返回 Key 概览（不暴露 key_prefix），供 Dashboard 使用"""
    _sql = "SELECT name, created_at, is_active, call_count, last_used_at FROM api_keys ORDER BY created_at DESC"
    if _use_pg():
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(_sql)
                return [
                    {"name": r[0], "created_at": r[1], "is_active": bool(r[2]), "call_count": r[3], "last_used_at": r[4]}
                    for r in cur.fetchall()
                ]
        finally:
            conn.close()
    else:
        conn = _sqlite_conn()
        try:
            rows = conn.execute(_sql).fetchall()
            return [
                {"name": r["name"], "created_at": r["created_at"], "is_active": bool(r["is_active"]), "call_count": r["call_count"], "last_used_at": r["last_used_at"]}
                for r in rows
            ]
        finally:
            conn.close()


def list_keys() -> List[Dict]:
    """列出所有 API Key（仅显示前缀，不暴露完整 key）"""
    if _use_pg():
        conn = _pg_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT key_prefix, name, created_at, is_active, call_count, last_used_at FROM api_keys ORDER BY created_at DESC"
                )
                rows = cur.fetchall()
                return [
                    {
                        "key_prefix": r[0],
                        "name": r[1],
                        "created_at": r[2],
                        "is_active": bool(r[3]),
                        "call_count": r[4],
                        "last_used_at": r[5],
                    }
                    for r in rows
                ]
        finally:
            conn.close()
    else:
        conn = _sqlite_conn()
        try:
            rows = conn.execute(
                "SELECT key_prefix, name, created_at, is_active, call_count, last_used_at FROM api_keys ORDER BY created_at DESC"
            ).fetchall()
            return [
                {
                    "key_prefix": r["key_prefix"],
                    "name": r["name"],
                    "created_at": r["created_at"],
                    "is_active": bool(r["is_active"]),
                    "call_count": r["call_count"],
                    "last_used_at": r["last_used_at"],
                }
                for r in rows
            ]
        finally:
            conn.close()
