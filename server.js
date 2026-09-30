const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;

// Quiz Sets Directory & State
const quizSetsDir = path.join(__dirname, 'data', 'quiz_sets');
const activeQuizPath = path.join(__dirname, 'data', 'active_quiz.json');
const questionsPath = path.join(__dirname, 'data', 'questions.json');
const backupPath = path.join(__dirname, 'data', 'session_backup.json');

if (!fs.existsSync(quizSetsDir)) {
  fs.mkdirSync(quizSetsDir, { recursive: true });
}

let currentQuizId = 'java';
let currentQuizTitle = 'Java Fundamentals';
let currentQuizLanguage = 'java';
let questions = [];

function getQuizSets() {
  try {
    if (!fs.existsSync(quizSetsDir)) return [];
    const files = fs.readdirSync(quizSetsDir).filter(f => f.endsWith('.json'));
    return files.map(f => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(quizSetsDir, f), 'utf8'));
        return {
          id: content.id || path.basename(f, '.json'),
          title: content.title || content.id || path.basename(f, '.json'),
          language: content.language || 'java',
          description: content.description || '',
          count: Array.isArray(content.questions) ? content.questions.length : 0
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  } catch (err) {
    console.error('Error reading quiz sets:', err);
    return [];
  }
}

function loadActiveQuiz(targetId) {
  try {
    let idToLoad = targetId;
    if (!idToLoad && fs.existsSync(activeQuizPath)) {
      try {
        const activeMeta = JSON.parse(fs.readFileSync(activeQuizPath, 'utf8'));
        idToLoad = activeMeta.activeQuizId;
      } catch (e) {}
    }
    if (!idToLoad) idToLoad = 'java';

    const setFile = path.join(quizSetsDir, `${idToLoad}.json`);
    if (fs.existsSync(setFile)) {
      const data = JSON.parse(fs.readFileSync(setFile, 'utf8'));
      currentQuizId = data.id || idToLoad;
      currentQuizTitle = data.title || 'Interactive Quiz';
      currentQuizLanguage = data.language || 'java';
      questions = Array.isArray(data.questions) ? data.questions : [];
    } else if (fs.existsSync(questionsPath)) {
      questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
      currentQuizId = 'custom';
      currentQuizTitle = 'Custom Quiz';
      currentQuizLanguage = 'java';
    }

    try {
      fs.writeFileSync(activeQuizPath, JSON.stringify({ activeQuizId: currentQuizId }, null, 2));
      fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2));
    } catch (e) {}

    console.log(`✅ Loaded quiz set "${currentQuizTitle}" (${currentQuizId}) with ${questions.length} questions.`);
  } catch (err) {
    console.error('Error loading active quiz:', err);
  }
}

// Initial load on server start
loadActiveQuiz();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Specific routes
app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

