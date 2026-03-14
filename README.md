<p align="center">
  <h1 align="center">🐙 LLMTrio</h1>
  <p align="center">
    <strong>Multi-LLM Orchestration Tool</strong><br>
    Claude · Codex · Gemini — 3개 AI를 병렬로 돌려서 하나의 결과를 만든다.
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/llmtrio"><img src="https://img.shields.io/npm/v/llmtrio?color=blue&label=npm" alt="npm"></a>
    <img src="https://img.shields.io/badge/dependencies-0-green" alt="zero deps">
    <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="node 18+">
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT"></a>
  </p>
</p>

---

## Why LLMTrio?

각 LLM에는 강점이 있다. Claude는 깊이 생각하고, Codex는 빠르게 코드를 쓰고, Gemini는 폭넓게 조사한다. LLMTrio는 하나의 프롬프트를 태스크로 분해하고, 각 태스크를 최적의 모델에 라우팅해서 **병렬 실행**한다.

Each LLM has strengths. Claude reasons deeply. Codex writes fast code. Gemini researches broadly. LLMTrio breaks a single prompt into tasks, routes each to the best model, and runs them **in parallel**.

> 프롬프트 하나 넣으면, 3개 AI가 동시에 일한 결과물이 나온다.

<!-- 스크린샷이 있으면 여기에 추가 -->
<!-- ![Dashboard Screenshot](docs/screenshot.png) -->

---

## Quick Start

```bash
# npx로 바로 실행
npx llmtrio

# 또는 클론해서 실행
git clone https://github.com/jee599/LLMTrio.git
cd LLMTrio
./trio
```

브라우저에서 대시보드가 열린다. CLI 설치, 인증, 워크플로우 실행까지 전부 UI에서 가능하다.

---

## How It Works

```
프롬프트 입력: "REST API with auth 만들어줘"
                    ↓
          ┌─────────────────────┐
          │   LLMTrio Engine    │
          └─────────────────────┘
                    ↓
    ┌───── 📐 Plan (병렬) ─────┐
    │                           │
    │  Claude 🟠     Codex 🔵  │
    │  architecture   scaffold  │
    └───────────────────────────┘
                    ↓
    ┌──── ⚡ Execute (병렬) ────┐
    │                           │
    │  Codex 🔵   Claude 🟠   Gemini 🟢  │
    │  implement  review     docs      │
    └───────────────────────────┘
                    ↓
          ✨ AI 요약 결과 출력
```

### 2-Phase 워크플로우

| Phase | 태스크 | 에이전트 | 설명 |
|-------|--------|----------|------|
| **Plan** | architecture | Claude | 구조 설계, 파일 구성, 컴포넌트 관계 |
| | scaffold | Codex | 프로젝트 골격 코드 생성 |
| **Execute** | implementation | Codex | 핵심 코드 구현 |
| | code-review | Claude | 버그, 보안, 개선점 리뷰 |
| | documentation | Gemini | README, 사용법 문서 작성 |

Plan이 끝나야 Execute로 넘어간다. 같은 Phase 안에서는 **병렬 실행**된다. Plan에서 하나라도 실패하면 Execute는 실행하지 않는다.

---

## Default Model Routing

| Task | Agent | Model |
|------|-------|-------|
| Architecture | Claude 🟠 | `claude-opus-4.6` |
| Code Review | Claude 🟠 | `claude-opus-4.6` |
| Implementation | Codex 🔵 | `gpt-5.4-codex` |
| Scaffold / Testing | Codex 🔵 | `gpt-5.4-codex` |
| Research | Gemini 🟢 | `gemini-3.1-pro` |
| Documentation | Gemini 🟢 | `gemini-3.1-pro` |

현재 에이전트 할당은 고정이며, 각 CLI의 기본 모델이 사용된다. `.trio/routing.json`에 기록되지만 CLI에 특정 모델을 지정하지는 않는다 (구독 기반 모델 사용).

---

## Dashboard

대시보드는 `http://localhost:3333`에서 실행된다. 탭 구성:

### 🔄 Flow — 워크플로우 흐름도
Phase별로 태스크가 어떤 에이전트에서 병렬 실행되는지 실시간으로 보여준다. 노드 클릭 시 상세 결과 패널. 완료 시 애니메이션.

### 📄 Results — 최종 결과
모든 태스크 output을 합쳐서 한 화면에 보여준다. Gemini가 AI 요약을 자동 생성한다. 원본 출력은 접기로 확인 가능.

### ⚙️ Setup — 설정
CLI 설치/인증, 워크플로우 설정 (어떤 태스크를 켜고 끌지).

### 🔔 알림
워크플로우 완료 시 브리핑 팝업이 뜬다. 결과 요약, 실패 태스크 안내, 다음 액션 버튼 제공.

---

## CLI Commands

