"""Back up the stopped Mac D1 database and enable the PCU pilot workspace."""
from pathlib import Path
import os
import secrets
import sqlite3
import time

ROOT = Path(__file__).resolve().parents[2]
matches = []
for path in (ROOT / '.wrangler/state/v3/d1').glob('**/*.sqlite'):
    with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as connection:
        if connection.execute("SELECT name FROM sqlite_master WHERE name='members'").fetchone():
            matches.append(path)
if len(matches) != 1:
    raise SystemExit('Mac 로컬 D1 데이터베이스를 하나만 찾을 수 있어야 합니다.')

path = matches[0]
with sqlite3.connect(path) as connection:
    missing = [n for n in ('institution_programs', 'institution_programs_source_unique')
               if not connection.execute("SELECT name FROM sqlite_master WHERE name=?", (n,)).fetchone()]
    new_objects = [connection.execute("SELECT name FROM sqlite_master WHERE name=?", (n,)).fetchone() is not None
                   for n in ('institution_staff', 'application_contacts')]
    new_objects.extend([
        any(row[1] == 'response_hours' for row in connection.execute('PRAGMA table_info(institution_programs)')) if 'institution_programs' not in missing else False,
        any(row[1] == 'response_due_at' for row in connection.execute('PRAGMA table_info(program_applications)')),
    ])
    if any(new_objects) and not all(new_objects):
        raise SystemExit('기관 확장 스키마가 일부만 적용되어 있습니다. 백업 후 수동 점검이 필요합니다.')
    needs9 = not all(new_objects)
if missing or needs9:
    backup_dir = ROOT / '.local-host/backups'
    backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    backup = backup_dir / ('institution-pre-migration-' + time.strftime('%Y%m%d-%H%M%S') + '-' + secrets.token_hex(3) + '.sqlite')
    with sqlite3.connect(path) as source, sqlite3.connect(backup) as target:
        source.backup(target)
    os.chmod(backup, 0o600)
    with sqlite3.connect(path) as connection:
        if 'institution_programs' in missing:
            sql = (ROOT / 'drizzle/0007_tiny_nightcrawler.sql').read_text().replace('--> statement-breakpoint', '\n')
            connection.executescript('BEGIN IMMEDIATE;\n' + sql + '\nCOMMIT;')
        if 'institution_programs_source_unique' in missing:
            sql = (ROOT / 'drizzle/0008_clear_blink.sql').read_text().replace('--> statement-breakpoint', '\n')
            connection.executescript('BEGIN IMMEDIATE;\n' + sql + '\nCOMMIT;')
        if needs9:
            sql = (ROOT / 'drizzle/0009_gigantic_toad_men.sql').read_text().replace('--> statement-breakpoint', '\n')
            connection.executescript('BEGIN IMMEDIATE;\n' + sql + '\nCOMMIT;')
    print('DB 백업 및 기관 테이블 준비 완료:', backup)
else:
    print('기관 테이블이 이미 준비되어 있습니다.')

env_path = ROOT / '.dev.vars'
if not env_path.exists():
    raise SystemExit('.dev.vars 파일이 없습니다.')
content = env_path.read_text()
access_key = None
for line in content.splitlines():
    if line.startswith('INSTITUTION_ACCESS_KEY='):
        access_key = line.split('=', 1)[1].strip().strip('"\'')
if access_key is None:
    access_key = secrets.token_urlsafe(48)
    content += ('' if not content or content.endswith('\n') else '\n') + 'INSTITUTION_ACCESS_KEY=' + access_key + '\n'
if not any(line.startswith('INSTITUTION_SESSION_SECRET=') for line in content.splitlines()):
    content += ('' if content.endswith('\n') else '\n') + 'INSTITUTION_SESSION_SECRET=' + secrets.token_urlsafe(48) + '\n'
env_path.write_text(content)
os.chmod(env_path, 0o600)
key_path = ROOT / '.local-host/institution-access-key'
key_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
key_path.write_text(access_key + '\n')
os.chmod(key_path, 0o600)
print('기관 접속 코드 저장 완료: .local-host/institution-access-key (코드 내용은 출력하지 않음)')
