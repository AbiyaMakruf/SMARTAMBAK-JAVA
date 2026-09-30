// Host Presenter Script
const socket = io();

// State
let hostState = {
  status: 'LOBBY',
  currentQuestionIndex: -1,
  totalQuestions: 10,
  players: [],
  previousLeaderboardMap: {},
  currentQuestion: null,
  detailedSummary: []
};

// DOM Screens
const screens = {
  lobby: document.getElementById('host-lobby'),
  countdown: document.getElementById('host-countdown'),
  question: document.getElementById('host-question'),
  result: document.getElementById('host-result'),
  leaderboard: document.getElementById('host-leaderboard'),
  gameover: document.getElementById('host-gameover')
};

// Controls
const sessionStatus = document.getElementById('session-status');
const btnHostAction = document.getElementById('btn-host-action');
const btnHostSkip = document.getElementById('btn-host-skip');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnExportCsvTable = document.getElementById('btn-export-csv-table');
const btnHostReset = document.getElementById('btn-host-reset');
const btnLobbyStart = document.getElementById('btn-lobby-start');
const btnHostSound = document.getElementById('btn-host-sound');
const checkShuffle = document.getElementById('check-shuffle-options');
const selectHostQuiz = document.getElementById('select-host-quiz');
const hostQuizBadge = document.getElementById('host-quiz-badge');

if (checkShuffle) {
  checkShuffle.addEventListener('change', () => {
    socket.emit('host_toggle_shuffle', { enabled: checkShuffle.checked });
  });
}

if (selectHostQuiz) {
  selectHostQuiz.addEventListener('change', () => {
    const selected = selectHostQuiz.value;
    socket.emit('host_change_quiz_set', { quizId: selected });
  });
}

// Floating Emoji Reactions from participants
socket.on('reaction_received', (data) => {
  const emoji = data && data.emoji;
  if (!emoji) return;

  const el = document.createElement('div');
  el.className = 'floating-reaction';
  el.innerText = emoji;

  // Random horizontal position (10% to 90%)
  const leftPos = Math.random() * 80 + 10;
  el.style.left = `${leftPos}%`;

  document.body.appendChild(el);
  setTimeout(() => {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }, 2800);
});

if (btnHostSound) {
  btnHostSound.addEventListener('click', () => {
    if (window.soundFX) {
      window.soundFX.init();
      const isMuted = window.soundFX.toggleMute();
      btnHostSound.innerText = isMuted ? '🔇 Sound Off' : '🔊 Sound On';
    }
  });
}

function switchScreen(screenKey) {
  Object.keys(screens).forEach(key => {
    if (screens[key]) {
      screens[key].classList.toggle('active', key === screenKey);
    }
  });
}

// Generate QR Code and show Join URL
const joinUrl = window.location.origin;
document.getElementById('display-join-url').innerText = joinUrl;

try {
  new QRCode(document.getElementById('qrcode-box'), {
    text: joinUrl,
    width: 100,
    height: 100,
    colorDark: '#0f101d',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
} catch (e) {
  console.log('QRCode initialization skipped or library not loaded:', e);
}

// Canvas Confetti Celebration
function launchConfetti(durationMs = 4500) {
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const colors = ['#ffd700', '#ff3d00', '#00e676', '#00b0ff', '#e040fb', '#ffffff'];
    const pieces = [];
    const count = Math.min(110, Math.floor(width / 10));

    for (let i = 0; i < count; i++) {
      pieces.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.4,
        r: Math.random() * 8 + 4,
        d: Math.random() * count,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.floor(Math.random() * 10) - 10,
        tiltAngleInc: (Math.random() * 0.07) + 0.05,
        tiltAngle: 0,
        speedY: Math.random() * 3 + 2,
        speedX: (Math.random() - 0.5) * 3
      });
    }

    let animationFrame;
    const startTime = Date.now();

    function draw() {
      ctx.clearRect(0, 0, width, height);
      pieces.forEach(p => {
        p.tiltAngle += p.tiltAngleInc;
        p.y += (Math.cos(p.d) + 1 + p.speedY) / 1.5;
        p.x += p.speedX;
        p.tilt = Math.sin(p.tiltAngle - (p.d / 3)) * 12;

        ctx.beginPath();
        ctx.lineWidth = p.r;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
        ctx.stroke();
      });

      if (Date.now() - startTime < durationMs) {
        animationFrame = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(animationFrame);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    }

    draw();
  } catch (e) {}
}

