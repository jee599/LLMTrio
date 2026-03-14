# GPT Feedback for LLMTrio

기준 시점: 2026-03-14  
분석 기준: `main` 최신 상태 (`95c5603`)

## 한 줄 평가

`LLMTrio`는 방향이 좋은 로컬 AI 코딩 오케스트레이터 알파다.  
지금도 데모나 초기 사용자 테스트는 가능하지만, 실제 상품으로 팔려면 `실행 안정성`, `플랫폼 일관성`, `승인 플로우 품질`, `설정/권한 구조`를 먼저 정리해야 한다.

## 현재 제품성 평가

- 시장성: 있음
- 현재 완성도: 알파
- 바로 판매 가능 여부: 아직 어려움
- 가장 좋은 포지셔닝: `CLI 기반 AI 코딩 로컬 오케스트레이터 + 브라우저 대시보드`

이 제품의 핵심 가치는 다음이다.

- Claude, Codex, Gemini 같은 AI 코딩 CLI를 한 워크플로 안에서 묶는다.
- `plan -> execute -> review` 흐름을 한 화면에서 관리한다.
- 브라우저에서 설치, 로그인, 실행, 승인, 결과 확인까지 연결한다.
- 로컬 상태와 결과를 파일 기반으로 보관해 복구와 재실행이 쉽다.

이 포지셔닝은 맞다. 특히 `브라우저에서 설치하고 설정하는 경험`은 유지하는 것이 좋다. 다만 지금은 UI가 약속하는 수준과 엔진이 실제 보장하는 수준 사이에 차이가 있다.

## 유지해야 할 것

다음은 제품 정체성이므로 유지하는 것이 좋다.

- 브라우저 기반 Setup 화면
- 브라우저에서 CLI 설치와 로그인 유도
- 로컬 퍼스트 구조
- 승인 모드
- 결과 패널과 요약 브리핑
- 파일 기반 상태 저장
- 다중 agent 병렬 실행 개념

특히 브라우저 설치 UX는 좋은 방향이다.  
이 제품은 CLI 사용자를 위한 도구지만, 실제 사용 경험은 브라우저 대시보드에서 완성되는 구조가 더 낫다.

## 빼거나 축소해야 할 것

현재 단계에서 복잡도만 높이고 신뢰도를 떨어뜨리는 요소들은 과감히 줄이는 것이 좋다.

- 가짜 비용 추적
- 최신 모델 자동 조사 기능
- 토론 탭
- 과한 칸반 보드 상호작용
- 실제 적용되지 않는 모델 라우팅 과장 표현
- 아직 안정화되지 않은 세부 제어 UI

이 기능들은 언젠가 다시 넣을 수 있다. 하지만 v1에서는 핵심 가치가 아니다.

## 실제 상품화를 막는 핵심 문제

### 1. 런처와 플랫폼 의존성이 일관되지 않음

현재 Node 엔트리 포인트가 여전히 `bash`에 의존한다.  
그래서 Windows에서 일부 명령은 바로 깨진다.

문제:

- `bin/llmtrio.js`의 `login`, `start`가 `bash` 호출에 묶여 있음
- 일부 상태 체크가 `which`를 사용함
- `command-watcher.sh`, `model-checker.sh`가 셸 유틸리티에 의존함

상품화 관점 리스크:

- npm 설치 후 바로 안 되는 경험이 발생함
- README와 실제 요구사항이 어긋남
- 지원 플랫폼 설명이 모호해짐

수정 방향:

- 핵심 실행 경로를 Node 단일 런타임으로 통합
- `command-watcher.sh` 기능은 `dashboard-server.js` 또는 별도 `command-worker.js`로 이전
- `model-checker.sh`도 Node 스크립트로 치환하거나 v1에서 제거
- CLI 설치 여부 확인은 `where`/`which` 분기 대신 Node 기반 탐지로 통일

권장 구현:

- `lib/process.js`: spawn, kill, timeout, pid 관리 공통화
- `lib/platform.js`: CLI 탐지, 브라우저 열기, npm 실행 공통화
- `scripts/command-watcher.sh` 제거
- `scripts/model-checker.sh` 제거 또는 `scripts/model-checker.js`로 교체

