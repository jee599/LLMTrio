# GPT Feedback for LLMTrio

기준 시점: 2026-03-14 19:18 KST  
분석 기준 커밋: `22e1834` (`fix: security, cross-platform, output limits, honest README`)

## 총평

최신 버전의 `LLMTrio`는 이전보다 훨씬 나아졌다.  
지금은 "기획이 앞서는 데모" 단계는 넘었고, `좋은 알파` 또는 `베타 직전`에 가깝다.

냉정하게 말하면:

- 상품성은 있다.
- 방향도 맞다.
- 지금 바로 유료 제품으로 팔기에는 아직 이르다.
- 이제 필요한 것은 기능 추가보다 `핵심 신뢰성 정리`다.

가장 적절한 포지셔닝은 여전히 이것이다.

`CLI 기반 AI 코딩 로컬 오케스트레이터 + 브라우저 Setup / Approval / Results UI`

## 현재 점수

- 포지셔닝: 8.5 / 10
- 제품 구조의 일관성: 7.5 / 10
- 실행 신뢰도: 6.5 / 10
- 크로스플랫폼 준비도: 6 / 10
- 유료화 준비도: 6.5 / 10

한 줄로 요약하면:

`팔릴 수 있는 아이디어`는 이미 갖췄다.  
하지만 `돈 받고 써도 되는 안정성`은 아직 완성되지 않았다.

## 이번 최신 버전에서 실제로 좋아진 점

이번 최신 커밋은 이전 피드백을 상당 부분 반영했다. 이건 명확히 긍정적이다.

### 1. 죽은 기능을 걷어냈다

좋은 결정이다.

- Debate 제거
- 가짜 비용 / 예산 UI 축소
- display-only 모델 관리 UI 축소
- README 과장 문구 일부 제거

이 덕분에 제품이 "있어 보이기 위한 기능 묶음"에서 "실제로 동작하는 흐름" 쪽으로 이동했다.

### 2. 문서가 더 솔직해졌다

README가 전보다 현실과 가까워졌다.

- 라우팅이 실제 CLI 모델 선택이 아니라는 점을 명시
- Tasks / Kanban 설명 제거
- Debate 로드맵 제거
- 알파 상태 명시
- 플랫폼 요구사항 명시

이건 신뢰도에 중요하다.

### 3. 보안 리스크 하나를 실제로 줄였다

`/api/result/:taskId`에 task ID 검증이 추가됐다.

- path traversal 위험 감소
- 최소한의 입력 검증 시작

작지만 의미 있는 개선이다.

### 4. Windows 대응이 일부 개선됐다

이전보다 확실히 좋아졌다.

- `bin/llmtrio.js login`이 더 이상 `bash`에 직접 의존하지 않음
- CLI 탐지에서 Windows는 `where` 사용
- 브라우저 열기에서 Windows는 `start` 사용

실제로 `node bin\llmtrio.js login`은 이제 동작한다.

### 5. 출력 저장 한도가 개선됐다

결과 저장 한도가 4000자에서 16000자로 늘고, truncation 표시도 들어갔다.

이건 결과 비교 기능을 나중에 붙일 때도 도움이 된다.

### 6. plan summary 저장 방향은 맞다

`plan-summary.json`을 도입한 것은 정확한 방향이다.  
Approval mode에서 필요한 핵심 자산은 바로 이 `중간 산출물의 명시적 저장`이다.

## 냉정한 결론

이번 버전은 "무엇을 버려야 하는지"를 이해하기 시작한 버전이다.  
이건 제품화에 매우 중요하다.

하지만 아직 `P0`가 끝난 것은 아니다.

지금 시점에서 해야 할 일은:

- 새로운 기능을 더 넣는 것
- 더 화려한 UI를 붙이는 것
- 더 많은 탭을 만드는 것

이 아니다.

지금 해야 할 일은:

- 현재 약속한 핵심 흐름이 정말 끝까지 맞게 동작하는지
- Windows / macOS / Linux에서 같은 기대를 줄 수 있는지
- Approval / Setup / Stop / Retry가 믿을 수 있는지

이 세 가지를 마무리하는 것이다.

## 반드시 더 수정해야 하는 것

아래는 `상품화 전 필수 수정사항`이다.

### P0-1. plan -> execute context handoff가 의도대로 아직 동작하지 않는다

이건 현재 가장 중요한 문제다.

