#!/usr/bin/env python3
"""
fangcun CLI 集成测试

调用线上 checker/dict 服务，覆盖每个命令的 help、成功、失败场景。
运行后生成带时间戳的 Markdown 报告到 docs/cli-test-report.md。

用法: python3 tests/test_cli.py
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta

CLI = os.path.join(os.path.dirname(__file__), "..", "cli.py")
REPORT_PATH = os.path.join(os.path.dirname(__file__), "..", "docs", "cli-test-report.md")

_UTC8 = timezone(timedelta(hours=8))


class TestRunner:
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        self.start_time = datetime.now(_UTC8)

    def run(self, name: str, args: list, expect_rc: int = 0,
            expect_json: bool = True, json_check: callable = None,
            expect_stderr_contains: str = None, expect_stdout_contains: str = None):
        ts = datetime.now(_UTC8).strftime("%H:%M:%S.%f")[:-3]
        cmd = [sys.executable, CLI] + args
        cmd_str = f"python3 cli.py {' '.join(args)}"

        t0 = time.monotonic()
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        elapsed_ms = int((time.monotonic() - t0) * 1000)

        ok = True
        notes = []

        if proc.returncode != expect_rc:
            ok = False
            notes.append(f"exit code: got {proc.returncode}, expected {expect_rc}")

        stdout = proc.stdout.strip()
        stderr = proc.stderr.strip()

        if expect_json and stdout:
            try:
                data = json.loads(stdout)
                if json_check and not json_check(data):
                    ok = False
                    notes.append(f"json_check failed")
            except json.JSONDecodeError:
                if expect_rc == 0:
                    ok = False
                    notes.append("stdout is not valid JSON")

        if expect_stderr_contains and expect_stderr_contains not in stderr:
            ok = False
            notes.append(f"stderr missing: '{expect_stderr_contains}'")

        if expect_stdout_contains and expect_stdout_contains not in stdout:
            ok = False
            notes.append(f"stdout missing: '{expect_stdout_contains}'")

        status = "PASS" if ok else "FAIL"
        if ok:
            self.passed += 1
        else:
            self.failed += 1

        preview = stdout[:120].replace("\n", " ") if stdout else "(empty)"
        if stderr and not ok:
            preview += f" | stderr: {stderr[:80]}"

        self.results.append({
            "name": name,
            "cmd": cmd_str,
            "ts": ts,
            "elapsed_ms": elapsed_ms,
            "status": status,
            "notes": "; ".join(notes) if notes else "",
            "preview": preview,
            "rc": proc.returncode,
        })

        icon = "+" if ok else "!"
        print(f"  [{icon}] {status}  {name} ({elapsed_ms}ms)")

    def write_report(self):
        end_time = datetime.now(_UTC8)
        total = self.passed + self.failed
        duration = (end_time - self.start_time).total_seconds()

        lines = [
            f"# fangcun CLI 测试报告",
            f"",
            f"| 项目 | 值 |",
            f"|------|------|",
            f"| 运行时间 | {self.start_time.strftime('%Y-%m-%d %H:%M:%S')} UTC+8 |",
            f"| 总耗时 | {duration:.1f}s |",
            f"| 用例总数 | {total} |",
            f"| 通过 | {self.passed} |",
            f"| 失败 | {self.failed} |",
            f"| 通过率 | {self.passed/total*100:.0f}% |",
            f"",
            f"---",
            f"",
            f"## 测试结果",
            f"",
            f"| # | 时间 | 耗时 | 状态 | 用例 | 命令 | 备注 |",
            f"|---|------|------|------|------|------|------|",
        ]
        for i, r in enumerate(self.results, 1):
            status_icon = "PASS" if r["status"] == "PASS" else "**FAIL**"
            cmd_escaped = r["cmd"].replace("|", "\\|")
            notes = r["notes"].replace("|", "\\|") if r["notes"] else ""
            lines.append(
                f"| {i} | {r['ts']} | {r['elapsed_ms']}ms | {status_icon} | {r['name']} | `{cmd_escaped}` | {notes} |"
            )

        lines += [
            f"",
            f"---",
            f"",
            f"## 输出摘要",
            f"",
        ]
        for i, r in enumerate(self.results, 1):
            preview = r["preview"].replace("|", "\\|")
            if len(preview) > 150:
                preview = preview[:150] + "…"
            lines.append(f"**{i}. {r['name']}** (rc={r['rc']})")
            lines.append(f"```")
            lines.append(f"$ {r['cmd']}")
            lines.append(f"{preview}")
            lines.append(f"```")
            lines.append(f"")

        os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
        with open(REPORT_PATH, "w") as f:
            f.write("\n".join(lines))
        print(f"\n报告已写入: {REPORT_PATH}")


def main():
    t = TestRunner()

    print("=== Help 测试 ===")

    t.run("help: 主命令", ["-h"], expect_rc=0, expect_json=False,
          expect_stdout_contains="格律诗词校验")

    t.run("help: validate", ["validate", "-h"], expect_rc=0, expect_json=False,
          expect_stdout_contains="--text")

    t.run("help: rules", ["rules", "-h"], expect_rc=0, expect_json=False,
          expect_stdout_contains="--genre")

    t.run("help: char", ["char", "-h"], expect_rc=0, expect_json=False,
          expect_stdout_contains="--char")

    t.run("help: rhyme", ["rhyme", "-h"], expect_rc=0, expect_json=False,
          expect_stdout_contains="--category")

    t.run("help: suggest", ["suggest", "-h"], expect_rc=0, expect_json=False,
          expect_stdout_contains="--mode")

    print("\n=== validate 测试 ===")

    t.run("validate: 五绝通过",
          ["validate", "--text", "白日依山尽黄河入海流欲穷千里目更上一层楼", "--genre", "Shi"],
          json_check=lambda d: d.get("is_valid") is True and d.get("rule", {}).get("name") == "五绝仄起")

    t.run("validate: 五绝不通过",
          ["validate", "--text", "春眠不觉晓处处闻啼鸟夜来风雨声花落知多少", "--genre", "Shi"],
          expect_rc=1,
          json_check=lambda d: d.get("is_valid") is False and len(d.get("errors", [])) > 0
                                and d["errors"][0].get("expected") in ("P", "Z"))

    t.run("validate: 词 (词林正韵)",
          ["validate", "--text",
           "东风夜放花千树更吹落星如雨宝马雕车香满路凤箫声动玉壶光转一夜鱼龙舞蛾儿雪柳黄金缕笑语盈盈暗香去众里寻他千百度蓦然回首那人却在灯火阑珊处",
           "--genre", "Ci", "--rhyme-book", "Cilinzhengyun"],
          expect_rc=1,
          json_check=lambda d: d.get("rule") is not None and d["rule"].get("char_count", 0) > 60)

    t.run("validate: 字数不匹配",
          ["validate", "--text", "三个字", "--genre", "Shi"],
          expect_rc=1,
          json_check=lambda d: d.get("is_valid") is False
                                and any("字数" in e.get("message", "") for e in d.get("errors", [])))

    t.run("validate: 指定规则名",
          ["validate", "--text", "白日依山尽黄河入海流欲穷千里目更上一层楼",
           "--genre", "Shi", "--rule", "五绝仄起"],
          json_check=lambda d: d.get("rule", {}).get("name") == "五绝仄起")

    t.run("validate: pretty 模式",
          ["validate", "--text", "白日依山尽黄河入海流欲穷千里目更上一层楼",
           "--genre", "Shi", "--pretty"],
          expect_json=False,
          expect_stdout_contains="格律通过")

    t.run("validate: tone_pattern 存在",
          ["validate", "--text", "白日依山尽黄河入海流欲穷千里目更上一层楼", "--genre", "Shi"],
          json_check=lambda d: len(d.get("tone_pattern", [])) == 20
                                and all(t in ("P", "Z", "A") for t in d["tone_pattern"]))

    t.run("validate: rhyme 结构完整",
          ["validate", "--text", "白日依山尽黄河入海流欲穷千里目更上一层楼", "--genre", "Shi"],
          json_check=lambda d: "rhyme" in d and d["rhyme"].get("name") is not None
                                and isinstance(d["rhyme"].get("positions"), list))

    t.run("validate: 缺少 --text",
          ["validate", "--genre", "Shi"],
          expect_rc=2, expect_json=False,
          expect_stderr_contains="--text")

    t.run("validate: 无效 genre",
          ["validate", "--text", "测试", "--genre", "Invalid"],
          expect_rc=2, expect_json=False,
          expect_stderr_contains="invalid choice")

    print("\n=== rules 测试 ===")

    t.run("rules: 诗规则",
          ["rules", "--genre", "Shi"],
          json_check=lambda d: isinstance(d, list) and len(d) > 0
                                and all("name" in r and "char_count" in r for r in d))

    t.run("rules: 词规则数量",
          ["rules", "--genre", "Ci"],
          json_check=lambda d: isinstance(d, list) and len(d) > 100)

    t.run("rules: 搜索沁园春",
          ["rules", "--genre", "Ci", "--search", "沁园春"],
          json_check=lambda d: isinstance(d, list) and len(d) > 0
                                and all("沁园春" in r["name"] for r in d))

    t.run("rules: 搜索无结果",
          ["rules", "--genre", "Shi", "--search", "不存在的词牌"],
          json_check=lambda d: isinstance(d, list) and len(d) == 0)

    print("\n=== char 测试 ===")

    t.run("char: 单字无 book",
          ["char", "--char", "东"],
          json_check=lambda d: d.get("char") == "东"
                                and "tones" in d and "rhyme_categories" in d)

    t.run("char: 单字带 book",
          ["char", "--char", "东", "--book", "Pingshuiyun"],
          json_check=lambda d: d.get("tones") == ["平"]
                                and isinstance(d.get("rhyme_categories"), list)
                                and d["rhyme_categories"][0]["name"] == "一东")

    t.run("char: 多字批量",
          ["char", "--char", "明月", "--book", "Pingshuiyun"],
          json_check=lambda d: isinstance(d, list) and len(d) == 2
                                and d[0]["tone"] == "P" and d[1]["tone"] == "Z")

    t.run("char: 不存在的字",
          ["char", "--char", "鑫"],
          json_check=lambda d: isinstance(d.get("tones"), list))

    t.run("char: 繁体字 (繁→简)",
          ["char", "--char", "東", "--book", "Pingshuiyun"],
          json_check=lambda d: len(d.get("tones", [])) > 0)

    print("\n=== rhyme 测试 ===")

    t.run("rhyme: 一东",
          ["rhyme", "--book", "Pingshuiyun", "--category", "一东"],
          json_check=lambda d: d.get("category_name") == "一东"
                                and d.get("total", 0) > 10
                                and "东" in d.get("characters", []))

    t.run("rhyme: 带 include",
          ["rhyme", "--book", "Pingshuiyun", "--category", "一东", "--include", "neighbor"],
          json_check=lambda d: "primary" in d and "related" in d)

    t.run("rhyme: 不存在的韵部",
          ["rhyme", "--book", "Pingshuiyun", "--category", "不存在"],
          expect_rc=2,
          json_check=lambda d: "error" in d)

    print("\n=== suggest 测试 ===")

    t.run("suggest: pair 模式",
          ["suggest", "--term", "明月", "--mode", "pair"],
          json_check=lambda d: isinstance(d, list) and len(d) > 0)

    t.run("suggest: head 模式",
          ["suggest", "--term", "春", "--mode", "head", "--length", "2"],
          json_check=lambda d: isinstance(d, (list, dict)))

    t.run("suggest: tail 模式",
          ["suggest", "--term", "月", "--mode", "tail", "--length", "2", "--tone", "P"],
          json_check=lambda d: isinstance(d, (list, dict)))

    t.run("suggest: tongwei 模式",
          ["suggest", "--term", "春", "--mode", "tongwei"],
          json_check=lambda d: isinstance(d, list)
                                or (isinstance(d, dict) and "error" not in d))

    t.run("suggest: 无结果的词",
          ["suggest", "--term", "xyzabc", "--mode", "pair"],
          json_check=lambda d: isinstance(d, list) and len(d) == 0)

    print("\n=== 边界 测试 ===")

    t.run("validate: 占位符 □",
          ["validate", "--text", "白日依山尽黄河入海流欲穷千里目更上一层□", "--genre", "Shi"],
          json_check=lambda d: "□" in d.get("chars", []))

    t.run("validate: 带标点输入",
          ["validate", "--text", "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。", "--genre", "Shi"],
          json_check=lambda d: d.get("is_valid") is True)

    t.run("缺少子命令",
          [],
          expect_rc=2, expect_json=False,
          expect_stderr_contains="required")

    # --- 写报告 ---
    t.write_report()
    print(f"\n总计: {t.passed} passed, {t.failed} failed")
    return 0 if t.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