### 2. 승인 모드의 핵심 가치가 아직 약함

승인 모드는 제품의 중요한 차별점인데, 현재 `plan` 결과가 `execute`에 안정적으로 이어지는 구조가 약하다.

문제:

- `plan` 결과는 메모리 기반 연결에 가깝다
- 승인 후 `execute`를 새 프로세스로 재개할 때 컨텍스트 전달이 약하다
- 사용자가 승인한 이유나 선택 사항이 다음 단계에 반영되지 않는다

상품화 관점 리스크:

- 승인 모드가 단지 일시정지 UI처럼 보일 수 있음
- 자동 모드와 승인 모드의 결과 품질이 달라질 수 있음

수정 방향:

- `plan` 종료 시 phase summary를 파일로 저장
- 승인 시 선택한 방향, 체크한 옵션, 승인 코멘트를 함께 저장
- `execute` 시작 시 이 요약 파일을 읽어 프롬프트에 주입

권장 구현:

- `.trio/phase-plan-summary.json`
- `.trio/workflow-context.json`
- `dashboard-server.js`에서 승인 시 사용자 승인 코멘트까지 저장
- `octopus-core.js`에서 `--context-file` 또는 동일 효과의 로드 경로 지원

### 3. 모델 라우팅이 실제 제품 약속만큼 강하지 않음

현재 라우팅은 UI에서 바꿀 수 있지만, 실제 실행 계층에서는 제한적이다.

문제:

- task type에 따른 실제 모델 선택 로직이 약함
- agent별 기본 실행 명령은 고정
- UI는 `routing.json` 수정이 강력한 기능처럼 보이지만 실제 반영 폭이 좁음

상품화 관점 리스크:

- 사용자가 “왜 모델을 바꿨는데 결과가 달라지지 않지?”를 느낄 수 있음
- 라우팅 기능에 대한 신뢰가 떨어짐

수정 방향:

- `task type -> model id -> cli invocation` 흐름을 엔진 하나에서 관리
- CLI가 model 선택 옵션을 지원하면 실제로 전달
- CLI가 model 선택을 지원하지 않으면 UI 문구를 `권장 모델` 수준으로 낮춤

권장 구현:

- `config/models.json` 또는 `.trio/models.json`에 `provider`, `agent`, `cliArgs` 구조 정의
- `resolveAgent()`와 `resolveModelId()`를 분리하지 말고 `resolveExecutionTarget()`로 합침
- 결과 JSON에 `requestedModel`과 `actualModel`을 모두 기록

### 4. task 제어 모델이 상품 수준으로 정리되지 않음

현재 UI는 task 단위 제어처럼 보이지만 실제 내부 동작은 agent 단위, workflow 단위로 섞여 있다.

문제:

- cancel/approve/reassign의 의미가 UI와 구현에서 다를 수 있음
- task 단위 재시도와 부분 재실행 흐름이 아직 약함

상품화 관점 리스크:

- 사용자가 조작 결과를 예측하기 어렵다
- “실행 관리 도구”의 기본 신뢰가 떨어진다

수정 방향:

- `taskId`를 1급 식별자로 승격
- 프로세스 관리도 task 기준으로 통일
- workflow cancel과 task cancel을 분리

권장 구현:

- `.trio/process-index.json`
- `activeProcs: Map<taskId, childProcess>`
- `/api/command`에서 `workflow` 레벨 명령과 `task` 레벨 명령을 분리

### 5. 설정 스키마가 일관되지 않음

예산, timeout, workflow 설정 키가 읽는 쪽과 저장하는 쪽에서 다르다.

문제:

- `session_limit`을 읽으면서 저장은 `max_turns_session`으로 함
- `timeout_seconds`와 `timeout_minutes`가 혼재

상품화 관점 리스크:

- 저장 버튼이 눌려도 실제 실행엔 반영되지 않는 상황이 생김
- 사용자가 제품을 못 믿게 됨

수정 방향:

- 설정 스키마를 하나로 통일
- 읽기/쓰기 모두 단일 validator를 거치게 함

권장 구현:

- `config/schema-budget.json` 또는 Node validator 함수
- v1 스키마 예시:

```json
{
  "workflow": {
    "plan": {
      "research": false,
      "architecture": true,
      "scaffold": true
    },
    "execute": {
      "implementation": true,
      "code-review": true,
      "documentation": true
    }
  },
  "timeout_seconds": 120,
  "session_limit": 5,
  "daily_limit": 20,
  "warn_at": 0.8
}
```

### 6. 보안과 권한 경계가 약함

브라우저에서 설치, 로그인, 실행, 키 저장까지 다루는 만큼 로컬 서버 권한 경계가 중요하다.

문제:

- 인증 없는 local HTTP API
- API key 저장과 명령 실행이 가까이 붙어 있음
- 결과 파일 접근 경로 검증이 약함

상품화 관점 리스크:

- 로컬 앱이지만 보안 신뢰도가 낮아짐
- 회사 환경이나 보수적인 사용자층에서 채택이 어려워짐

수정 방향:

- 세션 토큰 또는 로컬 nonce 추가
- 민감 엔드포인트는 CSRF 비슷한 방어 추가
- 파일 경로는 whitelist 방식으로 제한

권장 구현:

- 서버 시작 시 임시 세션 토큰 생성
- 브라우저는 최초 HTML 로드 시 토큰을 주입받고 이후 POST에 포함
- `/api/result/:taskId`는 `taskId`를 정규식으로 검증

### 7. README와 실제 지원 범위가 맞아야 함

지금은 문서가 제품 기대치를 올리는 편이다.

문제:

- `Node.js만 있으면 됨`처럼 읽히는 표현
- 라우팅, 비용, 다중 agent 관제가 다 완성된 것처럼 보이는 표현

수정 방향:

- 지원 범위 명확화
- 알파 단계 표시
- 실제 검증된 플랫폼과 미검증 플랫폼을 구분

## 실제 상품화를 위한 우선순위 수정안

### P0. 판매 전 반드시 끝내야 하는 것

예상 기간: 1~2주

1. Node 단일 런타임으로 실행 경로 통합
2. 브라우저 Setup 흐름을 Windows/macOS/Linux에서 동일하게 동작하게 정리
3. 승인 모드의 context handoff 구현
4. 설정 스키마 통일
5. PID 및 프로세스 lifecycle 정리

완료 기준:

- `npx llmtrio` 후 Setup, Login, Start, Stop이 주요 OS에서 동작
- 승인 후 execute 결과 품질이 auto mode와 큰 차이 없이 유지
- 설정 변경이 실제 실행에 반영됨

### P1. 알파를 베타로 끌어올리는 것

예상 기간: 1주

1. 결과물 비교와 최종 선택 기능
2. 실패 task만 재실행
3. workflow 템플릿
4. repo-aware 정보 표시

완료 기준:

- 병렬 실행 결과를 사람이 쉽게 비교하고 선택 가능
- 하나 실패했다고 전체를 다시 돌리지 않아도 됨
- 개발자가 실제 프로젝트에 붙여서 반복 사용 가능

### P2. 상품 차별화를 만드는 것

예상 기간: 1~2주

1. Git 변경 요약과 diff 기반 비교
2. 승인 코멘트 기반 재실행
3. 팀용 공유 preset
4. 간단한 session restore

## 추가하면 좋은 핵심 기능

### 1. 결과물 비교와 최종 선택

이건 실제 상품성을 크게 올린다.

개념:

- 같은 요청을 여러 agent가 수행
- 각 결과를 같은 포맷으로 비교
- 사용자가 하나를 채택하거나 조합

화면 구조 제안:

- 상단: workflow prompt
- 중단: agent별 결과 카드
- 각 카드: 요약, 에러, 소요 시간, 모델, 변경 파일, diff, 원문 output
- 하단 액션:
  - `이 결과 채택`
  - `이 결과를 베이스로 다시 실행`
  - `A+B 비교`
  - `최종 요약 생성`

필요 구현:

- 결과 JSON에 `summary`, `filesTouched`, `diffSnippet`, `riskNotes` 필드 추가
- 승인 단계와 별도로 `selection` 상태 저장
- `.trio/final-selection.json` 생성

