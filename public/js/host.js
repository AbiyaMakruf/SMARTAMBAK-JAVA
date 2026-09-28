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

// Connect as Host
socket.emit('host_join');

socket.on('host_synced', (data) => {
  hostState.status = data.status;
  hostState.players = data.players || [];
  hostState.totalQuestions = data.totalQuestions || 10;

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

  updateLobbyPlayers();
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
    chip.innerHTML = `
      <span class="p-name">${p.name}</span>
      <span class="p-nim">NIM: ${p.nim}</span>
      <button type="button" class="btn-kick-player" title="Kick ${p.name}">✖</button>
    `;

    const kickBtn = chip.querySelector('.btn-kick-player');
    kickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Remove "${p.name}" (NIM: ${p.nim}) from the quiz lobby?`)) {
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

socket.on('new_question', (q) => {
  hostState.status = 'QUESTION_ACTIVE';
  hostState.currentQuestion = q;
  sessionStatus.innerText = `QUESTION ${q.index + 1}/${q.total}`;

  switchScreen('question');

  btnHostAction.style.display = 'none';
  btnHostSkip.style.display = 'inline-flex';
  btnHostSkip.innerText = 'Skip Question / End Timer';

  document.getElementById('host-q-indicator').innerText = `Question ${q.index + 1} of ${q.total}`;
  document.getElementById('host-q-text').innerText = q.question;
  document.getElementById('host-timer-circle').innerText = q.timeLimit || 25;
  document.getElementById('host-answered-count').innerText = '0';
  document.getElementById('host-total-count').innerText = hostState.players.length;

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

  if (q.type === 'multiple_choice' || q.type === 'true_false') {
    q.options.forEach((opt, idx) => {
      const card = document.createElement('div');
      card.className = `host-opt-card opt-${idx % 4}`;
      card.innerHTML = `
        <span style="font-size: 26px;">${shapes[idx % 4]}</span>
        <span>${opt}</span>
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

// Question Result Reveal
socket.on('question_result', (data) => {
  hostState.status = 'QUESTION_RESULT';
  sessionStatus.innerText = 'REVEAL';

  switchScreen('result');

  btnHostSkip.style.display = 'none';
  btnHostAction.style.display = 'inline-flex';
  btnHostAction.innerText = 'Show Leaderboard ➔';

  const q = data.question;
  document.getElementById('result-q-indicator').innerText = `Results: Question ${q.id}`;
  document.getElementById('result-total-answered').innerText = `${data.totalAnswered} / ${data.totalPlayers}`;
  document.getElementById('result-q-text').innerText = q.question;
  document.getElementById('result-explanation-text').innerText = q.explanation || 'No explanation provided.';

  const resultGrid = document.getElementById('result-options-grid');
  resultGrid.innerHTML = '';

  const shapes = ['▲', '◆', '●', '■'];

  if (q.type === 'multiple_choice' || q.type === 'true_false') {
    q.options.forEach((opt, idx) => {
      const isCorrect = idx === Number(q.correctAnswer);
      const count = data.distribution[idx] || 0;

      const card = document.createElement('div');
      card.className = `host-opt-card opt-${idx % 4} ${isCorrect ? 'is-correct' : 'dimmed'}`;
      card.innerHTML = `
        <span style="font-size: 26px;">${shapes[idx % 4]}</span>
        <span>${opt} ${isCorrect ? '✓' : ''}</span>
        <span class="opt-stat-badge">${count}</span>
      `;
      resultGrid.appendChild(card);
    });
  } else if (q.type === 'fill_in') {
    const cardCorrect = document.createElement('div');
    cardCorrect.className = 'host-opt-card opt-3 is-correct';
    cardCorrect.innerHTML = `
      <span>Acceptable: <strong>${q.correctAnswers.join(', ')}</strong></span>
      <span class="opt-stat-badge">${data.distribution.correct || 0} Correct</span>
    `;

    const cardIncorrect = document.createElement('div');
    cardIncorrect.className = 'host-opt-card opt-0 dimmed';
    cardIncorrect.innerHTML = `
      <span>Incorrect / Blank</span>
      <span class="opt-stat-badge">${data.distribution.incorrect || 0}</span>
    `;

    resultGrid.appendChild(cardCorrect);
    resultGrid.appendChild(cardIncorrect);
  }
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

// Animated Leaderboard
socket.on('show_leaderboard', (data) => {
  hostState.status = 'LEADERBOARD';
  sessionStatus.innerText = 'LEADERBOARD';

  switchScreen('leaderboard');

  btnHostSkip.style.display = 'none';
  btnHostAction.style.display = 'inline-flex';
  const isLast = hostState.currentQuestion && (hostState.currentQuestion.index + 1 >= hostState.totalQuestions);
  btnHostAction.innerText = isLast ? 'Show Final Results 🏆' : 'Next Question ➔';

  const list = document.getElementById('host-leader-list');
  list.innerHTML = '';

  const top5 = data.leaderboard.slice(0, 5);
  const currentMap = {};

  if (window.soundFX) window.soundFX.playScoreRoll();

  top5.forEach((p, idx) => {
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

    const item = document.createElement('div');
    item.className = `leader-item ${cardClimbClass}`;
    item.style.animationDelay = `${idx * 0.12}s`;
    item.innerHTML = `
      <div class="leader-rank-wrapper">
        <div class="leader-rank">#${currentRank}</div>
        ${rankBadgeHtml}
      </div>
      <div class="leader-name">
        <span>${p.name}</span>
        <span class="leader-nim">NIM: ${p.nim}</span>
        ${streakHtml}
      </div>
      <div class="score-wrapper">
        <div class="leader-score" id="score-counter-${p.id}">${prevScore.toLocaleString()} pts</div>
        ${deltaHtml}
      </div>
    `;
    list.appendChild(item);

    // Roll-up score animation
    animateScoreCount(`score-counter-${p.id}`, prevScore, p.score, 1100 + (idx * 120));
  });

  hostState.previousLeaderboardMap = currentMap;
});

// Game Over & Matrix Table
socket.on('game_over', (data) => {
  hostState.status = 'GAME_OVER';
  sessionStatus.innerText = 'GAME OVER';

  switchScreen('gameover');

  btnHostAction.style.display = 'none';
  btnHostSkip.style.display = 'none';
  btnExportCsv.style.display = 'inline-flex';
  if (window.soundFX) window.soundFX.playFanfare();

  hostState.detailedSummary = data.detailedSummary || [];

  // 1. Render Podium
  const podiumContainer = document.getElementById('podium-container');
  podiumContainer.innerHTML = '';

  const top3 = data.podium || [];
  
  // Order: 2nd on left, 1st center, 3rd right
  const orderMapping = [
    { rank: 2, player: top3[1], class: 'step-2' },
    { rank: 1, player: top3[0], class: 'step-1' },
    { rank: 3, player: top3[2], class: 'step-3' }
  ];

  orderMapping.forEach(item => {
    if (item.player) {
      const step = document.createElement('div');
      step.className = `podium-step ${item.class}`;
      step.innerHTML = `
        <div class="podium-player-name">
          ${item.player.name}
          <div class="podium-player-nim">NIM: ${item.player.nim}</div>
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
        <div class="insight-desc">${ins.fastestStudent ? `Avg response: ${ins.fastestStudent.avgTime}s (NIM: ${ins.fastestStudent.nim})` : '-'}</div>
      </div>
    `;
    insightsContainer.style.display = 'grid';
  }

  // 3. Render Full Matrix Table
  renderMatrixTable(hostState.detailedSummary, data.totalQuestions);
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
      ${qCellsHtml}
    `;

    tbody.appendChild(tr);
  });
}

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
