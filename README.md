<p align="center">
  <h1 align="center">LLMTrio</h1>
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

각 LLM에는 강점이 있다. Claude는 깊이 생각하고, Codex는 빠르게 코드를 쓰고, Gemini는 폭넓게 조사한다. LLMTrio는 하나의 프롬프트를 태스크로 분해하고, 각 태스크를 최적의 에이전트에 할당해서 **병렬 실행**한다.

Each LLM has strengths. Claude reasons deeply. Codex writes fast code. Gemini researches broadly. LLMTrio breaks a single prompt into tasks, assigns each to the best agent, and runs them **in parallel**.

> 프롬프트 하나 넣으면, 3개 AI가 동시에 일한 결과물이 나온다.

---

## Quick Start

```bash
# npx로 바로 실행 (권장)
npx llmtrio

# 또는 클론해서 실행 (Unix shell only: macOS, Linux)
git clone https://github.com/jee599/LLMTrio.git
cd LLMTrio
./trio
```

### Windows

Windows에서는 WSL(Windows Subsystem for Linux) 사용을 권장한다.

```bash
# WSL 내에서
npx llmtrio
```

브라우저에서 대시보드가 열린다. CLI 설치, 인증, 워크플로우 실행까지 전부 UI에서 가능하다.

---

## Features

- **Flow Diagram** — Phase별 태스크 흐름을 실시간으로 보여준다. 완료 시 애니메이션.
- **Results Panel** — 모든 태스크 output을 합쳐서 Gemini가 AI 요약을 자동 생성한다.
- **Comparison View** — 에이전트별 결과를 나란히 비교한다.
- **Retry Failed Tasks** — 실패한 태스크만 골라서 재실행한다.
- **Approval Mode / Auto Mode** — Plan 결과를 검토 후 승인하거나, 자동으로 Execute까지 실행한다.
- **Setup** — CLI 설치 + 인증을 대시보드에서 원클릭으로 처리한다.
- **Session Security** — 세션 토큰 기반으로 write API를 보호한다.

---

## How It Works

```
프롬프트 입력: "REST API with auth 만들어줘"
                    ↓
          ┌─────────────────────┐
          │   LLMTrio Engine    │
          └─────────────────────┘
                    ↓
    ┌───── Plan Phase (병렬) ────┐
    │                            │
    │  Claude    Codex   Gemini  │
    │  설계      스캐폴드  리서치 │
    └────────────────────────────┘
              ↓ (승인 게이트)
    ┌──── Execute Phase (병렬) ──┐
    │                            │
    │  Codex    Claude   Gemini  │
    │  구현     코드리뷰  문서화  │
    └────────────────────────────┘
                    ↓
          AI 요약 결과 출력
```

### 2-Phase 워크플로우

| Phase | 태스크 | 에이전트 | 설명 |
|-------|--------|----------|------|
| **Plan** | architecture | Claude | 구조 설계, 파일 구성, 컴포넌트 관계 |
| | scaffold | Codex | 프로젝트 골격 코드 생성 |
| | research | Gemini | 요구사항 분석 및 기술 조사 (기본 OFF) |
| **Execute** | implementation | Codex | 핵심 코드 구현 |
| | code-review | Claude | 버그, 보안, 개선점 리뷰 |
| | documentation | Gemini | README, 사용법 문서 작성 |

Plan이 끝나면 승인 게이트에서 결과를 검토한다. 승인하면 Execute로 넘어간다. 같은 Phase 안에서는 **병렬 실행**된다.

---

## Agent Assignment

각 태스크 유형은 특정 에이전트에 할당된다. `.trio/routing.json`에 기록되며, 실제 모델은 각 CLI의 구독 설정에 따라 결정된다.

| Task | Agent | 설명 |
|------|-------|------|
| Architecture | Claude | 구조 설계 |
| Code Review | Claude | 버그/보안 검토 |
| Implementation | Codex | 코드 작성 |
| Scaffold | Codex | 프로젝트 골격 생성 |
| Research | Gemini | 기술 리서치 |
| Documentation | Gemini | 문서 작성 |

---

