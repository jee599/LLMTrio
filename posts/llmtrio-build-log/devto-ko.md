---
title: "Claude, Codex, Gemini를 동시에 돌려봤다 — LLMTrio 빌드 로그"
published: false
description: "프롬프트 하나에 AI 3개가 병렬로 일한다. 만드는 건 이틀, 버그 잡는 건 하루 종일."
tags: ai, opensource, llm, webdev
---

프롬프트 하나를 넣으면 Claude, Codex, Gemini 세 개가 동시에 일한다. 각자 잘하는 걸 맡기고, 결과를 합친다. 터미널 세 개 띄워놓고 복붙하는 게 아니라 자동으로.

그게 LLMTrio를 만든 이유다.

아이디어는 단순했다. 구현은 아니었다.


## 왜 세 개를 동시에?

LLM마다 성격이 있다. 몇 달 동안 세 모델을 각각 쓰면서 패턴이 보였다.

Claude는 깊이 생각한다. 아키텍처 설계를 맡기면 컴포넌트 관계, 의존성, 엣지 케이스까지 잡아낸다. 코드 리뷰도 내가 몇 시간 걸릴 버그를 찾아준다.

Codex는 빠르다. 구현 코드를 찍어내는 속도가 다른 모델과 비교가 안 된다. 프로젝트 스캐폴딩, 보일러플레이트, CRUD — 이런 건 Codex 영역이다.

Gemini는 넓게 본다. 주제를 조사하고, 제약 조건을 찾고, 리스크를 파악하는 데 강하다. 코드 한 줄 쓰기 전에 해야 하는 분석 작업.

하나만 쓰는 건 아깝다. 세 개를 동시에, 각자 잘하는 걸 맡기면?


## 의존성 0개, 파일 기반 아키텍처

초반에 두 가지를 정했다.

**npm 의존성 없음.** Node.js 빌트인 모듈만 쓴다 — `http`, `fs`, `child_process`, `path`. 프로젝트 전체가 파일 3개다. `octopus-core.js`(워크플로우 엔진), `dashboard-server.js`(HTTP + SSE 서버), `dashboard.html`(싱글 파일 프론트엔드). React 없고, Express 없고, Socket.io 없다.

이유는 간단하다. LLMTrio는 CLI 도구 세 개를 붙이는 접착제다. 쉘 커맨드 세 개를 이어주는 데 프레임워크를 올리는 건 과하다. 의존성 0이면 `npx llmtrio` 한 방에 돌아간다.

**파일 기반 메시지 버스.** 세 컴포넌트는 `.trio/state.json`과 `.trio/results/task-*.json` 파일로 소통한다. 대시보드 서버가 `fs.watch`로 파일 변경을 감지하고 SSE로 브라우저에 쏜다.

```
octopus-core writes → .trio/state.json
                    → .trio/results/task-abc.json
                         ↓ (fs.watch)
dashboard-server broadcasts → SSE events
                         ↓
dashboard.html receives → updates UI
```

취약해 보인다. 맞다, 조금 그렇다. 하지만 디버깅이 쉽다. 모든 상태 전환이 JSON 파일이니까 `cat`으로 확인할 수 있다. localhost에서 돌아가는 도구 치고는 이 단순함이 더 낫다.


## 2페이즈 워크플로우

프롬프트 하나가 두 단계로 분해된다. 각 단계 안에서는 태스크가 병렬로 돈다.

**Plan 페이즈**에서 Gemini가 요구사항을 분석하고, Claude가 아키텍처를 설계하고, Codex가 프로젝트 골격을 만든다. 세 개가 동시에 시작해서 독립적으로 실행된다.

**Execute 페이즈**에서 Codex가 핵심 코드를 구현하고, Claude가 코드 리뷰를 하고, Gemini가 문서를 쓴다. Plan이 전부 성공해야 Execute로 넘어간다.

```
프롬프트: "REST API with auth 만들어줘"
                    ↓
    ┌─── Plan (병렬) ──────────┐
    │ Gemini: research          │
    │ Claude: architecture      │
    │ Codex: scaffold           │
    └───────────────────────────┘
                    ↓
    ┌── Execute (병렬) ────────┐
    │ Codex: implementation     │
    │ Claude: code-review       │
    │ Gemini: documentation     │
    └───────────────────────────┘
                    ↓
           통합 결과 출력
```

