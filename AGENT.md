# AGENT.md - AI & Developer Session Handover

This document serves as the primary context and technical documentation for AI coding agents and developers working on this repository across sessions.

---

## 📌 1. Project Overview

**SMARTAMBAK Live Quiz** (Kahoot/Quizizz clone) is a lightweight, low-latency, real-time multiplayer quiz engine designed for classroom and workshop presentations of 40+ concurrent participants. It runs locally on Node.js and is exposed to participants over the internet using `ngrok` or a local Wi-Fi network.

### Primary Goals & Constraints:
- **No external database required:** Operates fully in-memory with file-based atomic JSON persistence.
- **Strictly mobile-optimized:** Touch-first participant UI with high-contrast shapes, clean responsive buttons, and zero layout shifting.
- **Port:** Uses **Port 4000** (`http://localhost:4000`). *(Port 3000 has conflicts with Windows background system services).*
- **Multi-Quiz Support:** Not limited to Java; supports preset and custom question sets (Java, Python, MLOps, SQL, etc.).

---

## 🏗️ 2. Architecture & File Structure

```text
├── server.js               # Main Express + Socket.io server & game engine
├── package.json            # Scripts & dependencies (Express, Socket.io, Cors)
├── test-simulation.js      # Automated 40-player concurrent test suite
├── .gitignore              # Ignores node_modules, temp files, and session backups
├── data/
│   ├── active_quiz.json    # Pointer to the currently active quiz set ID
│   ├── questions.json      # Mirror copy of active questions for legacy APIs
│   ├── session_backup.json # Atomic backup snapshot of live session (ignored in git)
│   └── quiz_sets/
│       ├── java.json       # Java Fundamentals (10 questions + code snippets)
│       ├── python.json     # Python Essentials (10 questions + code snippets)
│       └── mlops.json      # MLOps & ML Systems (10 questions)
└── public/
    ├── index.html          # Participant (Student) mobile web app
    ├── host.html           # Host / Presenter projection screen
    ├── manage.html         # Visual Question & Quiz Set Manager
    ├── css/
    │   ├── style.css       # Participant styling & progress tracker
    │   └── host.css        # Host presentation styling & leaderboard animations
    └── js/
        ├── audio.js        # Pure Web Audio API sound synthesizer (no MP3 files)
        ├── player.js       # Participant client logic (reconnect, reactions, tracker)
        ├── host.js         # Host presenter controls (animations, QR code, matrix)
        └── manage.js       # Quiz set switcher, editor, and CRUD operations
```

---

## 🌐 3. URLs and Routing

| Route | Role | Description |
| :--- | :--- | :--- |
| `GET /` | Participant | Mobile-responsive registration, quiz screen, and review |
| `GET /host` | Host / Big Screen | Live lobby, countdown, question countdown, leaderboard, game over |
| `GET /manage` | Quiz Manager | Switch active quiz, rename, create new quiz sets, edit questions |
| `GET /api/quiz-sets` | API | List available quiz sets and current active quiz |
| `POST /api/quiz-sets/active` | API | Switch active quiz (`{ id: "python" }`) |
| `POST /api/quiz-sets` | API | Create or update quiz set (`{ id, title, language, questions }`) |
| `DELETE /api/quiz-sets/:id` | API | Delete custom quiz set |
| `GET /api/questions` | API | Retrieve current questions for backward compatibility |
| `POST /api/questions` | API | Save questions to current active quiz |
| `GET /api/export-csv` | API | Download Excel/CSV report of all students and answers |

---

## 🎮 4. Game Lifecycle & State Machine

The game flows sequentially controlled by the Host:

```text
[LOBBY] ────(host_start_quiz)───► [COUNTDOWN] (3s)
                                       │
                                       ▼
┌───────────────► [QUESTION_ACTIVE] (20-25s timer)
│                         │
│           (all answered / timer 0 / host skip)
│                         ▼
│                [QUESTION_RESULT] (Distribution & answer stats)
│                         │
│               (host_show_leaderboard)
│                         ▼
│                 [LEADERBOARD] (Animated podium & rank changes)
│                         │
└─── (host_next_question)─┘ (if more questions remain)
                          │ (if final question)
                          ▼
                     [GAME_OVER] (Podium top 3 + Insights + Matrix + CSV)
```

---

## ⚡ 5. Socket.io Event Reference

### Client / Host -> Server
- `player_join`: `{ name, nim }` - Student enters lobby.
- `player_reconnect`: `{ nim, sessionToken }` - Restores dropped mobile connection.
- `submit_answer`: `{ answer }` - Submits choice (MCQ index, TF 0/1, or FIB string).
- `send_reaction`: `{ emoji }` - Emits floating reaction (❤️, 🔥, 👏, 🤯, 💡, ☕).
- `host_join`: Registers presenter screen.
- `host_start_quiz`: Triggers 3-second countdown.
- `host_skip_question`: Immediately reveals question result.
- `host_show_leaderboard`: Advances from result to leaderboard.
- `host_next_question`: Advances to next question or game over.
- `host_reset_quiz`: Resets session back to lobby.
- `host_kick_player`: `{ playerId }` - Removes unwanted player from lobby.
- `host_change_quiz_set`: `{ quizId }` - Switches active quiz set from lobby dropdown.
- `host_toggle_shuffle`: `{ enabled }` - Toggles anti-cheating option shuffling.

