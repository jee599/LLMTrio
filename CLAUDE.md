# LLMTrio

Multi-LLM 오케스트레이션 도구. Claude, Codex, Gemini를 병렬로 실행한다.

## 설계 원칙

- Zero dependencies. Node.js 내장 모듈만 사용한다.
- No build step. 프론트엔드는 HTML + CSS + JS.
- JSON 파일 기반 상태 관리. `.trio/` 디렉토리가 전부.
- Atomic write. 항상 `.tmp` → `rename`으로 쓴다.

## 핵심 파일

- `scripts/octopus-core.js` — 워크플로우 엔진. 여기서 에이전트를 spawn한다.
- `scripts/dashboard-server.js` — HTTP + SSE 서버. 브라우저와 엔진을 중개한다.
- `scripts/dashboard.html` — 프론트엔드 진입점.
- `scripts/lib/auth.js` — CLI 설치/인증 체크 공유 모듈.
- `bin/llmtrio.js` — npx 엔트리포인트.
- `trio` — Unix bash 엔트리포인트.

## 빌드 & 테스트

```bash
node --test test/e2e.js test/workflow.js
```

## 주의사항

- `child_process.spawn`으로 에이전트를 띄울 때 `CLAUDECODE`, `ANTHROPIC_API_KEY` 등 환경변수를 제거해야 한다. 중첩 세션 방지.
- `.trio/.env`에 API 키가 저장된다. 커밋 금지 (.gitignore에 `.trio/` 포함됨).
- session token은 서버 시작 시 `crypto.randomBytes(16)`로 생성. write API 보호용.
- timeout 0은 무제한을 의미한다. falsy 체크 하지 말 것.
