#!/usr/bin/env bash
# 점검 한 번에 돌리기
#   tests/run.sh          빠른 점검 (1~2분)
#   tests/run.sh full     전체 점검: 무작위 9,000번 (5분쯤)
#   tests/run.sh browser  실제 브라우저로 화면 확인 (Playwright 필요)
# 다른 파일로 돌리기(예: 고치기 전 버전):  APP_HTML=/경로/old.html tests/run.sh
set -u
cd "$(dirname "$0")"
export TZ=Asia/Seoul   # 사용자와 같은 시간대 (아침 9시 전에 날짜가 밀리는 문제를 잡기 위해)
MODE="${1:-quick}"
APP="${APP_HTML:-../index.html}"
fail=0
run() { local name="$1"; shift; printf '%-34s ' "$name"; local out; if out="$("$@" 2>&1)"; then echo "$out" | grep -E 'PASS|OK' | tail -1; else fail=1; echo "실패"; echo "$out" | tail -25; fi; }

if [ "$MODE" = "browser" ]; then node browser_home.js; exit $?; fi

if [ ! -d node_modules/jsdom ]; then echo "jsdom 설치 중..."; npm install --no-audit --no-fund >/dev/null 2>&1 || { echo "jsdom 설치 실패 (tests 폴더에서 npm install)"; exit 1; }; fi
tmpdir="$(mktemp -d)"; trap 'rm -rf "$tmpdir"' EXIT

run "정적 점검"                    python3 static.py "$APP" "$tmpdir/main.js"
run "문법"                         sh -c "node --check '$tmpdir/main.js' && echo OK"
run "홈의 오늘 계획"               node t_home_plan.js
run "v1.3에서 고친 버그"           node t_fixed_v13.js
run "다시 확인할 것(백업·복사 등)" node t_regress.js

# 무작위 점검은 메모리를 많이 써서 씨앗을 나눠 따로 실행한다
if [ "$MODE" = "full" ]; then RANGES="1:20 21:40 41:60 61:80 81:100"; else RANGES="1:10"; fi
for r in $RANGES; do
  a="${r%%:*}"; b="${r##*:}"
  run "무작위: 계획 체크·취소 $a~$b" node fuzz_plan.js "$a" "$b"
  run "무작위: 전체 동작 $a~$b"      node fuzz_all.js "$a" "$b"
done

echo
if [ "$fail" = 0 ]; then echo "모두 통과"; else echo "실패한 점검이 있어요"; fi
exit $fail
