// Participant Client Script with Auto-Reconnect, Sound Effects, Anti-Cheating Shuffle, Reactions, and Prism Highlighting
const socket = io();

// State
let myPlayer = {
  name: '',
  nim: '',
  sessionToken: '',
  score: 0
};
let currentQuestion = null;
let currentMaxTime = 25;
const STORAGE_KEY = 'java_quiz_session';

// DOM Elements
const screens = {
  join: document.getElementById('screen-join'),
  lobby: document.getElementById('screen-lobby'),
  countdown: document.getElementById('screen-countdown'),
  question: document.getElementById('screen-question'),
  submitted: document.getElementById('screen-submitted'),
  result: document.getElementById('screen-result'),
  leaderboard: document.getElementById('screen-leaderboard'),
  gameover: document.getElementById('screen-gameover')
};

const quizHeader = document.getElementById('quiz-header');
const playerDisplayName = document.getElementById('player-display-name');
const playerScore = document.getElementById('player-score');
const kickedBanner = document.getElementById('kicked-banner');
const btnSoundToggle = document.getElementById('btn-sound-toggle');
const reactionBar = document.getElementById('reaction-bar');

// Progress Tracker Elements
const progressTracker = document.getElementById('quiz-progress-tracker');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');
const progressSegments = document.getElementById('progress-segments');
const lobbyTotalQuestions = document.getElementById('lobby-total-questions');

let totalQuestionsCount = 10;
let answersStatusMap = {}; // questionIndex -> boolean (true / false)

function renderProgressTracker(currentIndex, total) {
  if (!progressTracker) return;
  totalQuestionsCount = total || totalQuestionsCount;
  
  if (progressText) {
    progressText.innerText = `Question ${currentIndex + 1} of ${totalQuestionsCount}`;
  }
  if (progressPercent) {
    const pct = Math.round(((currentIndex + 1) / totalQuestionsCount) * 100);
    progressPercent.innerText = `${pct}%`;
  }
  
  if (progressSegments) {
    progressSegments.innerHTML = '';
    for (let i = 0; i < totalQuestionsCount; i++) {
      const seg = document.createElement('div');
      let statusClass = 'upcoming';

      if (i === currentIndex) {
        statusClass = 'current';
      } else if (answersStatusMap[i] === true) {
        statusClass = 'correct';
      } else if (answersStatusMap[i] === false) {
        statusClass = 'incorrect';
      } else if (i < currentIndex) {
        statusClass = 'upcoming';
      }

      seg.className = `segment-step ${statusClass}`;
      seg.title = `Question ${i + 1}`;
      progressSegments.appendChild(seg);
    }
  }
}

// Forms & Inputs
const joinForm = document.getElementById('join-form');
const inputName = document.getElementById('input-name');
const inputNim = document.getElementById('input-nim');
const joinError = document.getElementById('join-error');

// Anti-Cheat Elements
const privacyShield = document.getElementById('privacy-shield');
const btnResumeQuiz = document.getElementById('btn-resume-quiz');
const tabSwitchToast = document.getElementById('tab-switch-toast');
const tabSwitchCountEl = document.getElementById('tab-switch-count');
const studentWatermarkOverlay = document.getElementById('student-watermark-overlay');
const appContainer = document.querySelector('.app-container');

let tabSwitchCount = 0;
let currentScreenKey = 'join';
let isWatermarkEnabled = false;

function updateWatermarkVisibility() {
  if (!studentWatermarkOverlay) return;
  const showWatermarkScreens = ['question', 'submitted', 'result', 'leaderboard'];
  const shouldShow = isWatermarkEnabled && showWatermarkScreens.includes(currentScreenKey);
  studentWatermarkOverlay.style.display = shouldShow ? 'grid' : 'none';
}

function setupStudentWatermark(name, nim) {
  if (!studentWatermarkOverlay) return;
  studentWatermarkOverlay.innerHTML = '';
  const text = `${name} • ${nim}`;
  for (let i = 0; i < 8; i++) {
    const item = document.createElement('div');
    item.className = 'watermark-item';
    item.innerText = text;
    studentWatermarkOverlay.appendChild(item);
  }
  updateWatermarkVisibility();
}

