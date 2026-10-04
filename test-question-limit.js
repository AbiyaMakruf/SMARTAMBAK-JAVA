const io = require('socket.io-client');
const http = require('http');

const SERVER_URL = 'http://localhost:4000';

async function testQuestionLimit() {
  console.log('🧪 Starting Question Limit & Randomize verification test...');

  const hostSocket = io(SERVER_URL);
  const p1Socket = io(SERVER_URL);

  await new Promise(r => hostSocket.on('connect', r));
  await new Promise(r => p1Socket.on('connect', r));

  // 1. Reset Quiz state to clean slate
  hostSocket.emit('host_join');
  hostSocket.emit('host_reset_quiz');
  await new Promise(r => setTimeout(r, 300));

  // 2. Set question limit to 25
  console.log('📌 Test 1: Setting question limit to 25...');
  let updatePromise = new Promise(resolve => {
    hostSocket.on('quiz_info_updated', function handler(data) {
      if (data.questionLimit === 25) {
        hostSocket.off('quiz_info_updated', handler);
        resolve(data);
      }
    });
  });

  hostSocket.emit('host_set_question_limit', { limit: 25 });
  const updateData25 = await updatePromise;

  console.log(`✅ Received quiz_info_updated: totalQuestions=${updateData25.totalQuestions}, availableQuestions=${updateData25.availableQuestions}, questionLimit=${updateData25.questionLimit}`);
  if (updateData25.totalQuestions !== 25) {
    throw new Error(`Expected totalQuestions=25, got ${updateData25.totalQuestions}`);
  }
  if (updateData25.availableQuestions < 25) {
    throw new Error(`Expected availableQuestions >= 25, got ${updateData25.availableQuestions}`);
  }

  // 3. Toggle Randomize questions
  console.log('📌 Test 2: Toggling randomize questions to true...');
  let randPromise = new Promise(resolve => {
    hostSocket.on('quiz_info_updated', function handler(data) {
      if (data.randomizeQuestions === true) {
        hostSocket.off('quiz_info_updated', handler);
        resolve(data);
      }
    });
  });

  hostSocket.emit('host_toggle_randomize_questions', { enabled: true });
  const randData = await randPromise;
  console.log(`✅ Received randomizeQuestions=true confirmation!`);

  // 4. Player joins and host starts quiz
  console.log('📌 Test 3: Player joins and host starts quiz with 25 questions...');
  let p1JoinPromise = new Promise(resolve => {
    p1Socket.on('join_success', resolve);
  });
  p1Socket.emit('player_join', { name: 'Limit Tester', nim: '99999' });
  const p1Data = await p1JoinPromise;
  console.log(`✅ Player joined. Initial totalQuestions for player: ${p1Data.totalQuestions}`);
  if (p1Data.totalQuestions !== 25) {
    throw new Error(`Expected player to see totalQuestions=25, got ${p1Data.totalQuestions}`);
  }

  let newQPromise = new Promise(resolve => {
    p1Socket.on('new_question', resolve);
  });
  hostSocket.emit('host_start_quiz');
  const firstQ = await newQPromise;
  console.log(`✅ First question received by player: Question index=${firstQ.index}, total=${firstQ.total}`);
  if (firstQ.total !== 25) {
    throw new Error(`Expected question.total to be 25, got ${firstQ.total}`);
  }

  // 5. Reset and set to custom 10 questions
  console.log('📌 Test 4: Resetting quiz and setting question limit to 10...');
  hostSocket.emit('host_reset_quiz');
  await new Promise(r => setTimeout(r, 300));

  let updatePromise10 = new Promise(resolve => {
    hostSocket.on('quiz_info_updated', function handler(data) {
      if (data.questionLimit === 10) {
        hostSocket.off('quiz_info_updated', handler);
        resolve(data);
      }
    });
  });
  hostSocket.emit('host_set_question_limit', { limit: 10 });
  const updateData10 = await updatePromise10;
  console.log(`✅ Successfully set limit to 10 questions (totalQuestions=${updateData10.totalQuestions})`);
  if (updateData10.totalQuestions !== 10) {
    throw new Error(`Expected totalQuestions=10, got ${updateData10.totalQuestions}`);
  }

  // 6. Reset back to all questions (0)
  console.log('📌 Test 5: Setting question limit back to 0 (all questions)...');
  let updatePromiseAll = new Promise(resolve => {
    hostSocket.on('quiz_info_updated', function handler(data) {
      if (data.questionLimit === 0) {
        hostSocket.off('quiz_info_updated', handler);
        resolve(data);
      }
    });
  });
  hostSocket.emit('host_set_question_limit', { limit: 0 });
  const updateDataAll = await updatePromiseAll;
  console.log(`✅ Successfully set limit to 0 (all available: ${updateDataAll.totalQuestions} questions)`);
  if (updateDataAll.totalQuestions !== updateDataAll.availableQuestions) {
    throw new Error(`Expected totalQuestions to match availableQuestions, got ${updateDataAll.totalQuestions} vs ${updateDataAll.availableQuestions}`);
  }

  // Cleanup
  hostSocket.emit('host_toggle_randomize_questions', { enabled: false });
  await new Promise(r => setTimeout(r, 200));
  hostSocket.disconnect();
  p1Socket.disconnect();
  console.log('🎉 ALL QUESTION LIMIT TESTS PASSED PERFECTLY!');
  process.exit(0);
}

testQuestionLimit().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
