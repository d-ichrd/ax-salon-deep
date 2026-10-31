/**
 * AX 살롱(심화) 신청서 → 구글 시트 접수
 * 구글 시트 > 확장 프로그램 > Apps Script 에 이 코드를 통째로 붙여 넣고
 * 배포 > 새 배포 > 웹 앱 (실행: 나 / 액세스: 모든 사용자) 로 배포하세요.
 */
const SHEET_NAME = '신청';
const NOTIFY_EMAIL = '';   // 새 신청이 들어올 때 알림 받을 메일 (선택, 비워 두면 알림 없음)

const COLUMNS = [
  ['접수시각', d => new Date()],
  ['이름', d => d.name],
  ['연락처', d => d.phone],
  ['이메일', d => d.email],
  ['하는 일', d => d.role],
  ['조직 유형', d => d.orgType],
  ['AI 활용 단계', d => d.stage],
  ['나누고 싶은 경험', d => d.experience],
  ['풀고 싶은 문제', d => d.question],
  ['앉고 싶은 탁자', d => d.seat],
  ['만나고 싶은 사람', d => d.meet],
  ['2부 참석', d => d.part2],
  ['알게 된 경로', d => d.source],
  ['사례 공유 의향', d => d.talk],
  ['개인정보 동의', d => d.agree ? '동의' : ''],
  ['촬영 동의', d => d.photo ? '동의' : '미동의'],
  ['선정', d => ''],
  ['메모', d => '']
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    if (d.website) return json_({ ok: true });                  // 스팸 봇
    if (!d.name || !d.email || !d.agree) return json_({ ok: false, error: 'missing' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(COLUMNS.map(c => c[0]));
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    }
    sh.appendRow(COLUMNS.map(c => safe_(c[1](d))));

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL, `[AX 살롱 심화] 새 신청 · ${d.name}`,
        `${d.name} (${d.role || ''})\n${d.email} / ${d.phone || ''}\n\n${d.experience || ''}\n\n시트: ${ss.getUrl()}`);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, message: 'AX 살롱 신청 접수 중' });
}

// 시트 수식 주입 방지 + 연락처 앞자리 0 유지
function safe_(v) {
  if (v instanceof Date) return v;
  v = v == null ? '' : String(v).slice(0, 5000);
  return /^[=+\-@0]/.test(v) ? "'" + v : v;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