function showTabSwitchWarning() {
  if (!tabSwitchToast) return;
  if (tabSwitchCountEl) tabSwitchCountEl.innerText = tabSwitchCount;
  tabSwitchToast.style.display = 'block';
  setTimeout(() => {
    tabSwitchToast.style.display = 'none';
  }, 4000);
}

function activatePrivacyShield() {
  const activeQuizScreens = ['question', 'submitted', 'result'];
  if (activeQuizScreens.includes(currentScreenKey)) {
    if (appContainer) appContainer.classList.add('blur-on-unfocus');
    if (privacyShield) privacyShield.classList.add('active');
  }
}

function deactivatePrivacyShield() {
  if (appContainer) appContainer.classList.remove('blur-on-unfocus');
  if (privacyShield) privacyShield.classList.remove('active');
}

if (btnResumeQuiz) {
  btnResumeQuiz.addEventListener('click', () => {
    deactivatePrivacyShield();
  });
}

// 1. Prevent Right-Click / Context Menu & Long-Press
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
});

// 2. Prevent Copy, Cut, Selectstart, Drag
document.addEventListener('copy', (e) => {
  if (e.target && e.target.id === 'fill-in-input') return;
  e.preventDefault();
  return false;
});
document.addEventListener('cut', (e) => {
  if (e.target && e.target.id === 'fill-in-input') return;
  e.preventDefault();
  return false;
});
document.addEventListener('selectstart', (e) => {
  if (e.target && e.target.id === 'fill-in-input') return;
  e.preventDefault();
  return false;
});
document.addEventListener('dragstart', (e) => {
  e.preventDefault();
  return false;
});

// 3. Block Hotkeys (Ctrl+C, Ctrl+U, Ctrl+S, Ctrl+P, F12, Ctrl+Shift+I, PrintScreen)
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.id === 'fill-in-input' && !e.ctrlKey && !e.metaKey) {
    return;
  }

  if (e.key === 'PrintScreen') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('');
    }
    activatePrivacyShield();
    e.preventDefault();
    return false;
  }

  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    if (['c', 'u', 's', 'p', 'a'].includes(key)) {
      e.preventDefault();
      return false;
    }
  }

  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
    e.preventDefault();
    return false;
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'PrintScreen') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('');
    }
  }
});

// 4. Focus Loss & Tab/App-Switch Detection
let blurCooldown = false;
function handleFocusLost() {
  const activeQuizScreens = ['question', 'submitted', 'result'];
  if (!activeQuizScreens.includes(currentScreenKey)) return;

  activatePrivacyShield();

  if (!blurCooldown) {
    blurCooldown = true;
    tabSwitchCount++;
    socket.emit('player_focus_lost');
    showTabSwitchWarning();
    setTimeout(() => { blurCooldown = false; }, 1500);
  }
}

window.addEventListener('blur', handleFocusLost);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    handleFocusLost();
  }
});

function switchScreen(screenKey) {
  currentScreenKey = screenKey;
  Object.keys(screens).forEach(key => {
    if (screens[key]) {
      screens[key].classList.toggle('active', key === screenKey);
    }
  });

  // Reaction bar visibility
  if (reactionBar) {
    const showReactionScreens = ['lobby', 'submitted', 'result', 'leaderboard', 'gameover'];
    reactionBar.style.display = showReactionScreens.includes(screenKey) ? 'flex' : 'none';
  }

  // Progress tracker visibility (visible while kuis berlangsung)
  if (progressTracker) {
    const showProgressScreens = ['question', 'submitted', 'result', 'leaderboard'];
    progressTracker.style.display = showProgressScreens.includes(screenKey) ? 'block' : 'none';
  }

  // Watermark visibility
  updateWatermarkVisibility();

  // Remove blur when changing screen cleanly
  deactivatePrivacyShield();

  // Reset auto-advance countdown banners
  const resultAutoEl = document.getElementById('player-auto-advance');
  const lbAutoEl = document.getElementById('player-lb-auto-advance');
  if (resultAutoEl && screenKey !== 'result') resultAutoEl.style.display = 'none';
  if (lbAutoEl && screenKey !== 'leaderboard') lbAutoEl.style.display = 'none';
}

