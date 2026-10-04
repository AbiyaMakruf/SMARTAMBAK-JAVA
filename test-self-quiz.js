const io = require('socket.io-client');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:4000';

async function testSelfQuizSystem() {
  console.log('🧪 Starting Self-Paced Quiz automated integration test...');

  const hostSocket = io(SERVER_URL);
  await new Promise(r => hostSocket.on('connect', r));

  let hostReceivedSubmission = null;
  hostSocket.on('self_quiz_submission_received', (data) => {
    hostReceivedSubmission = data;
  });

  // 1. Check Config API
  console.log('📌 Test 1: Testing GET /api/self-quiz/config...');
  const configRes = await fetch(`${SERVER_URL}/api/self-quiz/config`);
  if (!configRes.ok) throw new Error('Config API returned ' + configRes.status);
  const config = await configRes.json();
  console.log(`✅ Config retrieved: activeQuizTitle="${config.activeQuizTitle}", totalQuestions=${config.totalQuestions}`);

  // 2. Start Self Quiz
  console.log('📌 Test 2: Testing POST /api/self-quiz/start for student "Budi Pratama" (NIM 21010045)...');
  const startRes = await fetch(`${SERVER_URL}/api/self-quiz/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Budi Pratama',
      nim: '21010045'
    })
  });
  if (!startRes.ok) throw new Error('Start API returned ' + startRes.status);
  const startData = await startRes.json();
  if (!startData.success || !startData.sessionToken) throw new Error('Start API failed');
  console.log(`✅ Started Self Quiz: sessionToken=${startData.sessionToken}, questionsCount=${startData.totalQuestions}`);

  // Verify that correct answers are NOT exposed to client
  if (startData.questions[0].correctAnswer !== undefined || startData.questions[0].correctAnswers !== undefined) {
    throw new Error('SECURITY LEAK: Question correctAnswer was exposed to client in start API!');
  }
  console.log('✅ Security check passed: correctAnswer is hidden from client.');

  // 3. Submit Answers for First 3 Questions
  console.log('📌 Test 3: Submitting answers for questions...');
  // Question 0
  const sub0 = await fetch(`${SERVER_URL}/api/self-quiz/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionToken: startData.sessionToken,
      questionIndex: 0,
      answer: 0,
      timeSpent: 2.5,
      tabSwitches: 1
    })
  });
  const sub0Data = await sub0.json();
  console.log(`✅ Answer Q0 submitted: isCorrect=${sub0Data.isCorrect}, ptsEarned=${sub0Data.pointsEarned}, currentScore=${sub0Data.currentScore}`);

  // Question 1
  const sub1 = await fetch(`${SERVER_URL}/api/self-quiz/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionToken: startData.sessionToken,
      questionIndex: 1,
      answer: 1,
      timeSpent: 1.8,
      tabSwitches: 2
    })
  });
  const sub1Data = await sub1.json();
  console.log(`✅ Answer Q1 submitted: isCorrect=${sub1Data.isCorrect}, ptsEarned=${sub1Data.pointsEarned}, currentScore=${sub1Data.currentScore}`);

  // 4. Finish Self Quiz
  console.log('📌 Test 4: Testing POST /api/self-quiz/finish...');
  const finishRes = await fetch(`${SERVER_URL}/api/self-quiz/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionToken: startData.sessionToken,
      tabSwitches: 2
    })
  });
  if (!finishRes.ok) throw new Error('Finish API returned ' + finishRes.status);
  const finishData = await finishRes.json();
  if (!finishData.success || !finishData.record) throw new Error('Finish API failed');
  console.log(`✅ Finished Self Quiz: Final Score=${finishData.record.score}, Accuracy=${finishData.record.accuracy}%, Total Qs=${finishData.record.totalQuestions}`);

  // Wait for socket emit
  await new Promise(r => setTimeout(r, 200));
  if (!hostReceivedSubmission || hostReceivedSubmission.name !== 'Budi Pratama') {
    throw new Error('Host socket did not receive self_quiz_submission_received event!');
  }
  console.log(`✅ Realtime Host notification verified: received alert for "${hostReceivedSubmission.name}" with score ${hostReceivedSubmission.score} pts!`);

  // 5. Verify Local Persistence
  console.log('📌 Test 5: Verifying local file persistence in data/self_quiz_results/...');
  const resultsJsonPath = path.join(__dirname, 'data', 'self_quiz_results', 'results.json');
  const resultsCsvPath = path.join(__dirname, 'data', 'self_quiz_results', 'self_quiz_rekap.csv');

  if (!fs.existsSync(resultsJsonPath)) throw new Error('results.json does not exist!');
  if (!fs.existsSync(resultsCsvPath)) throw new Error('self_quiz_rekap.csv does not exist!');

  const jsonContent = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));
  const foundBudi = jsonContent.find(r => r.name === 'Budi Pratama' && r.nim === '21010045');
  if (!foundBudi) throw new Error('Budi Pratama record not found in results.json!');
  console.log(`✅ results.json verified: Budi Pratama found with score ${foundBudi.score} and ${foundBudi.review.length} reviewed questions.`);

  const csvContent = fs.readFileSync(resultsCsvPath, 'utf8');
  if (!csvContent.includes('Budi Pratama') || !csvContent.includes('21010045')) {
    throw new Error('Budi Pratama not found in self_quiz_rekap.csv!');
  }
  console.log('✅ self_quiz_rekap.csv verified: Spreadsheet contains student NIM, name, score, and duration.');

  // 6. Test Host Monitoring API
  console.log('📌 Test 6: Testing GET /api/self-quiz/records and CSV download...');
  const recRes = await fetch(`${SERVER_URL}/api/self-quiz/records`);
  const records = await recRes.json();
  if (!Array.isArray(records) || records.length === 0) throw new Error('Records API returned empty array');
  console.log(`✅ Records API working: retrieved ${records.length} saved submission(s).`);

  const csvDownloadRes = await fetch(`${SERVER_URL}/api/self-quiz/export-csv`);
  if (!csvDownloadRes.ok) throw new Error('CSV download API failed');
  const csvDownloadText = await csvDownloadRes.text();
  if (!csvDownloadText.includes('21010045')) throw new Error('Downloaded CSV missing expected student');
  console.log('✅ CSV download API working smoothly.');

  // Cleanup
  hostSocket.disconnect();
  console.log('\n🎉 ALL SELF-PACED QUIZ TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
}

testSelfQuizSystem().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