### 2. Repo-aware 실행

현재는 프롬프트 중심이다. 상품이 되려면 실제 저장소 문맥을 알아야 한다.

추가 요소:

- 현재 git branch
- 변경된 파일
- 최근 커밋
- uncommitted changes 감지
- 실행 대상 폴더 선택

필요 구현:

- `git status --porcelain`
- `git diff --stat`
- `git branch --show-current`
- dashboard에 현재 repo 상태 표시

### 3. Doctor / Environment Check

브라우저 설치 UX를 살리려면 첫 진입이 강해야 한다.

추가 요소:

- Node 버전 확인
- npm 설치 가능 여부
- CLI 설치 여부
- 로그인 여부
- write permission 확인
- 브라우저 열기 가능 여부

권장 UX:

- Setup 첫 화면에서 `Ready`, `Needs install`, `Needs login`, `Unsupported shell` 표시
- 한 번에 수정 가능한 액션 버튼 제공

### 4. 부분 재실행과 Resume

실전에서 중요하다.

필요 기능:

- 실패 task만 재실행
- 마지막 workflow 재개
- 승인 대기 상태 복구

저장 파일 제안:

- `.trio/last-workflow.json`
- `.trio/workflow-context.json`
- `.trio/selections.json`

## 보완하면 좋은 기능

- 결과 복사 외에 diff 복사
- agent별 raw output 토글
- 실행 로그 다운로드
- prompt template 저장
- 자주 쓰는 routing preset
- 프로젝트별 설정 프로필

## v1에서 권장하지 않는 기능

다음은 상품 초기 버전에서 우선순위를 낮추는 것이 좋다.

- debate 모드 확대
- 복잡한 drag-and-drop board
- 실시간 비용 계산
- 자동 최신 모델 추천
- agent 간 자동 병합

이 기능들은 재미있지만, 제품의 첫 구매 이유가 되지는 않는다.

## 권장 제품 구조

가장 좋은 구조는 다음과 같다.

### CLI Core

- workflow 실행
- task orchestration
- 상태 저장
- 결과 저장
- repo context 수집

### Local Backend

- browser dashboard 제공
- setup / install / login API
- 실행 제어 API
- 결과 조회 API

### Browser Dashboard

- setup
- workflow 시작
- approval
- 결과 비교
- 최종 선택

즉, 제품 포지셔닝은 여전히 맞다.

`CLI 기반 AI 코딩 로컬 오케스트레이터`가 본체이고,  
브라우저는 `설치 + 관제 + 승인 + 비교` 경험을 담당해야 한다.

## 4주 상품화 로드맵 제안

### 1주차

- Node 단일 런타임 통합
- command watcher 제거
- platform detection 정리
- 설정 스키마 통일

### 2주차

- approval context handoff 구현
- PID/lifecycle 정리
- Windows/macOS/Linux smoke test
- README 정리

### 3주차

- 결과물 비교 화면 구현
- 부분 재실행 구현
- repo-aware 정보 표시

### 4주차

- doctor 화면
- selection persistence
- 템플릿과 preset
- 알파 사용자 테스트

## 출시 전 체크리스트

- `npx llmtrio` 기준으로 첫 실행이 주요 OS에서 동작
- Setup 화면에서 실제 설치/로그인 흐름이 동작
- 승인 모드가 실질적인 품질 향상을 제공
- 설정 변경이 실제 실행과 일치
- 결과 비교 후 채택이 가능
- README가 실제 기능만 약속

## 최종 결론

상품성은 있다.  
하지만 성공 조건은 분명하다.

- 브라우저 Setup 경험은 유지할 것
- 엔진과 UI의 약속을 맞출 것
- 복잡한 기능보다 신뢰도를 먼저 확보할 것
- `설치 -> 실행 -> 승인 -> 비교 -> 선택` 흐름을 제품의 중심으로 둘 것

이 프로젝트는 `많은 기능을 가진 데모`보다  
`로컬에서 믿고 쓰는 AI 코딩 워크플로 도구`로 갈 때 훨씬 더 상품성이 높다.
