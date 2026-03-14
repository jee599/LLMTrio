# Claude Feedback for LLMTrio

기준 시점: 2026-03-14
분석 기준: `main` 최신 상태 + GPT feedback 반영

## 한 줄 평가

UI는 90점짜리인데 엔진은 60점짜리다. 대시보드가 약속하는 것과 실제 동작 사이의 간극이 이 프로젝트의 핵심 문제다.

## GPT 피드백과의 교차 검증

GPT가 맞은 것:
- bash 의존성 제거 필요 → 동의
- 설정 스키마 불일치 → 동의
- 승인 모드 context handoff 약함 → 동의, 실제로 500자만 넘어감
- debate/비용/칸반 빼야 함 → 동의

GPT가 놓친 것:
- routing.json이 실제 CLI에 model ID를 전달하지 않는 근본 버그
- models.json이 순수 전시용이라는 사실
- debate 탭이 단순히 미완성이 아니라 백엔드가 아예 없다는 점
- SSE가 fs.watch의 atomic rename 문제로 아예 안 되고 있었다는 핵심 버그 (이미 수정)
- 결과 출력이 4000자로 잘리는 문제

## 실제 동작 vs UI 약속 — 정직한 비교

| 기능 | UI가 보여주는 것 | 실제 동작 |
|------|-----------------|----------|
| 모델 라우팅 | 드롭다운으로 모델 선택 가능 | agent 이름만 바뀜, model ID는 CLI에 안 넘어감 |
| 비용 제한 | 슬라이더로 세션/일일 한도 설정 | checkBudget()이 항상 {ok:true} 반환 |
| 토론 탭 | 에이전트 간 토론 + 합의도 미터 | 메시지 입력만 됨, 에이전트 응답 없음, 합의도 항상 0% |
| 모델 업데이트 | 최신 모델 자동 감지 | models.json 생성되지만 라우팅에 영향 없음 |
| 결과 출력 | 전체 에이전트 출력 | 마지막 4000자만 저장, 나머지 버려짐 |
| 승인 모드 | plan 결과 검토 후 실행 | plan 출력의 마지막 500자만 execute에 전달 |

## 죽은 코드 목록

### 아예 동작 안 하는 기능
- debate 탭 전체: UI만 존재, 백엔드 없음
- consensus meter: 항상 0%, 업데이트 로직 없음
- cost/budget 슬라이더: 저장은 되지만 enforce 안 됨
- models.json: 생성되지만 라우팅에 사용 안 됨
- last_check.json: 아무도 안 읽음

### 반만 동작하는 기능
- model routing UI: 선택은 가능, CLI에 전달 안 됨
- Setup install/login: 실행은 되지만 완료 확인 불안정
- Flow 실시간 뷰: 완료된 태스크만 보임, 진행 중엔 내용 없음
- 결과 모달: 4000자 잘림

## 아키텍처 근본 문제

### dashboard.html 5400줄 모놀리스
CSS 2000줄 + HTML 500줄 + JS 2900줄이 한 파일에.
테스트 불가, 분업 불가, 리팩토링 위험.

분리 제안:
- styles.css (CSS만)
- dashboard.html (HTML + 최소 init)
- app.js (상태관리 + 렌더링)
- sse.js (SSE + 이벤트 핸들링)

### 파일 기반 메시지 버스의 한계
- pending.json에 동시 쓰기 → 데이터 유실 가능
- command-watcher.sh가 2초마다 폴링 → 명령 지연
- 순서 보장 없음

### routing이 연극
resolveModelId()가 model ID를 구하지만 spawnAgent()는 agent 이름으로만 실행.
```js
// octopus-core.js
const AGENT_CMD = {
  claude: (c) => ['claude', ['-p', c]],    // model ID 안 씀
  codex: (c) => ['codex', ['exec', c]],     // model ID 안 씀
  gemini: (c) => ['gemini', ['-p', c]],     // model ID 안 씀
};
```

## 즉시 실행할 수정 (Quick Wins)

### 1. 죽은 기능 제거 (1시간)
- debate 탭 HTML/CSS/JS 전부 삭제
- cost 슬라이더 UI 삭제 (budget.json의 workflow 설정은 유지)
- models.json 관련 model-checker.sh, Setup의 모델 업데이트 버튼 삭제
- routing 드롭다운을 "권장 모델" 정보 표시로 전환

### 2. routing 실제 구현 (30분)
CLI가 model 선택을 지원하는 경우 전달:
```js
const AGENT_CMD = {
  claude: (c, model) => ['claude', ['-p', c, '--model', model || 'claude-sonnet-4-6']],
  codex: (c, model) => ['codex', ['exec', c]],  // codex는 model 선택 미지원
  gemini: (c, model) => ['gemini', ['-p', c, '--model', model || 'gemini-2.5-pro']],
};
```

### 3. 승인 context 강화 (1시간)
plan 종료 시 결과를 파일로 저장:
```
.trio/plan-summary.json
{
  "research": { "output": "전체 출력", "summary": "요약" },
  "architecture": { "output": "전체 출력", "summary": "요약" },
  "scaffold": { "output": "전체 출력", "summary": "요약" }
}
```
execute 시작 시 이 파일을 읽어서 context로 주입.

### 4. bash 스크립트 제거 (2시간)
- command-watcher.sh → dashboard-server.js에 이미 구현됨, 삭제
- model-checker.sh → 삭제 (models.json 기능 자체 제거)
- trio 스크립트 → bin/llmtrio.js로 완전 대체

## GPT + Claude 통합 우선순위

### P0: 지금 당장 (오늘)
1. 죽은 기능 삭제 (debate, cost sliders, model checker)
2. routing 실제 구현 (model ID를 CLI에 전달)
3. bash 스크립트 제거
4. 승인 context handoff (plan-summary.json)

### P1: 이번 주
1. 설정 스키마 통일
2. 결과물 비교 화면
3. 부분 재실행 (실패 task만)
4. 크로스 플랫폼 테스트

### P2: 다음 주
1. dashboard.html 분리 (css/html/js)
2. repo-aware 실행
3. desktop notification
4. session restore

## 최종 평가

|  | 점수 | 이유 |
|--|------|------|
| 핵심 엔진 | 85/100 | 병렬 실행, 2-phase, 타임아웃 잘 됨 |
| 대시보드 디자인 | 90/100 | 색상, 레이아웃, 반응형 우수 |
| 기능 완성도 | 40/100 | 반만 되는 기능이 너무 많음 |
| 코드 품질 | 65/100 | 감사 이슈 수정했지만 모놀리스 구조 |
| 상품 신뢰도 | 45/100 | UI 약속 vs 실제 간극 |

> 이 프로젝트의 적은 기능 부족이 아니다. 기능 과잉이다. 반만 되는 기능 10개보다 완전히 되는 기능 5개가 상품이다.