엔진은 Plan 결과를 Execute 프롬프트에 컨텍스트로 넘긴다. 구현 태스크는 아키텍처를 알고, 코드 리뷰는 스캐폴드를 안다.


## 버그 사파리

오케스트레이터를 만드는 건 세션 두어 번이었다. 버그를 잡는 데 하루 종일 걸렸다.


## 아무것도 안 도는데 "진행중"

대시보드에서 세 에이전트 모두 "working"으로 표시됐다. 태스크가 아직 pending인데도. 경과 시간 카운터도 멈추지 않고 계속 올라갔다.

**원인:** `Promise.all` 안에서 `task.status = 'working'`을 프로세스 spawn 전에 설정했다. JavaScript가 각 async 함수의 동기 코드를 먼저 전부 실행하니까, 세 태스크가 동시에 "working"이 된다 — 하나도 안 시작했는데.

```javascript
// Before: 세 태스크가 즉시 'working'으로 바뀜
await Promise.all(tasks.map(async (task) => {
  task.status = 'working';  // 모든 태스크에서 await 전에 실행됨
  saveState(state);
  const result = await spawnAgent(task.agent, prompt, task);
}));
```

**수정:** 상태를 pending으로 유지하고, 실제 프로세스가 spawn된 후에만 working으로 전환하는 콜백을 추가했다. 타이머도 pending이면 "0.0s", done이면 최종값 고정, working일 때만 카운팅하도록 수정.


## 이전 워크플로우 결과가 계속 보인다

새 워크플로우를 돌렸는데 이전 결과가 그대로 나왔다.

**원인:** 캐싱이 3겹이었다. 브라우저가 `/api/result/` 응답을 캐싱. 서버가 `lastGoodData` Map에 파싱 결과를 영구 캐싱. `state.json`이 새 프로세스 시작 전에 리셋 안 돼서 대시보드가 이전 상태를 읽음.

**수정:** 모든 fetch에 `cache: 'no-store'` 추가. 서버의 `lastGoodData`를 워크플로우 시작 시 클리어. `state.json` 즉시 초기화. 그리고 워크플로우 ID 기반 검증을 추가해서 — 각 워크플로우마다 고유 ID를 부여하고, 대시보드가 이전 ID의 SSE 업데이트를 무시하게 했다.

```javascript
// 이전 워크플로우의 stale 업데이트를 무시
if (data.workflowId && _currentWorkflowId &&
    data.workflowId !== _currentWorkflowId) {
  return;
}
```


## 싱크 버그 7개 전수 조사

눈에 보이는 문제를 고친 후, 세 파일을 전부 감사했다. 7개의 독립적인 싱크 문제가 나왔다.

에이전트 카드는 업데이트되는데 태스크 배열은 비어있었다. `agent-update` SSE가 카드를 직접 업데이트하지만, `tasks` 배열은 `state-update` SSE에서만 채워졌다. 흐름도와 결과 탭이 `tasks` 배열을 쓰니까, 카드는 실시간인데 나머지는 0/0.

에이전트-태스크 상태 매핑 함수가 3개나 있었다. 각각 약간 다른 로직. 하나의 `syncTasksToAgents()`로 통합했다.

설정 API 4개(`/api/models`, `/api/routing`, `/api/budget`, `/api/auth-status`)에 캐시 헤더가 없었다. 서버 result 캐시가 파일 삭제 후에도 남아있었다. 전체 목록은 분산 시스템 교과서 같다 — 레이스 컨디션, 스테일 리드, 캐시 무효화 누락, 이벤트 순서 문제.

"단순한" localhost 도구에서 전부 나왔다.


## 승인 버튼을 3번 눌렀는데 아무 일도 안 일어난다

이게 가장 구조적인 버그였다. "승인 모드"를 추가했다. Plan이 끝나면 유저가 결과를 검토하고 승인해야 Execute가 시작되는 구조.

첫 구현: octopus-core가 Plan을 끝내고, `approval.json` 파일이 생길 때까지 500ms마다 폴링한다. 대시보드는 유저가 버튼을 누르면 그 파일을 생성한다.

```javascript
// 첫 시도: 폴링 기반 승인
function waitForApproval() {
  return new Promise((resolve) => {
    const check = () => {
      if (fs.existsSync(APPROVAL_FILE)) {
        resolve(JSON.parse(fs.readFileSync(APPROVAL_FILE)));
        return;
      }
      setTimeout(check, 500); // 500ms마다 폴링
    };
    check();
  });
}
```

