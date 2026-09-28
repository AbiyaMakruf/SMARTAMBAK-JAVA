// Comprehensive Automated Test Simulation:
// 40 Players + Kick + Reconnect + Reactions + Insights + Questions API + CSV Export
const io = require('socket.io-client');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';
const NUM_PLAYERS = 40;

async function runSimulation() {
  console.log(`\n🚀 Starting extended simulation with ${NUM_PLAYERS} concurrent participants...`);

  // 1. Connect Host
  const hostSocket = io(SERVER_URL);
  await new Promise((resolve) => {
    hostSocket.on('connect', () => {
      console.log('✅ Host connected.');
      hostSocket.emit('host_join');
      hostSocket.emit('host_reset_quiz');
      setTimeout(resolve, 200);
    });
  });

  // 2. Test Kick Feature in Lobby: Extra player joins and gets kicked
  const trollSocket = io(SERVER_URL);
  let kickedReceived = false;

  await new Promise((resolve) => {
    trollSocket.on('connect', () => {
      trollSocket.emit('player_join', { name: 'Troll Student', nim: '99999999' });
    });
    trollSocket.on('join_success', () => {
      console.log('⚠️  Troll player joined lobby, testing Host Kick...');
      trollSocket.on('player_kicked', (kickData) => {
        kickedReceived = true;
        console.log(`✅ Troll player received kick notification: "${kickData.message}"`);
        trollSocket.disconnect();
        resolve();
      });
      // Host kicks troll player
      setTimeout(() => {
        hostSocket.emit('host_kick_player', { playerId: trollSocket.id });
      }, 200);
    });
  });

  if (!kickedReceived) {
    throw new Error('Host kick feature failed: kicked event not received!');
  }

  // 3. Connect 40 Legitimate Players
  const players = [];
  const joinedPromises = [];

  for (let i = 1; i <= NUM_PLAYERS; i++) {
    const nim = `210100${i < 10 ? '0' + i : i}`;
    const name = `Student ${i}`;

    const pSocket = io(SERVER_URL);
    const pObj = { id: i, socket: pSocket, nim, name, sessionToken: null };
    players.push(pObj);

    const pPromise = new Promise((resolve, reject) => {
      pSocket.on('connect', () => {
        pSocket.emit('player_join', { name, nim });
      });

      pSocket.on('join_success', (data) => {
        pObj.sessionToken = data.sessionToken;
        resolve();
      });

      pSocket.on('join_error', (err) => {
        reject(err);
      });
    });

    joinedPromises.push(pPromise);
  }

  await Promise.all(joinedPromises);
  console.log(`✅ All ${NUM_PLAYERS} participants successfully joined with unique Name & NIM and received sessionTokens.`);

  // 4. Test Floating Emoji Reactions
  let reactionReceived = false;
  hostSocket.on('reaction_received', (data) => {
    if (data.emoji === '🔥') reactionReceived = true;
  });

  players[0].socket.emit('send_reaction', { emoji: '🔥' });
  await new Promise(r => setTimeout(r, 200));
  if (reactionReceived) {
    console.log('✅ Floating Emoji Reaction verified (host received 🔥).');
  } else {
    throw new Error('Reaction failed to reach host!');
  }

  // 5. Start Quiz
  console.log('🏁 Host triggering quiz start...');
  hostSocket.emit('host_start_quiz');

  // 6. Test Disconnect & Reconnect with Player 1
  let player1Reconnected = false;
  let reviewsReceived = 0;

  await new Promise((resolve) => {
    players.forEach(p => {
      p.socket.on('new_question', (q) => {
        // Player 1 simulates network drop and reconnects!
        if (p.id === 1 && !player1Reconnected) {
          player1Reconnected = true;
          console.log('🔄 Simulating mobile disconnect & auto-reconnect for Player 1...');
          p.socket.disconnect();

          setTimeout(() => {
            const reconnectedSocket = io(SERVER_URL);
            p.socket = reconnectedSocket;

            reconnectedSocket.on('connect', () => {
              reconnectedSocket.emit('player_reconnect', {
                nim: p.nim,
                sessionToken: p.sessionToken
              });
            });

            reconnectedSocket.on('reconnect_success', (recData) => {
              console.log(`✅ Player 1 successfully reconnected! Status: ${recData.status}, Score: ${recData.score}`);
              reconnectedSocket.emit('submit_answer', { answer: 1 });
            });
          }, 300);
          return;
        }

        // Other players submit answers normally
        setTimeout(() => {
          let ans;
          if (q.type === 'multiple_choice' || q.type === 'true_false') {
            ans = p.id % 2 === 0 ? 1 : 0;
          } else {
            ans = 'void';
          }
          p.socket.emit('submit_answer', { answer: ans });
        }, 50 + (p.id * 10));
      });
    });

    hostSocket.on('question_result', (data) => {
      console.log(`✅ Host received question_result for Question ${data.question.id}:`);
      console.log(`   Total answered: ${data.totalAnswered} / ${data.totalPlayers}`);
      console.log(`   Distribution:`, data.distribution);
      resolve();
    });
  });

  // 7. Test Host next question / skip to end & check Classroom Insights
  console.log('⏩ Host ending quiz to test game_over and classroom insights...');
  let receivedInsights = null;

  const gameOverPromise = new Promise((resolve) => {
    players.forEach(p => {
      p.socket.on('player_game_over_review', (data) => {
        reviewsReceived++;
        if (reviewsReceived === 1) {
          console.log(`✅ Participant received individual answer review (${data.review.length} questions).`);
        }
      });
    });

    hostSocket.on('game_over', (data) => {
      receivedInsights = data.insights;
      console.log(`✅ Host received game_over with podium top 3:`, data.podium.map(p => `${p.name} (#${p.score} pts)`));
      resolve();
    });
  });

  // Advance to end
  setTimeout(() => {
    hostSocket.emit('host_end_quiz');
  }, 200);

  await gameOverPromise;

  // 8. Verify Classroom Insights
  if (receivedInsights) {
    console.log(`✅ Classroom Insights verified:`);
    console.log(`   - Toughest Question: Q${receivedInsights.toughestQuestion.index} (${receivedInsights.toughestQuestion.accuracy}% accuracy)`);
    console.log(`   - Easiest Question: Q${receivedInsights.easiestQuestion.index} (${receivedInsights.easiestQuestion.accuracy}% accuracy)`);
    console.log(`   - Class Accuracy: ${receivedInsights.overallAccuracy}%`);
    if (receivedInsights.fastestStudent) {
      console.log(`   - Fastest Student: ${receivedInsights.fastestStudent.name} (${receivedInsights.fastestStudent.avgTime}s)`);
    }
  } else {
    throw new Error('Classroom Insights missing in game_over payload!');
  }

  // 9. Verify Question Manager API
  console.log('🛠️  Verifying Question Manager API (/api/questions)...');
  const questionsRes = await new Promise((resolve, reject) => {
    http.get(`${SERVER_URL}/api/questions`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
  console.log(`✅ Questions API working: retrieved ${questionsRes.length} questions.`);

  // 9b. Verify Multi-Quiz Sets API
  console.log('📚 Verifying Multi-Quiz Sets API (/api/quiz-sets)...');
  const quizSetsRes = await new Promise((resolve, reject) => {
    http.get(`${SERVER_URL}/api/quiz-sets`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
  console.log(`✅ Quiz Sets API working: activeQuiz="${quizSetsRes.activeQuizTitle}", found ${quizSetsRes.quizSets.length} sets (${quizSetsRes.quizSets.map(q => q.title).join(', ')}).`);

  // 10. Test CSV Export endpoint
  console.log('📥 Verifying /api/export-csv endpoint...');
  const csvData = await new Promise((resolve, reject) => {
    http.get(`${SERVER_URL}/api/export-csv`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });

  const lines = csvData.trim().split('\r\n');
  console.log(`✅ CSV Header: ${lines[0].substring(0, 80)}...`);
  console.log(`✅ CSV Total Data Rows: ${lines.length - 1}`);

  if (lines.length - 1 === NUM_PLAYERS) {
    console.log(`\n🎉 ALL TESTS (1, 3, 4, 5, 6) PASSED WITH FLYING COLORS!`);
  }

  // Cleanup
  players.forEach(p => p.socket && p.socket.disconnect());
  hostSocket.disconnect();
  process.exit(0);
}

runSimulation().catch(err => {
  console.error('❌ Simulation Error:', err);
  process.exit(1);
});