// Connect as Host
socket.emit('host_join');

socket.on('host_synced', (data) => {
  hostState.status = data.status;
  hostState.players = data.players || [];
  hostState.totalQuestions = data.totalQuestions || 10;
  hostState.currentQuestionIndex = data.currentQuestionIndex;

  if (data.quizSets && selectHostQuiz) {
    selectHostQuiz.innerHTML = '';
    data.quizSets.forEach(qs => {
      const opt = document.createElement('option');
      opt.value = qs.id;
      opt.textContent = `${qs.title} (${qs.count} Qs)`;
      if (qs.id === data.quizId) opt.selected = true;
      selectHostQuiz.appendChild(opt);
    });
  }

  if (data.quizTitle && hostQuizBadge) {
    hostQuizBadge.innerText = `🎯 ${data.quizTitle.toUpperCase()}`;
  }

  if (selectHostQuiz) {
    selectHostQuiz.disabled = (hostState.status !== 'LOBBY');
  }

  // Restore screen state seamlessly if host refreshed!
  if (data.status === 'LOBBY') {
    switchScreen('lobby');
    sessionStatus.innerText = 'LOBBY';
    btnHostAction.style.display = 'none';
    btnHostSkip.style.display = 'none';
    updateLobbyPlayers();
  } else if (data.status === 'COUNTDOWN') {
    switchScreen('countdown');
    sessionStatus.innerText = 'STARTING';
    document.getElementById('host-countdown-val').innerText = 'Ready!';
    btnHostAction.style.display = 'none';
    btnHostSkip.style.display = 'none';
  } else if (data.status === 'QUESTION_ACTIVE' && data.currentQuestion) {
    renderQuestion(data.currentQuestion, data.timeLeft, data.answeredCount, data.totalPlayers);
  } else if (data.status === 'QUESTION_RESULT' && data.currentQuestion) {
    renderResult(data);
  } else if (data.status === 'LEADERBOARD') {
    latestLeaderboardData = data.leaderboard || [];
    switchScreen('leaderboard');
    sessionStatus.innerText = 'LEADERBOARD';
    btnHostSkip.style.display = 'none';
    btnHostAction.style.display = 'inline-flex';
    const isLast = (data.currentQuestionIndex + 1 >= data.totalQuestions);
    btnHostAction.innerText = isLast ? 'Show Final Results 🏆' : 'Next Question ➔';
    renderLeaderboardView();
  } else if (data.status === 'GAME_OVER') {
    renderGameOver(data);
  }
});

socket.on('quiz_info_updated', (data) => {
  if (data.quizTitle && hostQuizBadge) {
    hostQuizBadge.innerText = `🎯 ${data.quizTitle.toUpperCase()}`;
  }
  if (selectHostQuiz && data.quizId) {
    selectHostQuiz.value = data.quizId;
  }
  if (data.totalQuestions) {
    hostState.totalQuestions = data.totalQuestions;
  }
});

// Update Lobby
socket.on('player_list_update', (data) => {
  hostState.players = data.players || [];
  updateLobbyPlayers();
});