// Sound toggle
if (btnSoundToggle) {
  btnSoundToggle.addEventListener('click', () => {
    if (window.soundFX) {
      const isMuted = window.soundFX.toggleMute();
      btnSoundToggle.innerText = isMuted ? '🔇' : '🔊';
    }
  });
}

// Floating Emoji Reactions setup
document.querySelectorAll('.reaction-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const emoji = btn.dataset.emoji;
    if (!emoji) return;

    socket.emit('send_reaction', { emoji });

    // Local animated floating bubble on student's screen
    const bubble = document.createElement('div');
    bubble.className = 'local-reaction';
    bubble.innerText = emoji;
    const dx = (Math.random() - 0.5) * 80;
    bubble.style.setProperty('--dx', `${dx}px`);
    document.body.appendChild(bubble);

    setTimeout(() => {
      if (bubble && bubble.parentNode) {
        bubble.parentNode.removeChild(bubble);
      }
    }, 1600);
  });
});

// Tier Badges Helper
function updatePlayerTier(score) {
  const badge = document.getElementById('player-tier-badge');
  if (!badge) return;
  if (score >= 8000) {
    badge.className = 'tier-badge tier-master';
    badge.innerText = '👑 Master';
  } else if (score >= 5000) {
    badge.className = 'tier-badge tier-diamond';
    badge.innerText = '💎 Berlian';
  } else if (score >= 2500) {
    badge.className = 'tier-badge tier-gold';
    badge.innerText = '🥇 Emas';
  } else if (score >= 1000) {
    badge.className = 'tier-badge tier-silver';
    badge.innerText = '🥈 Perak';
  } else {
    badge.className = 'tier-badge tier-bronze';
    badge.innerText = '🥉 Perunggu';
  }
}

