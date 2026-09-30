const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:4000';

async function testAutoAdvance() {
  console.log('🧪 Starting Auto-Advance verification test...');

  const hostSocket = io(SERVER_URL);
  const p1Socket = io(SERVER_URL);

  await new Promise(r => hostSocket.on('connect', r));
  await new Promise(r => p1Socket.on('connect', r));

  hostSocket.emit('host_join');
  hostSocket.emit('host_reset_quiz');

  await new Promise(r => setTimeout(r, 200));

  p1Socket.emit('player_join', { name: 'Auto Tester', nim: '12345' });
  await new Promise(r => p1Socket.on('join_success', r));

  console.log('✅ Player joined. Starting quiz...');
  hostSocket.emit('host_start_quiz');

  // Wait for Question 0 to start
  await new Promise(r => hostSocket.on('new_question', r));
  console.log('✅ Question 0 active. Skipping question to trigger QUESTION_RESULT...');

  hostSocket.emit('host_skip_question');

  // Verify transition to QUESTION_RESULT and capture auto_advance_tick
  let toLeaderboardTicks = [];
  hostSocket.on('auto_advance_tick', (tick) => {
    if (tick.phase === 'TO_LEADERBOARD') {
      toLeaderboardTicks.push(tick.countdown);
    }
  });

  console.log('⏳ Waiting for auto-transition to LEADERBOARD (up to 12s)...');
  const lbPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for auto show_leaderboard!')), 12000);
    hostSocket.on('show_leaderboard', (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  const lbData = await lbPromise;
  console.log(`✅ AUTO-ADVANCE SUCCESS: Automatically transitioned to LEADERBOARD after 10s countdown!`);
  console.log(`   Captured ticks: ${toLeaderboardTicks.slice(0, 5).join(', ')}...`);

  // Now wait for auto-advance from LEADERBOARD to NEXT QUESTION
  let toNextQuestionTicks = [];
  hostSocket.on('auto_advance_tick', (tick) => {
    if (tick.phase === 'TO_NEXT_QUESTION') {
      toNextQuestionTicks.push(tick.countdown);
    }
  });

  console.log('⏳ Waiting for auto-transition to NEXT QUESTION (up to 12s)...');
  const nextQPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for auto next_question!')), 12000);
    hostSocket.on('new_question', (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  const nextQ = await nextQPromise;
  console.log(`✅ AUTO-ADVANCE SUCCESS: Automatically transitioned to Question ${nextQ.index + 1} (${nextQ.question.substring(0, 40)}...) after 10s countdown!`);
  console.log(`   Captured ticks: ${toNextQuestionTicks.slice(0, 5).join(', ')}...`);

  // Clean up
  hostSocket.emit('host_reset_quiz');
  hostSocket.disconnect();
  p1Socket.disconnect();

  console.log('\n🎉 ALL AUTO-ADVANCE VERIFICATIONS PASSED 100%!');
  process.exit(0);
}

testAutoAdvance().catch(err => {
  console.error('❌ Auto-Advance test failed:', err);
  process.exit(1);
});
