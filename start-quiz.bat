@echo off
title Launcher Java Quiz & Ngrok (Singapore/AP Region)
color 0B

echo =====================================================================
echo           JAVA QUIZ SERVER & NGROK LAUNCHER (ASIA-PACIFIC)
echo =====================================================================
echo.
echo [1/3] Menyiapkan direktori kerja...
cd /d "%~dp0"

echo [2/3] Menjalankan Server Node.js (npm start)...
start "Java Quiz Server - Localhost:4000" cmd /k "npm start"

echo.
echo Menunggu 2 detik agar server siap...
timeout /t 2 /nobreak >nul

echo.
echo [3/3] Menjalankan Ngrok Tunnel (Region AP / Singapore ~18ms latency)...
start "Ngrok Tunnel - Region AP" cmd /k "ngrok http 4000"

echo.
echo =====================================================================
echo   SUKSES: KEDUA LAYANAN TELAH AKTIF!
echo =====================================================================
echo  - Host / Admin Panel : http://localhost:4000/host
echo  - Question Manager   : http://localhost:4000/manage
echo  - Self-Paced Quiz    : http://localhost:4000/self
echo  - Ngrok Web Webhook  : http://127.0.0.1:4040
echo.
echo  * Link Publik Siswa  : Salin URL "Forwarding https://..." dari jendela Ngrok
echo =====================================================================
echo.
echo Tekan sembarang tombol untuk menutup jendela launcher ini.
pause >nul