```bash
./trio                          # 대시보드 열기 (기본)
./trio start "프롬프트"          # 풀 워크플로우 실행
./trio task claude "프롬프트"    # 단일 에이전트 태스크 실행
./trio task codex "프롬프트"     # Codex로 단일 태스크
./trio task gemini "프롬프트"    # Gemini로 단일 태스크
./trio login                    # CLI 인증 상태 확인 & 로그인
./trio status                   # 현재 워크플로우 상태 조회
./trio stop                     # 모든 프로세스 중지
./trio dashboard stop           # 대시보드 서버 중지
```

### Examples

```bash
# 한국어 프롬프트 → 한국어로 결과 출력
./trio start "할일 목록 CLI 앱을 만들어줘"

# 영어 프롬프트 → 영어로 결과 출력
./trio start "Build a REST API with JWT auth"

# Claude에게만 코드 리뷰 요청
./trio task claude "이 프로젝트의 보안 취약점을 찾아줘"

# Gemini에게만 리서치 요청
./trio task gemini "2026년 최신 AI 모델 동향을 조사해줘"
```

---

## Configuration

### 워크플로우 설정 (`.trio/budget.json`)

어떤 태스크를 실행할지 ON/OFF:

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
  }
}
```

`research`는 기본 OFF. Setup 탭에서 "최신 모델 확인" 버튼으로 수동 실행 가능.

### 언어 자동 감지

프롬프트에 한국어가 포함되면 에이전트가 한국어로 응답한다. 영어 프롬프트는 영어 응답. 대시보드 UI도 한/영 전환 지원.

---

## Architecture

```
┌──────────────────────────────────────────┐
│          Browser (dashboard.html)         │
│  Flow · Results · Tasks · Setup          │
└────────────────┬─────────────────────────┘
                 │ SSE + HTTP
┌────────────────┴─────────────────────────┐
│     Dashboard Server (localhost:3333)     │
│     dashboard-server.js (Node.js)        │
└────────────────┬─────────────────────────┘
                 │ spawn + fs.watch
┌────────────────┴─────────────────────────┐
│        Octopus Core Engine               │
│        octopus-core.js                   │
│                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │claude -p│ │codex    │ │gemini -p│   │
│  │         │ │exec     │ │         │   │
│  └─────────┘ └─────────┘ └─────────┘   │
└──────────────────────────────────────────┘
                 │
        .trio/ (JSON files)
        ├── state.json      ← 워크플로우 상태
        ├── routing.json    ← 모델 라우팅
        ├── budget.json     ← 워크플로우 설정
        └── results/        ← 태스크별 결과
```

### 설계 원칙

- **Zero dependencies** — Node.js 내장 모듈만 사용. npm install 불필요.
- **No build step** — 프론트엔드는 단일 HTML 파일. 번들러 없음.
- **No database** — `.trio/` 디렉토리의 JSON 파일이 전부.
- **Subscription auth** — API 키 불필요. 각 CLI의 구독 인증 사용.
- **Resilient** — 대시보드를 닫았다 열어도 상태 유지.

---

## Project Structure

```
LLMTrio/
├── trio                        # CLI 엔트리포인트 (bash)
├── package.json                # npx 지원
├── bin/
│   └── llmtrio.js              # npx llmtrio 엔트리
├── scripts/
│   ├── octopus-core.js         # 멀티 에이전트 오케스트레이션 엔진
│   ├── dashboard-server.js     # HTTP + SSE 서버
│   ├── dashboard.html          # 프론트엔드 (단일 파일)
│   ├── command-watcher.sh      # 커맨드 큐 프로세서
│   └── model-checker.sh        # 모델 업데이트 체커
├── config/
│   ├── default-routing.json    # 기본 라우팅 설정
│   └── default-budget.json     # 기본 워크플로우 설정
└── .trio/                      # 런타임 데이터 (gitignored)
    ├── state.json
    ├── routing.json
    ├── budget.json
    └── results/
```

---

## Requirements

- **Node.js** v18+
- **플랫폼**: macOS, Linux (Windows는 WSL 권장)
- **AI CLI 도구**: 최소 1개 이상 설치 + 인증 필요

```bash
# CLI 설치 (대시보드 Setup 탭에서도 가능)
npm install -g @anthropic-ai/claude-code   # Claude
npm install -g @openai/codex               # Codex
npm install -g @google/gemini-cli          # Gemini
```

각 CLI는 구독 인증(OAuth) 또는 API 키가 필요하다.

---

## Status

현재 **알파** 단계. 핵심 워크플로우(plan→execute 병렬 실행)는 동작하지만, 일부 기능은 개발 중이다.

## Roadmap

- [ ] 결과물 비교 + 선택 기능
- [ ] 실패 task만 재실행
- [ ] Git branch 자동 생성 / PR 연동
- [ ] 플러그인 시스템

---

## License

MIT
