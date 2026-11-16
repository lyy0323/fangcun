"""Android 端埋点本地队列：先落盘，联网后按序补发。

设计要点：
- 记录时立即追加一行 JSON，写盘成功即视为已采集，App 被杀也不丢；
- 每条带自增 id，补发成功按 id 删除，期间新增的记录不受影响；
- 超过 max_events 时丢最旧的，避免长期离线把文件撑大。
"""

import json
import os
import threading


class EventQueue:
    def __init__(self, path, max_events=5000):
        self._path = path
        self._max = max_events
        self._lock = threading.Lock()
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)

    def _read_locked(self):
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
        except FileNotFoundError:
            return []
        items = []
        for line in lines:
            try:
                items.append(json.loads(line))
            except ValueError:
                continue  # 断电/写坏的行直接丢弃
        return items

    def _write_locked(self, items):
        tmp = self._path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        os.replace(tmp, self._path)

    def enqueue(self, source, route):
        """写入一条待补发记录，返回其 id。"""
        with self._lock:
            items = self._read_locked()
            next_id = max((it.get("id", 0) for it in items), default=0) + 1
            items.append({"id": next_id, "source": source, "route": route})
            if len(items) > self._max:
                items = items[-self._max:]
            self._write_locked(items)
            return next_id

    def size(self):
        with self._lock:
            return len(self._read_locked())

    def drain(self, post, limit=None):
        """按 id 顺序补发；post(item) 返回 True 表示已送达。

        遇到失败立即停止：已送达的按 id 删掉，失败项与后续项留到下次。
        返回 (sent, remaining)。
        """
        with self._lock:
            items = self._read_locked()
        if not items:
            return (0, 0)

        batch = items[:limit] if limit else items
        sent = 0
        last_id = None
        for item in batch:
            try:
                ok = post(item)
            except Exception:
                ok = False
            if not ok:
                break
            sent += 1
            last_id = item.get("id", 0)
        if not sent:
            return (0, len(items))

        with self._lock:
            remaining = [it for it in self._read_locked() if it.get("id", 0) > last_id]
            self._write_locked(remaining)
            return (sent, len(remaining))
