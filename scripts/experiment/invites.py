"""Mac-local CLI for the invitation-only student experiment.

Usage: python3 scripts/experiment/invites.py create U01 [--base-url https://...]
       python3 scripts/experiment/invites.py list|revoke U01|delete U01|summary
"""
from pathlib import Path
import argparse
import datetime as dt
import hashlib
import json
import re
import secrets
import sqlite3
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / '.local-host'


def database():
    matches = []
    for path in (ROOT / '.wrangler/state/v3/d1').glob('**/*.sqlite'):
        connection = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
        try:
            if connection.execute("SELECT name FROM sqlite_master WHERE name='experiment_invites'").fetchone():
                matches.append(path)
        finally:
            connection.close()
    if len(matches) != 1:
        raise RuntimeError('실험 DB를 찾지 못했어요. 0006 마이그레이션을 적용했는지 확인해 주세요.')
    connection = sqlite3.connect(matches[0], timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys=ON')
    return connection


def public_url(arg):
    value = arg or (STATE / 'public-url').read_text().strip() if (arg or (STATE / 'public-url').exists()) else None
    if not value or not re.fullmatch(r'https://[a-zA-Z0-9.-]+(?::[0-9]+)?', value):
        raise RuntimeError('공개 HTTPS 주소가 필요합니다. --base-url https://... 을 입력해 주세요.')
    return value.rstrip('/')


def main():
    parser = argparse.ArgumentParser(description='대대일모 MVP 실험 초대 관리')
    sub = parser.add_subparsers(dest='action', required=True)
    create = sub.add_parser('create', help='새 초대 또는 기존 참여자 링크 재발급')
    create.add_argument('code')
    create.add_argument('--base-url')
    create.add_argument('--days', type=int, default=15)
    for name in ('revoke', 'delete'):
        command = sub.add_parser(name)
        command.add_argument('code')
    sub.add_parser('list')
    sub.add_parser('summary')
    args = parser.parse_args()
    if hasattr(args, 'code') and not re.fullmatch(r'U[0-9]{2,3}', args.code):
        parser.error('참여자 코드는 U01 형식이어야 합니다.')
    if args.action == 'create' and not 1 <= args.days <= 30:
        parser.error('--days는 1~30 사이여야 합니다.')
    base = public_url(args.base_url) if args.action == 'create' else None
    with database() as db:
        now = int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)
        if args.action == 'create':
            token = secrets.token_urlsafe(32)
            digest = hashlib.sha256(token.encode()).hexdigest()
            expiry = now + args.days * 86400000
            old = db.execute('SELECT id FROM experiment_invites WHERE participant_code=?', (args.code,)).fetchone()
            if old:
                db.execute('UPDATE experiment_invites SET token_hash=?,session_version=session_version+1,expires_at=?,revoked_at=NULL WHERE id=?', (digest, expiry, old['id']))
            else:
                db.execute('INSERT INTO experiment_invites (id,participant_code,token_hash,session_version,created_at,expires_at) VALUES (?,?,?,?,?,?)', (str(uuid.uuid4()), args.code, digest, 1, now, expiry))
            print(f'{args.code} 초대 링크 (한 번만 표시): {base}/experiment#invite={token}')
        elif args.action == 'revoke':
            result = db.execute('UPDATE experiment_invites SET revoked_at=?,session_version=session_version+1 WHERE participant_code=?', (now, args.code))
            print('초대를 회수했습니다.' if result.rowcount else '참여자 코드를 찾지 못했습니다.')
        elif args.action == 'delete':
            result = db.execute('DELETE FROM experiment_invites WHERE participant_code=?', (args.code,))
            print('초대와 관련 행동 기록을 삭제했습니다.' if result.rowcount else '참여자 코드를 찾지 못했습니다.')
        elif args.action == 'list':
            for row in db.execute('SELECT participant_code,expires_at,revoked_at,consented_at,availability_updated_at FROM experiment_invites ORDER BY participant_code'):
                print(json.dumps(dict(row), ensure_ascii=False))
        elif args.action == 'summary':
            for row in db.execute('''SELECT i.participant_code,i.consented_at,i.availability_updated_at,
                SUM(CASE WHEN a.action='feed_viewed' THEN 1 ELSE 0 END) AS feed_views,
                SUM(CASE WHEN a.action='original_open_attempt' AND a.fit_at_action='time_match' THEN 1 ELSE 0 END) AS matching_open_attempts,
                SUM(CASE WHEN a.action='original_open_attempt' THEN 1 ELSE 0 END) AS all_open_attempts
                FROM experiment_invites i LEFT JOIN experiment_actions a ON a.invite_id=i.id
                WHERE i.participant_code!='U00'
                GROUP BY i.id ORDER BY i.participant_code'''):
                print(json.dumps(dict(row), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (OSError, sqlite3.Error, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