// Canvas Confetti Celebration
function launchConfetti(durationMs = 2500) {
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const colors = ['#ffd700', '#ff3d00', '#00e676', '#00b0ff', '#e040fb', '#ffffff'];
    const pieces = [];
    const count = Math.min(80, Math.floor(width / 12));

    for (let i = 0; i < count; i++) {
      pieces.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.4,
        r: Math.random() * 6 + 3,
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

// 1. Check for stored session on startup (Auto Reconnect)
socket.on('connect', () => {
  const savedSession = localStorage.getItem(STORAGE_KEY);
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      if (parsed.sessionToken || parsed.nim) {
        socket.emit('player_reconnect', {
          nim: parsed.nim || '',
          sessionToken: parsed.sessionToken
        });
      }
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
});

const playerBrandTitle = document.getElementById('player-brand-title');

function updateQuizTitle(title) {
  if (!title) return;
  if (playerBrandTitle) playerBrandTitle.innerText = title;
  document.title = `${title} - Live Quiz`;
}

socket.on('init_state', (data) => {
  if (data) {
    if (data.totalQuestions) {
      totalQuestionsCount = data.totalQuestions;
      if (lobbyTotalQuestions) {
        lobbyTotalQuestions.innerText = `${totalQuestionsCount} Questions in this session`;
      }
    }
    if (data.quizTitle) {
      updateQuizTitle(data.quizTitle);
    }
    if (data.watermarkEnabled !== undefined) {
      isWatermarkEnabled = !!data.watermarkEnabled;
      updateWatermarkVisibility();
    }
  }
});

socket.on('watermark_status', (data) => {
  if (data && data.enabled !== undefined) {
    isWatermarkEnabled = !!data.enabled;
    updateWatermarkVisibility();
  }
});

socket.on('quiz_info_updated', (data) => {
  if (data) {
    if (data.totalQuestions) {
      totalQuestionsCount = data.totalQuestions;
      if (lobbyTotalQuestions) {
        lobbyTotalQuestions.innerText = `${totalQuestionsCount} Questions in this session`;
      }
    }
    if (data.quizTitle) {
      updateQuizTitle(data.quizTitle);
    }
  }
});

// Reconnect success handler
socket.on('reconnect_success', (data) => {
  myPlayer.name = data.name;
  myPlayer.nim = data.nim;
  myPlayer.score = data.score || 0;

  if (data.watermarkEnabled !== undefined) {
    isWatermarkEnabled = !!data.watermarkEnabled;
  }

  playerDisplayName.innerText = myPlayer.name;
  playerScore.innerText = myPlayer.score.toLocaleString();
  document.getElementById('lobby-player-name').innerText = myPlayer.name;
  document.getElementById('lobby-player-nim').innerText = myPlayer.nim;
  quizHeader.style.display = 'flex';

  setupStudentWatermark(myPlayer.name, myPlayer.nim);

  if (data.currentQuestion) {
    renderProgressTracker(data.currentQuestion.index, data.currentQuestion.total);
  }

  if (data.status === 'LOBBY') {
    switchScreen('lobby');
  } else if (data.status === 'QUESTION_ACTIVE') {
    if (data.hasAnswered) {
      switchScreen('submitted');
    } else if (data.currentQuestion) {
      renderQuestion(data.currentQuestion);
    }
  } else if (data.status === 'QUESTION_RESULT') {
    switchScreen('submitted');
  } else if (data.status === 'LEADERBOARD') {
    document.getElementById('lb-player-score').innerText = myPlayer.score.toLocaleString();
    switchScreen('leaderboard');
  } else if (data.status === 'GAME_OVER') {
    switchScreen('gameover');
  }
});

socket.on('reconnect_failed', () => {
  // Session expired or not found, but prefill inputs so student does not have to retype
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.name && inputName) inputName.value = parsed.name;
      if (parsed.nim && inputNim) inputNim.value = parsed.nim;
    }
  } catch (e) {}
});

function showLateJoinBanner(missedCount, totalQuestions) {
  const toast = document.createElement('div');
  toast.className = 'tab-switch-toast';
  toast.style.display = 'block';
  toast.style.background = '#ff9800';
  toast.style.color = '#1a1a1a';
  toast.style.fontWeight = 'bold';
  toast.style.padding = '12px 18px';
  toast.style.borderRadius = '10px';
  toast.style.position = 'fixed';
  toast.style.top = '70px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '999999';
  toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
  toast.innerHTML = `⚠️ Anda bergabung di tengah kuis (${missedCount} soal sebelumnya terlewat & dinilai 0 pts). Silakan kerjakan soal aktif!`;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
  }, 6000);
}

// Handle player kicked by host
socket.on('player_kicked', (data) => {
  localStorage.removeItem(STORAGE_KEY);
  myPlayer.score = 0;
  quizHeader.style.display = 'none';

  if (kickedBanner) {
    kickedBanner.innerText = data.message || 'You were removed from the session by the host.';
    kickedBanner.style.display = 'block';
  }
  switchScreen('join');
});

// Join form submit
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  joinError.style.display = 'none';
  if (kickedBanner) kickedBanner.style.display = 'none';

  const name = inputName.value.trim();
  const nim = inputNim.value.trim();

  if (!name) {
    joinError.innerText = 'Mohon masukkan nama lengkap Anda.';
    joinError.style.display = 'block';
    return;
  }

  if (window.soundFX) window.soundFX.init();

  socket.emit('player_join', { name, nim: nim || '-' });
});

// Socket Events
socket.on('join_error', (data) => {
  joinError.innerText = data.message || 'Could not join session.';
  joinError.style.display = 'block';
});