겉으로는 `plan-summary.json`이 추가되었지만, 실제 코드 순서상 `execute` 단계 프롬프트를 만들기 전에 이 컨텍스트를 주입하지 못하고 있다.

현재 구조:

- `runWorkflow()` 시작 시 `prevPhaseOutputs = ''`
- Approval mode에서는 `--phase execute`로 재시작
- `execute` phase의 task prompt를 만들 때 `prevPhaseOutputs`가 비어 있음
- 그 뒤에야 `plan-summary.json`을 읽어 `prevPhaseOutputs`를 채움

즉, 컨텍스트를 `읽긴 읽는데 너무 늦게 읽는다`.

이 문제는 제품 핵심을 직접 훼손한다.

- Approval mode의 품질이 auto mode보다 떨어질 수 있다
- 사용자는 "왜 plan을 승인했는데 execute가 plan을 안 본 것 같지?"를 느낀다
- 제품의 가장 중요한 차별점이 약해진다

수정 방향:

- `onlyPhase === 'execute'`인 경우 loop 전에 `plan-summary.json`을 먼저 읽어 `prevPhaseOutputs`를 채운다
- 또는 phase loop 안에서 `execute` task를 생성하기 전에 context를 주입한다

권장 구현:

```js
let prevPhaseOutputs = '';

if (onlyPhase === 'execute') {
  const planSummary = readJson(path.join(TRIO_DIR, 'plan-summary.json'));
  if (planSummary) {
    prevPhaseOutputs = Object.entries(planSummary)
      .filter(([_, v]) => v.status === 'done' && v.output)
      .map(([name, v]) => `[${name}]: ${v.output.slice(-2000)}`)
      .join('\n\n');
  }
}
```

추가 권장:

- approval 시 사용자 코멘트도 `.trio/workflow-context.json`에 저장
- execute prompt에 plan summary + approval note를 같이 주입

관련 파일:

- `scripts/octopus-core.js`
- `scripts/dashboard-server.js`

### P0-2. Windows에서 CLI 설치가 아직 깨진다

이건 실제 검증 결과가 있다.

현재 `dashboard-server.js`는 CLI 설치 시 다음처럼 동작한다.

- `spawn('npm', ['install', '-g', packageName])`

하지만 Windows에서는 이 호출이 `ENOENT`로 실패한다.  
실제로 이 환경에서 `spawn('npm', ['--version'])`도 실패했다.

즉, Setup 탭의 핵심 UX 중 하나가 Windows에서 아직 완성되지 않았다.

이 문제는 상품화에 치명적이다.

- 브라우저에서 설치된다고 해놓고 실제로는 안 된다
- Setup UX를 강점으로 내세울 수 없다

수정 방향:

- Windows에서는 `npm.cmd`를 직접 호출
- 또는 `cmd /c npm ...` 패턴으로 실행

권장 구현:

```js
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const proc = spawn(npmCmd, ['install', '-g', packageName], ...);
```

대안:

```js
const proc = process.platform === 'win32'
  ? spawn('cmd', ['/c', 'npm', 'install', '-g', packageName], ...)
  : spawn('npm', ['install', '-g', packageName], ...);
```

관련 파일:

- `scripts/dashboard-server.js`

### P0-3. PID 저장 방식이 아직 잘못됐다

현재 PID 파일은 `writeJsonAtomic()`으로 저장된다.  
즉 JSON 문자열 형식으로 저장될 가능성이 높다.

반면 읽는 쪽은 `parseInt(fs.readFileSync(...))`를 사용한다.

이건 구조적으로 잘못된 조합이다.

가능한 문제:

- PID를 제대로 읽지 못함
- `stop`이 실패함
- 오래된 프로세스가 남음
- 포트 충돌이 생김

이 문제는 크로스플랫폼 이슈와 결합하면 더 위험해진다.

수정 방향:

- PID 파일은 JSON이 아니라 plain text 숫자만 저장
- PID read / write helper를 따로 만든다

권장 구현:

```js
function writePidFile(file, pid) {
  fs.writeFileSync(file + '.tmp', String(pid), 'utf8');
  fs.renameSync(file + '.tmp', file);
}

function readPidFile(file) {
  return parseInt(fs.readFileSync(file, 'utf8').trim(), 10);
}
```

관련 파일:

- `scripts/octopus-core.js`
- `scripts/dashboard-server.js`
- `bin/llmtrio.js`
- `trio`

### P0-4. command queue는 거의 죽은 상태인데 코드와 파일은 남아 있다

이건 구조 debt다.

현재 상태:

- `command-watcher.sh`는 사실상 빠졌다
- 그런데 `/api/command`는 여전히 `pending.json`에 append 한다
- `sendPrompt()` 같은 함수는 여전히 queue 기반이다
- single-agent prompt UI도 일부 남아 있다

즉, `command queue`가 제품의 핵심 구조가 아니게 되었는데 아직 코드에는 남아 있다.

이 문제는 당장 앱을 터뜨리진 않더라도 제품 신뢰도와 유지보수성을 깎는다.

부작용:

- pending.json이 의미 없이 쌓일 수 있다
- 어떤 명령은 즉시 처리되고 어떤 명령은 파일에만 쌓인다
- 코드 읽는 사람도 동작 경로를 헷갈린다

수정 방향:

- `pending.json` 기반 큐를 완전히 제거하거나
- 정말 필요하다면 Node worker로 정식 복원한다

권장 판단:

- v1에서는 제거하는 것이 낫다
- `/api/command`는 직접 처리 가능한 명령만 받게 단순화한다

권장 정리:

- `commands/` 런타임 큐 삭제
- `appendToPending()` 제거
- single-agent prompt는 `/api/run-agent`로 직접 연결하거나 UI에서 제거

관련 파일:

- `scripts/dashboard-server.js`
- `scripts/dashboard.html`
- `commands/`

### P0-5. 브라우저 권한 경계는 아직 약하다

taskId 검증은 좋아졌지만, 전체 보안 모델은 여전히 약하다.

현재는 다음 엔드포인트들이 로컬에서 직접 중요한 작업을 수행한다.

- `/api/save-key`
- `/api/install-cli`
- `/api/cli-login`
- `/api/run-agent`

이 구조는 로컬 앱 알파에서는 허용 가능하지만, 상품화 관점에서는 최소한의 세션 보호가 필요하다.

위험:

- 로컬 브라우저 세션을 믿는 구조가 너무 단순하다
- 향후 팀 환경이나 기업 환경에서 신뢰를 얻기 어렵다

수정 방향:

- 서버 시작 시 임시 세션 토큰 생성
- HTML 렌더 시 토큰 주입
- 민감 POST 요청은 토큰 검사

추가 권장:

- setup 관련 명령은 explicit confirm step 추가
- key 저장 시 provider별 validation 추가

관련 파일:

- `scripts/dashboard-server.js`
- `scripts/dashboard.html`

## 중요하지만 P0 다음에 처리해도 되는 것

### P1-1. 라우팅은 아직 "표시용에 가까운 설정"이다

README는 이제 더 솔직해졌지만, 제품 기능 자체는 아직 약하다.

현재 라우팅은:

- task type -> agent 매핑에 가깝다
- 실제 CLI별 모델 선택 옵션을 강제하지 않는다

즉, `routing.json`은 "오케스트레이션 설정"이지 "모델 선택기"가 아니다.

이건 당장 막아야 할 버그는 아니지만, 앞으로 상품 설명과 맞추려면 다음 중 하나를 택해야 한다.

- 이 기능을 agent routing으로 명확히 재정의
- 각 CLI가 지원하는 model 옵션까지 실제로 연결

v1 권장:

- 이름을 `routing`보다 `agent assignment`에 가깝게 표현
- UI에서도 "실제 모델 강제 선택"처럼 보이지 않게 유지

### P1-2. 인증 상태 판정이 완전히 일관되지는 않다

예를 들어:

- `bin/llmtrio.js login`은 간단한 환경변수/파일 기준
- `dashboard-server.js`도 유사하지만 세부 기준은 다르다

이런 차이는 나중에 사용자를 헷갈리게 만든다.

수정 방향:

- `checkAuthStatus()` 로직을 공용 모듈로 분리
- CLI / dashboard / doctor가 같은 기준을 사용

### P1-3. README는 좋아졌지만 아직 완전히 정리되지는 않았다

좋아진 건 맞다. 하지만 아직 shell script와 WSL 의존, clone-and-run 경로에 대한 설명이 더 명확해질 필요가 있다.

필요한 보완:

- `npx llmtrio`를 메인 실행 경로로 올리기
- `./trio`는 Unix shell 경로라고 분명히 쓰기
- Windows native 지원과 WSL 권장을 구분해서 쓰기

### P1-4. dashboard.html에 정리되지 않은 흔적이 아직 많다

최신 버전에서도 cost, model, first-run overlay 관련 잔여 구조가 보인다.

