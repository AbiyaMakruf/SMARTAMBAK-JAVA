// Visual Question & Quiz Set Manager Script
let questionsList = [];
let allQuizSets = [];
let activeQuizId = 'java';
let currentQuizData = {
  id: 'java',
  title: 'Java Fundamentals',
  language: 'java',
  description: '',
  questions: []
};

// DOM Elements
const container = document.getElementById('questions-list');
const totalCountEl = document.getElementById('total-q-count');
const btnAddQ = document.getElementById('btn-add-q');
const btnSaveServer = document.getElementById('btn-save-server');

const selectActiveSet = document.getElementById('select-active-set');
const activeBadge = document.getElementById('active-badge');
const btnSetActive = document.getElementById('btn-set-active');
const btnRenameSet = document.getElementById('btn-rename-set');
const btnNewSet = document.getElementById('btn-new-set');
const btnDeleteSet = document.getElementById('btn-delete-set');

const displayQuizTitle = document.getElementById('display-quiz-title');
const displayQuizDesc = document.getElementById('display-quiz-desc');

// Quiz Set Modal Elements
const setModal = document.getElementById('set-modal');
const setModalTitle = document.getElementById('set-modal-title');
const setForm = document.getElementById('set-form');
const setFormMode = document.getElementById('set-form-mode');
const setFormTitle = document.getElementById('set-form-title');
const setFormLang = document.getElementById('set-form-lang');
const setFormDesc = document.getElementById('set-form-desc');
const btnCancelSet = document.getElementById('btn-cancel-set');

// Question Modal Elements
const modal = document.getElementById('q-modal');
const modalTitle = document.getElementById('modal-title');
const qForm = document.getElementById('q-form');
const editIndexInput = document.getElementById('edit-index');
const formType = document.getElementById('form-type');
const formTime = document.getElementById('form-timelimit');
const formQuestion = document.getElementById('form-question');
const formCode = document.getElementById('form-code');
const formFibAnswers = document.getElementById('form-fib-answers');
const formExplanation = document.getElementById('form-explanation');
const btnModalCancel = document.getElementById('btn-modal-cancel');

const sectionMcq = document.getElementById('section-mcq');
const sectionTf = document.getElementById('section-tf');
const sectionFib = document.getElementById('section-fib');
const mcqLabel = document.getElementById('mcq-label');
const mcqHint = document.getElementById('mcq-hint');

// 1. Load all quiz sets & active quiz info
async function loadQuizSets(targetQuizId) {
  try {
    const res = await fetch('/api/quiz-sets');
    const data = await res.json();
    activeQuizId = data.activeQuizId || 'java';
    allQuizSets = data.quizSets || [];

    // Populate dropdown
    selectActiveSet.innerHTML = '';
    allQuizSets.forEach(qs => {
      const opt = document.createElement('option');
      opt.value = qs.id;
      opt.textContent = `${qs.title} (${qs.count} Qs)${qs.id === activeQuizId ? ' ⭐ [Active]' : ''}`;
      selectActiveSet.appendChild(opt);
    });

    const toLoad = targetQuizId || (selectActiveSet.value ? selectActiveSet.value : activeQuizId);
    selectActiveSet.value = toLoad;
    await loadSingleQuizSet(toLoad);
  } catch (err) {
    console.error('Failed to load quiz sets:', err);
    alert('Error connecting to quiz server.');
  }
}

// 2. Load a single quiz set's questions
async function loadSingleQuizSet(quizId) {
  try {
    const res = await fetch(`/api/quiz-sets/${quizId}`);
    if (!res.ok) {
      throw new Error(`Could not load quiz set ${quizId}`);
    }
    const data = await res.json();
    currentQuizData = data;
    questionsList = Array.isArray(data.questions) ? data.questions : [];

    // Update UI headers
    displayQuizTitle.innerText = currentQuizData.title || currentQuizData.id;
    displayQuizDesc.innerText = currentQuizData.description || `Language / Syntax: ${(currentQuizData.language || 'java').toUpperCase()}`;

    // Update active status UI
    const isCurrentActive = currentQuizData.id === activeQuizId;
    if (activeBadge) activeBadge.style.display = isCurrentActive ? 'inline-block' : 'none';
    if (btnSetActive) {
      btnSetActive.disabled = isCurrentActive;
      btnSetActive.innerText = isCurrentActive ? '✓ Currently Active' : '⭐ Set as Active';
      btnSetActive.style.opacity = isCurrentActive ? '0.6' : '1';
    }

    // Preset sets cannot be deleted
    const isProtected = ['java', 'python', 'mlops'].includes(currentQuizData.id);
    if (btnDeleteSet) {
      btnDeleteSet.disabled = isProtected || isCurrentActive;
      btnDeleteSet.style.display = isProtected ? 'none' : 'inline-block';
    }

    renderQuestions();
  } catch (err) {
    console.error('Error loading single quiz set:', err);
  }
}

