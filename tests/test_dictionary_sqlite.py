"""Compare the read-only snapshot against the original JSON lookup path."""
import json
import sqlite3
from pathlib import Path

import pytest
import dict_db
from build_dictionary_sqlite import build_dictionary, SOURCES


@pytest.fixture(scope='module')
def dictionary(tmp_path_factory):
    output = tmp_path_factory.mktemp('dictionary') / 'dictionary.sqlite3'
    build_dictionary(Path(__file__).resolve().parents[1] / 'static/config', output)
    return output


def compare(monkeypatch, dictionary, fn, *args):
    monkeypatch.setattr(dict_db, 'POSTGRES_URL', None)
    monkeypatch.setattr(dict_db, 'DICT_SQLITE_PATH', None)
    expected = fn(*args)
    monkeypatch.setattr(dict_db, 'DICT_SQLITE_PATH', str(dictionary))
    # JSON tuple/list representation differs but HTTP serialization is identical.
    actual = fn(*args)
    assert json.dumps(actual, ensure_ascii=False) == json.dumps(expected, ensure_ascii=False)


@pytest.mark.parametrize('position', ['head', 'tail'])
@pytest.mark.parametrize('length,tone', [('all', 'all'), ('2', 'P'), ('2', 'Z'), ('2', 'all'), ('3', 'all')])
def test_phrases(monkeypatch, dictionary, position, length, tone):
    for term in ['春', '山', '月', '不存在']:
        compare(monkeypatch, dictionary, dict_db.lookup_phrases, term, position, length, tone)


@pytest.mark.parametrize('term', ['春', '山', '春风', '明月', '不存在'])
def test_pairs_and_definitions(monkeypatch, dictionary, term):
    for fn in [dict_db.lookup_pairs, dict_db.lookup_definitions, dict_db.lookup_sg_definitions]:
        compare(monkeypatch, dictionary, fn, term)
    if len(term) == 1:
        compare(monkeypatch, dictionary, dict_db.lookup_tongwei, term)


@pytest.mark.parametrize('term', ['春', '山', '春风', '明月', '长安', '不存在'])
def test_allusions_no_early_limit(monkeypatch, dictionary, term):
    monkeypatch.setattr(dict_db, 'POSTGRES_URL', None)
    monkeypatch.setattr(dict_db, 'DICT_SQLITE_PATH', None)
    expected = dict_db.lookup_allusions(term, 1)
    monkeypatch.setattr(dict_db, 'DICT_SQLITE_PATH', str(dictionary))
    actual = dict_db.lookup_allusions(term, 1)
    assert sorted(actual, key=lambda e: json.dumps(e, sort_keys=True)) == sorted(expected, key=lambda e: json.dumps(e, sort_keys=True))
    if term == '春':
        assert len(actual) > 1


def test_multi_character_tongwei(monkeypatch, dictionary):
    monkeypatch.setattr(dict_db, 'DICT_SQLITE_PATH', None)
    monkeypatch.setattr(dict_db, 'POSTGRES_URL', None)
    scores = {}
    for partner in {p[0] for p in dict_db.lookup_pairs('春风')}:
        for sibling, _ in dict_db.lookup_pairs(partner):
            if sibling != '春风':
                scores[sibling] = scores.get(sibling, 0) + 1
    expected = sorted(((w, n) for w, n in scores.items() if n >= 2),
                      key=lambda item: (-item[1], item[0]))[:50]
    monkeypatch.setattr(dict_db, 'DICT_SQLITE_PATH', str(dictionary))
    actual = dict_db.lookup_tongwei('春风')
    assert actual == expected
    assert actual == sorted(actual, key=lambda item: (-item[1], item[0]))


def test_manifest_readonly_and_no_json_load(monkeypatch, dictionary):
    monkeypatch.setattr(dict_db, 'DICT_SQLITE_PATH', str(dictionary))
    monkeypatch.setattr(dict_db, '_load_json', lambda name: pytest.fail('SQLite loaded JSON'))
    assert dict_db.check_health() == {'backend': 'sqlite', 'schema_version': 1}
    assert dict_db.lookup_pairs('春')
    with sqlite3.connect(dictionary) as conn:
        sources = conn.execute("SELECT key,value FROM manifest WHERE key != 'schema_version'").fetchall()
        assert set(key for key, _ in sources) == set(SOURCES)
        assert all(len(json.loads(value)['sha256']) == 64 for _, value in sources)
    with pytest.raises(sqlite3.OperationalError, match='readonly'):
        dict_db._sqlite_query('DELETE FROM manifest')


def test_failed_build_keeps_snapshot(tmp_path):
    output = tmp_path / 'dictionary.sqlite3'
    output.write_bytes(b'previous snapshot')
    with pytest.raises(FileNotFoundError):
        build_dictionary(tmp_path / 'missing', output)
    assert output.read_bytes() == b'previous snapshot'
    assert list(tmp_path.glob('*.tmp')) == []


def test_http_sort_normalization_pagination_and_readiness(monkeypatch, dictionary, tmp_path):
    import app as app_module
    monkeypatch.setattr(dict_db, 'DICT_SQLITE_PATH', str(dictionary))
    monkeypatch.setattr(app_module, 'record_call', lambda *args: None)
    client = app_module.app.test_client()
    health = client.get('/api/_health')
    assert health.status_code == 200
    assert health.get_json()['dictionary']['backend'] == 'sqlite'
    full = client.get('/api/dictionary/allusion', query_string={'term': '春'}).get_json()
    limited = client.get('/api/dictionary/allusion', query_string={'term': '春', 'limit': 1}).get_json()
    assert limited == full[:1]
    for mode in ['pair', 'tongwei']:
        full = client.get('/api/dictionary/search', query_string={'term': '春', 'mode': mode}).get_json()
        page = client.get('/api/dictionary/search', query_string={
            'term': '春', 'mode': mode, 'limit': 3, 'offset': 2}).get_json()
        assert page == full[2:5]
    traditional = client.get('/api/char/definitions', query_string={'char': '樂'}).get_json()
    simplified = client.get('/api/char/definitions', query_string={'char': '乐'}).get_json()
    assert traditional['definitions'] == simplified['definitions']
    assert traditional['sg_definitions'] == simplified['sg_definitions']
    monkeypatch.setattr(dict_db, 'DICT_SQLITE_PATH', str(tmp_path / 'missing.sqlite3'))
    assert client.get('/api/_health').status_code == 503
