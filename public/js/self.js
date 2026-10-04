// Self-Paced Quiz Client Engine
(function() {
  'use strict';

  // DOM Elements
  const screenRegister = document.getElementById('screen-self-register');
  const screenQuestion = document.getElementById('screen-self-question');
  const screenResult = document.getElementById('screen-self-result');

  const header = document.getElementById('self-header');
  const headerUserName = document.getElementById('header-user-name');
  const headerUserNim = document.getElementById('header-user-nim');
  const headerScoreVal = document.getElementById('header-score-val');

  const progressTracker = document.getElementById('self-progress-tracker');
  const progressQuestionIndicator = document.getElementById('progress-question-indicator');
  const progressPercentIndicator = document.getElementById('progress-percent-indicator');
  const progressFillBar = document.getElementById('progress-fill-bar');

  const cheatBanner = document.getElementById('self-cheat-banner');
  const cheatSwitchCount = document.getElementById('cheat-switch-count');
  const watermarkOverlay = document.getElementById('self-watermark-overlay');

  const resumeBanner = document.getElementById('resume-session-banner');
  const resumeDesc = document.getElementById('resume-session-desc');
  const btnResumeQuiz = document.getElementById('btn-resume-quiz');
  const btnDiscardQuiz = document.getElementById('btn-discard-quiz');

  const formStart = document.getElementById('form-self-start');
  const inputName = document.getElementById('input-self-name');
  const inputNim = document.getElementById('input-self-nim');
  const selfActiveQuizTitle = document.getElementById('self-active-quiz-title');
  const selfActiveQuizMeta = document.getElementById('self-active-quiz-meta');
  const btnStartQuiz = document.getElementById('btn-start-self-quiz');

  // Question screen elements
  const qTypeBadge = document.getElementById('q-type-badge');
  const qTimerBadge = document.getElementById('q-timer-badge');
  const qTimerVal = document.getElementById('q-timer-val');
  const qText = document.getElementById('q-text');
  const qCodeWrap = document.getElementById('q-code-wrap');
  const qCodeSnippet = document.getElementById('q-code-snippet');
  const qOptionsContainer = document.getElementById('q-options-container');
  const qFillInWrap = document.getElementById('q-fill-in-wrap');
  const inputFillIn = document.getElementById('input-fill-in');
  const btnSubmitFill = document.getElementById('btn-submit-fill');
  const qMultiSelectAction = document.getElementById('q-multi-select-action');
  const btnSubmitMulti = document.getElementById('btn-submit-multi');
  const qFeedbackBox = document.getElementById('q-feedback-box');
  const qFeedbackTitle = document.getElementById('q-feedback-title');
  const qFeedbackDesc = document.getElementById('q-feedback-desc');
  const btnNextQuestion = document.getElementById('btn-next-question');

  // Result screen elements
  const resScoreVal = document.getElementById('res-score-val');
  const resAccuracyVal = document.getElementById('res-accuracy-val');
  const resSummaryName = document.getElementById('res-summary-name');
  const resSummaryNim = document.getElementById('res-summary-nim');
  const resSummaryQuiz = document.getElementById('res-summary-quiz');
  const resSummaryCheats = document.getElementById('res-summary-cheats');
  const reviewListContainer = document.getElementById('self-review-list');
  const btnRestartQuiz = document.getElementById('btn-restart-quiz');

  // State
  let selfState = {
    sessionToken: null,
    name: '',
    nim: '',
    quizId: '',
    quizTitle: '',
    questions: [],
    currentIndex: 0,
    score: 0,
    tabSwitches: 0,
    watermarkEnabled: false,
    timerInterval: null,
    timeLeft: 0,
    questionStartTime: 0,
    hasAnswered: false,
    selectedMultiChoices: new Set()
  };

  const STORAGE_KEY = 'self_quiz_active_session_v1';

  // 1. Inisialisasi awal
  async function init() {
    try {
      const res = await fetch('/api/self-quiz/config');
      const data = await res.json();

      selfState.watermarkEnabled = !!data.watermarkEnabled;
      selfState.quizId = data.activeQuizId || 'java';
      selfState.quizTitle = data.activeQuizTitle || 'Interactive Quiz';

      if (selfActiveQuizTitle) {
        selfActiveQuizTitle.innerText = data.activeQuizTitle || 'Interactive Quiz';
      }

      if (selfActiveQuizMeta) {
        if (data.questionLimit && data.questionLimit > 0 && data.availableQuestions) {
          selfActiveQuizMeta.innerText = `📝 ${data.totalQuestions} Soal Digunakan (dari bank ${data.availableQuestions} soal)${data.randomizeQuestions ? ' • 🎲 Soal Diacak' : ''}`;
        } else {
          selfActiveQuizMeta.innerText = `📝 ${data.totalQuestions || 0} Soal Aktif (Semua)${data.randomizeQuestions ? ' • 🎲 Soal Diacak' : ''}`;
        }
      }
    } catch (e) {
      console.error('Failed to load quiz config:', e);
      if (selfActiveQuizTitle) selfActiveQuizTitle.innerText = 'Kuis Aktif';
      if (selfActiveQuizMeta) selfActiveQuizMeta.innerText = '📝 Memuat soal...';
    }

    // Periksa apakah ada sesi tersimpan di localStorage
    checkSavedSession();
  }

  function checkSavedSession() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.sessionToken && parsed.questions && parsed.questions.length > 0) {
          resumeDesc.innerText = `Sesi untuk "${parsed.name}" (${parsed.nim}) pada soal ${parsed.currentIndex + 1} dari ${parsed.questions.length}.`;
          resumeBanner.style.display = 'block';

          inputName.value = parsed.name || '';
          inputNim.value = (parsed.nim && parsed.nim !== '-') ? parsed.nim : '';
        }
      }
    } catch (e) {
      console.warn('Error reading saved session:', e);
    }
  }

  // 2. Event Listeners Registrasi
  formStart.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = inputName.value.trim();
    const nim = inputNim.value.trim() || '-';

    if (!name) return;

    btnStartQuiz.disabled = true;
    btnStartQuiz.innerHTML = '<span>⏳ Memulai Sesi...</span>';

    try {
      const resp = await fetch('/api/self-quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nim })
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        alert(data.error || 'Gagal memulai kuis mandiri.');
        btnStartQuiz.disabled = false;
        btnStartQuiz.innerHTML = '<span>🚀 Mulai Kuis Sekarang</span>';
        return;
      }

      // Mulai kuis
      selfState.sessionToken = data.sessionToken;
      selfState.name = name;
      selfState.nim = nim;
      selfState.quizId = data.quizId;
      selfState.quizTitle = data.quizTitle;
      selfState.questions = data.questions || [];
      selfState.currentIndex = 0;
      selfState.score = 0;
      selfState.tabSwitches = 0;

      saveStateToLocal();
      startQuizSession();
    } catch (err) {
      console.error('Error starting quiz:', err);
      alert('Terjadi kesalahan koneksi ke server.');
      btnStartQuiz.disabled = false;
      btnStartQuiz.innerHTML = '<span>🚀 Mulai Kuis Sekarang</span>';
    }
  });

  btnResumeQuiz.addEventListener('click', () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) {
        selfState = { ...selfState, ...saved };
        resumeBanner.style.display = 'none';
        startQuizSession();
      }
    } catch (e) {
      alert('Gagal melanjutkan sesi.');
    }
  });

  btnDiscardQuiz.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    resumeBanner.style.display = 'none';
  });

  // 3. Memulai Tampilan Pengerjaan Kuis
  function startQuizSession() {
    switchScreen('question');
    header.style.display = 'flex';
    progressTracker.style.display = 'block';

    headerUserName.innerText = selfState.name;
    headerUserNim.innerText = selfState.nim !== '-' ? `NIM: ${selfState.nim}` : 'Tanpa NIM';
    headerScoreVal.innerText = selfState.score;

    if (selfState.watermarkEnabled) {
      renderWatermark(selfState.name, selfState.nim);
    }

    renderCurrentQuestion();
  }

  function renderWatermark(name, nim) {
    watermarkOverlay.innerHTML = '';
    watermarkOverlay.style.display = 'flex';
    const tag = `${name} • ${nim !== '-' ? nim : 'Kuis'}`;
    for (let i = 0; i < 40; i++) {
      const span = document.createElement('div');
      span.className = 'watermark-item';
      span.innerText = tag;
      watermarkOverlay.appendChild(span);
    }
  }

  // 4. Render Soal Aktif
  function renderCurrentQuestion() {
    stopTimer();
    selfState.hasAnswered = false;
    selfState.selectedMultiChoices.clear();

    const q = selfState.questions[selfState.currentIndex];
    if (!q) {
      finishQuiz();
      return;
    }

    // Update Progress
    const currentNum = selfState.currentIndex + 1;
    const totalQ = selfState.questions.length;
    progressQuestionIndicator.innerText = `Soal ${currentNum} dari ${totalQ}`;
    const percent = Math.round((currentNum / totalQ) * 100);
    progressPercentIndicator.innerText = `${percent}%`;
    progressFillBar.style.width = `${percent}%`;

    // Type Badge
    let typeName = 'PILIHAN GANDA';
    if (q.type === 'true_false') typeName = 'BENAR / SALAH';
    else if (q.type === 'multi_select') typeName = 'PILIHAN GANDA KOMPLEKS (LEBIH DARI SATU)';
    else if (q.type === 'fill_in') typeName = 'ISIAN SINGKAT';
    qTypeBadge.innerText = typeName;

    // Question Text
    qText.innerText = q.question;

    // Code Snippet
    if (q.code && q.code.trim()) {
      qCodeSnippet.textContent = q.code;
      qCodeWrap.style.display = 'block';
      if (window.Prism) Prism.highlightElement(qCodeSnippet);
    } else {
      qCodeWrap.style.display = 'none';
    }

    // Reset Containers
    qOptionsContainer.innerHTML = '';
    qOptionsContainer.style.display = 'none';
    qFillInWrap.style.display = 'none';
    qMultiSelectAction.style.display = 'none';
    qFeedbackBox.style.display = 'none';
    btnNextQuestion.style.display = 'none';

    // Reset fill-in elements state
    if (btnSubmitFill) {
      btnSubmitFill.disabled = false;
      btnSubmitFill.removeAttribute('disabled');
      btnSubmitFill.style.pointerEvents = 'auto';
      btnSubmitFill.style.opacity = '1';
      btnSubmitFill.innerText = 'Kirim';
    }
    if (inputFillIn) {
      inputFillIn.disabled = false;
      inputFillIn.removeAttribute('disabled');
      inputFillIn.value = '';
    }

    // Render by Type
    const shapes = ['▲', '◆', '●', '■'];

    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      qOptionsContainer.style.display = 'grid';
      (q.options || []).forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `self-opt-btn opt-${idx % 4}`;
        btn.innerHTML = `
          <span class="opt-icon">${shapes[idx % 4]}</span>
          <span class="opt-text">${opt}</span>
        `;
        btn.addEventListener('click', () => {
          if (selfState.hasAnswered) return;
          submitAnswer(idx, [btn]);
        });
        qOptionsContainer.appendChild(btn);
      });
    } else if (q.type === 'multi_select') {
      qOptionsContainer.style.display = 'grid';
      qMultiSelectAction.style.display = 'block';

      const optButtons = [];
      (q.options || []).forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `self-opt-btn opt-${idx % 4}`;
        btn.innerHTML = `
          <span class="opt-icon">☐</span>
          <span class="opt-text">${opt}</span>
        `;
        btn.addEventListener('click', () => {
          if (selfState.hasAnswered) return;
          if (selfState.selectedMultiChoices.has(idx)) {
            selfState.selectedMultiChoices.delete(idx);
            btn.classList.remove('selected');
            btn.querySelector('.opt-icon').innerText = '☐';
          } else {
            selfState.selectedMultiChoices.add(idx);
            btn.classList.add('selected');
            btn.querySelector('.opt-icon').innerText = '☑';
          }
        });
        optButtons.push(btn);
        qOptionsContainer.appendChild(btn);
      });

      btnSubmitMulti.onclick = () => {
        if (selfState.hasAnswered) return;
        if (selfState.selectedMultiChoices.size === 0) {
          alert('Pilih minimal satu opsi jawaban sebelum konfirmasi.');
          return;
        }
        const selectedArr = Array.from(selfState.selectedMultiChoices).sort((a, b) => a - b);
        submitAnswer(selectedArr, optButtons);
      };
    } else if (q.type === 'fill_in') {
      qFillInWrap.style.display = 'flex';
      inputFillIn.value = '';
      inputFillIn.disabled = false;
      inputFillIn.removeAttribute('disabled');

      if (btnSubmitFill) {
        btnSubmitFill.disabled = false;
        btnSubmitFill.removeAttribute('disabled');
        btnSubmitFill.style.pointerEvents = 'auto';
        btnSubmitFill.style.opacity = '1';
        btnSubmitFill.innerText = 'Kirim';
      }

      setTimeout(() => {
        try { inputFillIn.focus(); } catch (e) {}
      }, 50);

      const doSubmitFill = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (selfState.hasAnswered) return;
        const val = inputFillIn.value.trim();
        if (!val) {
          alert('Ketik jawaban Anda sebelum mengirim.');
          inputFillIn.focus();
          return;
        }
        inputFillIn.disabled = true;
        if (btnSubmitFill) {
          btnSubmitFill.disabled = true;
          btnSubmitFill.innerText = 'Mengirim...';
        }
        submitAnswer(val, []);
      };

      btnSubmitFill.onclick = doSubmitFill;
      inputFillIn.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSubmitFill(e);
        }
      };
    }

    // Start Timer
    startTimer(q.timeLimit || 25);
  }

  // 5. Timer System
  function startTimer(seconds) {
    stopTimer();
    selfState.timeLeft = seconds;
    selfState.questionStartTime = Date.now();
    qTimerVal.innerText = selfState.timeLeft;
    qTimerBadge.classList.remove('urgent');

    selfState.timerInterval = setInterval(() => {
      selfState.timeLeft--;
      qTimerVal.innerText = Math.max(0, selfState.timeLeft);

      if (selfState.timeLeft <= 5) {
        qTimerBadge.classList.add('urgent');
      }

      if (selfState.timeLeft <= 0) {
        stopTimer();
        if (!selfState.hasAnswered) {
          // Waktu habis, submit otomatis jawaban kosong
          submitAnswer(null, []);
        }
      }
    }, 1000);
  }

  function stopTimer() {
    if (selfState.timerInterval) {
      clearInterval(selfState.timerInterval);
      selfState.timerInterval = null;
    }
  }

  // 6. Submit Answer
  async function submitAnswer(answer, optionButtons = []) {
    stopTimer();
    selfState.hasAnswered = true;

    const timeSpent = Math.max(0.5, (Date.now() - selfState.questionStartTime) / 1000);
    const q = selfState.questions[selfState.currentIndex];

    // Disable all options
    optionButtons.forEach(btn => btn.style.pointerEvents = 'none');
    if (btnSubmitMulti) btnSubmitMulti.style.display = 'none';
    if (inputFillIn) inputFillIn.disabled = true;
    if (btnSubmitFill) btnSubmitFill.disabled = true;

    try {
      const resp = await fetch('/api/self-quiz/submit-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: selfState.sessionToken,
          questionIndex: selfState.currentIndex,
          answer: answer,
          timeSpent: timeSpent,
          tabSwitches: selfState.tabSwitches
        })
      });

      const data = await resp.json();
      if (!resp.ok) {
        alert(data.error || 'Gagal mengirim jawaban.');
        return;
      }

      // Update skor lokal
      selfState.score = data.currentScore;
      headerScoreVal.innerText = selfState.score;

      // Beri warna visual pada opsi
      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        optionButtons.forEach((btn, idx) => {
          if (idx === Number(data.correctAnswer)) {
            btn.classList.add('is-correct');
          } else if (idx === Number(answer) && !data.isCorrect) {
            btn.classList.add('is-wrong');
          } else {
            btn.classList.add('dimmed');
          }
        });
      } else if (q.type === 'multi_select') {
        const expected = (data.correctAnswers || []).map(Number);
        optionButtons.forEach((btn, idx) => {
          const isExpected = expected.includes(idx);
          if (isExpected) {
            btn.classList.add('is-correct');
          } else if (selfState.selectedMultiChoices.has(idx) && !isExpected) {
            btn.classList.add('is-wrong');
          } else {
            btn.classList.add('dimmed');
          }
        });
      }

      // Feedback Card
      qFeedbackBox.style.display = 'block';
      if (data.isCorrect) {
        qFeedbackBox.className = 'self-feedback-card correct';
        qFeedbackTitle.innerHTML = `<span>✓ Jawaban Benar!</span> <span style="font-size: 13px; color: #69f0ae;">+${data.pointsEarned} pts</span>`;
      } else {
        qFeedbackBox.className = 'self-feedback-card incorrect';
        const timeoutText = (answer === null || answer === undefined) ? 'Waktu Habis!' : 'Jawaban Kurang Tepat';
        qFeedbackTitle.innerHTML = `<span>✗ ${timeoutText}</span> <span style="font-size: 13px; color: #ff8a80;">+0 pts</span>`;
      }

      let explanationText = data.explanation || '';
      if (q.type === 'fill_in') {
        const correctAnswersList = (data.correctAnswers || []).join(' / ');
        explanationText = `Kunci jawaban yang benar: <strong>${correctAnswersList}</strong>.<br>${explanationText}`;
      }
      qFeedbackDesc.innerHTML = explanationText;

      // Show Next button
      const isLast = (selfState.currentIndex + 1 >= selfState.questions.length);
      btnNextQuestion.innerHTML = isLast ? '<span>Selesaikan & Lihat Hasil 🏆</span>' : '<span>Soal Berikutnya ➔</span>';
      btnNextQuestion.style.display = 'block';

      // Update index untuk resume jika reload
      saveStateToLocal();
    } catch (e) {
      console.error('Error submitting answer:', e);
      alert('Koneksi terganggu saat mengirim jawaban.');
    }
  }

  btnNextQuestion.addEventListener('click', () => {
    selfState.currentIndex++;
    saveStateToLocal();

    if (selfState.currentIndex < selfState.questions.length) {
      renderCurrentQuestion();
    } else {
      finishQuiz();
    }
  });

  // 7. Menyelesaikan Kuis (Finish)
  async function finishQuiz() {
    stopTimer();
    btnNextQuestion.disabled = true;
    btnNextQuestion.innerText = 'Menyimpan Hasil ke Server...';

    try {
      const resp = await fetch('/api/self-quiz/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: selfState.sessionToken,
          tabSwitches: selfState.tabSwitches
        })
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        alert(data.error || 'Gagal menyelesaikan kuis.');
        return;
      }

      // Hapus sesi aktif dari localStorage
      localStorage.removeItem(STORAGE_KEY);

      // Render Hasil Akhir
      renderResultScreen(data.record);
    } catch (e) {
      console.error('Error finishing quiz:', e);
      alert('Terjadi kesalahan saat memproses hasil kuis.');
    }
  }

  function renderResultScreen(record) {
    switchScreen('result');
    header.style.display = 'none';
    progressTracker.style.display = 'none';
    cheatBanner.style.display = 'none';
    watermarkOverlay.style.display = 'none';

    resScoreVal.innerText = `${record.score} pts`;
    resAccuracyVal.innerText = `Akurasi: ${record.accuracy}% (${record.correctCount} dari ${record.totalQuestions} Benar)`;

    resSummaryName.innerText = record.name;
    resSummaryNim.innerText = record.nim !== '-' ? record.nim : 'Tanpa NIM';
    resSummaryQuiz.innerText = record.quizTitle;
    resSummaryCheats.innerText = `${record.tabSwitchCount || 0}x`;

    // Render review list
    reviewListContainer.innerHTML = '';
    const reviewData = record.review || [];
    reviewData.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = `review-item-card ${item.isCorrect ? 'is-correct' : 'is-incorrect'}`;
      card.innerHTML = `
        <div class="review-q-num">Soal #${item.index} (${item.isCorrect ? '✓ Benar +' + item.pointsEarned + ' pts' : '✗ Salah +0 pts'})</div>
        <div class="review-q-title">${item.question}</div>
        <div class="review-answer-row">
          <span style="color: var(--text-muted);">Jawaban Anda:</span> 
          <strong style="color: ${item.isCorrect ? '#00e676' : '#ff5252'};">${item.submittedDisplay || '-'}</strong>
        </div>
        ${!item.isCorrect ? `
          <div class="review-answer-row">
            <span style="color: var(--text-muted);">Kunci Jawaban:</span> 
            <strong style="color: #00e676;">${item.correctDisplay}</strong>
          </div>
        ` : ''}
        ${item.explanation ? `
          <div class="review-explanation">
            💡 <strong>Penjelasan:</strong> ${item.explanation}
          </div>
        ` : ''}
      `;
      reviewListContainer.appendChild(card);
    });
  }

  btnRestartQuiz.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  });

  // 8. Anti-Cheat & Screen Visibility Detection (Single counter per screen exit)
  let isCurrentlyAway = false;
  let lastTabSwitchTime = 0;

  function handleFocusLost() {
    // Hanya hitung saat kuis sedang berjalan dan soal aktif belum selesai dijawab
    if (selfState.hasAnswered !== false || !selfState.sessionToken) return;

    const now = Date.now();
    // Cegah multi-trigger dari rentetan event blur & visibilitychange saat beralih window/tab
    if (isCurrentlyAway || (now - lastTabSwitchTime < 2000)) return;

    isCurrentlyAway = true;
    lastTabSwitchTime = now;

    selfState.tabSwitches++;
    cheatSwitchCount.innerText = selfState.tabSwitches;
    cheatBanner.style.display = 'flex';
    saveStateToLocal();
  }

  function handleFocusGained() {
    // Saat user kembali ke window, reset status away setelah stabil
    setTimeout(() => {
      if (!document.hidden && (document.hasFocus ? document.hasFocus() : true)) {
        isCurrentlyAway = false;
      }
    }, 400);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      handleFocusLost();
    } else {
      handleFocusGained();
    }
  });

  window.addEventListener('blur', () => {
    handleFocusLost();
  });

  window.addEventListener('focus', () => {
    handleFocusGained();
  });

  // 9. Helper Storage & Switch Screen
  function saveStateToLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sessionToken: selfState.sessionToken,
        name: selfState.name,
        nim: selfState.nim,
        quizId: selfState.quizId,
        quizTitle: selfState.quizTitle,
        questions: selfState.questions,
        currentIndex: selfState.currentIndex,
        score: selfState.score,
        tabSwitches: selfState.tabSwitches,
        watermarkEnabled: selfState.watermarkEnabled
      }));
    } catch (e) {}
  }

  function switchScreen(screenName) {
    [screenRegister, screenQuestion, screenResult].forEach(s => s.classList.remove('active'));
    if (screenName === 'register') screenRegister.classList.add('active');
    else if (screenName === 'question') screenQuestion.classList.add('active');
    else if (screenName === 'result') screenResult.classList.add('active');
  }

  // Jalankan
  init();

})();