// Dropdown change listener
selectActiveSet.addEventListener('change', () => {
  loadSingleQuizSet(selectActiveSet.value);
});

// Set active button
btnSetActive.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/quiz-sets/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentQuizData.id })
    });
    const result = await res.json();
    if (result.success) {
      activeQuizId = result.activeQuizId;
      alert(`🎯 "${result.activeQuizTitle}" is now active for all participants and host screen!`);
      loadQuizSets(currentQuizData.id);
    }
  } catch (e) {
    alert('Failed to set active quiz.');
  }
});

// Rename / Edit Quiz Set Metadata Modal
btnRenameSet.addEventListener('click', () => {
  setFormMode.value = 'edit';
  setModalTitle.innerText = `Rename / Edit: ${currentQuizData.title}`;
  setFormTitle.value = currentQuizData.title;
  setFormLang.value = currentQuizData.language || 'java';
  setFormDesc.value = currentQuizData.description || '';
  setModal.style.display = 'flex';
});

// New Quiz Set Modal
btnNewSet.addEventListener('click', () => {
  setFormMode.value = 'create';
  setModalTitle.innerText = 'Create New Quiz Set';
  setFormTitle.value = '';
  setFormLang.value = 'java';
  setFormDesc.value = '';
  setModal.style.display = 'flex';
});

btnCancelSet.addEventListener('click', () => {
  setModal.style.display = 'none';
});

// Handle Save Quiz Set Metadata
setForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mode = setFormMode.value;
  const title = setFormTitle.value.trim();
  const language = setFormLang.value;
  const desc = setFormDesc.value.trim();

  if (!title) return;

  if (mode === 'create') {
    // Generate safe slug id
    const safeId = title.toLowerCase().replace(/[^a-z0-9_-]/g, '_') + '_' + Date.now().toString(36);
    // Starter starter template question
    const starterQuestion = {
      id: 1,
      type: 'multiple_choice',
      question: `Sample question for ${title}`,
      code: null,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 0,
      timeLimit: 25,
      explanation: 'Explanation for correct answer.'
    };

    try {
      const res = await fetch('/api/quiz-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: safeId,
          title: title,
          language: language,
          description: desc,
          questions: [starterQuestion]
        })
      });
      const data = await res.json();
      if (data.success) {
        setModal.style.display = 'none';
        alert(`✅ Created quiz set "${title}" successfully!`);
        await loadQuizSets(safeId);
      } else {
        alert(data.error || 'Failed to create quiz set.');
      }
    } catch (err) {
      alert('Network error creating quiz set.');
    }
  } else {
    // Edit existing quiz set metadata
    currentQuizData.title = title;
    currentQuizData.language = language;
    currentQuizData.description = desc;

    try {
      const res = await fetch('/api/quiz-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentQuizData.id,
          title: currentQuizData.title,
          language: currentQuizData.language,
          description: currentQuizData.description,
          questions: questionsList
        })
      });
      const data = await res.json();
      if (data.success) {
        setModal.style.display = 'none';
        alert(`✅ Updated quiz "${title}"!`);
        await loadQuizSets(currentQuizData.id);
      } else {
        alert(data.error || 'Failed to update quiz set.');
      }
    } catch (err) {
      alert('Network error saving quiz set metadata.');
    }
  }
});