socket.on('join_success', (data) => {
  myPlayer.name = data.name;
  myPlayer.nim = data.nim;
  myPlayer.sessionToken = data.sessionToken;
  myPlayer.score = data.score || 0;
  updatePlayerTier(myPlayer.score);

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    name: data.name,
    nim: data.nim,
    sessionToken: data.sessionToken
  }));

  playerDisplayName.innerText = myPlayer.name;
  playerScore.innerText = myPlayer.score.toLocaleString();
  document.getElementById('lobby-player-name').innerText = myPlayer.name;
  document.getElementById('lobby-player-nim').innerText = myPlayer.nim;

  if (data.watermarkEnabled !== undefined) {
    isWatermarkEnabled = !!data.watermarkEnabled;
  }

  setupStudentWatermark(myPlayer.name, myPlayer.nim);
  quizHeader.style.display = 'flex';

  if (data.status === 'LOBBY') {
    switchScreen('lobby');
  } else if (data.status === 'QUESTION_ACTIVE') {
    if (data.hasAnswered) {
      switchScreen('submitted');
    } else if (data.currentQuestion) {
      renderQuestion(data.currentQuestion);
    } else {
      switchScreen('submitted');
    }
  } else if (data.status === 'QUESTION_RESULT') {
    switchScreen('submitted');
  } else if (data.status === 'LEADERBOARD') {
    document.getElementById('lb-player-score').innerText = myPlayer.score.toLocaleString();
    switchScreen('leaderboard');
  } else if (data.status === 'GAME_OVER') {
    switchScreen('gameover');
  } else {
    switchScreen('lobby');
  }

  if (data.isLateJoiner && data.missedCount > 0) {
    showLateJoinBanner(data.missedCount, data.totalQuestions);
  }
});

socket.on('start_countdown', (data) => {
  switchScreen('countdown');
  const cdVal = document.getElementById('countdown-val');
  if (cdVal) cdVal.innerText = data.count;
  if (window.soundFX) window.soundFX.playTick();
});