**문제:** octopus-core 프로세스가 폴링하다가 죽었다. dashboard-server가 spawn한 자식 프로세스는 생존이 보장되지 않는다. 타임아웃, 메모리, 아니면 그냥 운이 나빠서 죽을 수 있다. 프로세스가 죽으면 파일을 읽을 놈이 없다.

승인 버튼을 3번 눌렀다. 아무 일도 안 일어났다. 프로세스 목록을 확인했더니 — octopus-core가 죽어있었다. `approval.json`은 존재하지만 아무도 안 읽는다.

**수정:** 승인 로직을 octopus-core에서 완전히 빼고 dashboard-server로 옮겼다. 한 프로세스가 오래 돌면서 폴링하는 대신, 짧은 프로세스 두 개를 순차적으로 spawn한다.

```
승인 모드:
1. 서버 spawn: octopus-core --phase plan
2. Plan 완료 → 프로세스 정상 종료
3. 서버가 state를 'awaiting-approval'로 세팅
4. 유저가 승인 클릭
5. 서버 spawn: octopus-core --phase execute
6. Execute 완료 → 프로세스 정상 종료

자동 모드:
1. 서버 spawn: octopus-core (--phase 없이)
2. plan + execute 순차 실행 → 종료
```

서버가 라이프사이클을 관리한다. 어느 쪽이 크래시하든 서버의 `on('close')` 핸들러가 잡아서 stuck 태스크를 에러로 마킹한다.

이 프로젝트에서 얻은 가장 큰 교훈: **자식 프로세스에 블로킹 대기를 넣지 마라.** 상태 전환은 부모가 관리해야 한다.


## 다르게 했을 것들

**상태 관리가 어려운 부분이다.** 디버깅 시간의 80%가 싱크 문제였다. 실제 LLM 오케스트레이션이 아니라. 파일 기반 메시지 버스가 동작하긴 하지만, 어느 컴포넌트가 최신 데이터를 갖고 있는지 추적하려면 규율이 필요하다. 이벤트 소싱 설계였으면 버그의 반은 안 생겼을 거다.

**전부 타임아웃을 걸어라.** 첫 버전에는 에이전트 프로세스에 타임아웃이 없었다. Gemini가 documentation 태스크에서 3분 넘게 멈춘 적이 있다. 지금은 모든 spawn에 설정 가능한 타임아웃(기본 120초)이 있고, SIGTERM → 3초 후 SIGKILL로 에스컬레이션한다.

**상태 변경을 폴링하지 마라.** approval 폴링이 가장 확실한 실패였지만, 대시보드의 주기적 `fetchFullState()` 호출도 냄새가 난다. SSE가 유일한 업데이트 소스여야 한다. 폴링은 전략이 아니라 폴백이다.


## 스택

프로젝트 전체가 파일 3개, npm 의존성 0개다.

```
scripts/
├── octopus-core.js      # 워크플로우 엔진 (CLI 에이전트 spawn)
├── dashboard-server.js  # HTTP 서버 + SSE + 파일 워처
└── dashboard.html       # 싱글 파일 프론트엔드 (5000줄+)
```

CLI 도구 세 개를 오케스트레이션한다 — `claude`(Claude Code), `codex`(OpenAI Codex CLI), `gemini`(Google Gemini CLI). 각각 자식 프로세스로 spawn되고, 역할별 프롬프트를 받아 실행하고, stdout으로 결과를 수집한다.

대시보드는 실시간 모니터다. 완료 애니메이션이 있는 흐름도, 클릭하면 상세 결과가 나오는 디테일 패널, 승인/자동 모드 토글, 실시간 경과 타이머, 워크플로우 완료 시 결과를 요약하는 브리핑 시스템.

전부 `localhost:3333`에서 돌아간다. 클라우드 없고, 계정 없고, 텔레메트리 없다.

---

- [LLMTrio GitHub](https://github.com/jee599/LLMTrio)
- [LLMTrio npm](https://www.npmjs.com/package/llmtrio)

> AI 세 개를 동시에 돌리는 건 미래처럼 들린다. 그 세 개의 상태를 동기화하는 건 현재처럼 느껴진다 — 지저분하고, 레이스 컨디션 투성이고, 그래서 풀어볼 만하다.
