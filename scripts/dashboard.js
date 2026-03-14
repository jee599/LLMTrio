(function () {
  'use strict';

  // ── Pop-out mode detection ──
  const urlParams = new URLSearchParams(window.location.search);
  const popoutMode = urlParams.get('popout'); // 'task' | 'agent' | null
  const popoutId = urlParams.get('id');
  const isPopout = !!popoutMode;

  // ── State ──
  const state = {
    agents: {
      claude: { status: 'pending', task: '', elapsed: 0, cost: 0, output: '', file: '', startedAt: null, model: '' },
      codex:  { status: 'pending', task: '', elapsed: 0, cost: 0, output: '', file: '', startedAt: null, model: '' },
      gemini: { status: 'pending', task: '', elapsed: 0, cost: 0, output: '', file: '', startedAt: null, model: '' },
    },
    cost: { total: 0, claude: 0, codex: 0, gemini: 0, budget: 5.0, opusCalls: 0 },
    phase: 'discover',
    sseConnected: false,
  };

  const i18n = {
    en: {
      waiting: 'Waiting for response...',
      task: 'Task',
      elapsed: 'Elapsed',
      cost: 'Cost',
      output: 'Output',
      pending: 'Pending',
      working: 'Working',
      done: 'Done',
      error: 'Error',
      cancelled: 'Cancelled',
      totalCost: 'Total Cost',
      budget: 'Budget',
      opusCalls: 'Opus Calls',
      sendTo: (agent) => `Send to ${agent}...`,
      send: 'Send',

      debateEmpty: 'No debate started yet.',
      consensus: 'Consensus',
      taskBoard: 'Task Board',
      models: 'Models',
      flow: 'Flow',
      debate: 'Debate',
      pendingCol: 'Pending',
      workingCol: 'In Progress',
      doneCol: 'Done',
      routing: 'Task Routing',
      budgetControls: 'Budget Limits',
      sessionLimit: 'Session Limit',
      dailyLimit: 'Daily Limit',
      opusLimit: 'Opus Call Limit',
      save: 'Save',
      noModels: 'No model data. Run model-checker.sh.',
      loadingModels: 'Loading models...',
      newModelDetected: 'New model detected',
      firstRunTitle: 'LLMTrio First Run Setup',
      firstRunDesc: 'Gemini searched for the latest AI coding models. Review the settings below.',
      confirm: 'Confirm',
      edit: 'Edit',
      dashboardStopped: 'Dashboard stopped.',
      input: 'Input',
      userPrompt: 'User Prompt',
      merge: 'Merge',
      resultIntegration: 'Result Integration',
      fileBus: 'File System (Message Bus)',
      architecture: 'Architecture',
      implementation: 'Implementation',
      testing: 'Testing',
      research: 'Research',
      codeReview: 'Code Review',
      documentation: 'Documentation',
      addOpinion: 'Add your opinion to the debate...',
      rejectReason: 'Enter rejection reason:',
      approve: 'Approve',
      reject: 'Reject',
    },
    ko: {
      waiting: '응답 대기 중...',
      task: '작업',
      elapsed: '경과시간',
      cost: '비용',
      output: '출력',
      pending: '대기',
      working: '작업중',
      done: '완료',
      error: '오류',
      cancelled: '취소',
      totalCost: '총 비용',
      budget: '예산',
      opusCalls: 'Opus 호출',
      sendTo: (agent) => `${agent}에게 지시...`,
      send: '전송',

      debateEmpty: '토론이 시작되지 않았습니다.',
      consensus: '합의도',
      taskBoard: '태스크 보드',
      models: '모델 관리',
      flow: '흐름도',
      debate: '토론',
      pendingCol: '대기',
      workingCol: '진행중',
      doneCol: '완료',
      routing: '작업별 모델 라우팅',
      budgetControls: '비용 한도 설정',
      sessionLimit: '세션 한도',
      dailyLimit: '일일 한도',
      opusLimit: 'Opus 호출 제한',
      save: '저장',
      noModels: '모델 정보가 없습니다. model-checker.sh 실행 필요.',
      loadingModels: '모델 정보를 불러오는 중...',
      newModelDetected: '새 모델이 감지되었습니다',
      firstRunTitle: 'LLMTrio 첫 실행 설정',
      firstRunDesc: 'Gemini가 최신 AI 코딩 모델을 검색했습니다. 아래 설정을 확인하세요.',
      confirm: '이대로 설정',
      edit: '수정',
      dashboardStopped: '대시보드가 종료되었습니다.',
      input: '입력',
      userPrompt: '사용자 프롬프트',
      merge: '병합',
      resultIntegration: '결과 통합',
      fileBus: '파일 시스템 (메시지 버스)',
      architecture: '아키텍처',
      implementation: '구현',
      testing: '테스트',
      research: '리서치',
      codeReview: '코드리뷰',
      documentation: '문서',
      addOpinion: '토론에 의견을 추가...',
      rejectReason: '거절 사유를 입력하세요:',
      approve: '승인',
      reject: '거절',
    },
    zh: {
      waiting: '等待响应中...',
      task: '任务',
      elapsed: '耗时',
      cost: '费用',
      output: '输出',
      pending: '待定',
      working: '运行中',
      done: '完成',
      error: '错误',
      cancelled: '已取消',
      totalCost: '总费用',
      budget: '预算',
      opusCalls: 'Opus 调用',
      sendTo: (agent) => `发送给 ${agent}...`,
      send: '发送',

      debateEmpty: '讨论尚未开始。',
      consensus: '共识度',
      taskBoard: '任务板',
      models: '模型管理',
      flow: '流程图',
      debate: '讨论',
      pendingCol: '待定',
      workingCol: '进行中',
      doneCol: '完成',
      routing: '任务路由',
      budgetControls: '费用限制',
      sessionLimit: '会话限制',
      dailyLimit: '每日限制',
      opusLimit: 'Opus 调用限制',
      save: '保存',
      noModels: '无模型信息。请运行 model-checker.sh。',
      loadingModels: '加载模型信息中...',
      newModelDetected: '检测到新模型',
      firstRunTitle: 'LLMTrio 首次运行设置',
      firstRunDesc: 'Gemini 搜索了最新的 AI 编码模型。请查看以下设置。',
      confirm: '确认',
      edit: '编辑',
      dashboardStopped: '仪表板已停止。',
      input: '输入',
      userPrompt: '用户提示词',
      merge: '合并',
      resultIntegration: '结果整合',
      fileBus: '文件系统 (消息总线)',
      architecture: '架构',
      implementation: '实现',
      testing: '测试',
      research: '研究',
      codeReview: '代码审查',
      documentation: '文档',
      addOpinion: '添加您的意见到讨论...',
      rejectReason: '请输入拒绝原因:',
      approve: '批准',
      reject: '拒绝',
    },
    ja: {
      waiting: '応答待機中...',
      task: 'タスク',
      elapsed: '経過時間',
      cost: 'コスト',
      output: '出力',
      pending: '待機',
      working: '実行中',
      done: '完了',
      error: 'エラー',
      cancelled: 'キャンセル済',
      totalCost: '合計コスト',
      budget: '予算',
      opusCalls: 'Opus 呼出',
      sendTo: (agent) => `${agent}に送信...`,
      send: '送信',

      debateEmpty: 'ディベートはまだ始まっていません。',
      consensus: 'コンセンサス',
      taskBoard: 'タスクボード',
      models: 'モデル管理',
      flow: 'フロー図',
      debate: 'ディベート',
      pendingCol: '待機',
      workingCol: '進行中',
      doneCol: '完了',
      routing: 'タスクルーティング',
      budgetControls: 'コスト制限',
      sessionLimit: 'セッション制限',
      dailyLimit: '日次制限',
      opusLimit: 'Opus 呼出制限',
      save: '保存',
      noModels: 'モデル情報がありません。model-checker.sh を実行してください。',
      loadingModels: 'モデル情報を読み込み中...',
      newModelDetected: '新しいモデルが検出されました',
      firstRunTitle: 'LLMTrio 初回セットアップ',
      firstRunDesc: 'Gemini が最新の AI コーディングモデルを検索しました。以下の設定を確認してください。',
      confirm: '確認',
      edit: '編集',
      dashboardStopped: 'ダッシュボードが停止しました。',
      input: '入力',
      userPrompt: 'ユーザープロンプト',
      merge: 'マージ',
      resultIntegration: '結果統合',
      fileBus: 'ファイルシステム (メッセージバス)',
      architecture: 'アーキテクチャ',
      implementation: '実装',
      testing: 'テスト',
      research: 'リサーチ',
      codeReview: 'コードレビュー',
      documentation: 'ドキュメント',
      addOpinion: 'ディベートに意見を追加...',
      rejectReason: '拒否理由を入力してください:',
      approve: '承認',
      reject: '拒否',
    }
  };

  let lang = localStorage.getItem('llmtrio-lang') || (() => { const nl = (navigator.language || 'en').toLowerCase(); if (nl.startsWith('ko')) return 'ko'; if (nl.startsWith('zh')) return 'zh'; if (nl.startsWith('ja')) return 'ja'; return 'en'; })();
  let t = i18n[lang];
  // Inline string lookup for template literals (covers all lang==='ko' ternaries)
  const _s = {
    en: {
      noTasksYet: 'No tasks yet', enterPrompt: 'Enter a prompt to start a workflow',
      filter: 'Filter...', result: 'View', viewResult: 'View Result', cancel: 'Cancel',
      status: 'Status', type: 'Type', agent: 'Agent', phase: 'Phase',
      elapsedTime: 'Elapsed', errorLabel: 'Error', output: 'Output', loading: 'Loading...',
      noOutput: 'No output', noResultFile: 'No result file', loadFailed: 'Failed to load',
      copied: 'Copied!', copyAll: 'Copy All', copy: 'Copy', complete: 'Complete',
      inProgress: 'In Progress', failed: 'Failed', toDo: 'To Do',
      planPhase: 'Plan', executePhase: 'Execute',
      workflowResults: 'Workflow results will appear here', finalResult: 'Final Result',
      done: 'done', fail: 'fail', refresh: 'Refresh', tasksRunning: 'Tasks running...',
      loadingResults: 'Loading...', startFlow: 'Start a workflow to see the flow diagram',
      prompt: 'Prompt', active: 'active', parallel: 'Parallel', running: 'Running',
      runningDot: 'Running...', collapse: '▲ Collapse', viewFull: '▼ View full',
      loadingDot: 'Loading...', workflow: 'Workflow', briefing: 'Briefing',
      briefingPlaceholder: 'A results briefing will appear here when a workflow completes.',
      workflowBriefing: 'Workflow Briefing', nextAction: 'What would you like to do next?',
      retryFailed: 'Retry Failed Tasks', viewInFlow: 'View in Flow diagram',
      compare: 'Compare', backToResults: 'Back',
      startNewTask: 'Start a new task', dismiss: 'Dismiss',
      summary: 'Summary', taskResults: 'Task Results', issues: 'Issues',
      taskComplete: (prompt, done, total, err, time, tokens) => `Task "${prompt}" is complete. ${done} of ${total} tasks succeeded${err ? `, ${err} failed` : ''}. Took ${time}s${tokens ? `, ~${tokens.toLocaleString()} tokens used` : ''}.`,
      tasksFailed: (n) => `${n} task(s) failed. You can retry the failed tasks or increase the timeout in Settings.`,
      checking: 'Checking...', askingGemini: 'Asking Gemini for latest models...',
      saved: 'Saved!', idle: 'Idle — enter a prompt',
      rejectReason: 'Enter rejection reason',
    },
    ko: {
      noTasksYet: '아직 태스크가 없습니다', enterPrompt: '프롬프트를 입력해서 워크플로우를 시작하세요',
      filter: '필터...', result: '결과', viewResult: '결과 보기', cancel: '취소',
      status: '상태', type: '유형', agent: '에이전트', phase: '페이즈',
      elapsedTime: '경과시간', errorLabel: '오류', output: '출력', loading: '로딩 중...',
      noOutput: '출력 없음', noResultFile: '결과 파일 없음', loadFailed: '로딩 실패',
      copied: '복사됨!', copyAll: '전체 복사', copy: '복사', complete: '완료',
      inProgress: '진행중', failed: '실패', toDo: '대기',
      planPhase: '계획', executePhase: '실행',
      workflowResults: '워크플로우 결과가 여기에 표시됩니다', finalResult: '최종 결과',
      done: '완료', fail: '실패', refresh: '새로고침', tasksRunning: '작업 진행 중...',
      loadingResults: '결과 로딩 중...', startFlow: '워크플로우를 시작하면 흐름도가 표시됩니다',
      prompt: '프롬프트', active: '진행중', parallel: '병렬 실행', running: '진행중',
      runningDot: '진행 중...', collapse: '▲ 접기', viewFull: '▼ 전체 보기',
      loadingDot: '로딩...', workflow: '워크플로우', briefing: '브리핑',
      briefingPlaceholder: '워크플로우가 완료되면 결과 브리핑이 여기에 표시됩니다.',
      workflowBriefing: '워크플로우 결과 브리핑', nextAction: '다음 작업을 선택해 주세요:',
      retryFailed: '실패한 작업 재시도', viewInFlow: '흐름도에서 자세히 보기',
      compare: '비교', backToResults: '돌아가기',
      startNewTask: '새 작업 시작하기', dismiss: '확인',
      summary: '요약', taskResults: '작업별 결과', issues: '주의사항',
      taskComplete: (prompt, done, total, err, time, tokens) => `"${prompt}" 작업이 완료되었습니다. 총 ${total}개 태스크 중 ${done}개 성공${err ? `, ${err}개 실패` : ''}. 소요시간 ${time}초${tokens ? `, ~${tokens.toLocaleString()} 토큰 사용` : ''}.`,
      tasksFailed: (n) => `${n}개 태스크가 실패했습니다. 실패한 작업을 재시도하거나, 설정에서 타임아웃을 늘려보세요.`,
      checking: '확인 중...', askingGemini: 'Gemini에게 최신 모델 정보를 요청 중...',
      saved: '저장됨!', idle: '대기 중 — 프롬프트를 입력하세요',
      rejectReason: '거절 사유를 입력하세요',
    },
    zh: {
      noTasksYet: '暂无任务', enterPrompt: '输入提示词以启动工作流',
      filter: '筛选...', result: '查看', viewResult: '查看结果', cancel: '取消',
      status: '状态', type: '类型', agent: '代理', phase: '阶段',
      elapsedTime: '耗时', errorLabel: '错误', output: '输出', loading: '加载中...',
      noOutput: '无输出', noResultFile: '无结果文件', loadFailed: '加载失败',
      copied: '已复制!', copyAll: '全部复制', copy: '复制', complete: '完成',
      inProgress: '进行中', failed: '失败', toDo: '待办',
      planPhase: '计划', executePhase: '执行',
      workflowResults: '工作流结果将在此显示', finalResult: '最终结果',
      done: '完成', fail: '失败', refresh: '刷新', tasksRunning: '任务进行中...',
      loadingResults: '加载中...', startFlow: '启动工作流以查看流程图',
      prompt: '提示词', active: '进行中', parallel: '并行执行', running: '运行中',
      runningDot: '进行中...', collapse: '▲ 收起', viewFull: '▼ 查看全部',
      loadingDot: '加载中...', workflow: '工作流', briefing: '简报',
      briefingPlaceholder: '工作流完成后将在此显示结果简报。',
      workflowBriefing: '工作流结果简报', nextAction: '请选择下一步操作:',
      retryFailed: '重试失败任务', viewInFlow: '在流程图中查看详情',
      compare: '对比', backToResults: '返回',
      startNewTask: '开始新任务', dismiss: '确认',
      summary: '摘要', taskResults: '任务结果', issues: '注意事项',
      taskComplete: (prompt, done, total, err, time, tokens) => `"${prompt}" 任务已完成。共 ${total} 个任务中 ${done} 个成功${err ? `，${err} 个失败` : ''}。耗时 ${time}秒${tokens ? `，约 ${tokens.toLocaleString()} 令牌` : ''}。`,
      tasksFailed: (n) => `${n} 个任务失败。可以重试失败任务或在设置中增加超时时间。`,
      checking: '检查中...', askingGemini: '正在向 Gemini 查询最新模型信息...',
      saved: '已保存!', idle: '空闲 — 请输入提示词',
      rejectReason: '请输入拒绝原因',
    },
    ja: {
      noTasksYet: 'タスクがありません', enterPrompt: 'プロンプトを入力してワークフローを開始',
      filter: 'フィルター...', result: '表示', viewResult: '結果を見る', cancel: 'キャンセル',
      status: 'ステータス', type: 'タイプ', agent: 'エージェント', phase: 'フェーズ',
      elapsedTime: '経過時間', errorLabel: 'エラー', output: '出力', loading: '読み込み中...',
      noOutput: '出力なし', noResultFile: '結果ファイルなし', loadFailed: '読み込み失敗',
      copied: 'コピー済!', copyAll: '全てコピー', copy: 'コピー', complete: '完了',
      inProgress: '進行中', failed: '失敗', toDo: '待機',
      planPhase: '計画', executePhase: '実行',
      workflowResults: 'ワークフロー結果がここに表示されます', finalResult: '最終結果',
      done: '完了', fail: '失敗', refresh: 'リフレッシュ', tasksRunning: 'タスク実行中...',
      loadingResults: '読み込み中...', startFlow: 'ワークフローを開始するとフロー図が表示されます',
      prompt: 'プロンプト', active: '進行中', parallel: '並列実行', running: '実行中',
      runningDot: '実行中...', collapse: '▲ 閉じる', viewFull: '▼ 全体を見る',
      loadingDot: '読み込み中...', workflow: 'ワークフロー', briefing: 'ブリーフィング',
      briefingPlaceholder: 'ワークフロー完了時に結果ブリーフィングがここに表示されます。',
      workflowBriefing: 'ワークフロー結果ブリーフィング', nextAction: '次のアクションを選択してください:',
      retryFailed: '失敗タスクを再試行', viewInFlow: 'フロー図で詳細を見る',
      compare: '比較', backToResults: '戻る',
      startNewTask: '新しいタスクを開始', dismiss: '閉じる',
      summary: '概要', taskResults: 'タスク別結果', issues: '注意事項',
      taskComplete: (prompt, done, total, err, time, tokens) => `"${prompt}" タスクが完了しました。全 ${total} タスク中 ${done} 件成功${err ? `、${err} 件失敗` : ''}。所要時間 ${time}秒${tokens ? `、約 ${tokens.toLocaleString()} トークン使用` : ''}。`,
      tasksFailed: (n) => `${n} 件のタスクが失敗しました。失敗タスクを再試行するか、設定でタイムアウトを延長してください。`,
      checking: '確認中...', askingGemini: 'Gemini に最新モデル情報を問い合わせ中...',
      saved: '保存済み!', idle: '待機中 — プロンプトを入力してください',
      rejectReason: '拒否理由を入力してください',
    },
  };
  function tt(key) { return (_s[lang] || _s.en)[key] || _s.en[key] || key; }

  // Task name translation
  const _taskNames = {
    en: { architecture: 'Architecture', scaffold: 'Scaffold', research: 'Research', implementation: 'Implementation', 'code-review': 'Code Review', documentation: 'Documentation', 'single-task': 'Single Task' },
    ko: { architecture: '아키텍처', scaffold: '스캐폴드', research: '리서치', implementation: '구현', 'code-review': '코드 리뷰', documentation: '문서화', 'single-task': '단일 작업' },
    zh: { architecture: '架构', scaffold: '脚手架', research: '研究', implementation: '实现', 'code-review': '代码审查', documentation: '文档', 'single-task': '单一任务' },
    ja: { architecture: 'アーキテクチャ', scaffold: 'スキャフォールド', research: 'リサーチ', implementation: '実装', 'code-review': 'コードレビュー', documentation: 'ドキュメント', 'single-task': '単一タスク' },
  };
  function tn(name) { return (_taskNames[lang] || _taskNames.en)[name] || _taskNames.en[name] || name; }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (t[key]) el.textContent = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (typeof t[key] === 'function') el.placeholder = t[key](el.dataset.agent || '');
      else if (t[key]) el.placeholder = t[key];
    });
    document.documentElement.lang = lang;
    const sel = $('langSelect');
    if (sel) sel.value = lang;
  }

  window.setLanguage = function(l) {
    lang = l;
    t = i18n[lang] || i18n.en;
    localStorage.setItem('llmtrio-lang', lang);
    applyI18n();
    renderActiveTab();
  };

  const STATUS_LABELS = {
    pending: t.pending,
    working: t.working,
    done: t.done,
    error: t.error,
    cancelled: t.cancelled,
  };





  // ── DOM refs ──
  const $ = (id) => document.getElementById(id);

  // ── Throttled render via rAF ──
  let renderQueued = false;
  function getActiveTab() {
    const active = document.querySelector('.main-tab.active');
    return active ? active.dataset.tab : 'results';
  }

  function renderActiveTab() {
    const tab = getActiveTab();
    if (tab === 'flow') renderFlowDiagram();
    if (tab === 'results') renderResultsPanel();
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  // ── Render ──
  function render() {
    if (isPopout) return; // pop-out mode: skip main render (TODO)
    for (const agent of ['claude', 'codex', 'gemini']) {
      const a = state.agents[agent];

      // Card state class
      const card = $(`card-${agent}`);
      if (!card) continue;
      card.classList.remove('is-working', 'is-done', 'is-error');
      if (a.status === 'working') card.classList.add('is-working');
      else if (a.status === 'done') card.classList.add('is-done');
      else if (a.status === 'error') card.classList.add('is-error');

      // Progress bar
      const prog = $(`progress-${agent}`);
      if (prog) {
        prog.className = 'agent-progress-fill' + (a.status === 'done' ? ' done' : a.status === 'error' ? ' error' : '');
        if (a.status === 'working') {
          const elapsed = a.elapsed || ((a.startedAt ? (Date.now() - a.startedAt) / 1000 : 0));
          prog.style.width = Math.min(95, elapsed * 2) + '%';
        } else if (a.status === 'done') {
          prog.style.width = '100%';
        } else if (a.status === 'error') {
          prog.style.width = '100%';
        }
      }

      // Model display
      const modelEl = $(`model-${agent}`);
      if (modelEl) modelEl.textContent = a.model ? formatModel(a.model) : '—';

      // Status badge
      const badge = $(`status-${agent}`);
      if (badge) {
        badge.className = `status-badge ${a.status}`;
        badge.textContent = STATUS_LABELS[a.status] || a.status;
      }

      // Current task bar
      const taskBar = $(`current-task-${agent}`);
      if (taskBar) {
        if (a.task && a.status === 'working') {
          taskBar.style.display = 'flex';
          const taskEl = $(`task-${agent}`);
          if (taskEl) taskEl.textContent = a.task;
        } else {
          taskBar.style.display = a.task ? 'flex' : 'none';
          const taskEl = $(`task-${agent}`);
          if (taskEl) taskEl.textContent = a.task || '—';
        }
      }

      // Meta
      const fileEl = $(`file-${agent}`);
      if (fileEl) fileEl.textContent = a.file || '—';

      // Output (auto-scroll)
      const outputEl = $(`output-${agent}`);
      if (outputEl) {
        const wasAtBottom = outputEl.scrollTop + outputEl.clientHeight >= outputEl.scrollHeight - 4;
        outputEl.textContent = a.output || t.waiting;
        if (wasAtBottom) {
          outputEl.scrollTop = outputEl.scrollHeight;
        }
      }

      // Flow diagram — handled by renderFlowDiagram()
    }

    // Cost meter
    // Update bottom bar agent status dots
    ['claude', 'codex', 'gemini'].forEach(name => {
      const dot = $('statusDot' + name.charAt(0).toUpperCase() + name.slice(1));
      if (dot) {
        const s = state.agents[name].status;
        dot.textContent = s === 'pending' ? 'idle' : s;
        dot.style.color = s === 'working' ? 'var(--accent-blue)' : s === 'done' ? 'var(--accent-green)' : s === 'error' ? 'var(--accent-red)' : 'var(--text-muted)';
      }
    });

    // Workflow phase badge
    const phaseBadge = $('workflowPhaseBadge');
    if (phaseBadge) {
      if (state.phase && state.phase !== 'discover') {
        phaseBadge.style.display = 'inline-block';
        if (state.phase === 'complete') {
          phaseBadge.textContent = '✓ Complete';
          phaseBadge.style.background = 'rgba(52,211,153,0.15)';
          phaseBadge.style.color = 'var(--accent-green)';
          phaseBadge.style.borderColor = 'rgba(52,211,153,0.3)';
        } else if (state.phase === 'awaiting-approval') {
          phaseBadge.textContent = '⏸ Awaiting Approval';
          phaseBadge.style.background = 'rgba(245,215,110,0.15)';
          phaseBadge.style.color = 'var(--accent-yellow)';
          phaseBadge.style.borderColor = 'rgba(245,215,110,0.3)';
        } else {
          phaseBadge.textContent = state.phase;
          phaseBadge.style.background = 'rgba(91,141,239,0.15)';
          phaseBadge.style.color = 'var(--accent-blue)';
          phaseBadge.style.borderColor = 'rgba(91,141,239,0.3)';
        }
      } else if (state.workflowTasks && state.workflowTasks.length > 0) {
        phaseBadge.style.display = 'inline-block';
        phaseBadge.textContent = 'plan';
      } else {
        phaseBadge.style.display = 'none';
      }
    }

    // Sync workflow tasks to local tasks array
    if (state.workflowTasks && state.workflowTasks.length > 0) {
      tasks = state.workflowTasks;
    }

    // SSE indicator
    const ind = $('sseIndicator');
    ind.className = 'sse-indicator' + (state.sseConnected ? ' connected' : '');
  }


  function formatCost(val) {
    return '$' + (val || 0).toFixed(3);
  }

  function formatTokens(val) {
    if (!val) return '0';
    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
    return val.toString();
  }

  // ── Elapsed time ticker ──
  function tickElapsed() {
    const now = Date.now();
    let anyWorking = false;
    let earliest = Infinity;
    for (const agent of ['claude', 'codex', 'gemini']) {
      const a = state.agents[agent];
      const elapsedEl = $(`elapsed-${agent}`);
      if (!elapsedEl) continue;
      if (a.status === 'working' && a.startedAt) {
        anyWorking = true;
        if (a.startedAt < earliest) earliest = a.startedAt;
        const secs = (now - a.startedAt) / 1000 + (a.totalElapsed || 0);
        elapsedEl.textContent = formatElapsed(secs);
      } else if (a.status === 'done' || a.status === 'error') {
        elapsedEl.textContent = formatElapsed(a.totalElapsed || a.elapsed || 0);
      } else {
        elapsedEl.textContent = '0.0s';
      }
    }
    // Update bottom bar elapsed
    const el = $('elapsedTime');
    if (el) {
      if (anyWorking) {
        const totalSecs = Math.floor((now - earliest) / 1000);
        const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const ss = String(totalSecs % 60).padStart(2, '0');
        el.textContent = mm + ':' + ss;
        el.style.color = 'var(--accent-blue)';
      } else {
        el.style.color = 'var(--text-secondary)';
      }
    }
    requestAnimationFrame(tickElapsed);
  }

  function formatElapsed(secs) {
    if (secs < 60) return secs.toFixed(1) + 's';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m + 'm ' + s + 's';
  }

  function formatModel(model) {
    if (!model) return '';
    // "claude-opus-4.6" → "claude opus 4.6"
    // "claude-sonnet-4-6" → "claude sonnet 4.6"
    // "gpt-5.4-codex" → "codex 5.4"
    // "gemini-3.1-pro" → "gemini 3.1 pro"
    const m = model.toLowerCase();
    if (m.includes('codex') || m.includes('gpt')) {
      const ver = m.match(/(\d+[\.\d]*)/);
      return 'codex' + (ver ? ' ' + ver[1] : '');
    }
    if (m.includes('claude')) {
      const variant = m.includes('opus') ? 'opus' : m.includes('sonnet') ? 'sonnet' : m.includes('haiku') ? 'haiku' : '';
      const ver = m.match(/(\d+[\.\-]\d+)/);
      const verStr = ver ? ver[1].replace('-', '.') : '';
      return 'claude' + (variant ? ' ' + variant : '') + (verStr ? ' ' + verStr : '');
    }
    if (m.includes('gemini')) {
      const ver = m.match(/(\d+[\.\d]*)/);
      const variant = m.includes('pro') ? 'pro' : m.includes('flash') ? 'flash' : '';
      return 'gemini' + (ver ? ' ' + ver[1] : '') + (variant ? ' ' + variant : '');
    }
    return model;
  }

  // ── Clock ──
  function tickClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const clockEl = $('topbarClock');
    if (clockEl) clockEl.textContent = hh + ':' + mm + ':' + ss;
  }

  // ── Update functions ──
  function updateAgentCard(agent, data) {
    const a = state.agents[agent];
    if (!a) return;

    let statusChanged = false;
    if (data.status !== undefined && data.status !== a.status) {
      statusChanged = true;
      if (data.status === 'working' && a.status !== 'working') {
        a.startedAt = Date.now();
      }
      if (data.status !== 'working' && a.status === 'working' && a.startedAt) {
        a.elapsed = (Date.now() - a.startedAt) / 1000;
        $(`elapsed-${agent}`).textContent = formatElapsed(a.elapsed);
        a.startedAt = null;
      }
      a.status = data.status;
    }
    if (data.task !== undefined) a.task = data.task;
    if (data.cost !== undefined) a.cost = data.cost;
    if (data.output !== undefined) a.output = data.output;
    if (data.outputAppend !== undefined) a.output += data.outputAppend;
    if (data.file !== undefined) a.file = data.file;
    if (data.elapsed !== undefined) {
      a.elapsed = data.elapsed;
      $(`elapsed-${agent}`).textContent = formatElapsed(data.elapsed);
    }

    queueRender();
  }

  function updateCostMeter(data) {
    if (data.total !== undefined) state.cost.total = data.total;
    if (data.claude !== undefined) state.cost.claude = data.claude;
    if (data.codex !== undefined) state.cost.codex = data.codex;
    if (data.gemini !== undefined) state.cost.gemini = data.gemini;
    if (data.budget !== undefined) state.cost.budget = data.budget;
    if (data.opusCalls !== undefined) state.cost.opusCalls = data.opusCalls;

    queueRender();
  }

  function applyFullState(fullState) {
    // Set workflow ID on initial load
    if (fullState.workflowId) _currentWorkflowId = fullState.workflowId;
    if (fullState.phase) state.phase = fullState.phase;
    if (fullState.prompt) state.workflowPrompt = fullState.prompt;
    if (fullState.tasks) {
      syncTasksToAgents(fullState.tasks);
    }
    // Update prompt preview if workflow is active
    if (fullState.prompt) {
      const preview = $('promptPreviewText');
      if (preview) {
        preview.textContent = fullState.prompt;
        preview.style.color = 'var(--text-primary)';
      }
    }
    // Show approval widget if page loads in awaiting-approval state
    if (fullState.phase === 'awaiting-approval') {
      showApprovalWidget();
    }
    // Reset briefing on idle/new workflow
    if (fullState.phase === 'idle' || (fullState.phase === 'plan' && fullState.phaseProgress === 0)) {
      briefingData = null;
      briefingUnread = false;
      const badge = $('notifBadge');
      if (badge) badge.classList.remove('show');
    }
    queueRender();
  }

  // ── SSE ──
  let eventSource = null;
  let reconnectTimer = null;

  function connectSSE() {
    if (!window.EventSource) {
      console.error('EventSource not supported by this browser');
      const el = $('statusSummaryText');
      if (el) el.textContent = 'Error: Your browser does not support Server-Sent Events. Please use a modern browser.';
      return;
    }
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource('/events');

    eventSource.onopen = () => {
      state.sseConnected = true;
      queueRender();
    };

    eventSource.addEventListener('agent-update', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!data || !data.agent) return;
        updateAgentCard(data.agent, data);
        // Sync result data back to tasks array so flow/results stay in sync
        if (data.taskId && tasks.length > 0) {
          const task = tasks.find(t => t.id === data.taskId);
          if (task) {
            if (data.status && data.status !== task.status) task.status = data.status;
            if (data.elapsed) task.elapsed = data.elapsed;
            if (data.tokens) task.tokens = data.tokens;
            // Update workflowTasks reference too
            state.workflowTasks = tasks;
            renderActiveTab();
          }
        }
        // If we have agent data but no tasks, fetch full state to populate
        if (tasks.length === 0 && data.status) {
          fetchFullState();
        }
      } catch (err) {
        console.error('agent-update parse error:', err);
      }
    });

    eventSource.addEventListener('cost-update', (e) => {
      try {
        updateCostMeter(JSON.parse(e.data));
      } catch (err) {
        console.error('cost-update parse error:', err);
      }
    });

    eventSource.addEventListener('state-update', (e) => {
      try {
        const data = JSON.parse(e.data);

        // Skip state updates from old workflows
        if (data.workflowId && _currentWorkflowId && data.workflowId !== _currentWorkflowId) {
          return;
        }
        // Track current workflow ID
        if (data.workflowId) _currentWorkflowId = data.workflowId;

        if (data.phase) state.phase = data.phase;
        if (data.prompt) state.workflowPrompt = data.prompt;

        // Sync tasks through single handler
        if (data.tasks && Array.isArray(data.tasks)) {
          syncTasksToAgents(data.tasks);
        }

        // Approval gate: show approval widget
        if (data.phase === 'awaiting-approval') {
          showApprovalWidget();
        }

        // On complete, finalize working agents
        if (data.phase === 'complete') {
          ['claude', 'codex', 'gemini'].forEach(name => {
            const a = state.agents[name];
            if (a.status === 'working') { a.status = 'done'; a.startedAt = null; }
          });
        }

        queueRender();
        renderActiveTab();
      } catch (err) {
        console.error('state-update parse error:', err);
      }
    });

    eventSource.addEventListener('workflow-log', (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[workflow]', data.message);
        // Show workflow log in agent output panels
        const match = data.message.match(/\[(\w+)\]\s*(.*)/);
        if (match) {
          const agent = match[1];
          if (state.agents[agent]) {
            state.agents[agent].output += data.message + '\n';
            queueRender();
          }
        }
      } catch {}
    });

    eventSource.addEventListener('workflow-done', () => {
      console.log('[workflow] complete');
      state.phase = 'complete';
      _workflowStartedLocally = false;
      // Fetch final state to ensure everything is synced
      fetchFullState();
      queueRender();
      // Generate briefing and auto-open
      setTimeout(async () => {
        await generateBriefing();
        openBriefing();
      }, 800);
    });

    eventSource.onerror = () => {
      state.sseConnected = false;
      queueRender();
      eventSource.close();
      eventSource = null;

      // Reconnect with backoff
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        connectSSE();
        fetchFullState();
      }, 3000);
    };
  }

  function fetchFullState() {
    fetch('/api/state', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('state fetch failed');
        return res.json();
      })
      .then((data) => applyFullState(data))
      .catch(err => { console.error('fetch error:', err); });
  }

  // ── Phase 2: Command API ──
  function postCommand(cmd) {
    return fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    }).then(r => r.json());
  }

  // Expand/collapse bottom-bar prompt
  window.expandPrompt = function() {
    const expanded = $('promptExpanded');
    const preview = $('promptPreview');
    expanded.style.display = 'block';
    preview.style.display = 'none';
    setTimeout(() => $('mainPromptInput').focus(), 50);
  };

  window.collapsePrompt = function() {
    const expanded = $('promptExpanded');
    const preview = $('promptPreview');
    expanded.style.display = 'none';
    preview.style.display = 'flex';
  };

  let _workflowStartedLocally = false;
  let _currentWorkflowId = null;
  let _workflowMode = localStorage.getItem('llmtrio-mode') || 'approval'; // 'approval' or 'auto'

  window.setWorkflowMode = function(mode) {
    _workflowMode = mode;
    localStorage.setItem('llmtrio-mode', mode);
    const approvalBtn = $('modeApproval');
    const autoBtn = $('modeAuto');
    if (mode === 'approval') {
      approvalBtn.style.background = 'var(--accent-blue)';
      approvalBtn.style.color = '#fff';
      autoBtn.style.background = 'transparent';
      autoBtn.style.color = 'var(--text-muted)';
    } else {
      autoBtn.style.background = 'var(--accent-blue)';
      autoBtn.style.color = '#fff';
      approvalBtn.style.background = 'transparent';
      approvalBtn.style.color = 'var(--text-muted)';
    }
  };

  window.startWorkflow = function() {
    const input = $('mainPromptInput');
    const text = input.value.trim();
    if (!text) return;
    _workflowStartedLocally = true;
    _currentWorkflowId = null; // will be set from first state-update
    // Reset previous briefing and tasks immediately
    briefingData = null;
    briefingUnread = false;
    tasks = [];
    state.workflowTasks = [];
    state.phase = 'plan';
    state.phaseProgress = 0;
    state.sessionTokens = 0;
    state.workflowPrompt = text;
    resultsSummaryLoaded = false;
    flowSelectedTaskId = null;
    // Clear animation tracking
    Object.keys(flowPrevStatuses).forEach(k => delete flowPrevStatuses[k]);
    // Clear results panel content
    const rsc = document.getElementById('resultsSummaryContent');
    if (rsc) rsc.innerHTML = '';
    // Reset agent states
    ['claude', 'codex', 'gemini'].forEach(name => {
      Object.assign(state.agents[name], { status: 'pending', task: '', elapsed: 0, cost: 0, output: '', file: '', startedAt: null, model: '', totalElapsed: 0 });
    });
    const badge = $('notifBadge');
    if (badge) badge.classList.remove('show');
    // Close briefing modal if open
    const modal = document.querySelector('.briefing-overlay');
    if (modal) modal.remove();
    queueRender();

    const btn = $('startWorkflowBtn');
    const status = $('workflowStatus');
    btn.disabled = true;
    btn.textContent = 'Starting...';
    status.textContent = '';
    // Send as workflow start command
    fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'prompt', content: text, workflow: true, autoMode: _workflowMode === 'auto' }),
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        status.textContent = 'Workflow started!';
        status.style.color = 'var(--accent-green)';
        input.value = '';
        // Update preview text and collapse
        $('promptPreviewText').textContent = text;
        $('promptPreviewText').style.color = 'var(--text-primary)';
        setTimeout(() => collapsePrompt(), 800);
        // Switch to Flow tab — agent states will update via SSE from octopus-core
        switchTab('flow');
      } else {
        status.textContent = data.error || 'Failed';
        status.style.color = 'var(--accent-red)';
      }
      btn.disabled = false;
      btn.textContent = '▶ Start';
    })
    .catch(() => {
      status.textContent = 'Network error';
      status.style.color = 'var(--accent-red)';
      btn.disabled = false;
      btn.textContent = '▶ Start';
    });
  };

  window.sendPrompt = function(agent) {
    const input = $('prompt-' + agent);
    const text = input.value.trim();
    if (!text) return;
    postCommand({ type: 'prompt', target: agent, content: text });
    input.value = '';
  };

  window.sendCmd = function(type, agent) {
    postCommand({ type: type, target: agent });
  };

  // ── Phase 2: Tab Switching ──
  window.switchTab = function(tabId) {
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    const tabEl = document.querySelector(`.main-tab[data-tab="${tabId}"]`);
    if (tabEl) tabEl.classList.add('active');
    const contentEl = $('tab-' + tabId);
    if (contentEl) contentEl.classList.add('active');
    // Close flow detail when switching tabs
    if (tabId !== 'flow') {
      flowSelectedTaskId = null;
      const fd = document.getElementById('flowDetail');
      if (fd) fd.classList.remove('open');
    }
    // Flow tab: fullscreen mode (hide left panel)
    const app = document.getElementById('app');
    if (tabId === 'flow') {
      app.classList.add('flow-fullscreen');
      renderFlowDiagram();
    } else {
      app.classList.remove('flow-fullscreen');
    }
    if (tabId === 'results') renderResultsPanel();
  };


  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Task tracking ──
  let tasks = [];

  const PHASE_META = {
    plan:    { num: 1, label: 'Plan',    ko: '계획', zh: '计划', ja: '計画', tasks: ['research', 'architecture', 'scaffold'] },
    execute: { num: 2, label: 'Execute', ko: '실행', zh: '执行', ja: '実行', tasks: ['implementation', 'code-review', 'documentation'] },
  };

  function getPhaseForTask(nameOrTask) {
    if (typeof nameOrTask === 'object' && nameOrTask.phase) return nameOrTask.phase;
    const name = typeof nameOrTask === 'string' ? nameOrTask : nameOrTask?.name;
    for (const [p, m] of Object.entries(PHASE_META)) { if (m.tasks.includes(name)) return p; }
    return null;
  }

  // Kanban board removed — renderTaskBoard, openDetail, closeDetail,
  // kbDragStart, kbDragEnd, kbDrop, kbSearch, kbSetGroup are no longer needed.

  // ── Results Tab ──
  const expandedResults = new Set();

  let resultsSummaryLoaded = false;

  function renderResultsPanel() {
    const panel = $('resultsPanel');
    // Only show tasks that have actually run (not pending)
    const ranTasks = tasks.filter(t => t.status === 'done' || t.status === 'error' || t.status === 'working');
    if (!ranTasks.length) {
      panel.innerHTML = `<div class="results-empty">
        <div style="font-size:32px;opacity:0.3;">📄</div>
        <div>${tt('workflowResults')}</div>
      </div>`;
      resultsSummaryLoaded = false;
      return;
    }
    const doneCount = ranTasks.filter(t => t.status === 'done').length;
    const errCount = ranTasks.filter(t => t.status === 'error').length;
    const workingCount = ranTasks.filter(t => t.status === 'working').length;
    const totalTokens = ranTasks.reduce((s, t) => s + (t.tokens || 0), 0);
    const totalTime = ranTasks.reduce((s, t) => s + (t.elapsed || 0), 0);

    let html = `<div class="results-header">
      <span class="results-header-title">${tt('finalResult')}</span>
      <span class="results-header-info">${doneCount}/${ranTasks.length} ${tt('done')}${errCount ? ` · ${errCount} ${tt('fail')}` : ''}${workingCount ? ` · ${workingCount} ${tt('running')}` : ''} · ${formatElapsed(totalTime)}${totalTokens ? ` · ~${totalTokens.toLocaleString()} tok` : ''}</span>
      ${doneCount > 0 ? `<button class="results-header-refresh" onclick="renderComparisonView()">${tt('compare')}</button>` : ''}
      ${errCount > 0 && workingCount === 0 ? `<button class="results-header-refresh" onclick="retryFailedTasks()" style="color:var(--accent-red);border-color:rgba(239,83,80,0.4);">${tt('retryFailed')}</button>` : ''}
      <button class="results-header-refresh" onclick="resultsSummaryLoaded=false;renderResultsPanel()">${tt('refresh')}</button>
    </div>
    <div id="resultsSummaryBox" style="flex:1;overflow-y:auto;padding:20px 24px;">
      <div id="resultsSummaryContent" style="font-size:13px;line-height:1.8;color:var(--text-primary);">
        ${workingCount > 0
          ? `<div style="color:var(--text-muted);">${tt('tasksRunning')}</div>`
          : `<div style="color:var(--text-muted);">${tt('loadingResults')}</div>`}
      </div>
    </div>`;
    panel.innerHTML = html;
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';

    if (doneCount > 0) loadResultsSummary();
  }

  async function loadResultsSummary() {
    const allTasks = tasks.filter(t => t.status === 'done' || t.status === 'error');
    if (!allTasks.length) return;

    const results = {};
    await Promise.all(allTasks.map(async (t) => {
      try {
        const res = await fetch('/api/result/' + t.id, { cache: 'no-store' });
        if (res.ok) results[t.id] = await res.json();
      } catch {}
    }));

    const el = document.getElementById('resultsSummaryContent');
    if (!el) return;

    // Merge all outputs into one continuous text
    let merged = '';
    for (const t of allTasks) {
      const r = results[t.id];
      const output = (r?.output || '').trim();
      if (!output) continue;
      merged += output + '\n\n';
    }
    merged = merged.trim();

    // Errors section
    const errTasks = allTasks.filter(t => t.status === 'error');
    let errHtml = '';
    if (errTasks.length) {
      errHtml = `<div style="margin-bottom:16px;padding:10px 14px;background:rgba(239,83,80,0.08);border:1px solid rgba(239,83,80,0.2);border-radius:8px;color:var(--accent-red);font-size:12px;">
        <strong>${tt('failed')}:</strong> ${errTasks.map(t => tn(t.name)).join(', ')}
      </div>`;
    }

    // Stats line
    const _modelsLabel = { en: 'Models', ko: '모델', zh: '模型', ja: 'モデル' };
    const _timeLabel = { en: 'Time', ko: '소요', zh: '耗时', ja: '所要時間' };
    const totalTime = allTasks.reduce((s, t) => s + (t.elapsed || 0), 0);
    const totalTokens = allTasks.reduce((s, t) => s + (t.tokens || 0), 0);
    const models = [...new Set(allTasks.map(t => t.model ? formatModel(t.model) : t.agent))];
    const statsHtml = `<div style="margin-bottom:16px;padding:8px 12px;background:var(--bg-tertiary);border-radius:6px;font-size:11px;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;">
      <span>${_modelsLabel[lang] || _modelsLabel.en}: ${models.join(', ')}</span>
      <span>${_timeLabel[lang] || _timeLabel.en}: ${formatElapsed(totalTime)}</span>
      ${totalTokens ? `<span>~${totalTokens.toLocaleString()} tokens</span>` : ''}
    </div>`;

    const _summaryLabel = { en: 'Summary', ko: '결론', zh: '结论', ja: '結論' };
    const _generating = { en: 'Analyzing results...', ko: '결과 분석 중...', zh: '分析结果中...', ja: '結果分析中...' };
    const _rawLabel = { en: 'Raw output', ko: '원본 출력', zh: '原始输出', ja: '元の出力' };

    el.innerHTML = errHtml + statsHtml
      + `<div id="resultConclusionBox" style="margin-bottom:16px;padding:14px 16px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:10px;">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px;">${_summaryLabel[lang] || _summaryLabel.en}</div>
          <div id="resultConclusionText" style="font-size:13px;line-height:1.7;color:var(--text-primary);white-space:pre-wrap;">${_generating[lang] || _generating.en}</div>
        </div>`
      + `<details style="margin-bottom:12px;">
          <summary style="cursor:pointer;font-size:11px;color:var(--text-muted);padding:4px 0;">${_rawLabel[lang] || _rawLabel.en}</summary>
          <div style="white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.6;margin-top:8px;padding:12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;max-height:400px;overflow-y:auto;">${escapeHtml(merged) || tt('noOutput')}</div>
        </details>`
      + `<div style="text-align:right;padding-top:8px;border-top:1px solid var(--border);">
          <button class="btn btn-send" onclick="copyAllResults()" style="padding:6px 16px;font-size:12px;">${tt('copy')}</button>
        </div>`;

    resultsSummaryLoaded = true;

    // Request compact conclusion via gemini
    requestConclusion(merged);
  }

  async function requestConclusion(rawOutput) {
    const el = document.getElementById('resultConclusionText');
    if (!el) return;
    const wp = state.workflowPrompt || '';
    const prompts = {
      ko: `아래는 여러 AI 에이전트가 "${wp}" 요청에 대해 작업한 결과다.

3~5줄로 핵심만 정리해줘:
- 결론: 무엇이 완료됐고, 현재 상태가 뭔지
- 내가 다음에 해야 할 것

불필요한 서론, 에이전트 내부 사고과정, 중복 제거하고 결론만.

---
${rawOutput.slice(0, 4000)}`,
      zh: `以下是多个 AI 代理对"${wp}"请求的工作结果。

用3-5行总结要点:
- 结论: 完成了什么，当前状态
- 我接下来需要做什么

去掉多余内容，只保留结论。

---
${rawOutput.slice(0, 4000)}`,
      ja: `以下は複数のAIエージェントが「${wp}」リクエストに対して作業した結果です。

3〜5行で要点だけまとめてください:
- 結論: 何が完了し、現在の状態は何か
- 次にやるべきこと

不要な前置き、エージェントの思考過程、重複を除き結論のみ。

---
${rawOutput.slice(0, 4000)}`,
      en: `Below are outputs from multiple AI agents for the request "${wp}".

Summarize in 3-5 lines:
- Conclusion: what was done, current status
- What I should do next

No filler, no agent thinking process, just the conclusion.

---
${rawOutput.slice(0, 4000)}`,
    };
    const prompt = prompts[lang] || prompts.en;
    try {
      const res = await fetch('/api/run-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'gemini', prompt, timeout: 60 }),
      });
      const data = await res.json();
      if (data.ok && data.output) {
        el.textContent = data.output.trim();
      } else {
        el.textContent = rawOutput.split('\n').filter(l => l.trim() && !l.startsWith('I will') && !l.startsWith('I\'ll')).slice(-5).join('\n') || tt('noOutput');
      }
    } catch {
      el.textContent = rawOutput.split('\n').filter(l => l.trim() && !l.startsWith('I will') && !l.startsWith('I\'ll')).slice(-5).join('\n') || tt('noOutput');
    }
  }


  window.copyAllResults = async function() {
    const allTasks = tasks.filter(t => t.status === 'done' || t.status === 'error');
    let text = '';
    for (const t of allTasks) {
      try {
        const res = await fetch('/api/result/' + t.id, { cache: 'no-store' });
        if (res.ok) {
          const r = await res.json();
          text += `## ${tn(t.name)} (${t.model ? formatModel(t.model) : t.agent})\n${r.output || r.error || ''}\n\n`;
        }
      } catch {}
    }
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('[onclick="copyAllResults()"]');
      if (btn) { btn.textContent = tt('copied'); setTimeout(() => btn.textContent = tt('copyAll'), 1500); }
    });
  };

  window.retryFailedTasks = function() {
    const errTasks = tasks.filter(t => t.status === 'error');
    if (!errTasks.length) return;
    // Reset error tasks to pending in local state
    for (const t of errTasks) {
      t.status = 'pending';
      t.error = undefined;
      t.elapsed = 0;
      t.tokens = 0;
    }
    state.phase = errTasks[0].phase || 'execute';
    queueRender();
    postCommand({ type: 'retry-failed' });
  };

  window.renderComparisonView = async function() {
    const panel = $('resultsPanel');
    const doneTasks = tasks.filter(t => t.status === 'done' || t.status === 'error');
    if (!doneTasks.length) return;

    // Fetch all results
    const results = {};
    await Promise.all(doneTasks.map(async (t) => {
      try {
        const res = await fetch('/api/result/' + t.id, { cache: 'no-store' });
        if (res.ok) results[t.id] = await res.json();
      } catch {}
    }));

    const agentColors = { claude: 'var(--claude-color)', codex: 'var(--codex-color)', gemini: 'var(--gemini-color)' };

    let html = `<div class="results-header">
      <button class="results-header-refresh" onclick="renderResultsPanel()">${tt('backToResults')}</button>
      <span class="results-header-title">${tt('compare')}</span>
      <span class="results-header-info">${doneTasks.length} tasks</span>
    </div>
    <div class="compare-grid">`;

    for (const t of doneTasks) {
      const r = results[t.id];
      const output = (r?.output || r?.error || tt('noOutput')).trim();
      const color = agentColors[t.agent] || 'var(--text-secondary)';
      const statusIcon = t.status === 'done' ? '✓' : '✗';
      const statusColor = t.status === 'done' ? 'var(--accent-green)' : 'var(--accent-red)';
      const cardId = 'compare-card-' + t.id;

      html += `<div class="compare-card">
        <div class="compare-card-head">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
          <span style="font-weight:600;color:${color};font-size:12px;">${(t.agent || '').charAt(0).toUpperCase() + (t.agent || '').slice(1)}</span>
          <span style="font-size:11px;color:var(--text-muted);">${tn(t.name)}</span>
          <span style="font-size:10px;color:var(--text-muted);padding:2px 6px;background:var(--bg-tertiary);border-radius:4px;">${t.phase || ''}</span>
          <span style="margin-left:auto;font-size:10px;color:${statusColor};">${statusIcon}</span>
          <span style="font-size:10px;color:var(--text-muted);">${t.elapsed ? formatElapsed(t.elapsed) : ''}${t.tokens ? ` · ~${t.tokens.toLocaleString()} tok` : ''}</span>
          <button onclick="navigator.clipboard.writeText(document.getElementById('${cardId}').textContent).then(()=>{this.textContent='${tt('copied')}';setTimeout(()=>this.textContent='${tt('copy')}',1500)})" style="padding:3px 8px;font-size:10px;background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--text-secondary);cursor:pointer;">${tt('copy')}</button>
        </div>
        <div class="compare-card-output" id="${cardId}">${escapeHtml(output)}</div>
      </div>`;
    }

    html += '</div>';
    panel.innerHTML = html;
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
  };

  window.toggleResult = function(taskId) {
    if (expandedResults.has(taskId)) {
      expandedResults.delete(taskId);
      const body = document.getElementById('result-body-' + taskId);
      if (body) body.classList.remove('open');
      const arrow = body?.previousElementSibling?.querySelector('.result-item-arrow');
      if (arrow) arrow.classList.remove('open');
    } else {
      expandedResults.add(taskId);
      const body = document.getElementById('result-body-' + taskId);
      if (body) body.classList.add('open');
      const arrow = body?.previousElementSibling?.querySelector('.result-item-arrow');
      if (arrow) arrow.classList.add('open');
      fetchResultOutput(taskId);
    }
  };

  function fetchResultOutput(taskId) {
    const el = document.getElementById('result-output-' + taskId);
    if (!el) return;
    fetch('/api/result/' + taskId, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          let content = '';
          if (data.error) content += '⚠ ' + data.error + '\n\n';
          content += data.output || (tt('noOutput'));
          el.textContent = content;
        } else {
          el.textContent = tt('noResultFile');
        }
      })
      .catch(err => { console.error('fetch error:', err); el.textContent = tt('loadFailed'); });
  }

  window.copyResult = function(taskId) {
    const el = document.getElementById('result-output-' + taskId);
    if (el) {
      navigator.clipboard.writeText(el.textContent).then(() => {
        const btn = el.parentElement.querySelector('.result-copy-btn');
        if (btn) { btn.textContent = tt('copied'); setTimeout(() => { btn.textContent = tt('copy'); }, 1500); }
      });
    }
  };

  // Result viewer modal
  window.viewResult = function(taskId) {
    fetch('/api/result/' + taskId, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const overlay = document.createElement('div');
        overlay.className = 'result-modal-overlay';
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
        const statusIcon = data.status === 'done' ? '✅' : data.status === 'error' ? '❌' : '🔄';
        overlay.innerHTML = `<div class="result-modal">
          <div class="result-modal-header">
            <h3>${statusIcon} ${escapeHtml(data.task || taskId)} — ${escapeHtml(data.agent || '')}</h3>
            <button class="result-modal-close" onclick="this.closest('.result-modal-overlay').remove()">✕</button>
          </div>
          <div class="result-modal-body">${escapeHtml(data.output || data.error || (tt('noOutput')))}</div>
        </div>`;
        document.body.appendChild(overlay);
      })
      .catch(err => { console.error('fetch error:', err); });
  };

  // ── Flow v4: Models on top, tasks flow down ──
  const flowExpandedTasks = new Set();
  const flowPrevStatuses = {}; // track previous status for animations
  let flowSelectedTaskId = null;
  let _flowRenderPending = false;
  let _flowLastRender = 0;

  function renderFlowDiagram() {
    const now = Date.now();
    if (now - _flowLastRender < 500) {
      if (!_flowRenderPending) {
        _flowRenderPending = true;
        setTimeout(() => {
          _flowRenderPending = false;
          _flowLastRender = Date.now();
          _renderFlowDiagramImpl();
        }, 500 - (now - _flowLastRender));
      }
      return;
    }
    _flowLastRender = now;
    _renderFlowDiagramImpl();
  }

  function _renderFlowDiagramImpl() {
    const container = $('flowV3Container');
    if (!container) return;
    const allTasks = state.workflowTasks || tasks;
    const prompt = state.workflowPrompt || '';
    const curPhase = state.phase || '';

    if (!allTasks.length) {
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);flex-direction:column;gap:8px;">
        <div style="font-size:28px;opacity:0.3;">⟐</div>
        <div>${tt('startFlow')}</div>
      </div>`;
      return;
    }

    const totalDone = allTasks.filter(t => t.status === 'done').length;
    const totalErr = allTasks.filter(t => t.status === 'error').length;
    const totalWorking = allTasks.filter(t => t.status === 'working').length;
    const progressPct = allTasks.length ? Math.round(((totalDone + totalErr) / allTasks.length) * 100) : 0;
    const totalTokens = allTasks.reduce((s, t) => s + (t.tokens || 0), 0);
    const isComplete = curPhase === 'complete';

    const statusText = { pending: tt('toDo'), working: tt('running'), done: tt('complete'), error: tt('failed') };
    const statusColor = { pending: 'var(--text-muted)', working: 'var(--accent-blue)', done: 'var(--accent-green)', error: 'var(--accent-red)' };
    const phaseLabels = { plan: `📐 ${tt('planPhase')}`, execute: `⚡ ${tt('executePhase')}` };

    // Group tasks by phase
    const phases = ['plan', 'execute'];
    const phaseMap = {};
    for (const p of phases) {
      phaseMap[p] = allTasks.filter(t => t.phase === p);
    }

    let html = '';

    // Top bar
    html += `<div class="fv-bar">
      <div class="fv-bar-prompt" title="${escapeHtml(prompt)}">
        <span style="color:var(--text-muted);margin-right:4px;">${tt('prompt')}:</span>
        ${escapeHtml(prompt) || '—'}
      </div>
      <div class="fv-bar-stat">
        <div class="fv-pbar"><div class="fv-pfill" style="width:${progressPct}%"></div></div>
        ${progressPct}%
        ${totalWorking ? ` <span style="color:var(--accent-blue);">${totalWorking} ${tt('active')}</span>` : ''}
      </div>
    </div>`;

    // Phase-based vertical flow
    html += '<div class="fv-body">';

    phases.forEach((phase, pi) => {
      const phaseTasks = phaseMap[phase];
      if (!phaseTasks || !phaseTasks.length) return;

      const pDone = phaseTasks.every(t => t.status === 'done');
      const pErr = phaseTasks.some(t => t.status === 'error');
      const pWorking = phaseTasks.some(t => t.status === 'working');
      const badgeClass = pDone ? 'done' : pErr ? 'error' : pWorking ? 'active' : '';

      // Phase header
      html += `<div class="fv-phase-group">
        <div class="fv-phase-header">
          <div class="fv-phase-badge ${badgeClass}">${phaseLabels[phase] || phase}</div>
          <div class="fv-phase-line"></div>
          <span style="font-size:10px;color:var(--text-muted);">${phaseTasks.filter(t=>t.status==='done').length}/${phaseTasks.length}</span>
        </div>`;

      // Parallel indicator + tasks row
      if (phaseTasks.length > 1) {
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="font-size:10px;font-weight:600;color:var(--accent-blue);padding:2px 8px;border:1px solid rgba(91,141,239,0.3);border-radius:4px;background:rgba(91,141,239,0.06);">⫘ ${tt('parallel')}</div>
          <div style="flex:1;height:1px;background:var(--border);"></div>
        </div>`;
      }
      html += '<div class="fv-parallel">';
      phaseTasks.forEach((t, ti) => {
        const isExpanded = flowExpandedTasks.has(t.id);
        const modelStr = t.model ? formatModel(t.model) : t.agent;

        // Horizontal arrow between cards (only if sequential, not parallel)
        // Since all tasks in a phase are parallel, we show a parallel connector
        if (ti > 0 && phaseTasks.length > 1) {
          html += `<div style="display:flex;align-items:center;flex-shrink:0;"><div style="width:8px;height:1px;border-top:1.5px dashed var(--border);"></div></div>`;
        }

        // Determine animation class
        const prevStatus = flowPrevStatuses[t.id];
        let animClass = '';
        if (prevStatus && prevStatus !== t.status) {
          if (t.status === 'done') animClass = ' just-completed';
          else if (t.status === 'error') animClass = ' just-errored';
        }
        flowPrevStatuses[t.id] = t.status;
        const selectedClass = flowSelectedTaskId === t.id ? ' selected' : '';

        html += `<div class="fv-card${animClass}${selectedClass}" data-status="${t.status}" data-task-id="${t.id}" onclick="openFlowDetail('${t.id}')">
          <div class="fv-card-head">
            <div class="fv-card-dot ${t.status}"></div>
            <div class="fv-card-name">${escapeHtml(tn(t.name))}</div>
            <div class="fv-card-status" style="color:${statusColor[t.status] || 'var(--text-muted)'};">${statusText[t.status] || t.status}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span class="fv-card-agent agent-${t.agent}">${modelStr}</span>
            <span class="fv-card-meta" style="margin-bottom:0;">${t.status === 'pending' ? tt('toDo') : formatElapsed(t.elapsed)}${t.tokens ? ' · ~' + t.tokens.toLocaleString() + ' tok' : ''}</span>
          </div>`;

        if (t.status === 'error' && t.error) {
          html += `<div class="fv-card-summary err">${escapeHtml(t.error.slice(0, 150))}</div>`;
        } else if (t.status === 'done' || t.status === 'working') {
          html += `<div class="fv-card-summary" id="flow-summary-${t.id}">${t.status === 'working' ? tt('runningDot') : '...'}</div>`;
        }

        html += '</div>';
      });
      html += '</div>'; // fv-parallel
      html += '</div>'; // fv-phase-group

      // Connector arrow between phases
      if (pi < phases.length - 1 && phaseMap[phases[pi + 1]]?.length) {
        const nextPhaseTasks = phaseMap[phases[pi + 1]];
        const connDone = pDone;
        const connActive = pDone && nextPhaseTasks.some(t => t.status === 'working');
        html += `<div class="fv-connector ${connDone ? (connActive ? 'active' : 'done') : ''}">
          <div class="fv-connector-line"></div>
          <div class="fv-connector-head"></div>
        </div>`;
      }
    });

    // Footer
    const isAwaiting = curPhase === 'awaiting-approval';
    const _awaitLabel = { en: 'Awaiting your approval to proceed', ko: '실행 단계 진행을 위해 승인이 필요합니다', zh: '等待您的批准以继续', ja: '続行するには承認が必要です' };
    const _approveBtn = { en: 'Approve & Execute', ko: '승인 — 실행하기', zh: '批准并执行', ja: '承認して実行' };
    const _rejectBtn = { en: 'Reject', ko: '거절', zh: '拒绝', ja: '拒否' };

    if (isAwaiting) {
      html += `</div><div class="fv-footer" style="flex-direction:column;gap:10px;padding:16px 20px;">
        <div style="display:flex;align-items:center;gap:10px;width:100%;">
          <span style="font-size:18px;">⏸</span>
          <span style="font-weight:600;color:var(--accent-yellow);flex:1;">${_awaitLabel[lang] || _awaitLabel.en}</span>
          <span style="color:var(--text-muted);font-size:12px;">
            ${totalDone}/${allTasks.length} ${tt('done')}
          </span>
        </div>
        <div style="display:flex;gap:8px;width:100%;">
          <button onclick="rejectWorkflow()" style="padding:8px 20px;font-size:13px;font-weight:600;background:transparent;color:var(--accent-red);border:1px solid rgba(239,83,80,0.4);border-radius:8px;cursor:pointer;">${_rejectBtn[lang] || _rejectBtn.en}</button>
          <button onclick="showApprovalWidget()" style="padding:8px 20px;font-size:13px;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;flex:1;">Plan 결과 검토</button>
          <button onclick="approveWorkflow()" style="padding:8px 24px;font-size:13px;font-weight:700;background:var(--accent-green);color:#fff;border:none;border-radius:8px;cursor:pointer;box-shadow:0 2px 10px rgba(52,211,153,0.3);">${_approveBtn[lang] || _approveBtn.en}</button>
        </div>
      </div>`;
    } else {
      html += `</div><div class="fv-footer">
        <span style="font-weight:600;color:${isComplete ? (totalErr ? 'var(--accent-orange)' : 'var(--accent-green)') : 'var(--text-secondary)'};">
          ${isComplete ? (totalErr ? '⚠ ' : '✓ ') : ''}${tt('workflow')}: ${isComplete ? tt('complete') : tt('inProgress')}
        </span>
        <span style="color:var(--text-muted);">
          ${totalDone}/${allTasks.length} ${tt('done')}${totalErr ? ` · ${totalErr} ${tt('failed')}` : ''}${totalTokens ? ` · ~${totalTokens.toLocaleString()} tokens` : ''}
        </span>
        ${isComplete && totalErr > 0 ? `<button onclick="retryFailedTasks()" style="margin-left:auto;padding:6px 14px;font-size:12px;font-weight:600;background:transparent;color:var(--accent-red);border:1px solid rgba(239,83,80,0.4);border-radius:6px;cursor:pointer;">${tt('retryFailed')}</button>` : ''}
      </div>`;
    }

    container.innerHTML = html;

    // Fetch summaries
    for (const t of allTasks) {
      if (t.status === 'done') fetchFlowSummary(t.id);
      if (flowExpandedTasks.has(t.id)) fetchFlowFull(t.id);
    }
  }

  function fetchFlowSummary(taskId) {
    const el = document.getElementById('flow-summary-' + taskId);
    if (!el || el.dataset.loaded) return;
    fetch('/api/result/' + taskId, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const lines = data.lastLines || [];
        const summary = lines.filter(l => l.trim()).join('\n') || (data.output || '').trim().split('\n').slice(-3).join('\n');
        el.textContent = summary.slice(0, 200) || (tt('noOutput'));
        el.dataset.loaded = '1';
      })
      .catch(err => { console.error('fetch error:', err); });
  }

  function fetchFlowFull(taskId) {
    const el = document.getElementById('flow-full-' + taskId);
    if (!el || el.dataset.loaded) return;
    fetch('/api/result/' + taskId, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        let content = '';
        if (data.error) content += '⚠ ' + data.error + '\n\n';
        content += data.output || (tt('noOutput'));
        el.textContent = content;
        el.dataset.loaded = '1';
      })
      .catch(err => { console.error('fetch error:', err); el.textContent = 'Failed'; });
  }

  window.toggleFlowTask = function(taskId) {
    if (flowExpandedTasks.has(taskId)) flowExpandedTasks.delete(taskId);
    else flowExpandedTasks.add(taskId);
    renderFlowDiagram();
  };

  window.openFlowDetail = function(taskId) {
    const allTasks = state.workflowTasks || tasks;
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    flowSelectedTaskId = taskId;
    // Re-render to update selected class
    renderFlowDiagram();

    const detail = document.getElementById('flowDetail');
    const statusMap = { done: tt('complete'), working: tt('inProgress'), error: tt('failed'), pending: tt('toDo') };
    const statusLabel = statusMap[task.status] || task.status;
    const statusColor = { done: 'var(--accent-green)', working: 'var(--accent-blue)', error: 'var(--accent-red)', pending: 'var(--text-muted)' };
    const phase = getPhaseForTask(task);
    const phaseLabel = phase ? (PHASE_META[phase][lang] || PHASE_META[phase].label) : '—';

    const detailTitle = document.getElementById('flowDetailTitle');
    if (detailTitle) detailTitle.textContent = tn(task.name) || task.id;
    const detailBody = document.getElementById('flowDetailBody');
    if (!detailBody) return;

    detailBody.innerHTML = `
      <div class="kb-detail-row">
        <div class="kb-detail-field">
          <div class="kb-detail-label">${tt('status')}</div>
          <div class="kb-detail-value" style="font-weight:600;color:${statusColor[task.status] || 'inherit'};">${statusLabel}</div>
        </div>
        <div class="kb-detail-field">
          <div class="kb-detail-label">${tt('phase')}</div>
          <div class="kb-detail-value">${phaseLabel}</div>
        </div>
      </div>
      <div class="kb-detail-row">
        <div class="kb-detail-field">
          <div class="kb-detail-label">${tt('agent')}</div>
          <div class="kb-detail-value" style="display:flex;align-items:center;gap:8px;">
            <div class="kb-avatar ${task.agent || ''}" style="width:26px;height:26px;font-size:11px;">${(task.agent||'?').charAt(0).toUpperCase()}</div>
            ${task.agent || '—'}
          </div>
        </div>
        <div class="kb-detail-field">
          <div class="kb-detail-label">Model</div>
          <div class="kb-detail-value" style="font-family:var(--font-mono);font-size:12px;">${task.model ? formatModel(task.model) : '—'}</div>
        </div>
      </div>
      <div class="kb-detail-row">
        <div class="kb-detail-field">
          <div class="kb-detail-label">${tt('elapsedTime')}</div>
          <div class="kb-detail-value" style="font-family:var(--font-mono);">${formatElapsed(task.elapsed)}</div>
        </div>
        <div class="kb-detail-field">
          <div class="kb-detail-label">Tokens</div>
          <div class="kb-detail-value" style="font-family:var(--font-mono);">${task.tokens ? '~' + task.tokens.toLocaleString() : '—'}</div>
        </div>
      </div>
      ${task.error ? `
        <div class="kb-detail-field">
          <div class="kb-detail-label" style="color:var(--accent-red);">${tt('errorLabel')}</div>
          <div class="kb-detail-output" style="border-color:rgba(239,83,80,0.2);color:var(--accent-red);">${escapeHtml(task.error)}</div>
        </div>` : ''}
      <div class="kb-detail-field">
        <div class="kb-detail-label">${tt('output')}</div>
        <div class="kb-detail-output" id="flow-detail-output-${task.id}" style="max-height:none;flex:1;">${tt('loading')}</div>
      </div>
      <div style="padding-top:8px;">
        <button class="btn btn-send" onclick="copyFlowResult('${task.id}')" style="padding:6px 16px;font-size:12px;">${tt('copy')}</button>
      </div>
    `;

    detail.classList.add('open');

    // Fetch result
    fetch('/api/result/' + task.id, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const el = document.getElementById('flow-detail-output-' + task.id);
        if (el && data) {
          el.textContent = data.output || data.error || tt('noOutput');
        } else if (el) {
          el.textContent = task.status === 'pending' ? tt('toDo') : task.status === 'working' ? tt('runningDot') : tt('noResultFile');
        }
      })
      .catch(err => { console.error('fetch error:', err); });
  };

  window.closeFlowDetail = function() {
    flowSelectedTaskId = null;
    document.getElementById('flowDetail').classList.remove('open');
    renderFlowDiagram();
  };

  window.copyFlowResult = function(taskId) {
    const el = document.getElementById('flow-detail-output-' + taskId);
    if (el) {
      navigator.clipboard.writeText(el.textContent).then(() => {
        const btn = el.parentElement?.nextElementSibling?.querySelector('.btn-send');
        if (btn) { btn.textContent = tt('copied'); setTimeout(() => btn.textContent = tt('copy'), 1500); }
      });
    }
  };

  // ── Briefing / Notification system ──
  let briefingData = null; // { html, generated }
  let briefingUnread = false;

  async function generateBriefing() {
    const allTasks = state.workflowTasks || tasks;
    if (!allTasks.length) return;
    // Don't generate empty briefing
    const hasDone = allTasks.some(t => t.status === 'done' && t.elapsed > 0);
    if (!hasDone) return;

    const prompt = state.workflowPrompt || '';
    const totalDone = allTasks.filter(t => t.status === 'done').length;
    const totalErr = allTasks.filter(t => t.status === 'error').length;
    const totalTokens = allTasks.reduce((s, t) => s + (t.tokens || 0), 0);
    const totalTime = allTasks.reduce((s, t) => s + (t.elapsed || 0), 0);

    // Fetch all result outputs
    const results = {};
    await Promise.all(allTasks.map(async (t) => {
      try {
        const res = await fetch('/api/result/' + t.id, { cache: 'no-store' });
        if (res.ok) results[t.id] = await res.json();
      } catch {}
    }));

    // Build briefing HTML
    let html = '';

    // Overview
    html += `<div class="brief-section">
      <div class="brief-label">${tt('summary')}</div>
      <p>${tt('taskComplete')(escapeHtml(prompt.slice(0, 80)), totalDone, allTasks.length, totalErr, totalTime, totalTokens)}</p>
    </div>`;

    // Per-task results
    html += `<div class="brief-section">
      <div class="brief-label">${tt('taskResults')}</div>`;

    for (const t of allTasks) {
      const r = results[t.id];
      const dotColor = t.status === 'done' ? 'var(--accent-green)' : t.status === 'error' ? 'var(--accent-red)' : 'var(--text-muted)';

      let summaryText = '';
      if (t.status === 'error') {
        summaryText = t.error || (r?.error) || tt('failed');
      } else if (r) {
        // Extract meaningful summary from output
        const output = (r.output || '').trim();
        if (output) {
          // Take first 2-3 meaningful lines as summary
          const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('[') && !l.startsWith('#'));
          summaryText = lines.slice(0, 3).join(' ').slice(0, 200);
          if (!summaryText) summaryText = output.slice(0, 200);
        } else {
          summaryText = tt('noOutput');
        }
      }

      html += `<div class="brief-task-item">
        <div class="brief-task-dot" style="background:${dotColor};"></div>
        <div class="brief-task-text">
          <strong>${escapeHtml(tn(t.name))}</strong> <span style="opacity:0.6;">(${t.model ? formatModel(t.model) : t.agent}, ${formatElapsed(t.elapsed)})</span><br>
          ${escapeHtml(summaryText)}
        </div>
      </div>`;
    }
    html += '</div>';

    // Issues / warnings
    if (totalErr > 0) {
      html += `<div class="brief-section">
        <div class="brief-label" style="color:var(--accent-red);">${tt('issues')}</div>
        <p style="color:var(--accent-red);opacity:0.85;">${tt('tasksFailed')(totalErr)}</p>
      </div>`;
    }

    briefingData = { html, generated: Date.now() };
    briefingUnread = true;
    const badge = $('notifBadge');
    if (badge) { badge.classList.add('show'); badge.textContent = '1'; }
  }

  window.openBriefing = function() {
    if (!briefingData) {
      // No briefing yet — show placeholder
      const overlay = document.createElement('div');
      overlay.className = 'briefing-overlay';
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.innerHTML = `<div class="briefing-panel">
        <div class="briefing-header">
          <div class="briefing-header-title">🔔 ${tt('briefing')}</div>
          <button class="briefing-close" onclick="this.closest('.briefing-overlay').remove()">✕</button>
        </div>
        <div class="briefing-body" style="text-align:center;padding:40px;color:var(--text-muted);">
          ${tt('briefingPlaceholder')}
        </div>
      </div>`;
      document.body.appendChild(overlay);
      return;
    }

    // Mark as read
    briefingUnread = false;
    const badge = $('notifBadge');
    if (badge) badge.classList.remove('show');

    const allTasks = state.workflowTasks || tasks;
    const totalErr = allTasks.filter(t => t.status === 'error').length;
    const prompt = state.workflowPrompt || '';

    const overlay = document.createElement('div');
    overlay.className = 'briefing-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // Action buttons with next-step suggestions
    let actionsHtml = `<div class="brief-q">${tt('nextAction')}</div>
      <div class="brief-btns">`;

    if (totalErr > 0) {
      actionsHtml += `<button class="brief-btn primary" onclick="retryFailed();this.closest('.briefing-overlay').remove();">${tt('retryFailed')}</button>`;
    }
    actionsHtml += `<button class="brief-btn" onclick="this.closest('.briefing-overlay').remove();switchTab('flow');">${tt('viewInFlow')}</button>`;
    actionsHtml += `<button class="brief-btn" onclick="this.closest('.briefing-overlay').remove();focusPromptInput();">${tt('startNewTask')}</button>`;
    if (totalErr === 0) {
      actionsHtml += `<button class="brief-btn" onclick="this.closest('.briefing-overlay').remove();">${tt('dismiss')}</button>`;
    }
    actionsHtml += '</div>';

    overlay.innerHTML = `<div class="briefing-panel">
      <div class="briefing-header">
        <div class="briefing-header-title">🔔 ${tt('workflowBriefing')}</div>
        <button class="briefing-close" onclick="this.closest('.briefing-overlay').remove()">✕</button>
      </div>
      <div class="briefing-body">${briefingData.html}</div>
      <div class="briefing-actions">${actionsHtml}</div>
    </div>`;
    document.body.appendChild(overlay);
  };

  // ── Approval Widget ──
  function showApprovalWidget() {
    // Remove existing overlay if any
    const existing = document.querySelector('.approval-overlay');
    if (existing) existing.remove();

    const allTasks = state.workflowTasks || tasks;
    const planTasks = allTasks.filter(t => t.phase === 'plan' && t.status === 'done');
    const prompt = state.workflowPrompt || '';

    const _labels = {
      en: { title: 'Plan Review', subtitle: 'Review the plan before proceeding to execution', approve: 'Approve & Execute', reject: 'Reject', loading: 'Loading output...' },
      ko: { title: '실행 전 확인', subtitle: 'Plan 결과를 검토하고 실행 여부를 결정하세요', approve: '승인 — 실행하기', reject: '거절', loading: '출력 로딩 중...' },
      zh: { title: '计划审核', subtitle: '在执行前审核计划', approve: '批准并执行', reject: '拒绝', loading: '加载中...' },
      ja: { title: '計画確認', subtitle: '実行前に計画を確認してください', approve: '承認して実行', reject: '拒否', loading: '読み込み中...' },
    };
    const lb = _labels[lang] || _labels.en;

    // Build task cards
    let cardsHtml = '';
    for (const t of planTasks) {
      const agentClass = `agent-${t.agent}`;
      const modelStr = t.model ? formatModel(t.model) : t.agent;
      cardsHtml += `<div class="approval-task-card">
        <div class="approval-task-head">
          <span class="fv-card-agent ${agentClass}">${modelStr}</span>
          <span style="font-weight:600;font-size:13px;">${escapeHtml(tn(t.name))}</span>
          <span style="font-size:10px;color:var(--text-muted);margin-left:auto;">${formatElapsed(t.elapsed)}</span>
        </div>
        <div class="approval-task-output" id="approval-output-${t.id}">${lb.loading}</div>
      </div>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'approval-overlay';
    overlay.innerHTML = `<div class="approval-panel">
      <div class="approval-header">
        <div class="approval-header-icon">⏸</div>
        <div class="approval-header-text">
          <h3>${lb.title}</h3>
          <p>${lb.subtitle}</p>
        </div>
      </div>
      <div class="approval-body">
        ${prompt ? `<div style="margin-bottom:14px;padding:10px 14px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border);font-size:13px;color:var(--text-secondary);">
          <span style="color:var(--text-muted);font-size:11px;">Prompt:</span> ${escapeHtml(prompt)}
        </div>` : ''}
        ${cardsHtml}
      </div>
      <div class="approval-actions">
        <button class="btn-reject-lg" onclick="rejectWorkflow()">${lb.reject}</button>
        <button class="btn-approve-lg" onclick="approveWorkflow()">${lb.approve}</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    // Notify
    const badge = $('notifBadge');
    if (badge) { badge.classList.add('show'); badge.textContent = '!'; }

    // Fetch outputs
    for (const t of planTasks) {
      fetch('/api/result/' + t.id, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          const el = document.getElementById('approval-output-' + t.id);
          if (el && data) el.textContent = data.output || data.error || tt('noOutput');
          else if (el) el.textContent = tt('noOutput');
        })
        .catch(err => { console.error('fetch error:', err); });
    }
  }

  window.approveWorkflow = function() {
    postCommand({ type: 'approve', workflowApproval: true });
    const overlay = document.querySelector('.approval-overlay');
    if (overlay) overlay.remove();
    const badge = $('notifBadge');
    if (badge) badge.classList.remove('show');
    // Immediately update UI to show execute is starting
    state.phase = 'execute';
    queueRender();
    renderActiveTab();
    // Poll for state update since execute phase spawns asynchronously
    setTimeout(() => fetchFullState(), 1500);
    setTimeout(() => fetchFullState(), 4000);
  };

  window.rejectWorkflow = function() {
    postCommand({ type: 'reject', workflowApproval: true });
    const overlay = document.querySelector('.approval-overlay');
    if (overlay) overlay.remove();
    const badge = $('notifBadge');
    if (badge) badge.classList.remove('show');
    state.phase = 'complete';
    queueRender();
    renderActiveTab();
  };

  window.retryFailed = function() {
    // Retry only failed tasks, not the entire workflow
    retryFailedTasks();
  };

  window.focusPromptInput = function() {
    const input = document.querySelector('.prompt-input');
    if (input) { input.focus(); input.select(); }
  };

  // Workflow settings
  window.saveWorkflowSettings = function() {
    const settings = {
      plan: {
        research: $('wfPlanResearch').checked,
        architecture: $('wfPlanArchitecture').checked,
        scaffold: $('wfPlanScaffold').checked,
      },
      execute: {
        implementation: $('wfExecImpl').checked,
        'code-review': $('wfExecReview').checked,
        documentation: $('wfExecDocs').checked,
      },
      timeout_seconds: parseInt($('wfTimeout').value) || 45,
    };
    // Save to server via budget endpoint (reuse)
    fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'update-budget', content: JSON.stringify({ timeout_seconds: settings.timeout_seconds, workflow: settings }) }),
    }).then(() => {
      // Also save locally
      localStorage.setItem('workflowSettings', JSON.stringify(settings));
      const btn = event.target;
      btn.textContent = tt('saved');
      setTimeout(() => { btn.textContent = 'Save'; }, 1500);
    });
  };

  // Load saved settings on init
  try {
    const saved = JSON.parse(localStorage.getItem('workflowSettings'));
    if (saved) {
      if (saved.plan) {
        if ($('wfPlanResearch')) $('wfPlanResearch').checked = saved.plan.research !== false;
        if ($('wfPlanArchitecture')) $('wfPlanArchitecture').checked = saved.plan.architecture !== false;
        if ($('wfPlanScaffold')) $('wfPlanScaffold').checked = saved.plan.scaffold !== false;
      }
      if (saved.execute) {
        if ($('wfExecImpl')) $('wfExecImpl').checked = saved.execute.implementation !== false;
        if ($('wfExecReview')) $('wfExecReview').checked = saved.execute['code-review'] !== false;
        if ($('wfExecDocs')) $('wfExecDocs').checked = saved.execute.documentation !== false;
      }
      if (saved.timeout_seconds && $('wfTimeout')) $('wfTimeout').value = saved.timeout_seconds;
    }
  } catch {}

  window.approveTask = function(taskId) {
    postCommand({ type: 'approve', taskId: taskId });
  };

  window.rejectTask = function(taskId) {
    const reason = prompt(tt('rejectReason'));
    if (reason !== null) {
      postCommand({ type: 'reject', taskId: taskId, content: reason });
    }
  };

  // Enter key support for prompt inputs
  function initPromptInputs() {
    for (const agent of ['claude', 'codex', 'gemini']) {
      const input = $('prompt-' + agent);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          window.sendPrompt(agent);
        }
      });
    }
  }

  // Single source of truth: sync task array → agent card states
  function syncTasksToAgents(newTasks) {
    // Track workflow ID from tasks to filter stale data
    if (newTasks.length > 0 && newTasks[0].workflowId) {
      const incomingWfId = newTasks[0].workflowId;
      if (_currentWorkflowId && _currentWorkflowId !== incomingWfId) {
        // Stale data from old workflow — ignore
        return;
      }
      _currentWorkflowId = incomingWfId;
    }
    tasks = newTasks;
    state.workflowTasks = newTasks;

    ['claude', 'codex', 'gemini'].forEach(name => {
      const agentTasks = newTasks.filter(t => t.agent === name);
      if (agentTasks.length === 0) return;
      const a = state.agents[name];

      const hasWorking = agentTasks.some(t => t.status === 'working');
      const hasPending = agentTasks.some(t => t.status === 'pending');
      const hasError = agentTasks.some(t => t.status === 'error');
      const allDone = agentTasks.every(t => t.status === 'done');

      const displayTask = agentTasks.find(t => t.status === 'working')
        || agentTasks.find(t => t.status === 'pending')
        || agentTasks[agentTasks.length - 1];

      const newStatus = hasWorking ? 'working' : allDone ? 'done' : hasError ? 'error' : hasPending ? 'pending' : displayTask.status;

      if (newStatus === 'working' && a.status !== 'working') a.startedAt = Date.now();
      if (newStatus !== 'working' && a.status === 'working') a.startedAt = null;

      a.status = newStatus;
      a.task = `[${displayTask.phase || ''}] ${tn(displayTask.name)}`;
      if (displayTask.elapsed) a.elapsed = displayTask.elapsed;
      if (displayTask.model) a.model = displayTask.model;
      a.turns = agentTasks.filter(t => t.status === 'done').length;
      a.totalElapsed = agentTasks.reduce((s, t) => s + (t.elapsed || 0), 0);
    });
  }

  function handleTasksUpdate(data) {
    const newTasks = Array.isArray(data.tasks) ? data.tasks : Array.isArray(data) ? data : null;
    if (!newTasks) return;
    syncTasksToAgents(newTasks);
    queueRender();
    renderActiveTab();
  }

  // Patch SSE to add task/setup listeners
  const origConnectSSE = connectSSE;
  connectSSE = function() {
    origConnectSSE();
    if (eventSource) {
      eventSource.addEventListener('tasks-update', (e) => {
        try { handleTasksUpdate(JSON.parse(e.data)); } catch {}
      });
      eventSource.addEventListener('setup-update', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.status === 'installed' || data.status === 'logged-in') {
            checkAuthStatus();
          }
        } catch {}
      });
    }
  };

  // Also update applyFullState to handle tasks
  const origApplyFullState = applyFullState;
  applyFullState = function(fullState) {
    origApplyFullState(fullState);
    if (fullState.tasks) {
      updateStatusSummary(fullState);
      renderActiveTab();
    }
  };

  function updateStatusSummary(fullState) {
    const el = document.getElementById('statusSummaryText');
    if (!el) return;
    const phase = fullState.phase || 'idle';
    const t = fullState.tasks || [];
    const done = t.filter(x => x.status === 'done').length;
    const working = t.filter(x => x.status === 'working').length;
    const err = t.filter(x => x.status === 'error').length;
    const total = t.length;
    const prompt = fullState.prompt || '';
    const truncPrompt = prompt.length > 50 ? prompt.slice(0, 50) + '…' : prompt;

    if (phase === 'complete') {
      el.innerHTML = `<div style="color:#4caf50;font-weight:600;margin-bottom:4px;">${tt('complete')}</div>` +
        (truncPrompt ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">"${escapeHtml(truncPrompt)}"</div>` : '') +
        `<div style="font-size:12px;">${done}/${total} ${tt('done')}${err ? `, ${err} ${tt('failed')}` : ''}</div>`;
    } else if (working > 0) {
      const workingNames = t.filter(x => x.status === 'working').map(x => `${x.agent}: ${tn(x.name)}`).join(', ');
      el.innerHTML = `<div style="color:var(--accent-blue);font-weight:600;margin-bottom:4px;">${tt('running')} — ${phase}</div>` +
        (truncPrompt ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">"${escapeHtml(truncPrompt)}"</div>` : '') +
        `<div style="font-size:12px;">${workingNames}</div>` +
        `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${done}/${total} ${tt('done')}</div>`;
    } else if (total > 0) {
      el.innerHTML = `<div style="font-weight:600;margin-bottom:4px;">${phase}</div>` +
        `<div style="font-size:12px;">${done}/${total} ${tt('done')}</div>`;
    } else {
      el.textContent = tt('idle');
    }
  }

  let models = [];
  let routing = {};

  function loadRouting() {
    fetch('/api/routing', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.rules) {
          routing = data.rules;
          renderRoutingRules();
        }
      })
      .catch(err => { console.error('fetch error:', err); });
  }

  // Default routing: hardcoded agent assignments
  const DEFAULT_ROUTING = {
    research: 'gemini',
    architecture: 'claude',
    implementation: 'codex',
    'code-review': 'claude',
    documentation: 'gemini',
  };

  function renderRoutingRules() {
    const container = $('routingRules');
    const taskLabels = {
      architecture: t.architecture,
      implementation: t.implementation,
      testing: t.testing,
      research: t.research,
      'code-review': t.codeReview,
      documentation: t.documentation,
    };
    const effectiveRouting = Object.keys(routing).length > 0 ? routing : DEFAULT_ROUTING;

    container.innerHTML = Object.entries(effectiveRouting).map(([task, model]) => {
      const agent = model.includes('codex') || model.includes('gpt') ? 'codex'
        : model.includes('gemini') ? 'gemini' : 'claude';
      const dotColor = agent === 'claude' ? 'var(--claude-color)' : agent === 'codex' ? 'var(--codex-color)' : 'var(--gemini-color)';
      return `<div class="routing-row">
        <span class="routing-task-label">${taskLabels[task] || task}</span>
        <span style="display:flex;align-items:center;gap:6px;font-size:12px;font-family:var(--font-mono);color:var(--text-primary);">
          <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
          ${agent}
        </span>
      </div>`;
    }).join('');
  }

  // ── Setup / Auth ──
  function checkAuthStatus() {
    fetch('/api/auth-status', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        updateSetupCard('Claude', 'claude', data.claude);
        updateSetupCard('Codex', 'codex', data.codex);
        updateSetupCard('Gemini', 'gemini', data.gemini);
        if (!data.ready) {
          switchTab('setup');
        }
      })
      .catch(err => { console.error('fetch error:', err); });
  }

  function updateSetupCard(name, id, info) {
    const badge = $('setup' + name + 'Badge');
    const status = $('setup' + name + 'Status');
    const installBtn = $('setup' + name + 'InstallBtn');
    const installMsg = $('setup' + name + 'InstallMsg');
    const card = $('setupCard' + name);
    if (!info.installed) {
      badge.className = 'status-badge error';
      badge.textContent = 'Not installed';
      status.textContent = 'Click Install or enter an API key below.';
      if (installBtn) { installBtn.disabled = false; installBtn.textContent = 'Install CLI'; }
      if (installMsg) installMsg.textContent = '';
      if (card) card.classList.remove('ready');
    } else if (info.authenticated) {
      badge.className = 'status-badge done';
      badge.textContent = 'Ready';
      status.textContent = info.version || 'Authenticated';
      if (installBtn) { installBtn.style.display = 'none'; }
      if (installMsg) installMsg.textContent = '';
      if (card) {
        card.classList.add('ready');
        // Hide login/key inputs when authenticated
        card.querySelectorAll('.agent-prompt-input, .btn').forEach(el => {
          if (el !== badge && !el.classList.contains('status-badge')) el.style.display = 'none';
        });
        // Show a "connected" message instead
        let connMsg = card.querySelector('.setup-connected-msg');
        if (!connMsg) {
          connMsg = document.createElement('div');
          connMsg.className = 'setup-connected-msg';
          connMsg.style.cssText = 'padding:10px 14px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:8px;color:var(--accent-green);font-size:13px;margin-top:4px;';
          connMsg.textContent = '✓ Connected and ready to use';
          card.appendChild(connMsg);
        }
      }
    } else {
      badge.className = 'status-badge cancelled';
      badge.textContent = 'Needs auth';
      status.textContent = 'Installed — add an API key or login via browser.';
      if (installBtn) { installBtn.disabled = true; installBtn.textContent = 'Installed'; }
      if (installMsg) installMsg.textContent = '';
      if (card) card.classList.remove('ready');
    }
  }

  const PKG_NAMES = {claude:'@anthropic-ai/claude-code',codex:'@openai/codex',gemini:'@google/gemini-cli'};

  function setupLog(el, text, color) {
    const line = document.createElement('div');
    line.style.cssText = 'font-size:12px;padding:2px 0;font-family:var(--font-mono);color:' + (color || 'var(--text-muted)');
    const time = new Date().toLocaleTimeString('en-US', {hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
    line.textContent = '[' + time + '] ' + text;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function getLogEl(name) {
    const id = 'setupLog' + name;
    let el = $(id);
    if (!el) {
      const card = $('setupCard' + name);
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = 'margin-top:10px;max-height:120px;overflow-y:auto;background:var(--bg-secondary);border-radius:8px;padding:8px 12px;border:1px solid var(--border-color);';
      card.appendChild(el);
    }
    return el;
  }

  window.installCli = function(provider) {
    const name = provider.charAt(0).toUpperCase() + provider.slice(1);
    const btn = $('setup' + name + 'InstallBtn');
    const log = getLogEl(name);
    btn.disabled = true;
    btn.textContent = 'Installing...';
    setupLog(log, 'Starting installation of ' + PKG_NAMES[provider] + '...', 'var(--accent-blue)');
    setupLog(log, 'Running: npm install -g ' + PKG_NAMES[provider]);
    setupLog(log, 'This may take 30-60 seconds. Please wait...');
    fetch('/api/install-cli', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        setupLog(log, 'Installation complete!', 'var(--accent-green)');
        setupLog(log, name + ' CLI is now available.', 'var(--accent-green)');
        btn.textContent = 'Installed ✓';
        btn.style.opacity = '0.6';
      } else {
        setupLog(log, 'Installation failed.', 'var(--accent-red)');
        setupLog(log, 'Try manually in terminal: npm i -g ' + PKG_NAMES[provider], 'var(--accent-orange)');
        if (data.error) setupLog(log, 'Error: ' + data.error, 'var(--accent-red)');
        btn.disabled = false;
        btn.textContent = 'Retry';
      }
      checkAuthStatus();
    })
    .catch(() => {
      setupLog(log, 'Network error. Is the dashboard server running?', 'var(--accent-red)');
      btn.disabled = false;
      btn.textContent = 'Retry';
    });
  };

  window.cliLogin = function(provider) {
    const name = provider.charAt(0).toUpperCase() + provider.slice(1);
    const btn = $('setup' + name + 'LoginBtn');
    const log = getLogEl(name);
    btn.disabled = true;
    btn.textContent = 'Logging in...';
    setupLog(log, 'Starting ' + name + ' authentication...', 'var(--accent-blue)');
    setupLog(log, 'A browser window will open for login.');
    fetch('/api/cli-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })
    .then(r => r.json())
    .then(() => {
      setupLog(log, 'Browser login started. Complete the login in the new tab.', 'var(--accent-blue)');
      setupLog(log, 'Waiting for authentication...');
      let polls = 0;
      const dots = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
      const pollInterval = setInterval(() => {
        polls++;
        if (polls > 60) {
          clearInterval(pollInterval);
          setupLog(log, 'Login timed out after 2 minutes.', 'var(--accent-orange)');
          setupLog(log, 'Click "Browser Login" to try again.', 'var(--accent-orange)');
          btn.disabled = false;
          btn.textContent = 'Browser Login';
          return;
        }
        btn.textContent = dots[polls % dots.length] + ' Waiting...';
        fetch('/api/auth-status', { cache: 'no-store' }).then(r => r.json()).then(data => {
          if (data[provider] && data[provider].authenticated) {
            clearInterval(pollInterval);
            setupLog(log, 'Authentication successful!', 'var(--accent-green)');
            setupLog(log, name + ' is ready to use.', 'var(--accent-green)');
            btn.textContent = 'Logged in ✓';
            btn.style.opacity = '0.6';
            checkAuthStatus();
          }
        }).catch(err => { console.error('fetch error:', err); });
      }, 2000);
    })
    .catch(() => {
      setupLog(log, 'Failed to start login process.', 'var(--accent-red)');
      setupLog(log, 'Make sure the CLI is installed first.', 'var(--accent-orange)');
      btn.disabled = false;
      btn.textContent = 'Browser Login';
    });
  };

  window.saveKey = function(provider, inputId) {
    const input = $(inputId);
    const key = input.value.trim();
    if (!key) return;
    fetch('/api/save-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key }),
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        input.value = '';
        input.placeholder = 'Saved!';
        checkAuthStatus();
      }
    })
    .catch(err => { console.error('fetch error:', err); });
  };

  window.closeSetup = function() {
    switchTab('flow');
  };

  // First run handling
  window.confirmFirstRun = function() {
    $('firstRunOverlay').style.display = 'none';
  };

  window.dismissFirstRun = function() {
    $('firstRunOverlay').style.display = 'none';
    switchTab('models');
  };

  function checkFirstRun() {
    fetch('/api/state', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.firstRun) {
          showFirstRunOverlay(data);
        }
      })
      .catch(err => { console.error('fetch error:', err); });
  }

  function showFirstRunOverlay(data) {
    $('firstRunOverlay').style.display = 'flex';
    if (models.length > 0) {
      $('firstRunModels').innerHTML = '<h3 style="font-size:13px;margin-bottom:8px;">' + t.models + '</h3>' +
        models.map(m => '<div style="padding:4px 0;font-size:12px;">' + escapeHtml(m.name || m.id) + ' (' + escapeHtml(m.provider || '') + ')</div>').join('');
    }
    if (Object.keys(routing).length > 0) {
      $('firstRunRouting').innerHTML = '<h3 style="font-size:13px;margin-bottom:8px;">' + t.routing + '</h3>' +
        Object.entries(routing).map(([k, v]) => '<div style="padding:4px 0;font-size:12px;display:flex;justify-content:space-between;"><span>' + k + '</span><span style="font-family:var(--font-mono)">' + v + '</span></div>').join('');
    }
  }

  // ── Init ──
  function init() {
    applyI18n();
    render();
    tickClock();
    setInterval(tickClock, 1000);
    requestAnimationFrame(tickElapsed);
    connectSSE();
    fetchFullState();
    initPromptInputs();
    loadRouting();
    checkAuthStatus();

    // Init workflow mode selector
    setWorkflowMode(_workflowMode);

    // Panel resizer
    const resizer = $('panelResizer');
    if (resizer) {
      let dragging = false;
      resizer.addEventListener('mousedown', (e) => {
        dragging = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const w = Math.max(280, Math.min(e.clientX, window.innerWidth - 400));
        document.getElementById('app').style.setProperty('--left-width', w + 'px');
      });
      document.addEventListener('mouseup', () => {
        if (dragging) {
          dragging = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();