function renderQuestion(q) {
  currentQuestion = q;
  currentMaxTime = q.timeLimit || 25;

  renderProgressTracker(q.index, q.total);

  document.getElementById('question-number').innerText = `Question ${q.index + 1} of ${q.total}`;
  document.getElementById('question-text').innerText = q.question;
  document.getElementById('time-text').innerText = `${currentMaxTime}s`;

  // Timer Bar reset
  const timerBar = document.getElementById('timer-bar');
  if (timerBar) {
    timerBar.style.width = '100%';
    timerBar.style.transition = 'none';
    setTimeout(() => {
      timerBar.style.transition = 'width 1s linear';
    }, 50);
  }

  // Java Code Snippet with Prism Highlighting
  const codePre = document.getElementById('question-code-pre');
  const codeEl = document.getElementById('question-code');
  if (q.code) {
    codeEl.textContent = q.code;
    codePre.style.display = 'block';
    if (window.Prism) Prism.highlightElement(codeEl);
  } else {
    codePre.style.display = 'none';
  }

  const optionsContainer = document.getElementById('options-container');
  const fillInContainer = document.getElementById('fill-in-container');
  const fillInInput = document.getElementById('fill-in-input');
  const btnSubmitFill = document.getElementById('btn-submit-fill');
  if (fillInInput) {
    fillInInput.value = '';
    fillInInput.disabled = false;
    fillInInput.removeAttribute('disabled');
  }
  if (btnSubmitFill) {
    btnSubmitFill.disabled = false;
    btnSubmitFill.removeAttribute('disabled');
    btnSubmitFill.style.pointerEvents = 'auto';
    btnSubmitFill.style.opacity = '1';
    btnSubmitFill.innerText = 'Submit Answer';
  }

  optionsContainer.innerHTML = '';

  if (q.type === 'multiple_choice' || q.type === 'true_false') {
    fillInContainer.style.display = 'none';
    optionsContainer.style.display = 'grid';

    if (q.type === 'true_false') {
      optionsContainer.className = 'answers-grid two-cols';
    } else {
      optionsContainer.className = 'answers-grid';
    }

    // Anti-Cheating: Shuffle Options per device
    let itemsToRender = (q.options || []).map((opt, origIdx) => ({
      text: opt,
      originalIndex: origIdx
    }));

    if (q.shuffle && q.type === 'multiple_choice') {
      for (let i = itemsToRender.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [itemsToRender[i], itemsToRender[j]] = [itemsToRender[j], itemsToRender[i]];
      }
    }

    const colorClasses = ['btn-red', 'btn-blue', 'btn-yellow', 'btn-green'];
    const shapes = ['▲', '◆', '●', '■'];

    itemsToRender.forEach((item, posIdx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `answer-btn ${colorClasses[posIdx % colorClasses.length]}`;
      btn.innerHTML = `<span class="shape-icon">${shapes[posIdx % shapes.length]}</span><span>${item.text}</span>`;
      btn.addEventListener('click', () => {
        submitAnswer(item.originalIndex);
      });
      optionsContainer.appendChild(btn);
    });
  } else if (q.type === 'multi_select') {
    fillInContainer.style.display = 'none';
    optionsContainer.style.display = 'grid';
    optionsContainer.className = 'answers-grid';

    const selectedIndices = new Set();
    const colorClasses = ['btn-red', 'btn-blue', 'btn-yellow', 'btn-green'];
    const shapes = ['▲', '◆', '●', '■'];

    let itemsToRender = (q.options || []).map((opt, origIdx) => ({
      text: opt,
      originalIndex: origIdx
    }));

    itemsToRender.forEach((item, posIdx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `answer-btn multi-select-btn ${colorClasses[posIdx % colorClasses.length]}`;
      btn.innerHTML = `<span class="shape-icon">${shapes[posIdx % shapes.length]}</span><span style="flex: 1; text-align: left; margin: 0 10px;">${item.text}</span><span class="chk-box">☐</span>`;
      btn.addEventListener('click', () => {
        if (selectedIndices.has(item.originalIndex)) {
          selectedIndices.delete(item.originalIndex);
          btn.classList.remove('selected');
          btn.querySelector('.chk-box').innerText = '☐';
        } else {
          selectedIndices.add(item.originalIndex);
          btn.classList.add('selected');
          btn.querySelector('.chk-box').innerText = '☑';
        }
        submitMultiBtn.innerText = `Kirim Jawaban (${selectedIndices.size} dipilih)`;
        submitMultiBtn.disabled = selectedIndices.size === 0;
      });
      optionsContainer.appendChild(btn);
    });

    const submitMultiBtn = document.createElement('button');
    submitMultiBtn.type = 'button';
    submitMultiBtn.className = 'multi-submit-btn';
    submitMultiBtn.innerText = 'Pilih jawaban di atas...';
    submitMultiBtn.disabled = true;
    submitMultiBtn.style.gridColumn = '1 / -1';
    submitMultiBtn.style.margin = '10px 0';
    submitMultiBtn.style.padding = '14px';
    submitMultiBtn.style.fontSize = '16px';
    submitMultiBtn.addEventListener('click', () => {
      if (selectedIndices.size > 0) {
        submitAnswer(Array.from(selectedIndices).sort((a, b) => a - b));
      }
    });
    optionsContainer.appendChild(submitMultiBtn);
  } else if (q.type === 'fill_in') {
    optionsContainer.style.display = 'none';
    fillInContainer.style.display = 'flex';
    setTimeout(() => fillInInput.focus(), 150);
  }

  switchScreen('question');
}

socket.on('new_question', (q) => {
  renderQuestion(q);
});

// Timer tick
socket.on('timer_tick', (data) => {
  const timeText = document.getElementById('time-text');
  if (timeText) timeText.innerText = `${data.timeLeft}s`;

  const timerBar = document.getElementById('timer-bar');
  if (timerBar && currentMaxTime > 0) {
    const percent = Math.max(0, (data.timeLeft / currentMaxTime) * 100);
    timerBar.style.width = `${percent}%`;
  }

  if (window.soundFX) {
    if (data.timeLeft <= 5 && data.timeLeft > 0) {
      window.soundFX.playUrgentTick();
    } else if (data.timeLeft > 0 && data.timeLeft % 5 === 0) {
      window.soundFX.playTick();
    }
  }
});

