"""Refresh public PCU event candidates through the Mac-local operator endpoint."""
from pathlib import Path
import json
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
env_path = ROOT / '.dev.vars'
if not env_path.exists():
    raise SystemExit('.dev.vars를 찾지 못했어요. npm run experiment:migrate를 먼저 실행하세요.')
secret = next((line.split('=', 1)[1] for line in env_path.read_text().splitlines()
               if line.startswith('EXPERIMENT_OPERATOR_SECRET=')), '')
if not secret:
    raise SystemExit('npm run experiment:migrate로 운영자 비밀키를 설정해 주세요.')

request = urllib.request.Request(
    'http://127.0.0.1:3000/api/experiment/refresh', method='POST', data=b'',
    headers={'Origin': 'http://127.0.0.1:3000', 'X-Experiment-Operator-Secret': secret})
try:
    with urllib.request.urlopen(request, timeout=180) as response:
        result = json.load(response)
        print('수집 완료:', result['candidates'], '건 / 일부 실패:', result['partial'])
        print('수집 시각:', result['fetchedAt'])
except urllib.error.HTTPError as error:
    raise SystemExit(f'수집 요청 실패: HTTP {error.code}') from error
except urllib.error.URLError as error:
    raise SystemExit('Mac 앱이 실행 중인지 확인해 주세요.') from error
