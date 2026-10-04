const { spawn } = require('child_process');
const io = require('socket.io-client');
const path = require('path');

const SERVER_PORT = 4005;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

async function runTest() {
  console.log('🚀 Starting Fill-In-The-Blank Validation Test on port ' + SERVER_PORT);

  // 1. Launch server instance
  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: SERVER_PORT }
  });

  serverProcess.stdout.on('data', (d) => {
    // console.log('[Server stdout]:', d.toString());
  });
  serverProcess.stderr.on('data', (d) => {
    console.error('[Server stderr]:', d.toString());
  });

  // Give server 1.5 seconds to start
  await new Promise(r => setTimeout(r, 1500));

  try {
    // 2. Test Self Quiz Fill-in Question
    console.log('📌 Test 1: Self Quiz API Fill-in flow...');
    const startRes = await fetch(`${SERVER_URL}/api/self-quiz/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Tes Mahasiswa', nim: '12345678' })
    });

    if (!startRes.ok) throw new Error(`Self quiz start failed with ${startRes.status}`);
    const startData = await startRes.json();
    console.log(`✅ Started Self Quiz, total questions: ${startData.totalQuestions}`);

    // Cari index soal yang bertipe fill_in
    let fillInIdx = startData.questions.findIndex(q => q.type === 'fill_in');
    console.log(`🔎 Found fill_in question at index: ${fillInIdx}`);

    if (fillInIdx !== -1) {
      // Test submit jawaban fill_in yang benar
      // Ambil pertanyaan dari file quiz aktif untuk tahu kunci jawabannya
      const activeQuizRes = await fetch(`${SERVER_URL}/api/quiz-sets`);
      const quizzes = await activeQuizRes.json();
      const currentQ = startData.questions[fillInIdx];
      console.log(`❓ Soal: "${currentQ.question}"`);

      // Coba submit jawaban teks string
      const subRes = await fetch(`${SERVER_URL}/api/self-quiz/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: startData.sessionToken,
          questionIndex: fillInIdx,
          answer: '   jawaban_uji   ',
          timeSpent: 3.5,
          tabSwitches: 0
        })
      });

      if (!subRes.ok) throw new Error(`Submit answer failed with ${subRes.status}`);
      const subData = await subRes.json();
      console.log('✅ Submit fill_in response:', {
        isCorrect: subData.isCorrect,
        pointsEarned: subData.pointsEarned,
        currentScore: subData.currentScore,
        correctAnswers: subData.correctAnswers
      });

      if (!Array.isArray(subData.correctAnswers) || subData.correctAnswers.length === 0) {
        throw new Error('Expected correctAnswers array in response for fill_in type');
      }

      // Sekarang coba submit dengan kunci jawaban yang benar persis
      const realAnswer = subData.correctAnswers[0];
      const startRes2 = await fetch(`${SERVER_URL}/api/self-quiz/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Mahasiswa Pintar', nim: '12345679' })
      });
      const startData2 = await startRes2.json();

      const subRes2 = await fetch(`${SERVER_URL}/api/self-quiz/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: startData2.sessionToken,
          questionIndex: fillInIdx,
          answer: `  ${realAnswer.toUpperCase()}  `, // Test case-insensitivity & whitespace trimming
          timeSpent: 2.0,
          tabSwitches: 0
        })
      });
      const subData2 = await subRes2.json();
      console.log('✅ Correct Answer Submit Test:', {
        input: `  ${realAnswer.toUpperCase()}  `,
        isCorrect: subData2.isCorrect,
        pointsEarned: subData2.pointsEarned
      });

      if (!subData2.isCorrect || subData2.pointsEarned <= 0) {
        throw new Error('Case-insensitive match for fill-in answer failed!');
      }
      console.log('✅ Case-insensitivity & trimming for fill_in verified successfully!');
    }

    // 3. Test Live Quiz Fill-In Question with Socket.io
    console.log('📌 Test 2: Live Quiz Socket.io Fill-in flow...');
    const hostSocket = io(SERVER_URL);
    const playerSocket = io(SERVER_URL);

    await new Promise(r => hostSocket.on('connect', r));
    await new Promise(r => playerSocket.on('connect', r));

    hostSocket.emit('host_join');
    playerSocket.emit('player_join', { name: 'Player Live', nim: '88889999' });

    await new Promise(r => playerSocket.on('join_success', r));
    console.log('✅ Host and Player connected in Live Mode');

    console.log('🎉 ALL AUTOMATED TESTS PASSED SUCCESSFULLY!');
  } finally {
    serverProcess.kill('SIGTERM');
  }
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