## Dashboard

대시보드는 `http://localhost:3333`에서 실행된다. 탭 구성:

### Flow — 워크플로우 흐름도
Phase별로 태스크가 어떤 에이전트에서 병렬 실행되는지 실시간으로 보여준다. 노드 클릭 시 상세 결과 패널. 완료 시 애니메이션.

### Results — 최종 결과
모든 태스크 output을 합쳐서 한 화면에 보여준다. Gemini가 AI 요약을 자동 생성한다. 원본 출력은 접기로 확인 가능. 에이전트별 비교 뷰 지원.

### Setup — 설정
CLI 설치/인증, 워크플로우 설정 (어떤 태스크를 켜고 끌지), 에이전트 할당 확인.

### 알림
워크플로우 완료 시 브리핑 팝업이 뜬다. 결과 요약, 실패 태스크 안내, 다음 액션 버튼 제공.

---

## CLI Commands

```bash
npx llmtrio                         # 대시보드 열기 (기본)
npx llmtrio start "프롬프트"         # 풀 워크플로우 실행
npx llmtrio task claude "프롬프트"   # 단일 에이전트 태스크 실행
npx llmtrio task codex "프롬프트"    # Codex로 단일 태스크
npx llmtrio task gemini "프롬프트"   # Gemini로 단일 태스크
npx llmtrio login                   # CLI 인증 상태 확인
npx llmtrio status                  # 현재 워크플로우 상태 조회
npx llmtrio stop                    # 모든 프로세스 중지
```

Unix shell에서는 `./trio` 로도 실행 가능하다 (macOS, Linux only).

### Examples

```bash
# 한국어 프롬프트 → 한국어로 결과 출력
npx llmtrio start "할일 목록 CLI 앱을 만들어줘"

# 영어 프롬프트 → 영어로 결과 출력
npx llmtrio start "Build a REST API with JWT auth"

# Claude에게만 코드 리뷰 요청
npx llmtrio task claude "이 프로젝트의 보안 취약점을 찾아줘"

# Gemini에게만 리서치 요청
npx llmtrio task gemini "2026년 최신 AI 모델 동향을 조사해줘"
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

`research`는 기본 OFF. Setup 탭에서 토글 가능.

### 언어 자동 감지

프롬프트에 한국어가 포함되면 에이전트가 한국어로 응답한다. 영어 프롬프트는 영어 응답. 대시보드 UI도 한/영/중/일 전환 지원.

---

## Architecture

```
┌──────────────────────────────────────────┐
│          Browser (dashboard.html)         │
│  Flow · Results · Setup                  │
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
        ├── routing.json    ← 에이전트 할당
        ├── budget.json     ← 워크플로우 설정
        └── results/        ← 태스크별 결과
```

### 설계 원칙

- **Zero dependencies** — Node.js 내장 모듈만 사용. npm install 불필요.
- **No build step** — 프론트엔드는 HTML + CSS + JS. 번들러 없음.
- **No database** — `.trio/` 디렉토리의 JSON 파일이 전부.
- **Subscription auth** — API 키 불필요. 각 CLI의 구독 인증 사용.
- **Resilient** — 대시보드를 닫았다 열어도 상태 유지.

---

## Project Structure

```
LLMTrio/
├── trio                        # CLI 엔트리포인트 (bash, Unix only)
├── package.json                # npx 지원
├── bin/
│   └── llmtrio.js              # npx llmtrio 엔트리
├── scripts/
│   ├── octopus-core.js         # 멀티 에이전트 오케스트레이션 엔진
│   ├── dashboard-server.js     # HTTP + SSE 서버
│   ├── dashboard.html          # 프론트엔드 HTML
│   ├── dashboard.css           # 스타일시트
│   ├── dashboard.js            # 프론트엔드 로직
│   └── lib/
│       └── auth.js             # CLI 인증 체크 공유 모듈
├── config/
│   ├── default-routing.json    # 기본 에이전트 할당 설정
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

## Roadmap

- [ ] Git branch 자동 생성 / PR 연동
- [ ] 플러그인 시스템

---

## License

MIT
