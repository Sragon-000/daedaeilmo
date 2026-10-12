"""Back up the stopped Mac-local D1 database and apply the experiment migration."""
from pathlib import Path
import os
import secrets
import sqlite3
import time

ROOT = Path(__file__).resolve().parents[2]
matches = []
for path in (ROOT / '.wrangler/state/v3/d1').glob('**/*.sqlite'):
    connection = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
    try:
        if connection.execute("SELECT name FROM sqlite_master WHERE name='members'").fetchone():
            matches.append(path)
    finally:
        connection.close()
if len(matches) != 1:
    raise SystemExit('Mac 로컬 D1 데이터베이스를 하나만 찾을 수 있어야 합니다.')

path = matches[0]
with sqlite3.connect(path) as connection:
    migrated = bool(connection.execute("SELECT name FROM sqlite_master WHERE name='experiment_invites'").fetchone())
if migrated:
    print('0006 마이그레이션이 이미 적용되어 있습니다.')
else:
    backup_dir = ROOT / '.local-host/backups'
    backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    backup = backup_dir / ('experiment-pre-migration-' + time.strftime('%Y%m%d-%H%M%S') + '-' + secrets.token_hex(3) + '.sqlite')
    with sqlite3.connect(path) as source, sqlite3.connect(backup) as target:
        source.backup(target)
    os.chmod(backup, 0o600)
    sql = (ROOT / 'drizzle/0006_workable_the_executioner.sql').read_text()
    with sqlite3.connect(path) as connection:
        connection.executescript('BEGIN IMMEDIATE;\n' + sql + '\nCOMMIT;')
    print('백업:', backup)
    print('0006 마이그레이션 적용 완료')

env_path = ROOT / '.dev.vars'
if not env_path.exists():
    raise SystemExit('.dev.vars 파일이 없습니다. 학교 인증 설정을 먼저 완료해 주세요.')
content = env_path.read_text()
for name in ('EXPERIMENT_SESSION_SECRET', 'EXPERIMENT_OPERATOR_SECRET'):
    if not any(line.startswith(name + '=') for line in content.splitlines()):
        if content and not content.endswith('\n'):
            content += '\n'
        content += name + '=' + secrets.token_urlsafe(48) + '\n'
        print(name + '을(를) 로컬 설정에 추가했습니다.')
env_path.write_text(content)
os.chmod(env_path, 0o600)
