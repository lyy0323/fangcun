"""Android 埋点本地队列（event_queue）的行为契约。"""

import os
import sys

ANDROID_PY = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "android", "app", "src", "main", "python",
)
if ANDROID_PY not in sys.path:
    sys.path.insert(0, ANDROID_PY)

from event_queue import EventQueue  # noqa: E402


def _collect(queue):
    got = []
    sent, remaining = queue.drain(lambda item: got.append(item["route"]) or True)
    return got, sent, remaining


def test_enqueue_then_drain_delivers_in_order(tmp_path):
    queue = EventQueue(str(tmp_path / "q.jsonl"))
    queue.enqueue("android", "_event:create_board:genre=Shi")
    queue.enqueue("android", "_event:export_image:theme=素白")

    got, sent, remaining = _collect(queue)

    assert got == ["_event:create_board:genre=Shi", "_event:export_image:theme=素白"]
    assert (sent, remaining) == (2, 0)
    assert queue.size() == 0


def test_drain_keeps_items_when_post_fails(tmp_path):
    queue = EventQueue(str(tmp_path / "q.jsonl"))
    queue.enqueue("android", "_event:a")
    queue.enqueue("android", "_event:b")

    assert queue.drain(lambda item: False) == (0, 2)
    assert queue.size() == 2


def test_partial_success_removes_only_delivered_items(tmp_path):
    queue = EventQueue(str(tmp_path / "q.jsonl"))
    for route in ["_event:a", "_event:b", "_event:c"]:
        queue.enqueue("android", route)

    sent, remaining = queue.drain(lambda item: item["route"] != "_event:b")

    assert (sent, remaining) == (1, 2)
    got, _, _ = _collect(queue)
    assert got == ["_event:b", "_event:c"]


def test_post_exception_is_treated_as_failure(tmp_path):
    queue = EventQueue(str(tmp_path / "q.jsonl"))
    queue.enqueue("android", "_event:a")

    def boom(item):
        raise RuntimeError("network down")

    assert queue.drain(boom) == (0, 1)
    assert queue.size() == 1


def test_queue_is_capped_dropping_oldest(tmp_path):
    queue = EventQueue(str(tmp_path / "q.jsonl"), max_events=3)
    for route in ["_event:1", "_event:2", "_event:3", "_event:4", "_event:5"]:
        queue.enqueue("android", route)

    got, _, _ = _collect(queue)

    assert got == ["_event:3", "_event:4", "_event:5"]


def test_queued_items_survive_process_restart(tmp_path):
    path = str(tmp_path / "q.jsonl")
    EventQueue(path).enqueue("android", "_event:persisted")

    restarted = EventQueue(path)
    got, _, _ = _collect(restarted)

    assert got == ["_event:persisted"]


def test_corrupted_line_is_skipped(tmp_path):
    path = tmp_path / "q.jsonl"
    queue = EventQueue(str(path))
    queue.enqueue("android", "_event:ok")
    with open(path, "a", encoding="utf-8") as f:
        f.write("{broken line\n")
    queue.enqueue("android", "_event:ok2")

    got, sent, remaining = _collect(queue)

    assert got == ["_event:ok", "_event:ok2"]
    assert (sent, remaining) == (2, 0)