### Server -> Client / Host
- `init_state`: Initial state payload sent upon socket connection.
- `host_synced`: Full state synchronization for host.
- `quiz_info_updated`: Broadcast when active quiz or title changes.
- `start_countdown`: Broadcast to show 3-2-1 timer.
- `new_question`: Question text, code snippet, options, timeLimit (correct answers stripped).
- `timer_tick`: `{ timeLeft }` broadcast every second.
- `question_result`: Answer distribution, top 5, total answered.
- `player_question_result`: Individual score, points earned, streak, rank, and explanation.
- `show_leaderboard`: Triggers leaderboard screen.
- `game_over`: Final podium, classroom insights, and matrix.
- `player_game_over_review`: Tailored review of every question for each student.

---

## 🛡️ 6. Reliability & Anti-Cheating Architecture

1. **Anti-Copy & Text Selection Blocker:**
   CSS `user-select: none !important;` and `-webkit-touch-callout: none !important;` prevent highlighting or long-press popups on mobile. JavaScript event listeners block `copy`, `cut`, `selectstart`, `dragstart`, `contextmenu`, and hotkeys (`Ctrl+C`, `Ctrl+U`, `Ctrl+S`, `Ctrl+P`, `F12`, `Ctrl+Shift+I`).
2. **Anti-Screenshot & Focus-Loss Privacy Shield:**
   When a student switches apps on mobile, opens another browser tab, or presses `PrintScreen`, the screen immediately triggers a heavy blur filter (`blur-on-unfocus`) and displays an opaque `#privacy-shield`. If `PrintScreen` is pressed, the system clears the clipboard (`navigator.clipboard.writeText('')`).
3. **Dynamic Tiled Student Watermark:**
   A repeating semi-transparent background watermark displaying the student's **Full Name and Student ID (NIM)** is overlaid across all active quiz screens. Any external camera photograph or screenshot immediately identifies the student.
4. **Real-Time Tab-Switch Detection & Session Leaderboard Focus Watchlist:**
   Leaving the active quiz tab emits `player_focus_lost`. The student receives an on-screen warning toast (`⚠️ Warning: Focus lost!`), and the presenter screen receives a live alert toast (`host_player_alert`). On the **Session Leaderboard** screen between questions:
   - Every participant card displays their total screen-leave count (e.g. `⚠️ 3x Left Screen` or `🛡️ Focused`).
   - A dedicated **Focus Watchlist panel** on the host screen immediately displays all students who have left the screen, ordered by most violations, enabling the teacher/host to immediately call out and warn distracted students.
   - Host can toggle between viewing "Top 5" and "All Students" on the session leaderboard.
   - Total tab switches are logged and included in the final matrix table and CSV export (`Tab Switches (Cheat Alert)`).
5. **Anti-Cheating Option Shuffling:**
   Option ordering is randomized locally on each mobile device using Fisher-Yates shuffle while preserving original index mapping for submission. Host screen displays canonical options.
6. **Session Persistence & Auto-Reconnect:**
   `localStorage` stores `sessionToken` + `nim`. If a participant reloads or their mobile screen locks, they resume instantly without losing score or streak.
7. **Crash Protection via Atomic File Writing:**
   Session state is dumped atomically to `data/session_backup.json.tmp` and renamed to `session_backup.json` to prevent Windows file-lock race conditions.
8. **Pure Web Audio API:**
   No external audio files to download. Synthesizes ticks, chimes, buzzers, and fanfare using Web Audio oscillators and gain envelopes.

---

## 🧪 7. Running Tests & Simulation

Run the automated simulation of 40 concurrent mobile players:

```bash
# Run test suite
npm test
```

The test checks:
1. Host connection
2. Troll player kick from lobby
3. 40 concurrent players joining with unique NIM
4. Emoji reaction broadcast
5. Disconnect and session recovery
6. Question 1 full answer round with score calculation
7. Game over transition and Classroom Insights calculation
8. Visual question editor API (`/api/questions`)
9. Multi-quiz sets API (`/api/quiz-sets`)
10. CSV export formatting (`/api/export-csv`)

---

## 💡 8. Key Developer Conventions

- Always keep server listening on **port 4000**.
- Code syntax highlighter uses Prism.js CDN with tomorrow-night theme.
- Never write questions directly into HTML; keep them in `data/quiz_sets/*.json`.
- When updating question sets, ensure both the quiz set file and active sync are maintained.
