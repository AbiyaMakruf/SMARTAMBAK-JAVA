#!/usr/bin/env bash
# =====================================================================
#   JAVA QUIZ SERVER & NGROK LAUNCHER (ASIA PACIFIC / SINGAPORE)
# =====================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "====================================================================="
echo "        JAVA QUIZ SERVER & NGROK LAUNCHER (ASIA-PACIFIC)"
echo "====================================================================="
echo ""
echo "[1/2] Menjalankan Server Node.js (npm start)..."

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Di Windows (Git Bash)
    start cmd /k "npm start"
    sleep 2
    echo "[2/2] Menjalankan Ngrok Tunnel (Region AP)..."
    start cmd /k "ngrok http 4000"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # Di macOS
    osascript -e "tell application \"Terminal\" to do script \"cd \\\"$DIR\\\" && npm start\"" 2>/dev/null || (npm start &)
    sleep 2
    echo "[2/2] Menjalankan Ngrok Tunnel (Region AP)..."
    osascript -e "tell application \"Terminal\" to do script \"ngrok http 4000\"" 2>/dev/null || (ngrok http 4000 &)
else
    # Di Linux
    npm start &
    sleep 2
    echo "[2/2] Menjalankan Ngrok Tunnel (Region AP)..."
    ngrok http 4000 &
fi

echo ""
echo "====================================================================="
echo "  SUKSES: Server dan Ngrok telah dijalankan!"
echo "  Host Admin: http://localhost:4000/host"
echo "  Self Quiz:  http://localhost:4000/self"
echo "====================================================================="
