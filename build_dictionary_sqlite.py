"""Build an atomic, read-only-serving dictionary snapshot from JSON sources."""
import argparse
import gc
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile

SOURCES = {
    'phrase_head.json': 'head', 'phrase_tail.json': 'tail',
    'phrase_pairs.json': 'pairs', 'phrase_tongwei.json': 'tongwei',
    'char_definitions.json': 'definitions', 'sg_char_definitions.json': 'sg_definitions',
    'allusion_entries.json': 'allusions', 'allusion_index.json': 'allusion_idx',
}


def build_dictionary(source_dir, destination, fallback_dir=None):
    """Load one source at a time; failed builds leave the previous DB intact."""
    source_dir, destination = Path(source_dir), Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=destination.name + '.', suffix='.tmp', dir=destination.parent)
    os.close(fd)
    try:
        with sqlite3.connect(temporary) as conn:
            conn.executescript('''
                CREATE TABLE dictionary_values(kind TEXT, key TEXT, data TEXT NOT NULL,
                    PRIMARY KEY(kind,key)) WITHOUT ROWID;
                CREATE TABLE allusions(id INTEGER PRIMARY KEY, word TEXT NOT NULL, data TEXT NOT NULL);
                CREATE TABLE allusion_idx(ch TEXT, entry_id INTEGER, ordinal INTEGER,
                    PRIMARY KEY(ch,ordinal)) WITHOUT ROWID;
                CREATE TABLE manifest(key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
            ''')
            conn.execute("INSERT INTO manifest VALUES ('schema_version','1')")
            for filename, kind in SOURCES.items():
                path = source_dir / filename
                if not path.exists() and fallback_dir:
                    path = Path(fallback_dir) / filename
                # Fail loudly rather than deploy a silently incomplete dictionary.
                digest = hashlib.sha256()
                with path.open('rb') as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                        digest.update(chunk)
                with path.open(encoding='utf-8') as stream:
                    data = json.load(stream)
                if kind == 'allusions':
                    conn.executemany('INSERT INTO allusions VALUES (?,?,?)',
                        ((i, entry.get('w', ''), json.dumps(entry, ensure_ascii=False))
                         for i, entry in enumerate(data)))
                elif kind == 'allusion_idx':
                    conn.executemany('INSERT INTO allusion_idx VALUES (?,?,?)',
                        ((ch, entry_id, ordinal) for ch, ids in data.items()
                         for ordinal, entry_id in enumerate(ids)))
                else:
                    conn.executemany('INSERT INTO dictionary_values VALUES (?,?,?)',
                        ((kind, key, json.dumps(value, ensure_ascii=False)) for key, value in data.items()))
                conn.execute('INSERT INTO manifest VALUES (?,?)',
                    (filename, json.dumps({'sha256': digest.hexdigest(), 'entries': len(data)})))
                del data
                gc.collect()
            conn.execute('CREATE INDEX allusion_idx_entry ON allusion_idx(entry_id,ch)')
            conn.commit()
            if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Dictionary integrity check failed')
        with open(temporary, 'rb') as stream:
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', default='static/config')
    parser.add_argument('--output', default='data/dictionary.sqlite3')
    parser.add_argument('--fallback-dir', default='data/db_migrated')
    args = parser.parse_args()
    result = build_dictionary(args.source_dir, args.output, args.fallback_dir)
    print(f'Built {result} ({result.stat().st_size / 1024 / 1024:.1f} MiB)')
