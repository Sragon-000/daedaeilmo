# 학교 계정 인증 연결 기록

확인일: 2026-09-08. 이용 조건은 재학 상태가 아니라 학교 포털 로그인 성공이다. 시간표는 사용자가 직접 입력한다.

## 배재대학교

공식 시작 주소: https://portal.pcu.ac.kr/

공개 로그인 페이지에서 다음 순서를 확인했다.

1. `/patis/common/verifySsoSession.do`: 입력한 ID에 대한 기존 로그인 세션을 확인하고, 중복 로그인 시 기존 세션 종료 여부를 묻는다. **이 응답은 비밀번호 검증이나 본인 인증의 증거가 아니다. 인증 판정에 사용하면 안 된다.**
2. `/patis/common/getKey.do`: POST로 RSA 공개키 modulus/exponent를 받는다.
3. 페이지의 RSAKey.encrypt로 아이디와 비밀번호를 각각 암호화한다.
4. `/patis/system/AuthController.do`: `securedUserId`, `securedUserPwd`, `methodName=doSsoLogin`을 POST한다.

LMS의 외부인 로그인이나 타 대학으로 연결된 SSO 링크는 사용하지 않는다. 성공 후 보호된 리소스의 응답은 계정 테스트에서 별도로 확인해야 한다.

## 계명대학교

공식 시작 주소: https://portal.kmu.ac.kr/

공개 페이지에서 확인한 이동 순서:

1. `/index.jsp` → `/kmu/Login.do`
2. `https://sso.kmu.ac.kr/kmusso/ext/edward/login_form.do`
3. Return_Url은 `https://edward.kmu.ac.kr/com/SsoCtr/sso_login.do?redirectUrl=https://portal.kmu.ac.kr/proc/Login.do`
4. ID 양식은 `login_process.do`로 `loginName`, `password`, `loginType=ID`, `Return_Url`을 POST한다. 공개 JS의 ID 로그인과 인증서 로그인은 별도 경로이다.

학교 SSO가 발급하는 티켓이나 쿠키를 앱의 임의 콜백에 전달할 수 있다고 가정하지 않는다. 성공 리다이렉트 주소만으로 인증 성공을 판정하지 않는다. 배포 환경에서 HTTPS 인증서 검증이 성공해야 하며 검증을 끄는 우회는 사용하지 않는다.

## 계정 테스트 도구

`scripts/auth/inspect-login.mjs`는 독립된 비영구 Chrome 컨텍스트에서 공식 포털을 연다. 기본값은 배재대이며 pcu/kmu/both 인자로 범위를 선택한다. 사용자가 직접 로그인한다. 기존 개인 브라우저 프로필은 사용하지 않는다.

- 비밀번호, 요청 본문, 쿠키, 헤더, 응답 본문, 화면 이미지, storageState를 저장하거나 출력하지 않는다.
- 허용된 학교 호스트의 요청 경로(쿼리/프래그먼트 제외), 상태 코드, 메서드, 리소스 종류만 메모리에 최대 150개 보관한다.
- `inspect pcu` / `inspect kmu`는 비밀번호 입력칸 수와 로그아웃 요소 존재 여부만 출력한다. 개인정보 텍스트는 출력하지 않는다.
- 신호는 조사 자료이며 인증 증명이 아니다. 도구는 앱 인증 세션을 발급하지 않는다.
- `quit`으로 두 컨텍스트를 종료한다. 학교 세션이 서버에서도 취소된다고 보장하지 않으므로 필요한 경우 학교 화면에서 먼저 로그아웃한다.

공식 계정 테스트로 성공/실패 응답과 보호 리소스가 확인된 후 서버 검증기를 연결한다. 클라이언트의 성공 플래그, 데모 입장, 단순 200 응답, 쿠키 유무는 인증 증거로 사용하지 않는다.

## 실제 계정 테스트 진행

사용자가 별도 학교 창에서 배재대 로그인을 완료했다. `/patis/system/AuthController.do` POST(302) → `/exsignon/sso/sso_assert.jsp`(302) → `/exsignon/sso/sso_identify.jsp`(302) → `/main.do`(200)를 관찰했다. 완료 화면의 비밀번호 입력칸은 0개이고 로그아웃 요소가 존재했다. 별도 비로그인 HTTP 요청으로 `/main.do`를 읽으면 로그인 양식이 반환되고 로그아웃 문구는 없었다.

계명대는 사용자 요청으로 보류했다. 배재대 앱 서버 연결의 최종 실제 계정 테스트는 진행 중이다.

## 앱 연결에서 확인한 두 가지 차이

1. 서버의 새 세션에서는 `/exsignon/sso/sso_assert.jsp`가 `https://sso.pcu.ac.kr`로 이동한 다음 포털의 `/exsignon/sso/sso_identify.jsp`와 `/main.do`로 복귀한다. 허용 호스트는 portal.pcu.ac.kr와 sso.pcu.ac.kr 두 개로 고정했다. 호스트 전용 쿠키는 상대 서버로 전달하지 않는다.
2. 인증 후 `/main.do` 응답은 약 3~4KB의 eXBuilder/cpr 앱 로더이며 로그아웃 문구는 자바스크립트 실행 후 생긴다. HTML의 로그아웃 문구만 확인하던 판정을 제거하고, 실제 SSO 콜백의 메인 이동과 새 보호 리소스 요청의 앱 로더/로그인 양식 부재를 함께 확인한다. 메인 주소, 200 응답, 앱 로더만으로는 인증되지 않는다.

최종 확인: 사용자의 실제 배재대 계정으로 앱 로그인 POST가 200을 반환했고, 이어진 세션 확인 요청도 처리되었다. 사용자가 앱 로그인 성공을 확인했다. 임시 진단 출력을 제거했다. 로컬 앱에서 확인한 결과이며 기존 게시본에는 아직 반영하지 않았다.

사용자 결정: 시간표 자동 연결 검토를 취소했다. 시간표는 직접 입력으로 유지하며 수강내역/시간표 API를 구현하거나 호출하지 않는다. 이름·학번 표시 작업만 계속한다.
