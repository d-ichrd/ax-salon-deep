/* AX 살롱 뤼미에르 · 현장 페이지 설정
 * endpoint 를 비워 두면 "미리보기" 모드예요. 기록이 그 브라우저에만 남아요.
 * Apps Script 웹 앱을 배포한 뒤 나오는 주소(…/exec)를 endpoint 에 넣으면 실제로 기록돼요.
 */
window.AX_LIVE = {
  endpoint: '',
  tables: 6,
  eventDate: '2026-11-28',

  /* 대시보드의 "구글 시트 열기", "워크시트 사진 폴더" 버튼 (비워 두면 숨겨져요) */
  sheetUrl: '',
  driveUrl: '',

  /* 순서지 위쪽에 보이는 와이파이 안내 (예: 'FastFive_Guest / 비밀번호 0000') */
  wifi: '',

  /* 순서지의 자료 받기 링크. 구글 드라이브 공유 링크를 넣으면 돼요. 비우면 "공유되면 여기에"로 보여요 */
  materials: {
    joo: '', yoo: '', song: '', choi: '', kim: '',
    worksheet: 'worksheet.pdf', cards: 'cards.pdf', slides: '', book: ''
  }
};
