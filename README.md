# AX 살롱(심화) · Vercel 배포 안내

빌드 과정이 없는 정적 사이트예요. 이 폴더를 그대로 Vercel에 올리면 됩니다.

```
ax-salon-deep/
├─ index.html        페이지 본문
├─ config.js         ← 배포 때 고칠 곳 (신청서 접수 주소)
├─ og.jpg            카톡·SNS 링크 미리보기 이미지 (1200×630)
├─ favicon.svg
├─ assets/           배경 그림, 책 표지, 사람들 사진
├─ vercel.json       캐시·보안 헤더
├─ .vercelignore     apps-script/와 README는 배포에서 빠져요
└─ apps-script/Code.gs  신청서 → 구글 시트 접수용 코드
```

---

## 1. Vercel에 올리기 (둘 중 편한 방법)

### 방법 A. GitHub 경유 (추천: 이후 수정이 쉬움)
1. GitHub에서 새 저장소(예: `ax-salon-deep`)를 만들고, 이 폴더 안의 파일을 모두 업로드
   (Add file → Upload files → 폴더 안 내용 전체를 끌어다 놓기)
2. vercel.com → **Add New… → Project** → 방금 만든 저장소 **Import**
3. Framework Preset은 **Other**, Build Command·Output Directory는 비워 둔 채 **Deploy**
4. 이후에는 GitHub에서 파일을 고치면 자동으로 다시 배포돼요.

### 방법 B. 터미널 (Node.js가 설치된 경우)
```bash
cd ax-salon-deep
npx vercel          # 처음 한 번: 로그인 → 프로젝트 이름 ax-salon-deep
npx vercel --prod   # 실제 주소로 배포
```

> 기존 `ax-salon.vercel.app`과는 별도 프로젝트로 두고, 기존 사이트에서 이 주소로 링크를 거는 방식을 권해요.
> (하위 경로 `/deep`으로 합치면 이미지 경로가 어긋날 수 있어요.)

---

## 2. 신청서를 실제로 받기 (구글 시트, 10분)

지금 `config.js`의 `applyEndpoint`가 비어 있어서 **시안 모드**예요(확인 화면까지만 보이고 저장 안 됨).

1. 구글 드라이브에서 새 스프레드시트 만들기 (예: `AX 살롱 심화 신청`)
2. 메뉴 **확장 프로그램 → Apps Script** → 기본 코드를 지우고 `apps-script/Code.gs` 내용을 통째로 붙여 넣기 → 저장
   - 새 신청 알림 메일을 받으려면 맨 위 `NOTIFY_EMAIL`에 메일 주소 입력
3. 오른쪽 위 **배포 → 새 배포** → 유형 **웹 앱**
   - 다음 사용자 인증 정보로 실행: **나**
   - 액세스 권한이 있는 사용자: **모든 사용자**
   - 배포 → 권한 승인(“확인되지 않은 앱” 경고가 나오면 고급 → 이동)
4. 나오는 **웹 앱 URL**(`https://script.google.com/macros/s/…/exec`)을 복사해서 `config.js`에 붙여 넣기
   ```js
   applyEndpoint: 'https://script.google.com/macros/s/……/exec',
   ```
5. 다시 배포하면 시안 안내 문구가 사라지고, 제출할 때마다 시트의 `신청` 탭에 한 줄씩 쌓여요.
   (`선정`, `메모` 열은 운영진이 직접 쓰는 칸)

> Apps Script 코드를 고친 뒤에는 **배포 → 배포 관리 → 수정(연필) → 버전: 새 버전**으로 다시 배포해야 반영돼요. URL은 그대로예요.

---

## 3. 배포 후 확인할 것

- [ ] **링크 미리보기 주소**: 프로젝트 주소가 `ax-salon-deep.vercel.app`이 아니면, `index.html` 위쪽의
      `og:url`, `og:image`, `canonical` 세 줄의 주소를 실제 주소로 바꾸기
      (카톡은 미리보기를 캐시해요. 바꾼 뒤 [카카오 공유 디버거](https://developers.kakao.com/tool/debugger/sharing)에서 초기화)
- [ ] **오시는 길**: 주소 `서울 강남구 영동대로106길 11`과 지도 위치가 맞는지 확인
      (틀리면 `index.html`에서 주소 문구와 지도 링크 4곳을 함께 수정)
- [ ] 휴대폰에서 신청서를 한 번 제출해 보고 시트에 들어오는지 확인 → 테스트 행 삭제
- [ ] 개인정보 보관 기한(행사 후 3개월) 지나면 시트 정리
