---
name: trio:dashboard
description: LLMTrio 대시보드 실행/중지
---

# /trio:dashboard

LLMTrio 모니터링 대시보드를 실행한다.

## Start (기본)

```bash
# 1. command-watcher.sh 백그라운드 실행 → pending.json 모니터링
bash scripts/command-watcher.sh &
WATCHER_PID=$!
mkdir -p .trio/pids
echo $WATCHER_PID > .trio/pids/watcher.pid

# 2. model-checker.sh 실행 → 오늘 첫 실행이면 Gemini 모델 검색
bash scripts/model-checker.sh

# 3. dashboard-server.js 백그라운드 실행 → localhost:3333
node scripts/dashboard-server.js &
SERVER_PID=$!
echo $SERVER_PID > .trio/pids/server.pid

# 4. 브라우저 자동 오픈 (macOS / Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  open http://localhost:3333
else
  xdg-open http://localhost:3333
fi

# 5. 터미널 출력
echo "대시보드가 열렸습니다. localhost:3333"
```

## Stop

`/trio:dashboard stop` → 실행 중인 프로세스를 종료한다.

```bash
# .trio/pids/ 에서 PID 읽어서 SIGTERM 전송
for pidfile in .trio/pids/*.pid; do
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    kill -SIGTERM "$pid" 2>/dev/null && echo "Stopped PID $pid ($(basename "$pidfile" .pid))"
    rm -f "$pidfile"
  fi
done
echo "대시보드가 종료되었습니다."
```