function updateLobbyPlayers() {
  document.getElementById('lobby-count').innerText = hostState.players.length;
  const grid = document.getElementById('player-grid');
  grid.innerHTML = '';

  hostState.players.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';
    const nimDisplay = (p.nim && p.nim !== '-') ? `NIM: ${p.nim}` : 'Tanpa NIM';
    chip.innerHTML = `
      <span class="p-name">${p.name}</span>
      <span class="p-nim">${nimDisplay}</span>
      <button type="button" class="btn-kick-player" title="Kick ${p.name}">✖</button>
    `;

    const kickBtn = chip.querySelector('.btn-kick-player');
    kickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Remove "${p.name}" (${nimDisplay}) from the quiz lobby?`)) {
        socket.emit('host_kick_player', { playerId: p.id });
      }
    });

    grid.appendChild(chip);
  });
}

// Actions
btnLobbyStart.addEventListener('click', () => {
  if (hostState.players.length === 0) {
    alert('Wait for at least 1 participant to join before starting!');
    return;
  }
  socket.emit('host_start_quiz');
});

btnHostAction.addEventListener('click', () => {
  if (hostState.status === 'QUESTION_RESULT') {
    socket.emit('host_show_leaderboard');
  } else if (hostState.status === 'LEADERBOARD') {
    socket.emit('host_next_question');
  }
});

btnHostSkip.addEventListener('click', () => {
  socket.emit('host_skip_question');
});

function triggerCsvDownload() {
  window.open('/api/export-csv', '_blank');
}
btnExportCsv.addEventListener('click', triggerCsvDownload);
btnExportCsvTable.addEventListener('click', triggerCsvDownload);

btnHostReset.addEventListener('click', () => {
  if (confirm('Are you sure you want to reset the quiz session? All players will be kicked to lobby.')) {
    socket.emit('host_reset_quiz');
  }
});

// Socket Events
socket.on('start_countdown', (data) => {
  hostState.status = 'COUNTDOWN';
  sessionStatus.innerText = 'STARTING';
  if (selectHostQuiz) selectHostQuiz.disabled = true;
  switchScreen('countdown');
  btnHostAction.style.display = 'none';
  btnHostSkip.style.display = 'none';
  document.getElementById('host-countdown-val').innerText = data.count;
  if (window.soundFX) window.soundFX.playTick();
});

function renderQuestion(q, timeLeft, answeredCount, totalCount) {
  if (!q) return;
  hostState.status = 'QUESTION_ACTIVE';
  hostState.currentQuestion = q;
  sessionStatus.innerText = `QUESTION ${q.index + 1}/${q.total || hostState.totalQuestions}`;

  switchScreen('question');

  btnHostAction.style.display = 'none';
  btnHostSkip.style.display = 'inline-flex';
  btnHostSkip.innerText = 'Skip Question / End Timer';

  document.getElementById('host-q-indicator').innerText = `Question ${q.index + 1} of ${q.total || hostState.totalQuestions}`;
  document.getElementById('host-q-text').innerText = q.question;
  document.getElementById('host-timer-circle').innerText = (timeLeft !== undefined && timeLeft !== null) ? timeLeft : (q.timeLimit || 25);
  document.getElementById('host-answered-count').innerText = (answeredCount !== undefined) ? answeredCount : '0';
  document.getElementById('host-total-count').innerText = (totalCount !== undefined) ? totalCount : hostState.players.length;

  const codePre = document.getElementById('host-code-pre');
  const codeEl = document.getElementById('host-code-snippet');
  if (q.code) {
    codeEl.textContent = q.code;
    codePre.style.display = 'block';
    if (window.Prism) Prism.highlightElement(codeEl);
  } else {
    codePre.style.display = 'none';
  }

  const optionsGrid = document.getElementById('host-options-grid');
  optionsGrid.innerHTML = '';

  const shapes = ['▲', '◆', '●', '■'];

  if (q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'multi_select') {
    (q.options || []).forEach((opt, idx) => {
      const card = document.createElement('div');
      card.className = `host-opt-card opt-${idx % 4}`;
      const prefix = q.type === 'multi_select' ? '☑ ' : '';
      card.innerHTML = `
        <span style="font-size: 26px;">${shapes[idx % 4]}</span>
        <span>${prefix}${opt}</span>
      `;
      optionsGrid.appendChild(card);
    });
  } else if (q.type === 'fill_in') {
    const card = document.createElement('div');
    card.className = 'host-opt-card opt-1';
    card.style.gridColumn = 'span 2';
    card.style.justifyContent = 'center';
    card.innerHTML = `<span>⌨️ Participants type their answers on their phones</span>`;
    optionsGrid.appendChild(card);
  }
}

socket.on('new_question', (q) => {
  renderQuestion(q, q.timeLimit, 0, hostState.players.length);
});

// Timer tick
socket.on('timer_tick', (data) => {
  const timerCircle = document.getElementById('host-timer-circle');
  if (timerCircle) timerCircle.innerText = data.timeLeft;

  if (window.soundFX) {
    if (data.timeLeft <= 5 && data.timeLeft > 0) {
      window.soundFX.playUrgentTick();
    } else if (data.timeLeft > 0 && data.timeLeft % 5 === 0) {
      window.soundFX.playTick();
    }
  }
});

// Answer count update
socket.on('answer_count_update', (data) => {
  document.getElementById('host-answered-count').innerText = data.answeredCount;
  document.getElementById('host-total-count').innerText = data.totalPlayers;
});

function renderResult(data) {
  if (!data || !data.question) return;
  hostState.status = 'QUESTION_RESULT';
  sessionStatus.innerText = 'REVEAL';

  switchScreen('result');

  btnHostSkip.style.display = 'none';
  btnHostAction.style.display = 'inline-flex';
  btnHostAction.innerText = 'Show Leaderboard ➔';

  const q = data.question;
  document.getElementById('result-q-indicator').innerText = `Results: Question ${q.id}`;
  document.getElementById('result-total-answered').innerText = `${data.totalAnswered || data.answeredCount || 0} / ${data.totalPlayers || hostState.players.length}`;
  document.getElementById('result-q-text').innerText = q.question;
  document.getElementById('result-explanation-text').innerText = q.explanation || 'No explanation provided.';

  const resultGrid = document.getElementById('result-options-grid');
  resultGrid.innerHTML = '';

  const shapes = ['▲', '◆', '●', '■'];
  const dist = data.distribution || {};

  if (q.type === 'multiple_choice' || q.type === 'true_false') {
    (q.options || []).forEach((opt, idx) => {
      const isCorrect = idx === Number(q.correctAnswer);
      const count = dist[idx] || 0;

      const card = document.createElement('div');
      card.className = `host-opt-card opt-${idx % 4} ${isCorrect ? 'is-correct' : 'dimmed'}`;
      card.innerHTML = `
        <span style="font-size: 26px;">${shapes[idx % 4]}</span>
        <span>${opt} ${isCorrect ? '✓' : ''}</span>
        <span class="opt-stat-badge">${count}</span>
      `;
      resultGrid.appendChild(card);
    });
  } else if (q.type === 'multi_select') {
    (q.options || []).forEach((opt, idx) => {
      const isCorrect = (q.correctAnswers || []).includes(idx);
      const count = dist[idx] || 0;

      const card = document.createElement('div');
      card.className = `host-opt-card opt-${idx % 4} ${isCorrect ? 'is-correct' : 'dimmed'}`;
      card.innerHTML = `
        <span style="font-size: 26px;">${shapes[idx % 4]}</span>
        <span>${opt} ${isCorrect ? '✓ [Key]' : ''}</span>
        <span class="opt-stat-badge">${count} selected</span>
      `;
      resultGrid.appendChild(card);
    });
  } else if (q.type === 'fill_in') {
    const cardCorrect = document.createElement('div');
    cardCorrect.className = 'host-opt-card opt-3 is-correct';
    cardCorrect.innerHTML = `
      <span>Acceptable: <strong>${(q.correctAnswers || []).join(', ')}</strong></span>
      <span class="opt-stat-badge">${dist.correct || 0} Correct</span>
    `;

    const cardIncorrect = document.createElement('div');
    cardIncorrect.className = 'host-opt-card opt-0 dimmed';
    cardIncorrect.innerHTML = `
      <span>Incorrect / Blank</span>
      <span class="opt-stat-badge">${dist.incorrect || 0}</span>
    `;

    resultGrid.appendChild(cardCorrect);
    resultGrid.appendChild(cardIncorrect);
  }
}

// Question Result Reveal
socket.on('question_result', (data) => {
  renderResult(data);
});

// Number roll-up counter animation
function animateScoreCount(elementId, start, end, duration) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (start === end) {
    el.innerText = `${end.toLocaleString()} pts`;
    return;
  }

  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * ease);

    el.innerText = `${current.toLocaleString()} pts`;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.innerText = `${end.toLocaleString()} pts`;
    }
  }

  requestAnimationFrame(update);
}

// Animated Leaderboard with Live Focus Monitor
let latestLeaderboardData = [];
let lbViewMode = 'top5'; // 'top5' or 'all'

const btnLbTop5 = document.getElementById('btn-lb-top5');
const btnLbAll = document.getElementById('btn-lb-all');

if (btnLbTop5 && btnLbAll) {
  btnLbTop5.addEventListener('click', () => {
    lbViewMode = 'top5';
    btnLbTop5.classList.add('active');
    btnLbAll.classList.remove('active');
    renderLeaderboardView();
  });

  btnLbAll.addEventListener('click', () => {
    lbViewMode = 'all';
    btnLbAll.classList.add('active');
    btnLbTop5.classList.remove('active');
    renderLeaderboardView();
  });
}

function renderLeaderboardView() {
  const list = document.getElementById('host-leader-list');
  if (!list) return;
  list.innerHTML = '';

  const allCountEl = document.getElementById('lb-all-count');
  if (allCountEl) allCountEl.innerText = latestLeaderboardData.length;

  const playersToShow = lbViewMode === 'all' ? latestLeaderboardData : latestLeaderboardData.slice(0, 5);
  const currentMap = {};

  playersToShow.forEach((p, idx) => {
    const currentRank = idx + 1;
    const prev = hostState.previousLeaderboardMap ? hostState.previousLeaderboardMap[p.id] : null;
    const prevRank = prev ? prev.rank : currentRank;
    const prevScore = prev ? prev.score : 0;
    const rankDiff = prevRank - currentRank;
    const scoreDiff = p.score - prevScore;

    currentMap[p.id] = { rank: currentRank, score: p.score };

    let rankBadgeHtml = '';
    let cardClimbClass = '';

    if (prev) {
      if (rankDiff > 0) {
        rankBadgeHtml = `<span class="rank-indicator up" title="Climbed ${rankDiff} ranks!">▲ +${rankDiff}</span>`;
        cardClimbClass = 'climbing';
      } else if (rankDiff < 0) {
        rankBadgeHtml = `<span class="rank-indicator down" title="Fell ${Math.abs(rankDiff)} ranks">▼ ${Math.abs(rankDiff)}</span>`;
        cardClimbClass = 'falling';
      } else {
        rankBadgeHtml = `<span class="rank-indicator same" title="Rank unchanged">—</span>`;
      }
    } else {
      rankBadgeHtml = `<span class="rank-indicator same">—</span>`;
    }

    const streakHtml = p.streak >= 2 ? `<div class="streak-tag">🔥 ${p.streak} in a row!</div>` : '';
    const deltaHtml = (scoreDiff > 0 && prev) ? `<span class="score-delta">+${scoreDiff.toLocaleString()}</span>` : '';

    const leaves = Number(p.tabSwitches) || 0;
    const leaveBadgeHtml = leaves > 0
      ? `<span class="lb-leave-pill warning" title="${p.name} left quiz screen ${leaves}x">⚠️ ${leaves}x Left Screen</span>`
      : `<span class="lb-leave-pill clean" title="Zero screen leaves">🛡️ Focused</span>`;

    const item = document.createElement('div');
    item.className = `leader-item ${cardClimbClass}`;
    item.style.animationDelay = `${Math.min(idx * 0.1, 0.8)}s`;
    item.innerHTML = `
      <div class="leader-rank-wrapper">
        <div class="leader-rank">#${currentRank}</div>
        ${rankBadgeHtml}
      </div>
      <div class="leader-name">
        <div class="leader-name-row">
          <span class="p-fullname">${p.name}</span>
          ${leaveBadgeHtml}
        </div>
        <span class="leader-nim">${(p.nim && p.nim !== '-') ? `NIM: ${p.nim}` : ''}</span>
        ${streakHtml}
      </div>
      <div class="score-wrapper">
        <div class="leader-score" id="score-counter-${p.id}">${prevScore.toLocaleString()} pts</div>
        ${deltaHtml}
      </div>
    `;
    list.appendChild(item);

    animateScoreCount(`score-counter-${p.id}`, prevScore, p.score, 1100 + (Math.min(idx, 5) * 120));
  });

  // Calculate Highest Climber for Gamification Highlight
  let topClimber = null;
  let maxGain = 0;

  playersToShow.forEach((p, idx) => {
    const currentRank = idx + 1;
    const prev = hostState.previousLeaderboardMap ? hostState.previousLeaderboardMap[p.id] : null;
    if (prev) {
      const gain = prev.rank - currentRank;
      if (gain > maxGain && gain >= 2) {
        maxGain = gain;
        topClimber = { name: p.name, gain: gain };
      }
    }
  });

  const climberBanner = document.getElementById('host-highest-climber');
  if (climberBanner) {
    if (topClimber && maxGain >= 2) {
      climberBanner.innerHTML = `
        <span class="climber-rocket">🚀</span>
        <div class="climber-text">
          <strong>HIGHEST CLIMBER OF THE ROUND:</strong>
          <span style="color: #69f0ae; font-weight: 800;">${topClimber.name}</span>
          naik <strong style="color: #ffeb3b;">+${topClimber.gain} peringkat!</strong> 🔥
        </div>
      `;
      climberBanner.style.display = 'flex';
    } else {
      climberBanner.style.display = 'none';
    }
  }

  if (lbViewMode !== 'all') {
    hostState.previousLeaderboardMap = currentMap;
  }

  // Render Focus Watchlist
  renderFocusWatchlist();
}

function renderFocusWatchlist() {
  const container = document.getElementById('lb-focus-items');
  const countBadge = document.getElementById('lb-focus-total-badge');
  if (!container || !countBadge) return;

  const violators = latestLeaderboardData
    .filter(p => (Number(p.tabSwitches) || 0) > 0)
    .sort((a, b) => (Number(b.tabSwitches) || 0) - (Number(a.tabSwitches) || 0));

  if (violators.length === 0) {
    countBadge.innerText = '0 Left Screen';
    countBadge.className = 'badge-focus-status badge-ok';
    container.innerHTML = `
      <div class="focus-empty-state">
        <div class="focus-empty-icon">🛡️</div>
        <div style="font-weight: 700; color: #00e676; margin-bottom: 4px;">Clean Session</div>
        <div style="font-size: 12px; color: var(--text-muted);">All active students are focused on the quiz screen.</div>
      </div>
    `;
  } else {
    countBadge.innerText = `${violators.length} Left Screen`;
    countBadge.className = 'badge-focus-status badge-warn';
    container.innerHTML = '';

    violators.forEach(p => {
      const row = document.createElement('div');
      row.className = 'focus-item-row';
      const nimText = (p.nim && p.nim !== '-') ? `NIM: ${p.nim}` : 'Tanpa NIM';
      row.innerHTML = `
        <div class="focus-item-info">
          <span class="focus-item-name">${p.name}</span>
          <span class="focus-item-nim">${nimText}</span>
        </div>
        <span class="focus-item-tag">⚠️ ${p.tabSwitches}x Left Screen</span>
      `;
      container.appendChild(row);
    });
  }
}

socket.on('show_leaderboard', (data) => {
  hostState.status = 'LEADERBOARD';
  sessionStatus.innerText = 'LEADERBOARD';

  switchScreen('leaderboard');

  btnHostSkip.style.display = 'none';
  btnHostAction.style.display = 'inline-flex';
  const isLast = hostState.currentQuestion && (hostState.currentQuestion.index + 1 >= hostState.totalQuestions);
  btnHostAction.innerText = isLast ? 'Show Final Results 🏆' : 'Next Question ➔';

  latestLeaderboardData = data.leaderboard || [];

  if (window.soundFX) window.soundFX.playScoreRoll();

  renderLeaderboardView();
});

function renderGameOver(data) {
  if (!data) return;
  hostState.status = 'GAME_OVER';
  sessionStatus.innerText = 'GAME OVER';

  switchScreen('gameover');

  btnHostAction.style.display = 'none';
  btnHostSkip.style.display = 'none';
  btnExportCsv.style.display = 'inline-flex';
  if (window.soundFX) window.soundFX.playFanfare();
  launchConfetti(5000);

  hostState.detailedSummary = data.detailedSummary || [];

  // 1. Render Podium
  const podiumContainer = document.getElementById('podium-container');
  podiumContainer.innerHTML = '';

  const top3 = data.podium || [];
  
  const orderMapping = [
    { rank: 2, player: top3[1], class: 'step-2' },
    { rank: 1, player: top3[0], class: 'step-1' },
    { rank: 3, player: top3[2], class: 'step-3' }
  ];

  orderMapping.forEach(item => {
    if (item.player) {
      const step = document.createElement('div');
      step.className = `podium-step ${item.class}`;
      const nimText = (item.player.nim && item.player.nim !== '-') ? `NIM: ${item.player.nim}` : '';
      step.innerHTML = `
        <div class="podium-player-name">
          ${item.player.name}
          ${nimText ? `<div class="podium-player-nim">${nimText}</div>` : ''}
        </div>
        <div class="podium-score">${item.player.score.toLocaleString()} pts</div>
        <div class="step-rank">${item.rank}</div>
      `;
      podiumContainer.appendChild(step);
    }
  });

  // 2. Render Classroom Insights
  const insightsContainer = document.getElementById('insights-container');
  if (insightsContainer && data.insights) {
    const ins = data.insights;
    insightsContainer.innerHTML = `
      <div class="insight-card danger">
        <div class="insight-title">🔴 Most Challenging Topic</div>
        <div class="insight-val">${ins.toughestQuestion ? `Q${ins.toughestQuestion.index} (${ins.toughestQuestion.accuracy}% Correct)` : 'N/A'}</div>
        <div class="insight-desc">${ins.toughestQuestion ? ins.toughestQuestion.question : '-'}</div>
      </div>
      <div class="insight-card success">
        <div class="insight-title">🟢 Best Mastered Topic</div>
        <div class="insight-val">${ins.easiestQuestion ? `Q${ins.easiestQuestion.index} (${ins.easiestQuestion.accuracy}% Correct)` : 'N/A'}</div>
        <div class="insight-desc">${ins.easiestQuestion ? ins.easiestQuestion.question : '-'}</div>
      </div>
      <div class="insight-card info">
        <div class="insight-title">🎯 Class Accuracy</div>
        <div class="insight-val">${ins.overallAccuracy}% Average</div>
        <div class="insight-desc">Calculated across all submissions for all questions.</div>
      </div>
      <div class="insight-card warning">
        <div class="insight-title">⚡ Speed Demon</div>
        <div class="insight-val">${ins.fastestStudent ? `${ins.fastestStudent.name}` : 'N/A'}</div>
        <div class="insight-desc">${ins.fastestStudent ? `Avg response: ${ins.fastestStudent.avgTime}s ${(ins.fastestStudent.nim && ins.fastestStudent.nim !== '-') ? `(${ins.fastestStudent.nim})` : ''}` : '-'}</div>
      </div>
    `;
    insightsContainer.style.display = 'grid';
  }

  // 3. Render Full Matrix Table
  renderMatrixTable(hostState.detailedSummary, data.totalQuestions || hostState.totalQuestions);
}

// Game Over & Matrix Table
socket.on('game_over', (data) => {
  renderGameOver(data);
});

function renderMatrixTable(players, totalQuestions) {
  // Build headers
  const theadTr = document.getElementById('matrix-thead-tr');
  theadTr.innerHTML = `
    <th>Rank</th>
    <th>NIM</th>
    <th>Full Name</th>
    <th>Score</th>
    <th>Correct</th>
    <th>Tab Switches</th>
  `;

  for (let i = 1; i <= totalQuestions; i++) {
    const th = document.createElement('th');
    th.innerText = `Q${i}`;
    theadTr.appendChild(th);
  }

  // Build body
  const tbody = document.getElementById('matrix-tbody');
  tbody.innerHTML = '';

  players.forEach(p => {
    const tr = document.createElement('tr');
    tr.dataset.name = (p.name || '').toLowerCase();
    tr.dataset.nim = (p.nim || '').toLowerCase();

    const tabSwitchBadge = (p.tabSwitches && p.tabSwitches > 0)
      ? `<span style="background: rgba(226, 27, 60, 0.2); color: #ff5252; padding: 2px 8px; border-radius: 6px; font-weight: 700;">⚠️ ${p.tabSwitches}x</span>`
      : `<span style="color: #00e676; font-size: 12px;">✓ Clean</span>`;

    let qCellsHtml = '';
    p.answers.forEach(a => {
      let badge = '';
      if (a.submittedAnswer === null || a.submittedAnswer === undefined) {
        badge = `<span class="badge-incorrect" title="No answer">-</span>`;
      } else if (a.isCorrect) {
        badge = `<span class="badge-correct" title="Answered: ${a.submittedAnswer}">✓ ${a.submittedAnswer}</span>`;
      } else {
        badge = `<span class="badge-incorrect" title="Answered: ${a.submittedAnswer}">✗ ${a.submittedAnswer}</span>`;
      }
      qCellsHtml += `<td>${badge}</td>`;
    });

    tr.innerHTML = `
      <td><strong>#${p.rank}</strong></td>
      <td><code>${p.nim}</code></td>
      <td><strong>${p.name}</strong></td>
      <td style="color: #ffca28; font-weight: 700;">${p.score.toLocaleString()}</td>
      <td style="color: #00e676; font-weight: 700;">${p.correctCount} / ${totalQuestions}</td>
      <td style="text-align: center;">${tabSwitchBadge}</td>
      ${qCellsHtml}
    `;

    tbody.appendChild(tr);
  });
}

// Live Anti-Cheat alert to Host
socket.on('host_player_alert', (data) => {
  const p = latestLeaderboardData.find(item => item.id === data.playerId || item.nim === data.nim);
  if (p) {
    p.tabSwitches = data.tabSwitches;
    if (hostState.status === 'LEADERBOARD') {
      renderLeaderboardView();
    }
  }

  const alertToast = document.createElement('div');
  alertToast.style.cssText = `
    position: fixed;
    top: 60px;
    right: 20px;
    background: #e21b3c;
    color: white;
    padding: 12px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
    z-index: 999999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  alertToast.innerHTML = `⚠️ <span>${data.name} (${data.nim}) left the quiz screen! (Count: ${data.tabSwitches}x)</span>`;
  document.body.appendChild(alertToast);

  setTimeout(() => {
    if (alertToast && alertToast.parentNode) {
      alertToast.parentNode.removeChild(alertToast);
    }
  }, 4500);
});

