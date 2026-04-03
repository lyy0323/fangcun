#!/usr/bin/env bash
# 方寸 API 生产环境测试脚本
# 用法: FANGCUN_API_KEY=fc_xxx bash test_api.sh

set -euo pipefail

BASE="https://write.sjtuguoxue.space"
KEY="${FANGCUN_API_KEY:?请设置环境变量 FANGCUN_API_KEY}"
PASS=0
FAIL=0

test_endpoint() {
  local label="$1" expect_code="$2" method="$3" path="$4"
  shift 4
  local url="${BASE}${path}"

  if [[ "$method" == "POST" ]]; then
    code=$(curl -s -o /tmp/fangcun_resp.json -w "%{http_code}" \
      -X POST "$url" -H "X-API-Key: $KEY" -H "Content-Type: application/json" "$@")
  else
    code=$(curl -s -o /tmp/fangcun_resp.json -w "%{http_code}" \
      "$url" -H "X-API-Key: $KEY" "$@")
  fi

  if [[ "$code" == "$expect_code" ]]; then
    printf "  ✅ %-30s  HTTP %s\n" "$label" "$code"
    ((PASS++))
  else
    printf "  ❌ %-30s  期望 %s 实际 %s\n" "$label" "$expect_code" "$code"
    cat /tmp/fangcun_resp.json 2>/dev/null; echo
    ((FAIL++))
  fi
}

echo "🔍 测试生产环境: $BASE"
echo "   API Key: ${KEY:0:10}..."
echo

# --- 1. 文档页面（无需 Key）---
echo "📄 文档"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/docs")
if [[ "$code" == "200" ]]; then
  printf "  ✅ %-30s  HTTP %s\n" "/docs" "$code"; ((PASS++))
else
  printf "  ❌ %-30s  期望 200 实际 %s\n" "/docs" "$code"; ((FAIL++))
fi

# --- 2. 无 Key 应返回 401 ---
echo "🔒 认证"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/rules/list?genre=Shi")
if [[ "$code" == "401" ]]; then
  printf "  ✅ %-30s  HTTP %s\n" "无 Key → 401" "$code"; ((PASS++))
else
  printf "  ❌ %-30s  期望 401 实际 %s\n" "无 Key → 401" "$code"; ((FAIL++))
fi

# --- 3. 各 API 端点 ---
echo "📡 API 端点"

test_endpoint "validate_meter" 200 POST "/api/validate_meter" \
  -d '{"poem_text":"白日依山尽，黄河入海流。欲穷千里目，更上一层楼。","genre":"Shi","rhyme_book_name":"Pingshuiyun"}'

test_endpoint "char/lookup" 200 GET "/api/char/lookup?char=花&book=Pingshuiyun"

test_endpoint "rhyme/lookup" 200 GET "/api/rhyme/lookup?book=Pingshuiyun&category=一东"

test_endpoint "rhyme/list" 200 GET "/api/rhyme/list?book=Pingshuiyun&tone=P"

test_endpoint "rules/list" 200 GET "/api/rules/list?genre=Shi"

test_endpoint "dictionary/search" 200 GET "/api/dictionary/search?term=明&mode=head&length=2"

# --- 4. 输入校验 ---
echo "🛡️  输入校验"
test_endpoint "无效 genre → 400" 400 GET "/api/rules/list?genre=Invalid"
test_endpoint "无效 book → 400" 400 GET "/api/char/lookup?char=花&book=FakeBook"

# --- 结果 ---
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  通过: $PASS  失败: $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

rm -f /tmp/fangcun_resp.json /tmp/vercel_env.txt
exit $FAIL
