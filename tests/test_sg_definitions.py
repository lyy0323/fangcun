"""上古释义（sg_definitions）API 契约。

/api/char/definitions 现返回 { definitions(现义), sg_definitions(上古义) }：
- 上古释义来自 sg_char_definitions.json（繁体原文、按编号行拆分去重）
- 不区分诗经/楚辞，每字仅一份
- 简体字头 / 繁体字头（t2s 回退）都能查到
"""

import urllib.parse

import app as app_module


def _defs(char: str) -> dict:
    resp = app_module.app.test_client().get(
        "/api/char/definitions?char=" + urllib.parse.quote(char)
    )
    assert resp.status_code == 200
    return resp.get_json()


def test_sg_definitions_present_for_common_char():
    j = _defs("行")
    sg = j.get("sg_definitions") or []
    assert len(sg) >= 3  # 行列 / 行走 / 辈分 等多读音义项均并入
    assert any("行列" in it for it in sg)
    assert any("行走" in it for it in sg)


def test_sg_definitions_traditional_char_falls_back():
    # 樂 → 乐（繁体字头经 t2s 回退也能命中上古释义）
    j = _defs("樂")
    assert len(j.get("sg_definitions") or []) >= 3
    j2 = _defs("乐")
    assert j.get("sg_definitions") == j2.get("sg_definitions")


def test_sg_definitions_absent_char_returns_empty_list():
    j = _defs("龘")  # 生僻/非上古字
    assert j.get("sg_definitions") == []


def test_definitions_still_returns_modern_defs():
    j = _defs("行")
    assert isinstance(j.get("definitions"), list)
    assert len(j.get("definitions") or []) > 0  # mapull 现代释义不受影响