// Live Late Joiner alert to Host
socket.on('host_late_joiner_alert', (data) => {
  const alertToast = document.createElement('div');
  alertToast.style.cssText = `
    position: fixed;
    top: 120px;
    right: 20px;
    background: #ff9800;
    color: #1a1a1a;
    padding: 12px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 800;
    z-index: 999999;
    box-shadow: 0 6px 25px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    gap: 8px;
    border: 2px solid #fff;
    animation: popBadge 0.4s ease-out;
  `;
  alertToast.innerHTML = `⏳ <span><strong>${data.name}</strong> (${data.nim}) join di tengah sesi pada Soal ${data.joinedAtQuestion}/${data.totalQuestions} (${data.missedCount} soal terlewat, 0 pts)</span>`;
  document.body.appendChild(alertToast);

  if (window.soundFX) window.soundFX.playTick();

  setTimeout(() => {
    if (alertToast && alertToast.parentNode) {
      alertToast.parentNode.removeChild(alertToast);
    }
  }, 6000);
});

// Search Filter
document.getElementById('matrix-search').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const rows = document.querySelectorAll('#matrix-tbody tr');

  rows.forEach(r => {
    const name = r.dataset.name || '';
    const nim = r.dataset.nim || '';
    if (name.includes(query) || nim.includes(query)) {
      r.style.display = '';
    } else {
      r.style.display = 'none';
    }
  });
});

// Reset event
socket.on('quiz_reset', () => {
  hostState.status = 'LOBBY';
  hostState.players = [];
  hostState.previousLeaderboardMap = {};
  hostState.currentQuestionIndex = -1;
  sessionStatus.innerText = 'LOBBY';

  if (selectHostQuiz) selectHostQuiz.disabled = false;

  btnHostAction.style.display = 'none';
  btnHostSkip.style.display = 'none';
  btnExportCsv.style.display = 'none';

  updateLobbyPlayers();
  switchScreen('lobby');
});