// Submit answer helper
function submitAnswer(ans) {
  socket.emit('submit_answer', { answer: ans });
  switchScreen('submitted');
}

// Fill-in submit listener
const btnSubmitFillEl = document.getElementById('btn-submit-fill');
const fillInInputEl = document.getElementById('fill-in-input');

if (btnSubmitFillEl && fillInInputEl) {
  const doLiveSubmitFill = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const val = fillInInputEl.value.trim();
    if (!val) {
      alert('Ketik jawaban Anda sebelum mengirim.');
      fillInInputEl.focus();
      return;
    }
    btnSubmitFillEl.disabled = true;
    fillInInputEl.disabled = true;
    submitAnswer(val);
  };

  btnSubmitFillEl.onclick = doLiveSubmitFill;
  fillInInputEl.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doLiveSubmitFill(e);
    }
  };
}

// Individual question result
socket.on('player_question_result', (data) => {
  myPlayer.score = data.totalScore;
  playerScore.innerText = myPlayer.score.toLocaleString();
  updatePlayerTier(myPlayer.score);

  if (currentQuestion) {
    answersStatusMap[currentQuestion.index] = data.isCorrect;
    renderProgressTracker(currentQuestion.index, currentQuestion.total);
  }

  const resultCard = document.getElementById('result-card');
  const resultTitle = document.getElementById('result-title');
  const resultPoints = document.getElementById('result-points');
  const resultStreak = document.getElementById('result-streak');
  const resultRank = document.getElementById('result-rank');
  const resultCorrectAns = document.getElementById('result-correct-answer');
  const resultExplanation = document.getElementById('result-explanation');

  const badgesContainer = document.getElementById('result-gamification-badges');
  if (badgesContainer) {
    badgesContainer.innerHTML = '';
    if (data.isCorrect) {
      if (data.streak >= 2) {
        const comboBadge = document.createElement('span');
        comboBadge.className = 'gamify-badge gamify-combo';
        const label = data.streak >= 5 ? '🌟 UNSTOPPABLE' : (data.streak >= 3 ? '⚡ ON FIRE' : '🔥 COMBO');
        comboBadge.innerText = `${label} (${data.streak}x)! +${data.streakBonus || 0} pts`;
        badgesContainer.appendChild(comboBadge);
      }
      if (data.speedBonus > 0) {
        const speedBadge = document.createElement('span');
        speedBadge.className = 'gamify-badge gamify-speed';
        speedBadge.innerText = `⚡ Refleks Kilat! +${data.speedBonus} pts`;
        badgesContainer.appendChild(speedBadge);
      }
    }
  }

  if (data.isCorrect) {
    resultCard.className = 'result-card correct';
    resultTitle.innerText = 'CORRECT! 🎉';
    resultPoints.innerText = `+${data.pointsEarned.toLocaleString()} pts`;
    if (window.soundFX) window.soundFX.playCorrect();
    launchConfetti(2200);
  } else {
    resultCard.className = 'result-card incorrect';
    resultTitle.innerText = 'INCORRECT! ❌';
    resultPoints.innerText = '+0 pts';
    if (window.soundFX) window.soundFX.playIncorrect();
  }

  resultStreak.innerText = `🔥 ${data.streak}`;
  resultRank.innerText = `#${data.rank}`;
  resultCorrectAns.innerText = data.correctAnswer || '-';
  resultExplanation.innerText = data.explanation || 'No explanation provided.';

  switchScreen('result');
});

// Show leaderboard
socket.on('show_leaderboard', () => {
  document.getElementById('lb-player-score').innerText = myPlayer.score.toLocaleString();
  updatePlayerTier(myPlayer.score);
  switchScreen('leaderboard');
});