이건 치명적 버그는 아니지만:

- 코드가 불필요하게 크다
- 나중에 기능을 다시 오해하게 만든다
- UI 상태 관리가 복잡해진다

권장:

- 실제 쓰는 탭과 실제 쓰는 상태만 남긴다
- 사용하지 않는 번역 키도 정리한다

## 지금 추가하면 좋은 기능

아래 기능은 P0를 정리한 다음부터 진짜 상품성을 올린다.

### 1. 결과물 비교와 최종 선택

이건 가장 중요한 차기 기능이다.

목표:

- 여러 agent 결과를 같은 포맷으로 비교
- 사람이 하나를 선택
- 선택 결과를 다음 액션에 연결

필요 요소:

- 결과 카드 비교
- 요약 / diff / 위험요소 / 실행 시간 표시
- `이 결과 채택`
- `이 결과를 기준으로 재실행`

이 기능이 들어가야 "오케스트레이터"의 의미가 강해진다.

### 2. 실패 task만 재실행

실무 사용성을 크게 높인다.

현재는 workflow 단위 사고방식이 강하다.  
상품이 되려면 `부분 복구`가 가능해야 한다.

필요 요소:

- task 상태 기준 재실행
- 이전 성공 결과 재사용
- 실패 원인과 재실행 옵션 표시

### 3. repo-aware context

지금은 prompt 중심이 강하다.  
상품이 되려면 repository 문맥을 더 이해해야 한다.

추가 추천:

- 현재 branch 표시
- modified files 표시
- git diff stat 표시
- clean / dirty 상태 표시

### 4. doctor / environment check

Setup를 강점으로 가져가려면 이 기능이 꼭 필요하다.

필요 요소:

- Node 버전
- npm install 가능 여부
- CLI 설치 여부
- 로그인 상태
- write permission
- 브라우저 열기 가능 여부

이건 초반 사용자 이탈을 줄이는 데 효과가 크다.

## 지금은 넣지 않는 게 좋은 기능

아래는 지금 다시 넣으면 오히려 흐름이 흐려질 가능성이 크다.

- Debate
- 복잡한 Kanban
- 실시간 비용 계산
- 최신 모델 자동 조사
- 자동 병합

지금은 `작고 강한 제품`으로 가는 게 맞다.

## 권장 제품 구조

### CLI Core

- workflow 실행
- task orchestration
- 상태 저장
- 결과 저장
- repo context 수집

### Local Backend

- setup / install / login
- workflow 제어
- 결과 조회
- approval / retry / selection API

### Browser Dashboard

- Setup
- Run
- Approval
- Results
- Compare / Select

이 구조는 지금 포지셔닝과 잘 맞는다.

## 구현 우선순위

### 1주차

- execute context handoff 수정
- Windows npm install 경로 수정
- PID 파일 저장 방식 수정
- pending queue 제거

### 2주차

- local session token 추가
- auth 상태 체크 공용화
- README / launcher 정리
- dashboard dead code 정리

### 3주차

- 결과 비교 UI
- 실패 task 재실행
- result selection 저장

### 4주차

- repo-aware context
- doctor 화면
- preset / workflow template
- 알파 사용자 테스트

## 출시 판단

현재 버전은 다음 용도로는 충분하다.

- 데모
- 알파 테스터 모집
- 초기 사용자 인터뷰
- 기술 방향 검증

하지만 아직 아래 상태는 아니다.

- 유료 팀 도구
- 신뢰성 있는 daily driver
- 기업용 설치형 툴

유료화 전 최소 조건:

- Approval mode 품질이 실제로 일관적일 것
- Windows Setup이 정말 동작할 것
- Start / Stop / Retry가 믿을 수 있을 것
- 결과 비교와 선택이 가능할 것

## 최종 결론

최신 버전의 평가는 분명히 좋아졌다.

- 방향은 맞다
- 핵심 가치도 보인다
- 문서도 더 솔직해졌다
- 죽은 기능을 걷어낸 판단도 좋다

하지만 아직 냉정하게 말하면 `정리 중인 알파`다.

지금 가장 중요한 원칙은 하나다.

`더 많은 기능을 만들기보다, 이미 약속한 핵심 흐름을 진짜 믿을 수 있게 만드는 것`

이 원칙만 지키면 `LLMTrio`는 충분히 상품이 될 수 있다.  
이 원칙을 놓치면 다시 "멋져 보이지만 끝까지 믿기 어려운 도구"로 돌아갈 가능성이 높다.
