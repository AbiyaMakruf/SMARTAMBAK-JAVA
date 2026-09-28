# 🎯 SMARTAMBAK Live Quiz Platform
### Interactive Classroom Quiz System (Kahoot & Quizizz Alternative)

A modern, lightweight, low-latency live multiplayer quiz platform built with **Node.js**, **Express**, and **Socket.io**. Specifically designed to run without participant limits (supporting 40+ concurrent students), require zero external database setup, and be hosted locally and tunneled to the internet via **ngrok**.

---

## ✨ Key Features

- **🚀 Unlimited Participants (Tested for 40+ Concurrent Players):** Overcomes commercial tier limits (e.g. Kahoot/Quizizz 10-player caps).
- **📚 Multi-Quiz & Custom Question Sets:**
  - Built-in presets: **Java Fundamentals**, **Python Essentials**, and **MLOps & Machine Learning Systems**.
  - Host can switch quiz sets with a single click from the lobby or manage them visually.
  - Create, rename, edit, and delete custom quiz topics (e.g., SQL, Web Dev, Cloud).
- **📱 Touch-First Mobile Player UI:**
  - Optimized for mobile screens with large hit-targets and high-contrast shapes (▲, ◆, ●, ■).
  - **Live Segmented Progress Stepper:** Students see their question progress and real-time correct/incorrect indicators.
- **🛡️ Comprehensive Anti-Cheat & Anti-AI Protection:**
  - **Anti-Copy & Selection Lock:** Disables text selection, mobile long-press copy menu, right-click, cut, and dev shortcuts (`Ctrl+C`, `Ctrl+U`, `Ctrl+S`, `F12`).
  - **Anti-Screenshot Privacy Shield & Heavy Blur:** Instantly blurs/blacks out the quiz content whenever the student leaves the active tab or presses `PrintScreen` (with clipboard wipe).
  - **Dynamic Student Watermark:** Tiled semi-transparent overlay showing each student's **Full Name and NIM** across the questions to prevent anonymous photo/screen sharing.
  - **Live Tab-Switch Detection:** Logs every time a student leaves the quiz screen, warns the student, and alerts the host presenter in real-time. Total tab switches are exported to CSV.
  - **Anti-Cheating Option Randomizer:** Shuffles answer button orders individually per device so students sitting next to each other cannot copy by screen position.
- **🔄 Auto-Reconnect & Crash Recovery:**
  - Automatic reconnection via local storage tokens if mobile screens lock or browsers reload.
  - In-memory state backed up atomically to JSON on disk.
- **📊 Classroom Insights & Matrix Report:**
  - Automatically identifies the toughest question, easiest question, class average accuracy, and fastest student.
  - Full matrix table showing each student's name, NIM, score, and answer for every single question.
  - One-click **CSV/Excel Export** (`/api/export-csv`).
- **🏆 Animated Host Leaderboard:**
  - Visual position-climbing animations with rolling scores and rank gain/drop badges.
- **🔊 Synthesized Web Audio SFX:**
  - Dynamic game ticks, buzzers, chimes, score rolls, and fanfare synthesized directly via browser Web Audio API (no audio files to download).
- **❤️ Live Floating Reactions:**
  - Students can send real-time floating emojis (❤️, 🔥, 👏, 🤯, 💡, ☕) that float up across both the presenter and student screens.
- **🛠️ In-Browser Visual Question Editor (`/manage`):**
  - Add, edit, reorder, and delete questions with instant Prism.js code syntax highlighting.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **ngrok** (for sharing over the internet without public IP)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone git@github.com:AbiyaMakruf/SMARTAMBAK-JAVA.git
cd SMARTAMBAK-JAVA
npm install
```

### 3. Start the Server
```bash
npm start
```
The server will start listening on port **4000**:
```text
===============================================
  Java Quiz Server running at:
  Local Host / Admin:   http://localhost:4000/host
  Question Manager:     http://localhost:4000/manage
  Local Participant:    http://localhost:4000
  For 40+ players via ngrok: ngrok http 4000
===============================================
```

### 4. Expose to Participants via ngrok
Open a second terminal and run:
```bash
ngrok http 4000
```
Copy the generated `https://xxxx.ngrok-free.app` URL and share it with your students (or display the QR code on the Host screen).

---

## 🖥️ Screen Navigation & Views

| Screen | URL | Purpose |
| :--- | :--- | :--- |
| **Participant (Mobile)** | `http://localhost:4000` | Where students enter Name & NIM, answer questions, see timer and progress. |
| **Host / Presenter** | `http://localhost:4000/host` | Display on projector: Live lobby, QR Code, active question, answer distribution, animated leaderboard, and final podium. |
| **Question Manager** | `http://localhost:4000/manage` | Switch active quiz, rename quizzes, create new quiz sets, and edit questions. |

---

## 📚 Managing & Switching Quiz Sets

1. Open **`http://localhost:4000/host`**:
   - In the top navigation bar, use the **Quiz dropdown** to switch between **Java Fundamentals**, **Python Essentials**, or **MLOps**.
   - The quiz title and question count update in real-time across both Host and Student screens.
2. Open **`http://localhost:4000/manage`**:
   - Select any quiz set from the dropdown to edit its questions.
   - Click **"⭐ Set as Active"** to make that quiz the active session for the presenter.
   - Click **"➕ New Set"** to create a new quiz for any topic with custom syntax highlighting (Java, Python, JS, SQL, General).
   - Click **"✏️ Rename"** to customize the title and description.

---

## 🧪 Automated Testing

An automated simulation tests 40 concurrent participants, reconnects, kicks, question rounds, insights, and CSV exports:
```bash
npm test
```

Expected output:
```text
🚀 Starting extended simulation with 40 concurrent participants...
✅ Host connected.
✅ All 40 participants successfully joined with unique Name & NIM.
✅ Reconnect verified.
✅ Classroom Insights verified.
✅ Quiz Sets API working.
✅ CSV Total Data Rows: 40
🎉 ALL TESTS PASSED WITH FLYING COLORS!
```

---

## 📄 License
ISC License. Built for interactive educational workshops and live classroom engagement.
