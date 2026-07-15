#!/usr/bin/env bash
# 方寸 API 生产环境测试脚本
# 用法: bash test_api.sh

set -euo pipefail

BASE="https://write.sjtuguoxue.space"
PASS=0
FAIL=0

test_endpoint() {
  local label="$1" expect_code="$2" method="$3" path="$4"
  shift 4
  local url="${BASE}${path}"

  if [[ "$method" == "POST" ]]; then
    code=$(curl -s -o /tmp/fangcun_resp.json -w "%{http_code}" \
      -X POST "$url" -H "Content-Type: application/json" "$@")
  else
    code=$(curl -s -o /tmp/fangcun_resp.json -w "%{http_code}" \
      "$url" "$@")
  fi

  if [[ "$code" == "$expect_code" ]]; then
    printf "  ✅ %-30s  HTTP %s\n" "$label" "$code"
    ((PASS += 1))
  else
    printf "  ❌ %-30s  期望 %s 实际 %s\n" "$label" "$expect_code" "$code"
    cat /tmp/fangcun_resp.json 2>/dev/null; echo
    ((FAIL += 1))
  fi
}

echo "🔍 测试生产环境: $BASE"
echo

# --- 1. 文档页面 ---
echo "📄 文档"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/docs")
if [[ "$code" == "200" ]]; then
  printf "  ✅ %-30s  HTTP %s\n" "/docs" "$code"; ((PASS += 1))
else
  printf "  ❌ %-30s  期望 200 实际 %s\n" "/docs" "$code"; ((FAIL += 1))
fi

# --- 2. 各 API 端点（无需认证）---
echo "📡 API 端点"

test_endpoint "validate_meter" 200 POST "/api/validate_meter" \
  -d '{"poem_text":"白日依山尽，黄河入海流。欲穷千里目，更上一层楼。","genre":"Shi","rhyme_book_name":"Pingshuiyun"}'

test_endpoint "char/lookup" 200 GET "/api/char/lookup?char=花&book=Pingshuiyun"

test_endpoint "rhyme/lookup" 200 GET "/api/rhyme/lookup?book=Pingshuiyun&category=一东"

test_endpoint "rhyme/list" 200 GET "/api/rhyme/list?book=Pingshuiyun&tone=P"

test_endpoint "rules/list" 200 GET "/api/rules/list?genre=Shi"

test_endpoint "dictionary/search" 200 GET "/api/dictionary/search?term=明&mode=head&length=2"

# --- 3. 输入校验 ---
echo "🛡️  输入校验"
test_endpoint "无效 genre → 400" 400 GET "/api/rules/list?genre=Invalid"
test_endpoint "无效 book → 400" 400 GET "/api/char/lookup?char=花&book=FakeBook"

# --- 结果 ---
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  通过: $PASS  失败: $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

rm -f /tmp/fangcun_resp.json
exit $FAIL
