#!/bin/zsh
# Finder에서 더블클릭하면 로컬 서버 관리 화면을 엽니다.
cd -- "${0:A:h}" || exit 1

for python in /Library/Frameworks/Python.framework/Versions/Current/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
  if [[ -x "$python" ]] && "$python" -c 'import sqlite3' >/dev/null 2>&1; then
    exec "$python" scripts/admin/launch.py
  fi
done

echo 'Python 3을 찾지 못했습니다. Python 3 설치 후 다시 실행해 주세요.'
read '?Enter 키를 누르면 닫힙니다. '
exit 1