// Delete Quiz Set
btnDeleteSet.addEventListener('click', async () => {
  if (!confirm(`Are you sure you want to permanently delete the quiz set "${currentQuizData.title}"?`)) {
    return;
  }
  try {
    const res = await fetch(`/api/quiz-sets/${currentQuizData.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      await loadQuizSets(activeQuizId);
    } else {
      alert(data.error || 'Could not delete quiz set.');
    }
  } catch (e) {
    alert('Network error deleting quiz set.');
  }
});

// Render question list
function renderQuestions() {
  totalCountEl.innerText = questionsList.length;
  container.innerHTML = '';

  const lang = currentQuizData.language || 'java';
  const shapes = ['▲', '◆', '●', '■'];
  const shapeColors = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];

  questionsList.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'q-card-item';

    let badgeClass = 'badge-mcq';
    let typeName = 'Pilihan Ganda';
    if (q.type === 'multi_select') {
      badgeClass = 'badge-multi';
      typeName = 'Multiple Choice';
    } else if (q.type === 'true_false') {
      badgeClass = 'badge-tf';
      typeName = 'True / False';
    } else if (q.type === 'fill_in') {
      badgeClass = 'badge-fib';
      typeName = 'Fill in Blank';
    }

    let optionsHtml = '';
    if (q.type === 'multiple_choice') {
      optionsHtml = `<div class="opt-list">`;
      (q.options || []).forEach((opt, oIdx) => {
        const isCorrect = oIdx === Number(q.correctAnswer);
        const shape = shapes[oIdx % 4];
        const color = shapeColors[oIdx % 4];
        optionsHtml += `
          <div class="opt-item ${isCorrect ? 'correct' : ''}">
            <span style="color: ${color}; font-weight: bold; margin-right: 6px;">${shape}</span>
            <span style="flex: 1;">${escapeHtml(opt)}</span>
            ${isCorrect ? '<span style="color: #00e676; font-weight: bold; margin-left: 8px;">✓</span>' : ''}
          </div>`;
      });
      optionsHtml += `</div>`;
    } else if (q.type === 'multi_select') {
      optionsHtml = `<div class="opt-list">`;
      const correctArr = Array.isArray(q.correctAnswers)
        ? q.correctAnswers
        : (q.correctAnswer !== undefined ? [Number(q.correctAnswer)] : []);
      (q.options || []).forEach((opt, oIdx) => {
        const isCorrect = correctArr.includes(oIdx);
        const shape = shapes[oIdx % 4];
        const color = shapeColors[oIdx % 4];
        optionsHtml += `
          <div class="opt-item ${isCorrect ? 'correct' : ''}">
            <span style="color: ${color}; font-weight: bold; margin-right: 6px;">${shape}</span>
            <span style="flex: 1;">${escapeHtml(opt)}</span>
            ${isCorrect ? '<span style="color: #c084fc; font-weight: bold; margin-left: 8px;">☑ [Key]</span>' : ''}
          </div>`;
      });
      optionsHtml += `</div>`;
    } else if (q.type === 'true_false') {
      optionsHtml = `<div class="opt-list">
        <div class="opt-item ${Number(q.correctAnswer) === 0 ? 'correct' : ''}">
          <span style="flex: 1;">True</span>
          ${Number(q.correctAnswer) === 0 ? '<span style="color: #00e676; font-weight: bold;">✓</span>' : ''}
        </div>
        <div class="opt-item ${Number(q.correctAnswer) === 1 ? 'correct' : ''}">
          <span style="flex: 1;">False</span>
          ${Number(q.correctAnswer) === 1 ? '<span style="color: #00e676; font-weight: bold;">✓</span>' : ''}
        </div>
      </div>`;
    } else if (q.type === 'fill_in') {
      optionsHtml = `<div style="margin-top: 10px; font-size: 13px; color: #00e676;">
        Acceptable Answers: <strong>${(q.correctAnswers || []).map(escapeHtml).join(', ')}</strong>
      </div>`;
    }

    let codeHtml = '';
    if (q.code) {
      codeHtml = `<pre class="language-${lang}" style="border-radius: 8px; margin: 10px 0;"><code class="language-${lang}">${escapeHtml(q.code)}</code></pre>`;
    }

    card.innerHTML = `
      <div class="q-card-header">
        <div style="display: flex; gap: 10px; align-items: center;">
          <strong style="font-size: 16px; color: #ffca28;">#${idx + 1}</strong>
          <span class="q-badge ${badgeClass}">${typeName}</span>
          <span style="font-size: 12px; color: var(--text-muted);">⏱ ${q.timeLimit || 25}s</span>
        </div>
        <div class="q-controls">
          <button type="button" class="btn-icon" onclick="moveQuestion(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="btn-icon" onclick="moveQuestion(${idx}, 1)" ${idx === questionsList.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" class="btn-icon" onclick="openEditModal(${idx})">✏️ Edit</button>
          <button type="button" class="btn-icon delete" onclick="deleteQuestion(${idx})">🗑 Delete</button>
        </div>
      </div>
      <div style="font-size: 16px; font-weight: 600; line-height: 1.4;">${escapeHtml(q.question)}</div>
      ${codeHtml}
      ${optionsHtml}
      ${q.explanation ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 10px; border-top: 1px solid #282c47; padding-top: 6px;">💡 ${escapeHtml(q.explanation)}</div>` : ''}
    `;

    container.appendChild(card);
  });

  // Re-trigger Prism syntax highlight
  if (window.Prism) {
    Prism.highlightAll();
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Question Modal UI updater
function updateQuestionTypeUI() {
  const type = formType.value;
  const isMcqOrMulti = (type === 'multiple_choice' || type === 'multi_select');
  sectionMcq.style.display = isMcqOrMulti ? 'block' : 'none';
  sectionTf.style.display = type === 'true_false' ? 'block' : 'none';
  sectionFib.style.display = type === 'fill_in' ? 'block' : 'none';

  const radios = document.querySelectorAll('.opt-radio');
  const checkboxes = document.querySelectorAll('.opt-checkbox');
  const opt0 = document.getElementById('opt-0');
  const opt1 = document.getElementById('opt-1');

  if (isMcqOrMulti) {
    if (opt0) opt0.required = true;
    if (opt1) opt1.required = true;

    if (type === 'multi_select') {
      if (mcqLabel) mcqLabel.innerText = 'Options & Multiple Correct Answers';
      if (mcqHint) mcqHint.innerText = 'Centang semua jawaban yang benar (Checkbox - bisa >1)';
      radios.forEach(r => r.style.display = 'none');
      checkboxes.forEach(c => c.style.display = 'inline-block');
    } else {
      if (mcqLabel) mcqLabel.innerText = 'Options & Single Correct Answer';
      if (mcqHint) mcqHint.innerText = 'Pilih 1 kunci jawaban yang benar (Radio button)';
      radios.forEach(r => r.style.display = 'inline-block');
      checkboxes.forEach(c => c.style.display = 'none');
    }
  } else {
    if (opt0) opt0.required = false;
    if (opt1) opt1.required = false;
  }
}

formType.addEventListener('change', updateQuestionTypeUI);

function openAddModal() {
  editIndexInput.value = '-1';
  modalTitle.innerText = `Add New Question to ${currentQuizData.title}`;
  qForm.reset();
  formType.value = 'multiple_choice';
  updateQuestionTypeUI();
  modal.style.display = 'flex';
}

function openEditModal(idx) {
  const q = questionsList[idx];
  if (!q) return;

  editIndexInput.value = idx;
  modalTitle.innerText = `Edit Question #${idx + 1}`;

  const validTypes = ['multiple_choice', 'multi_select', 'true_false', 'fill_in'];
  formType.value = validTypes.includes(q.type) ? q.type : 'multiple_choice';
  updateQuestionTypeUI();

  formTime.value = q.timeLimit || 25;
  formQuestion.value = q.question || '';
  formCode.value = q.code || '';
  formExplanation.value = q.explanation || '';

  // Clear options and checkboxes first
  for (let i = 0; i < 4; i++) {
    const input = document.getElementById(`opt-${i}`);
    if (input) input.value = '';
    const chk = document.querySelector(`input[name="correct-multi-opt"][value="${i}"]`);
    if (chk) chk.checked = false;
  }

  if (q.type === 'multiple_choice') {
    (q.options || []).forEach((opt, i) => {
      const input = document.getElementById(`opt-${i}`);
      if (input) input.value = opt;
    });
    const rad = document.querySelector(`input[name="correct-opt"][value="${q.correctAnswer}"]`);
    if (rad) rad.checked = true;
  } else if (q.type === 'multi_select') {
    (q.options || []).forEach((opt, i) => {
      const input = document.getElementById(`opt-${i}`);
      if (input) input.value = opt;
    });
    const correctArr = Array.isArray(q.correctAnswers)
      ? q.correctAnswers
      : (q.correctAnswer !== undefined ? [Number(q.correctAnswer)] : [0]);
    [0, 1, 2, 3].forEach(i => {
      const chk = document.querySelector(`input[name="correct-multi-opt"][value="${i}"]`);
      if (chk) chk.checked = correctArr.includes(i);
    });
  } else if (q.type === 'true_false') {
    const rad = document.querySelector(`input[name="correct-tf"][value="${q.correctAnswer}"]`);
    if (rad) rad.checked = true;
  } else if (q.type === 'fill_in') {
    formFibAnswers.value = (q.correctAnswers || []).join(', ');
  }

  modal.style.display = 'flex';
}

function closeModal() {
  modal.style.display = 'none';
}

btnAddQ.addEventListener('click', openAddModal);
btnModalCancel.addEventListener('click', closeModal);

// Question Form submit
qForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const idx = Number(editIndexInput.value);
  const type = formType.value;

  const newQ = {
    id: idx >= 0 ? questionsList[idx].id : questionsList.length + 1,
    type: type,
    question: formQuestion.value.trim(),
    code: formCode.value.trim() || null,
    timeLimit: Number(formTime.value) || 25,
    explanation: formExplanation.value.trim()
  };

  if (type === 'multiple_choice') {
    newQ.options = [
      document.getElementById('opt-0').value.trim(),
      document.getElementById('opt-1').value.trim(),
      document.getElementById('opt-2').value.trim() || 'Option 3',
      document.getElementById('opt-3').value.trim() || 'Option 4'
    ];
    const checked = document.querySelector('input[name="correct-opt"]:checked');
    newQ.correctAnswer = checked ? Number(checked.value) : 0;
  } else if (type === 'multi_select') {
    newQ.options = [
      document.getElementById('opt-0').value.trim(),
      document.getElementById('opt-1').value.trim(),
      document.getElementById('opt-2').value.trim() || 'Option 3',
      document.getElementById('opt-3').value.trim() || 'Option 4'
    ];
    const checkedBoxes = document.querySelectorAll('input[name="correct-multi-opt"]:checked');
    newQ.correctAnswers = Array.from(checkedBoxes).map(cb => Number(cb.value));
    if (newQ.correctAnswers.length === 0) {
      newQ.correctAnswers = [0]; // default at least 1
    }
  } else if (type === 'true_false') {
    newQ.options = ['True', 'False'];
    const checked = document.querySelector('input[name="correct-tf"]:checked');
    newQ.correctAnswer = checked ? Number(checked.value) : 0;
  } else if (type === 'fill_in') {
    const raw = formFibAnswers.value.split(',');
    newQ.correctAnswers = raw.map(s => s.trim()).filter(Boolean);
    if (newQ.correctAnswers.length === 0) newQ.correctAnswers = ['answer'];
  }

  if (idx >= 0) {
    questionsList[idx] = newQ;
  } else {
    questionsList.push(newQ);
  }

  closeModal();
  renderQuestions();
});

// Move & Delete Question
window.moveQuestion = function(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= questionsList.length) return;
  const temp = questionsList[idx];
  questionsList[idx] = questionsList[target];
  questionsList[target] = temp;
  renderQuestions();
};

window.deleteQuestion = function(idx) {
  if (confirm(`Delete Question #${idx + 1}?`)) {
    questionsList.splice(idx, 1);
    renderQuestions();
  }
};

window.openEditModal = openEditModal;

// Save current quiz set questions to server
btnSaveServer.addEventListener('click', async () => {
  if (questionsList.length === 0) {
    alert('Cannot save an empty question list!');
    return;
  }

  try {
    const res = await fetch('/api/quiz-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentQuizData.id,
        title: currentQuizData.title,
        language: currentQuizData.language || 'java',
        description: currentQuizData.description || '',
        questions: questionsList
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`🎉 Successfully saved ${data.count} questions for "${currentQuizData.title}"!`);
      loadQuizSets(currentQuizData.id);
    } else {
      alert(`Failed to save: ${data.error}`);
    }
  } catch (err) {
    console.error('Save error:', err);
    alert('Failed to connect to server.');
  }
});

// Init on load
loadQuizSets();