// Auto-Advance countdown tick
socket.on('auto_advance_tick', (data) => {
  const resultAutoEl = document.getElementById('player-auto-advance');
  const resultAutoTime = document.getElementById('player-auto-time');
  const lbAutoEl = document.getElementById('player-lb-auto-advance');
  const lbAutoTime = document.getElementById('player-lb-auto-time');
  const lbAutoLabel = document.getElementById('player-lb-auto-label');

  if (!data || !data.phase || data.countdown <= 0) {
    if (resultAutoEl) resultAutoEl.style.display = 'none';
    if (lbAutoEl) lbAutoEl.style.display = 'none';
    return;
  }

  if (data.phase === 'TO_LEADERBOARD' && currentScreenKey === 'result') {
    if (resultAutoEl && resultAutoTime) {
      resultAutoTime.innerText = data.countdown;
      resultAutoEl.style.display = 'block';
    }
  } else if (data.phase === 'TO_NEXT_QUESTION' && currentScreenKey === 'leaderboard') {
    if (lbAutoEl && lbAutoTime) {
      lbAutoTime.innerText = data.countdown;
      if (lbAutoLabel) {
        lbAutoLabel.innerText = data.isLastQuestion ? 'Hasil akhir' : 'Soal berikutnya';
      }
      lbAutoEl.style.display = 'block';
    }
  }
});

// Final Game Over
socket.on('game_over', (data) => {
  const myRecord = (data.leaderboard || []).find(p => p.id === socket.id || p.nim === myPlayer.nim);
  const myRankIdx = (data.leaderboard || []).findIndex(p => p.id === socket.id || p.nim === myPlayer.nim);
  const rank = myRankIdx >= 0 ? myRankIdx + 1 : '-';
  const finalScore = myRecord ? myRecord.score : myPlayer.score;

  document.getElementById('final-rank-text').innerText = `Rank #${rank} of ${data.leaderboard.length}`;
  document.getElementById('final-score-text').innerText = `Final Score: ${finalScore.toLocaleString()} pts`;

  updatePlayerTier(finalScore);

  if (window.soundFX) window.soundFX.playFanfare();
  launchConfetti(4500);

  switchScreen('gameover');
});

// Personal Review List
socket.on('player_game_over_review', (data) => {
  const reviewContainer = document.getElementById('player-review-list');
  if (!reviewContainer) return;

  reviewContainer.innerHTML = '';

  (data.review || []).forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = `review-card ${item.isCorrect ? 'correct' : 'incorrect'}`;

    let codeBlock = '';
    if (item.code) {
      codeBlock = `<pre class="language-java" style="border-radius: 6px; margin: 8px 0; font-size: 12px;"><code class="language-java">${escapeHtml(item.code)}</code></pre>`;
    }

    card.innerHTML = `
      <div class="review-q-num">Question ${idx + 1} • ${item.isCorrect ? '✓ Correct' : '✗ Incorrect'}</div>
      <div class="review-q-text">${escapeHtml(item.question)}</div>
      ${codeBlock}
      <div class="review-ans-row">
        <div>Your Answer: <strong style="color: ${item.isCorrect ? '#00e676' : '#ff5252'};">${escapeHtml(String(item.submitted))}</strong></div>
        ${!item.isCorrect ? `<div>Correct Answer: <strong style="color: #00e676;">${escapeHtml(String(item.correctAnswer))}</strong></div>` : ''}
      </div>
      ${item.explanation ? `<div class="review-explanation"><strong>Explanation:</strong> ${escapeHtml(item.explanation)}</div>` : ''}
    `;

    reviewContainer.appendChild(card);
  });

  if (window.Prism) {
    Prism.highlightAll();
  }
});

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Reset
socket.on('quiz_reset', () => {
  localStorage.removeItem(STORAGE_KEY);
  myPlayer.score = 0;
  answersStatusMap = {};
  if (progressTracker) progressTracker.style.display = 'none';
  quizHeader.style.display = 'none';
  if (reactionBar) reactionBar.style.display = 'none';
  switchScreen('join');
});
