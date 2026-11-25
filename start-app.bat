@echo off
setlocal
cd /d "%~dp0"
set PGHOST=localhost
set PGPORT=5433
set PGDATABASE=wholesale_shop_db
set PGUSER=postgres
set PGPASSWORD=postgres
set PORT=3000
node server/server.js
pause
