"""
dict_db.py — 词库数据库访问层

生产环境（POSTGRES_URL 存在）走 Neon PostgreSQL。
本地 / Android（无 POSTGRES_URL）走 JSON 文件回退。
"""

import json
import os
from typing import List, Optional, Tuple

POSTGRES_URL = os.environ.get("POSTGRES_URL")

# ============================================================================
# JSON fallback（本地 / Android）
# ============================================================================

_json_cache: dict = {}


def _load_json(name: str):
    if name not in _json_cache:
        cfg = os.environ.get("FANGCUN_CONFIG_DIR", "static/config")
        path = os.path.join(cfg, name)
        if not os.path.exists(path):
            path = os.path.join("data/db_migrated", name)
        try:
            with open(path, "r") as f:
                _json_cache[name] = json.load(f)
        except FileNotFoundError:
            _json_cache[name] = {}
    return _json_cache[name]


# ============================================================================
# PostgreSQL helpers
# ============================================================================

_pg_conn_cache = None


def _get_conn():
    global _pg_conn_cache
    if _pg_conn_cache is not None:
        try:
            _pg_conn_cache.execute("SELECT 1")
            return _pg_conn_cache
        except Exception:
            try:
                _pg_conn_cache.close()
            except Exception:
                pass
            _pg_conn_cache = None
    import psycopg
    _pg_conn_cache = psycopg.connect(POSTGRES_URL, autocommit=True)
    return _pg_conn_cache


def _pg_query(sql: str, params: tuple = ()) -> list:
    conn = _get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


# ============================================================================
# 对语 (pairs)
# ============================================================================

def lookup_pairs(term: str) -> List[Tuple[str, int]]:
    if not POSTGRES_URL:
        return _load_json("phrase_pairs.json").get(term, [])
    rows = _pg_query(
        "SELECT paired, freq FROM pairs WHERE term = %s ORDER BY freq DESC LIMIT 100",
        (term,),
    )
    return [[r[0], r[1]] for r in rows]


# ============================================================================
# 词首 / 词末 (phrases) — 始终走 JSON（DB 膨胀严重，不划算）
# ============================================================================

def lookup_phrases(anchor: str, pos: str, length: str, tone: str):
    src = _load_json("phrase_head.json") if pos == "head" else _load_json("phrase_tail.json")
    entry = src.get(anchor, {})
    if length == "all":
        return entry
    len_data = entry.get(length, {})
    if tone in ("P", "Z"):
        return len_data.get(tone, [])
    merged = {}
    for t in ["P", "Z"]:
        for w, c in len_data.get(t, []):
            merged[w] = max(merged.get(w, 0), c)
    return sorted(merged.items(), key=lambda x: -x[1])


# ============================================================================
# 同位 (tongwei)
# ============================================================================

def lookup_tongwei(term: str) -> List[Tuple[str, int]]:
    if not POSTGRES_URL:
        tw = _load_json("phrase_tongwei.json")
        if len(term) == 1:
            return tw.get(term, [])
        pairs = _load_json("phrase_pairs.json")
        my_pairs = pairs.get(term, [])
        if not my_pairs:
            return []
        pair_set = set(p[0] for p in my_pairs)
        tw_score: dict = {}
        for partner in pair_set:
            for sibling, _ in pairs.get(partner, []):
                if sibling != term:
                    tw_score[sibling] = tw_score.get(sibling, 0) + 1
        top = sorted(tw_score.items(), key=lambda x: -x[1])
        return [(c, s) for c, s in top if s >= 2][:50]

    if len(term) == 1:
        rows = _pg_query(
            "SELECT sibling, score FROM tongwei WHERE ch = %s ORDER BY score DESC LIMIT 50",
            (term,),
        )
        return [[r[0], r[1]] for r in rows]

    rows = _pg_query(
        """SELECT p2.paired, COUNT(*) as score
           FROM pairs p1
           JOIN pairs p2 ON p1.paired = p2.term
           WHERE p1.term = %s AND p2.paired != %s
           GROUP BY p2.paired
           HAVING COUNT(*) >= 2
           ORDER BY score DESC
           LIMIT 50""",
        (term, term),
    )
    return [[r[0], r[1]] for r in rows]


# ============================================================================
# 典故 (allusions)
# ============================================================================

def lookup_allusions(term: str, limit: int = 60) -> list:
    if not POSTGRES_URL:
        index = _load_json("allusion_index.json")
        entries = _load_json("allusion_entries.json")
        if not index or not entries:
            return []
        if len(term) == 1:
            ids = index.get(term, [])
            return [entries[i] for i in ids if i < len(entries)]
        char_sets = [set(index.get(c, [])) for c in term]
        if not all(char_sets):
            return []
        common = char_sets[0]
        for s in char_sets[1:]:
            common &= s
        return [entries[i] for i in common if i < len(entries) and term in entries[i].get("w", "")]

    if len(term) == 1:
        rows = _pg_query(
            """SELECT a.data FROM allusions a
               JOIN allusion_idx i ON a.id = i.entry_id
               WHERE i.ch = %s LIMIT %s""",
            (term, limit),
        )
    else:
        chars = list(term)
        if len(chars) == 2:
            rows = _pg_query(
                """SELECT a.data FROM allusions a
                   WHERE a.id IN (
                       SELECT entry_id FROM allusion_idx WHERE ch = %s
                       INTERSECT
                       SELECT entry_id FROM allusion_idx WHERE ch = %s
                   ) AND a.word LIKE %s LIMIT %s""",
                (chars[0], chars[1], f"%{term}%", limit),
            )
        else:
            ids_sql = " INTERSECT ".join(
                ["SELECT entry_id FROM allusion_idx WHERE ch = %s"] * len(chars)
            )
            rows = _pg_query(
                f"""SELECT a.data FROM allusions a
                    WHERE a.id IN ({ids_sql})
                    AND a.word LIKE %s LIMIT %s""",
                (*chars, f"%{term}%", limit),
            )
    return [r[0] for r in rows]


# ============================================================================
# 释义 (definitions)
# ============================================================================

def lookup_definitions(ch: str) -> Optional[list]:
    if not POSTGRES_URL:
        defs = _load_json("char_definitions.json")
        return defs.get(ch)
    rows = _pg_query("SELECT defs FROM char_defs WHERE ch = %s", (ch,))
    return rows[0][0] if rows else None