app.get('/manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

// Quiz Sets API Endpoints
app.get('/api/quiz-sets', (req, res) => {
  res.json({
    activeQuizId: currentQuizId,
    activeQuizTitle: currentQuizTitle,
    activeQuizLanguage: currentQuizLanguage,
    quizSets: getQuizSets()
  });
});

app.get('/api/quiz-sets/:id', (req, res) => {
  const setFile = path.join(quizSetsDir, `${req.params.id}.json`);
  if (!fs.existsSync(setFile)) {
    return res.status(404).json({ error: 'Quiz set not found.' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(setFile, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read quiz set.' });
  }
});

app.post('/api/quiz-sets/active', (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Quiz set ID is required.' });

  loadActiveQuiz(id);

  io.emit('quiz_info_updated', {
    quizId: currentQuizId,
    quizTitle: currentQuizTitle,
    quizLanguage: currentQuizLanguage,
    totalQuestions: questions.length
  });

  res.json({
    success: true,
    activeQuizId: currentQuizId,
    activeQuizTitle: currentQuizTitle,
    activeQuizLanguage: currentQuizLanguage,
    totalQuestions: questions.length
  });
});

app.post('/api/quiz-sets', (req, res) => {
  try {
    const { id, title, language, description, questions: setQuestions } = req.body || {};
    if (!title || !Array.isArray(setQuestions) || setQuestions.length === 0) {
      return res.status(400).json({ error: 'Quiz title and a non-empty questions array are required.' });
    }

    const safeId = (id || title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')).trim();
    if (!safeId) return res.status(400).json({ error: 'Invalid quiz set ID.' });

    // Clean index questions
    setQuestions.forEach((q, idx) => {
      q.id = idx + 1;
      q.timeLimit = Number(q.timeLimit) || 25;
    });

    const quizData = {
      id: safeId,
      title: title.trim(),
      language: language || 'java',
      description: description || '',
      questions: setQuestions
    };

    const targetFile = path.join(quizSetsDir, `${safeId}.json`);
    fs.writeFileSync(targetFile, JSON.stringify(quizData, null, 2));

    if (safeId === currentQuizId) {
      loadActiveQuiz(safeId);
      io.emit('quiz_info_updated', {
        quizId: currentQuizId,
        quizTitle: currentQuizTitle,
        quizLanguage: currentQuizLanguage,
        totalQuestions: questions.length
      });
    }

    res.json({ success: true, id: safeId, title: quizData.title, count: setQuestions.length });
  } catch (err) {
    console.error('Error saving quiz set:', err);
    res.status(500).json({ error: 'Failed to save quiz set.' });
  }
});

app.delete('/api/quiz-sets/:id', (req, res) => {
  const { id } = req.params;
  if (['java', 'python', 'mlops'].includes(id)) {
    return res.status(400).json({ error: 'Default preset quiz sets (Java, Python, MLOps) cannot be deleted.' });
  }
  if (id === currentQuizId) {
    return res.status(400).json({ error: 'Cannot delete the currently active quiz set. Switch to another quiz first.' });
  }

  const targetFile = path.join(quizSetsDir, `${id}.json`);
  if (fs.existsSync(targetFile)) {
    fs.unlinkSync(targetFile);
    return res.json({ success: true, message: `Quiz set '${id}' deleted.` });
  }
  res.status(404).json({ error: 'Quiz set not found.' });
});

// Legacy / Active Question API Endpoints for Visual Editor
app.get('/api/questions', (req, res) => {
  res.json(questions);
});

app.post('/api/questions', (req, res) => {
  try {
    const updated = req.body;
    if (!Array.isArray(updated) || updated.length === 0) {
      return res.status(400).json({ error: 'Questions list must be a non-empty array.' });
    }

    // Re-index IDs cleanly
    updated.forEach((q, idx) => {
      q.id = idx + 1;
      q.timeLimit = Number(q.timeLimit) || 25;
    });

    questions = updated;

    // Save to active quiz set file
    const activeFile = path.join(quizSetsDir, `${currentQuizId}.json`);
    let quizSetData = {
      id: currentQuizId,
      title: currentQuizTitle,
      language: currentQuizLanguage,
      questions: questions
    };
    if (fs.existsSync(activeFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
        quizSetData = { ...existing, questions: questions };
      } catch (e) {}
    }
    fs.writeFileSync(activeFile, JSON.stringify(quizSetData, null, 2));
    fs.writeFileSync(questionsPath, JSON.stringify(questions, null, 2));

    console.log(`✅ Updated ${questions.length} questions for quiz '${currentQuizTitle}'.`);

    io.emit('quiz_info_updated', {
      quizId: currentQuizId,
      quizTitle: currentQuizTitle,
      quizLanguage: currentQuizLanguage,
      totalQuestions: questions.length
    });

    return res.json({ success: true, count: questions.length, questions });
  } catch (err) {
    console.error('Error saving questions:', err);
    return res.status(500).json({ error: 'Failed to save questions.' });
  }
});

// CSV Export Endpoint
app.get('/api/export-csv', (req, res) => {
  try {
    const playersList = Object.values(gameState.players);
    if (playersList.length === 0) {
      return res.status(400).send('No participant data available to export.');
    }

    playersList.sort((a, b) => b.score - a.score);

    const headerCols = ['Rank', 'NIM', 'Full Name', 'Total Score', 'Correct Count', 'Tab Switches (Cheat Alert)'];
    questions.forEach((q, idx) => {
      headerCols.push(`Q${idx + 1} Status`);
      headerCols.push(`Q${idx + 1} Answer`);
    });

    const rows = [headerCols.join(',')];

    playersList.forEach((player, rankIdx) => {
      let correctCount = 0;
      const questionCols = [];
      questions.forEach((q, qIdx) => {
        const ansRecord = player.answers[q.id];
        if (ansRecord) {
          if (ansRecord.isCorrect) correctCount++;
          questionCols.push(ansRecord.isCorrect ? 'CORRECT' : 'INCORRECT');
          const cleanAns = String(ansRecord.submittedAnswer || '-').replace(/"/g, '""');
          questionCols.push(`"${cleanAns}"`);
        } else {
          questionCols.push('NO_ANSWER');
          questionCols.push('"-"');
        }
      });

      const row = [
        rankIdx + 1,
        `"${(player.nim || '').replace(/"/g, '""')}"`,
        `"${(player.name || '').replace(/"/g, '""')}"`,
        player.score,
        correctCount,
        player.tabSwitches || 0
      ];

      const fullRow = row.concat(questionCols);
      rows.push(fullRow.join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Java_Quiz_Results.csv"');
    return res.send(csvContent);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).send('Failed to generate CSV export.');
  }
});

// Game state
const gameState = {
  status: 'LOBBY', // LOBBY, COUNTDOWN, QUESTION_ACTIVE, QUESTION_RESULT, LEADERBOARD, GAME_OVER
  currentQuestionIndex: -1,
  questionStartTime: null,
  timerInterval: null,
  timeLeft: 0,
  hostSocketId: null,
  shuffleOptions: true, // Anti-cheating feature
  players: {}, // socketId -> { id, sessionToken, name, nim, score, streak, answers: {} }
  currentQuestionAnswers: {} // socketId -> { submittedAnswer, isCorrect, pointsEarned, timeSpent }
};

function saveSessionBackup() {
  try {
    const backupData = {
      savedAt: new Date().toISOString(),
      status: gameState.status,
      currentQuestionIndex: gameState.currentQuestionIndex,
      shuffleOptions: gameState.shuffleOptions,
      players: gameState.players
    };
    const tempPath = backupPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(backupData, null, 2));
    fs.renameSync(tempPath, backupPath);
  } catch (e) {
    console.error('Backup error:', e);
  }
}

function sanitizePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    nim: player.nim,
    score: player.score,
    streak: player.streak,
    tabSwitches: player.tabSwitches || 0
  };
}

function getLeaderboard() {
  return Object.values(gameState.players)
    .map(p => sanitizePlayer(p))
    .sort((a, b) => b.score - a.score);
}

function calculateScore(timeSpentSeconds, maxTimeLimit) {
  const ratio = Math.max(0, Math.min(1, (maxTimeLimit - timeSpentSeconds) / maxTimeLimit));
  return Math.round(500 + 500 * ratio);
}

function checkAnswerCorrectness(question, submittedAnswer) {
  if (submittedAnswer === null || submittedAnswer === undefined) return false;

  if (question.type === 'multiple_choice' || question.type === 'true_false') {
    return Number(submittedAnswer) === Number(question.correctAnswer);
  }

  if (question.type === 'fill_in') {
    const cleanSub = String(submittedAnswer).trim().toLowerCase();
    return question.correctAnswers.some(ans => ans.trim().toLowerCase() === cleanSub);
  }

  if (question.type === 'multi_select') {
    if (!Array.isArray(submittedAnswer) || submittedAnswer.length === 0) return false;
    const expected = (question.correctAnswers || []).map(Number).sort((a, b) => a - b);
    const actual = submittedAnswer.map(Number).sort((a, b) => a - b);
    if (expected.length !== actual.length) return false;
    return expected.every((val, idx) => val === actual[idx]);
  }

  return false;
}

function getAnswerDistribution(question) {
  const dist = {};
  if (question.type === 'multiple_choice' || question.type === 'multi_select') {
    question.options.forEach((_, i) => dist[i] = 0);
  } else if (question.type === 'true_false') {
    dist[0] = 0;
    dist[1] = 0;
  } else if (question.type === 'fill_in') {
    dist.correct = 0;
    dist.incorrect = 0;
  }

  Object.values(gameState.currentQuestionAnswers).forEach(ans => {
    if (question.type === 'multiple_choice' || question.type === 'true_false') {
      if (dist[ans.submittedAnswer] !== undefined) {
        dist[ans.submittedAnswer]++;
      }
    } else if (question.type === 'multi_select') {
      if (Array.isArray(ans.submittedAnswer)) {
        ans.submittedAnswer.forEach(choice => {
          if (dist[choice] !== undefined) dist[choice]++;
        });
      }
    } else if (question.type === 'fill_in') {
      if (ans.isCorrect) dist.correct++;
      else dist.incorrect++;
    }
  });

  return dist;
}

// Classroom Insights calculation
function calculateClassroomInsights(playersList) {
  if (!playersList || playersList.length === 0 || questions.length === 0) {
    return null;
  }

  const questionStats = questions.map((q, qIdx) => {
    let correct = 0;
    let attempted = 0;
    let totalTime = 0;

    playersList.forEach(p => {
      const ans = p.answers[q.id];
      if (ans) {
        attempted++;
        if (ans.isCorrect) correct++;
        if (ans.timeSpent) totalTime += ans.timeSpent;
      }
    });

    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const avgTime = attempted > 0 ? Number((totalTime / attempted).toFixed(1)) : 0;

    return {
      id: q.id,
      index: qIdx + 1,
      type: q.type,
      question: q.question,
      correct,
      attempted,
      accuracy,
      avgTime
    };
  });

  const sortedByAccuracy = [...questionStats].sort((a, b) => a.accuracy - b.accuracy);
  const toughest = sortedByAccuracy[0];
  const easiest = sortedByAccuracy[sortedByAccuracy.length - 1];

  const totalCorrect = questionStats.reduce((sum, q) => sum + q.correct, 0);
  const totalPossible = playersList.length * questions.length;
  const overallAccuracy = totalPossible > 0 ? Math.round((totalCorrect / totalPossible) * 100) : 0;

  let fastestStudent = null;
  let minAvgTime = Infinity;

  playersList.forEach(p => {
    const ansList = Object.values(p.answers);
    if (ansList.length > 0) {
      const avg = ansList.reduce((s, a) => s + (a.timeSpent || 0), 0) / ansList.length;
      if (avg < minAvgTime && p.score > 0) {
        minAvgTime = avg;
        fastestStudent = {
          name: p.name,
          nim: p.nim,
          avgTime: Number(avg.toFixed(1))
        };
      }
    }
  });

  return {
    toughestQuestion: toughest,
    easiestQuestion: easiest,
    overallAccuracy,
    fastestStudent,
    totalStudents: playersList.length
  };
}

function stopTimer() {
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
}

function broadcastQuestionResult() {
  stopTimer();
  gameState.status = 'QUESTION_RESULT';

  const currentQ = questions[gameState.currentQuestionIndex];
  const distribution = getAnswerDistribution(currentQ);
  const leaderboard = getLeaderboard();

  // Notify host
  io.emit('question_result', {
    question: currentQ,
    distribution: distribution,
    leaderboard: leaderboard.slice(0, 5),
    totalAnswered: Object.keys(gameState.currentQuestionAnswers).length,
    totalPlayers: Object.keys(gameState.players).length
  });

  // Individualized feedback
  Object.keys(gameState.players).forEach(socketId => {
    const player = gameState.players[socketId];
    const ans = gameState.currentQuestionAnswers[socketId];
    const rank = leaderboard.findIndex(p => p.id === socketId) + 1;

    let correctText = '';
    if (currentQ.type === 'fill_in') {
      correctText = currentQ.correctAnswers ? currentQ.correctAnswers[0] : '';
    } else if (currentQ.type === 'multi_select') {
      correctText = (currentQ.correctAnswers || []).map(i => currentQ.options[i]).join(', ');
    } else {
      correctText = currentQ.options[currentQ.correctAnswer];
    }

    io.to(socketId).emit('player_question_result', {
      isCorrect: ans ? ans.isCorrect : false,
      pointsEarned: ans ? ans.pointsEarned : 0,
      totalScore: player.score,
      streak: player.streak,
      rank: rank,
      correctAnswer: correctText,
      explanation: currentQ.explanation
    });
  });

  saveSessionBackup();
}

function startQuestion(index) {
  if (index < 0 || index >= questions.length) {
    endGame();
    return;
  }

  stopTimer();
  gameState.status = 'QUESTION_ACTIVE';
  gameState.currentQuestionIndex = index;
  gameState.currentQuestionAnswers = {};

  const currentQ = questions[index];
  gameState.timeLeft = currentQ.timeLimit || 25;
  gameState.questionStartTime = Date.now();

  const clientQuestion = {
    index: index,
    total: questions.length,
    id: currentQ.id,
    type: currentQ.type,
    question: currentQ.question,
    code: currentQ.code || null,
    options: currentQ.options || null,
    timeLimit: gameState.timeLeft,
    shuffle: gameState.shuffleOptions
  };

  io.emit('new_question', clientQuestion);
  saveSessionBackup();

  gameState.timerInterval = setInterval(() => {
    gameState.timeLeft--;
    io.emit('timer_tick', { timeLeft: gameState.timeLeft });

    if (gameState.timeLeft <= 0) {
      stopTimer();
      broadcastQuestionResult();
    }
  }, 1000);
}

function endGame() {
  stopTimer();
  gameState.status = 'GAME_OVER';

  const fullLeaderboard = getLeaderboard();
  const rawPlayersList = Object.values(gameState.players);

  // Compile detailed matrix for host
  const detailedSummary = fullLeaderboard.map((p, idx) => {
    const rawPlayer = gameState.players[p.id];
    let correctCount = 0;
    const answerBreakdown = questions.map(q => {
      const ansRecord = rawPlayer ? rawPlayer.answers[q.id] : null;
      if (ansRecord && ansRecord.isCorrect) correctCount++;
      return {
        questionId: q.id,
        questionText: q.question,
        submittedAnswer: ansRecord ? ansRecord.submittedAnswer : null,
        isCorrect: ansRecord ? ansRecord.isCorrect : false,
        points: ansRecord ? ansRecord.pointsEarned : 0
      };
    });

    return {
      rank: idx + 1,
      name: p.name,
      nim: p.nim,
      score: p.score,
      correctCount: correctCount,
      tabSwitches: rawPlayer ? (rawPlayer.tabSwitches || 0) : 0,
      answers: answerBreakdown
    };
  });

  // Calculate Insights
  const insights = calculateClassroomInsights(rawPlayersList);

  io.emit('game_over', {
    podium: fullLeaderboard.slice(0, 3),
    leaderboard: fullLeaderboard,
    detailedSummary: detailedSummary,
    insights: insights,
    totalQuestions: questions.length
  });

  // Send individualized review to each player
  Object.keys(gameState.players).forEach(socketId => {
    const player = gameState.players[socketId];
    if (!player) return;

    const myReview = questions.map(q => {
      const ansRecord = player.answers[q.id];
      let correctDisplay = '';
      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        correctDisplay = q.options[q.correctAnswer];
      } else if (q.type === 'multi_select') {
        correctDisplay = (q.correctAnswers || []).map(i => q.options[i]).join(', ');
      } else {
        correctDisplay = q.correctAnswers.join(', ');
      }

      let submittedDisplay = '-';
      if (ansRecord && ansRecord.submittedAnswer !== null && ansRecord.submittedAnswer !== undefined) {
        if (q.type === 'multiple_choice' || q.type === 'true_false') {
          submittedDisplay = q.options[ansRecord.submittedAnswer] || ansRecord.submittedAnswer;
        } else if (q.type === 'multi_select') {
          if (Array.isArray(ansRecord.submittedAnswer)) {
            submittedDisplay = ansRecord.submittedAnswer.map(i => q.options[i] || i).join(', ');
          } else {
            submittedDisplay = String(ansRecord.submittedAnswer);
          }
        } else {
          submittedDisplay = ansRecord.submittedAnswer;
        }
      }

      return {
        id: q.id,
        question: q.question,
        code: q.code || null,
        submitted: submittedDisplay,
        correctAnswer: correctDisplay,
        isCorrect: ansRecord ? ansRecord.isCorrect : false,
        explanation: q.explanation || ''
      };
    });

    io.to(socketId).emit('player_game_over_review', {
      review: myReview
    });
  });

  saveSessionBackup();
}

// Socket handlers
io.on('connection', (socket) => {
  socket.emit('init_state', {
    status: gameState.status,
    currentQuestionIndex: gameState.currentQuestionIndex,
    totalQuestions: questions.length,
    shuffleOptions: gameState.shuffleOptions,
    quizId: currentQuizId,
    quizTitle: currentQuizTitle,
    quizLanguage: currentQuizLanguage
  });

  // Host registers
  socket.on('host_join', () => {
    gameState.hostSocketId = socket.id;
    socket.emit('host_synced', {
      status: gameState.status,
      players: Object.values(gameState.players).map(p => sanitizePlayer(p)),
      currentQuestionIndex: gameState.currentQuestionIndex,
      totalQuestions: questions.length,
      shuffleOptions: gameState.shuffleOptions,
      quizId: currentQuizId,
      quizTitle: currentQuizTitle,
      quizLanguage: currentQuizLanguage,
      quizSets: getQuizSets()
    });
  });

  // Host changes active quiz set from lobby dropdown
  socket.on('host_change_quiz_set', (data) => {
    if (gameState.status !== 'LOBBY') {
      return socket.emit('error_notification', { message: 'Quiz set can only be switched while in Lobby.' });
    }
    const { quizId } = data || {};
    if (quizId) {
      loadActiveQuiz(quizId);
      io.emit('quiz_info_updated', {
        quizId: currentQuizId,
        quizTitle: currentQuizTitle,
        quizLanguage: currentQuizLanguage,
        totalQuestions: questions.length
      });
      socket.emit('host_synced', {
        status: gameState.status,
        players: Object.values(gameState.players).map(p => sanitizePlayer(p)),
        currentQuestionIndex: gameState.currentQuestionIndex,
        totalQuestions: questions.length,
        shuffleOptions: gameState.shuffleOptions,
        quizId: currentQuizId,
        quizTitle: currentQuizTitle,
        quizLanguage: currentQuizLanguage,
        quizSets: getQuizSets()
      });
    }
  });

  // Host toggles anti-cheating shuffle
  socket.on('host_toggle_shuffle', (data) => {
    gameState.shuffleOptions = !!data.enabled;
    console.log(`Anti-cheating shuffle set to: ${gameState.shuffleOptions}`);
    saveSessionBackup();
  });

  // Live Floating Emoji Reactions
  socket.on('send_reaction', (data) => {
    const emoji = data && data.emoji;
    if (!emoji) return;
    // Broadcast reaction to host and all participants
    io.emit('reaction_received', {
      emoji: emoji,
      from: socket.id
    });
  });

  // Host kicks a player from lobby
  socket.on('host_kick_player', (data) => {
    const { playerId } = data || {};
    if (!playerId || !gameState.players[playerId]) return;

    delete gameState.players[playerId];

    io.to(playerId).emit('player_kicked', {
      message: 'You have been removed from the session by the host.'
    });

    io.emit('player_list_update', {
      count: Object.keys(gameState.players).length,
      players: Object.values(gameState.players).map(p => sanitizePlayer(p))
    });

    saveSessionBackup();
  });

  // Player session reconnect
  socket.on('player_reconnect', (data) => {
    const { nim, sessionToken } = data || {};
    if (!nim) {
      return socket.emit('reconnect_failed', { message: 'NIM is required' });
    }

    let existingSocketId = Object.keys(gameState.players).find(sid => {
      const p = gameState.players[sid];
      return p.nim.toLowerCase() === nim.toLowerCase() && sessionToken && p.sessionToken === sessionToken;
    });

    if (!existingSocketId) {
      existingSocketId = Object.keys(gameState.players).find(sid => {
        const p = gameState.players[sid];
        return p.nim.toLowerCase() === nim.toLowerCase();
      });
    }

    if (!existingSocketId) {
      return socket.emit('reconnect_failed', { message: 'Session expired or not found' });
    }

    const player = gameState.players[existingSocketId];
    delete gameState.players[existingSocketId];
    player.id = socket.id;
    gameState.players[socket.id] = player;

    if (gameState.currentQuestionAnswers[existingSocketId]) {
      gameState.currentQuestionAnswers[socket.id] = gameState.currentQuestionAnswers[existingSocketId];
      delete gameState.currentQuestionAnswers[existingSocketId];
    }

    const currentQ = questions[gameState.currentQuestionIndex];
    const hasAnswered = !!gameState.currentQuestionAnswers[socket.id];
    const leaderboard = getLeaderboard();
    const rank = leaderboard.findIndex(p => p.id === socket.id) + 1;

    socket.emit('reconnect_success', {
      id: socket.id,
      sessionToken: player.sessionToken,
      name: player.name,
      nim: player.nim,
      score: player.score,
      streak: player.streak,
      rank: rank,
      status: gameState.status,
      currentQuestion: currentQ ? {
        index: gameState.currentQuestionIndex,
        total: questions.length,
        id: currentQ.id,
        type: currentQ.type,
        question: currentQ.question,
        code: currentQ.code || null,
        options: currentQ.options || null,
        timeLimit: currentQ.timeLimit,
        shuffle: gameState.shuffleOptions
      } : null,
      timeLeft: gameState.timeLeft,
      hasAnswered: hasAnswered
    });

    saveSessionBackup();
  });

  // Player joins lobby or mid-game session
  socket.on('player_join', (data) => {
    const name = (data.name || '').trim();
    const nim = (data.nim || '').trim();

    if (!name || !nim) {
      return socket.emit('join_error', { message: 'Name and NIM are required!' });
    }

    // Check if this student is already registered (re-joining / reconnecting via form)
    const existingSocketId = Object.keys(gameState.players).find(sid => {
      const p = gameState.players[sid];
      return p.nim.toLowerCase() === nim.toLowerCase();
    });

    if (existingSocketId) {
      // Seamlessly reconnect existing student! Keep their score, streak, answers!
      const player = gameState.players[existingSocketId];
      delete gameState.players[existingSocketId];
      player.id = socket.id;
      player.name = name || player.name;
      gameState.players[socket.id] = player;

      if (gameState.currentQuestionAnswers[existingSocketId]) {
        gameState.currentQuestionAnswers[socket.id] = gameState.currentQuestionAnswers[existingSocketId];
        delete gameState.currentQuestionAnswers[existingSocketId];
      }

      saveSessionBackup();

      const currentQ = questions[gameState.currentQuestionIndex];
      const hasAnswered = !!gameState.currentQuestionAnswers[socket.id];
      const leaderboard = getLeaderboard();
      const rank = leaderboard.findIndex(p => p.id === socket.id) + 1;

      socket.emit('join_success', {
        id: socket.id,
        sessionToken: player.sessionToken,
        name: player.name,
        nim: player.nim,
        score: player.score,
        status: gameState.status,
        currentQuestionIndex: gameState.currentQuestionIndex,
        totalQuestions: questions.length,
        currentQuestion: (currentQ && gameState.status === 'QUESTION_ACTIVE') ? {
          index: gameState.currentQuestionIndex,
          total: questions.length,
          id: currentQ.id,
          type: currentQ.type,
          question: currentQ.question,
          code: currentQ.code || null,
          options: currentQ.options || null,
          timeLimit: currentQ.timeLimit,
          shuffle: gameState.shuffleOptions
        } : null,
        timeLeft: gameState.timeLeft,
        hasAnswered: hasAnswered,
        isRejoin: true
      });
      return;
    }

    // Brand new student
    const isLate = (gameState.status !== 'LOBBY');
    const sessionToken = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

    const player = {
      id: socket.id,
      sessionToken: sessionToken,
      name: name,
      nim: nim,
      score: 0,
      streak: 0,
      tabSwitches: 0,
      isLateJoiner: isLate,
      joinedAtQuestionIndex: gameState.currentQuestionIndex,
      answers: {}
    };

    // If joining mid-game, mark all prior questions as missed (0 pts)
    if (isLate && gameState.currentQuestionIndex >= 0) {
      for (let i = 0; i < gameState.currentQuestionIndex; i++) {
        const pastQ = questions[i];
        if (pastQ) {
          player.answers[pastQ.id] = {
            submittedAnswer: null,
            isCorrect: false,
            pointsEarned: 0,
            timeSpent: 0,
            missed: true
          };
        }
      }
    }

    gameState.players[socket.id] = player;
    saveSessionBackup();

    const currentQ = questions[gameState.currentQuestionIndex];

    socket.emit('join_success', {
      id: socket.id,
      sessionToken: sessionToken,
      name: name,
      nim: nim,
      score: 0,
      status: gameState.status,
      currentQuestionIndex: gameState.currentQuestionIndex,
      totalQuestions: questions.length,
      currentQuestion: (currentQ && gameState.status === 'QUESTION_ACTIVE') ? {
        index: gameState.currentQuestionIndex,
        total: questions.length,
        id: currentQ.id,
        type: currentQ.type,
        question: currentQ.question,
        code: currentQ.code || null,
        options: currentQ.options || null,
        timeLimit: currentQ.timeLimit,
        shuffle: gameState.shuffleOptions
      } : null,
      timeLeft: gameState.timeLeft,
      hasAnswered: false,
      isLateJoiner: isLate,
      missedCount: Math.max(0, gameState.currentQuestionIndex)
    });

    // Notify Host if student joined mid-session!
    if (isLate && gameState.hostSocketId) {
      io.to(gameState.hostSocketId).emit('host_late_joiner_alert', {
        name: player.name,
        nim: player.nim,
        joinedAtQuestion: gameState.currentQuestionIndex + 1,
        totalQuestions: questions.length,
        missedCount: Math.max(0, gameState.currentQuestionIndex)
      });
    }

    io.emit('player_list_update', {
      count: Object.keys(gameState.players).length,
      players: Object.values(gameState.players).map(p => sanitizePlayer(p))
    });
  });

  // Anti-cheat: Track when student leaves the tab / browser
  socket.on('player_focus_lost', () => {
    const player = gameState.players[socket.id];
    if (player) {
      player.tabSwitches = (player.tabSwitches || 0) + 1;
      console.log(`⚠️ Tab switch detected: ${player.name} (${player.nim}) - Count: ${player.tabSwitches}`);
      if (gameState.hostSocketId) {
        io.to(gameState.hostSocketId).emit('host_player_alert', {
          playerId: socket.id,
          name: player.name,
          nim: player.nim,
          tabSwitches: player.tabSwitches
        });
      }
      saveSessionBackup();
    }
  });

  // Host starts quiz
  socket.on('host_start_quiz', () => {
    if (gameState.status !== 'LOBBY') return;
    if (Object.keys(gameState.players).length === 0) {
      return socket.emit('action_error', { message: 'Cannot start quiz with 0 participants!' });
    }

    gameState.status = 'COUNTDOWN';
    let countdown = 3;
    io.emit('start_countdown', { count: countdown });

    const cdInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        io.emit('start_countdown', { count: countdown });
      } else {
        clearInterval(cdInterval);
        startQuestion(0);
      }
    }, 1000);
  });

  // Player submits answer
  socket.on('submit_answer', (data) => {
    if (gameState.status !== 'QUESTION_ACTIVE') return;

    const player = gameState.players[socket.id];
    if (!player) return;

    const currentQ = questions[gameState.currentQuestionIndex];
    if (!currentQ) return;

    if (gameState.currentQuestionAnswers[socket.id]) return;

    const timeSpent = Math.max(0.5, (Date.now() - gameState.questionStartTime) / 1000);
    const isCorrect = checkAnswerCorrectness(currentQ, data.answer);
    const pointsEarned = isCorrect ? calculateScore(timeSpent, currentQ.timeLimit || 25) : 0;

    if (isCorrect) {
      player.score += pointsEarned;
      player.streak += 1;
    } else {
      player.streak = 0;
    }

    player.answers[currentQ.id] = {
      submittedAnswer: data.answer,
      isCorrect: isCorrect,
      pointsEarned: pointsEarned,
      timeSpent: Number(timeSpent.toFixed(2))
    };

    gameState.currentQuestionAnswers[socket.id] = {
      submittedAnswer: data.answer,
      isCorrect: isCorrect,
      pointsEarned: pointsEarned,
      timeSpent: timeSpent
    };

    socket.emit('answer_received', {
      message: 'Answer submitted! Waiting for question time to finish.'
    });

    io.emit('answer_count_update', {
      answeredCount: Object.keys(gameState.currentQuestionAnswers).length,
      totalPlayers: Object.keys(gameState.players).length
    });

    saveSessionBackup();

    if (Object.keys(gameState.currentQuestionAnswers).length >= Object.keys(gameState.players).length) {
      broadcastQuestionResult();
    }
  });

  // Host manual actions
  socket.on('host_next_question', () => {
    const nextIdx = gameState.currentQuestionIndex + 1;
    if (nextIdx < questions.length) {
      startQuestion(nextIdx);
    } else {
      endGame();
    }
  });

  socket.on('host_end_quiz', () => {
    endGame();
  });

  socket.on('host_skip_question', () => {
    if (gameState.status === 'QUESTION_ACTIVE') {
      broadcastQuestionResult();
    }
  });

  socket.on('host_show_leaderboard', () => {
    gameState.status = 'LEADERBOARD';
    io.emit('show_leaderboard', {
      leaderboard: getLeaderboard()
    });
  });

  socket.on('host_reset_quiz', () => {
    stopTimer();
    gameState.status = 'LOBBY';
    gameState.currentQuestionIndex = -1;
    gameState.players = {};
    gameState.currentQuestionAnswers = {};
    io.emit('quiz_reset');
    saveSessionBackup();
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    if (socket.id === gameState.hostSocketId) {
      console.log('Host disconnected.');
      gameState.hostSocketId = null;
    } else if (gameState.players[socket.id]) {
      if (gameState.status === 'LOBBY') {
        delete gameState.players[socket.id];
        io.emit('player_list_update', {
          count: Object.keys(gameState.players).length,
          players: Object.values(gameState.players).map(p => sanitizePlayer(p))
        });
        saveSessionBackup();
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`  Java Quiz Server running at:`);
  console.log(`  Local Host / Admin:   http://localhost:${PORT}/host`);
  console.log(`  Question Manager:     http://localhost:${PORT}/manage`);
  console.log(`  Local Participant:    http://localhost:${PORT}`);
  console.log(`  For 40+ players via ngrok: ngrok http ${PORT}`);
  console.log(`===============================================`);
});
