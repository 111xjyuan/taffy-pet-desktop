@echo off
rem 双击运行（不需要装 Node，只要把 node_modules 一起解压）
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
start "" "node_modules\electron\dist\electron.exe" "%~dp0" --no-sandbox
