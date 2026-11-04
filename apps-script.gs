/**
 * AX 살롱 뤼미에르 · 현장 기록 서버 (Google Apps Script)
 *
 * 이 스크립트는 구글 시트에 붙여서 써요 (시트 메뉴 > 확장 프로그램 > Apps Script).
 *  - 기록은 이 시트의 탭(topics, worksheets, votes, notes, synthesis)에 쌓여요.
 *  - 워크시트 사진은 내 드라이브의 "AX 살롱 뤼미에르 워크시트" 폴더에 저장돼요.
 *  - AI 초안은 Anthropic Claude API를 써요 (스크립트 속성 ANTHROPIC_API_KEY).
 *
 * 처음 한 번: 위쪽 함수 목록에서 setup 을 골라 실행 → 권한 허용 → 실행 로그에 나온
 *            진행자 열쇠와 기록자 코드를 메모해 두세요.
 */

const TABLES = 6;
const TABS = {
  topics:     ['at', 'table', 'cardId', 'title', 'device'],
  worksheets: ['at', 'table', 'presenter', 'topic', 'summary', 'pitch', 'fileId', 'img', 'device'],
  votes:      ['at', 'voterTable', 'choice', 'device'],
  notes:      ['at', 'table', 'rating', 'text', 'name', 'device'],
  synthesis:  ['at', 'text', 'published'],
  rsvp:       ['at', 'name', 'company', 'title', 'phone', 'email', 'role', 'experience', 'interests', 'shareContact', 'agree', 'hide']
};

/* ---------------- setup ---------------- */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.entries(TABS).forEach(([name, head]) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) { sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); }
  });
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('FOLDER_ID')) p.setProperty('FOLDER_ID', DriveApp.createFolder('AX 살롱 뤼미에르 워크시트').getId());
  if (!p.getProperty('ADMIN_KEY')) p.setProperty('ADMIN_KEY', Utilities.getUuid().slice(0, 8));
  if (!p.getProperty('RECORDER_CODE')) p.setProperty('RECORDER_CODE', String(Math.floor(1000 + Math.random() * 9000)));
  if (!p.getProperty('VOTE')) p.setProperty('VOTE', 'closed');
  if (!p.getProperty('PARTICIPANT_KEY')) p.setProperty('PARTICIPANT_KEY', 'salon-' + String(Math.floor(1000 + Math.random() * 9000)));
  if (!p.getProperty('AI_MODEL')) p.setProperty('AI_MODEL', 'claude-sonnet-5-5');
  Logger.log('진행자 열쇠(ADMIN_KEY): ' + p.getProperty('ADMIN_KEY'));
  Logger.log('기록자 코드(RECORDER_CODE): ' + p.getProperty('RECORDER_CODE') + '  ← 워크시트에 적어 두세요');
  Logger.log('참여자 열쇠(PARTICIPANT_KEY): ' + p.getProperty('PARTICIPANT_KEY') + '  ← 명함첩을 열 때 써요. 연락처 공유에 동의한 분께만 보내 주세요');
  Logger.log('사진 폴더: https://drive.google.com/drive/folders/' + p.getProperty('FOLDER_ID'));
  Logger.log('AI 키: ' + (p.getProperty('ANTHROPIC_API_KEY') ? '설정됨' : '아직 없음 (프로젝트 설정 > 스크립트 속성에 ANTHROPIC_API_KEY 추가)'));
}

/* ---------------- web app ---------------- */
function doGet(e) {
  const prm = (e && e.parameter) || {};
  const action = prm.action || 'state';
  if (action === 'state') return json_(state_(isAdmin_(prm.key)));
  if (action === 'directory') return json_(directory_(prm.key));
  return json_({ ok: false, error: '알 수 없는 요청이에요.' });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: '요청을 읽지 못했어요.' }); }
  if (!d.action && d.email && d.name) d.action = 'rsvp';   // 본 페이지(b.html)의 참석 회신서
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const r = route_(d);
    CacheService.getScriptCache().removeAll(['state:0', 'state:1']);
    return json_(Object.assign({ ok: true }, r));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function route_(d) {
  const p = PropertiesService.getScriptProperties();
  const now = new Date().toISOString();
  const table = Number(d.table || 0);
  const okTable = t => Number.isInteger(t) && t >= 1 && t <= TABLES;
  const clip = (s, n) => String(s || '').trim().slice(0, n);
  const checkCode = () => { const code = p.getProperty('RECORDER_CODE'); if (code && String(d.code || '').trim() !== code) throw new Error('기록자 코드가 맞지 않아요. 워크시트 오른쪽 위의 숫자를 확인해 주세요.'); };
  const needAdmin = () => { if (!isAdmin_(d.key)) throw new Error('진행자 열쇠가 맞지 않아요.'); };

  switch (d.action) {
    case 'topic':
      if (!okTable(table)) throw new Error('탁자 번호를 먼저 골라 주세요.');
      append_('topics', [now, table, clip(d.cardId, 8), clip(d.title, 80), clip(d.device, 64)]);
      return {};

    case 'worksheet': {
      if (!okTable(table)) throw new Error('탁자 번호를 먼저 골라 주세요.');
      checkCode();
      const m = String(d.image || '').match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!m) throw new Error('사진을 읽지 못했어요. 다시 찍어 주세요.');
      const bytes = Utilities.base64Decode(m[2]);
      if (bytes.length > 8 * 1024 * 1024) throw new Error('사진이 너무 커요.');
      const blob = Utilities.newBlob(bytes, m[1], `table${table}_${now.replace(/[:.]/g, '-')}.jpg`);
      const file = DriveApp.getFolderById(p.getProperty('FOLDER_ID')).createFile(blob);
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) { /* 학교·회사 계정 정책으로 막히면 발표 화면에 사진이 안 보일 수 있어요 */ }
      const img = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w2000';
      append_('worksheets', [now, table, clip(d.presenter, 40), clip(d.topic, 90), '', '', file.getId(), img, clip(d.device, 64)]);
      const out = {};
      if (d.wantDraft) {
        try { out.draft = draftFromPhoto_(m[1], m[2], clip(d.topic, 90)); }
        catch (x) { out.aiError = 'AI가 이번에는 초안을 쓰지 못했어요.'; }
      }
      return out;
    }

    case 'memo':
      if (!okTable(table)) throw new Error('탁자 번호를 먼저 골라 주세요.');
      checkCode();
      append_('worksheets', [now, table, '', '', clip(d.summary, 600), clip(d.pitch, 1200), '', '', clip(d.device, 64)]);
      return {};

    case 'vote': {
      if (p.getProperty('VOTE') !== 'open') throw new Error('지금은 투표 시간이 아니에요.');
      const v = Number(d.voterTable), c = Number(d.choice);
      if (!okTable(v) || !okTable(c)) throw new Error('탁자 번호를 확인해 주세요.');
      if (v === c) throw new Error('내 탁자에는 투표할 수 없어요.');
      append_('votes', [now, v, c, clip(d.device, 64)]);
      return {};
    }

    case 'note': {
      const rating = Math.max(0, Math.min(5, Math.round(Number(d.rating) || 0)));
      const text = clip(d.text, 300);
      if (!text && !rating) throw new Error('등불을 켜거나 한 줄을 적어 주세요.');
      append_('notes', [now, okTable(table) ? table : '', rating || '', text, clip(d.name, 30), clip(d.device, 64)]);
      return {};
    }

    case 'ai_question': {
      const cache = CacheService.getScriptCache(), k = 'q:' + table, n = Number(cache.get(k) || 0);
      if (n >= 12) throw new Error('이 탁자는 질문을 많이 받았어요. 잠시 뒤 다시 눌러 주세요.');
      cache.put(k, String(n + 1), 3600);
      return aiQuestion_(clip(d.cardId, 8), clip(d.cardTitle, 80), clip(d.cardQ, 300), clip(d.context, 400));
    }

    case 'ai_synthesis': {
      needAdmin();
      const text = aiSynthesis_();
      append_('synthesis', [now, text, false]);
      return { synthesis: { text, at: now, published: false } };
    }

    case 'admin': {
      needAdmin();
      if (d.vote) { if (['open', 'closed', 'revealed'].indexOf(d.vote) < 0) throw new Error('투표 상태를 확인해 주세요.'); p.setProperty('VOTE', d.vote); }
      if (d.synthesisText != null || d.publish != null) {
        const cur = lastSynthesis_() || { text: '', published: false };
        append_('synthesis', [now, d.synthesisText != null ? String(d.synthesisText).slice(0, 20000) : cur.text, d.publish != null ? !!d.publish : cur.published]);
      }
      return {};
    }

    case 'report':
      needAdmin();
      return { url: makeReport_() };

    case 'rsvp':
      if (!d.agree) throw new Error('개인정보 수집·이용에 동의해야 회신할 수 있어요.');
      append_('rsvp', [now, clip(d.name, 40), clip(d.company, 60), clip(d.title, 60), clip(d.phone, 30), clip(d.email, 80), clip(d.role, 200), clip(d.experience, 2000), clip(d.seat, 60), d.shareContact === false ? false : true, true, '']);
      return {};
  }
  throw new Error('알 수 없는 요청이에요.');
}

/* ---------------- 참여자 명함첩 ----------------
 * 연락처 공유에 동의한 분만, 참여자 열쇠(또는 진행자 열쇠)가 맞을 때만 돌려줘요.
 * 시트 rsvp 탭의 hide 칸에 아무 글자나 적으면 명함첩에서 빠져요 (불참자 등).
 */
function directory_(key) {
  const p = PropertiesService.getScriptProperties();
  if (!(isAdmin_(key) || (p.getProperty('PARTICIPANT_KEY') && String(key || '') === p.getProperty('PARTICIPANT_KEY')))) return { ok: false, error: '참여자 열쇠가 맞지 않아요. 안내 메시지에 적힌 열쇠를 확인해 주세요.' };
  const byEmail = {};
  rows_('rsvp').forEach(r => { if (r.email) byEmail[String(r.email).toLowerCase()] = r; });
  const people = Object.keys(byEmail).map(k => byEmail[k])
    .filter(r => (r.shareContact === true || r.shareContact === 'TRUE') && !String(r.hide || '').trim())
    .map(r => ({ name: r.name, company: r.company, title: r.title, phone: String(r.phone || ''), email: r.email, role: r.role, interests: String(r.interests || '') }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  return { ok: true, people };
}

/* ---------------- state ---------------- */
function state_(admin) {
  const cache = CacheService.getScriptCache(), ck = 'state:' + (admin ? 1 : 0);
  const hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  const p = PropertiesService.getScriptProperties();
  const vote = p.getProperty('VOTE') || 'closed';
  const topics = {}, worksheets = {};
  rows_('topics').forEach(r => topics[r.table] = { cardId: r.cardId, title: r.title, at: r.at });
  rows_('worksheets').forEach(r => {
    const w = worksheets[r.table] || (worksheets[r.table] = {});
    ['presenter', 'topic', 'summary', 'pitch', 'img'].forEach(f => { if (r[f] !== '' && r[f] != null) w[f] = r[f]; });
    w.at = r.at;
  });
  const lastVote = {};
  rows_('votes').forEach(r => lastVote[r.device] = r);
  const counts = {}; for (let t = 1; t <= TABLES; t++) counts[t] = 0;
  Object.keys(lastVote).forEach(k => { const v = lastVote[k]; if (v.choice !== v.voterTable && counts[v.choice] != null) counts[v.choice]++; });
  const total = Object.keys(counts).reduce((a, k) => a + counts[k], 0);
  const notesAll = rows_('notes');
  const lastRating = {};
  notesAll.forEach(n => { if (n.rating) lastRating[n.device] = Number(n.rating); });
  const rs = Object.keys(lastRating).map(k => lastRating[k]), dist = [0, 0, 0, 0, 0];
  rs.forEach(r => dist[r - 1]++);
  const notes = notesAll.filter(n => n.text).slice(-200).reverse().map(n => ({ at: n.at, table: n.table || 0, rating: Number(n.rating) || 0, text: n.text, name: n.name }));
  const syn = lastSynthesis_();
  const out = {
    vote, topics, worksheets,
    votes: { total, counts: (admin || vote === 'revealed') ? counts : null, mine: null },
    notes,
    rating: { avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0, count: rs.length, dist },
    synthesis: syn && (admin || syn.published) ? syn : null,
    updatedAt: new Date().toISOString()
  };
  cache.put(ck, JSON.stringify(out), 3);
  return out;
}

function lastSynthesis_() {
  const r = rows_('synthesis');
  if (!r.length) return null;
  const s = r[r.length - 1];
  return { text: s.text, at: s.at, published: s.published === true || s.published === 'TRUE' };
}

/* ---------------- AI (Claude) ---------------- */
const VOICE = '말투는 담백한 해요체. 유행어, 과장, 홍보 문구, 이모지는 쓰지 않는다. 기록에 없는 사실을 지어내지 않는다.';

function claude_(content, system, maxTokens) {
  const p = PropertiesService.getScriptProperties();
  const key = p.getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('AI 키가 아직 설정되지 않았어요.');
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: p.getProperty('AI_MODEL') || 'claude-sonnet-5-5', max_tokens: maxTokens || 1200, system, messages: [{ role: 'user', content }] })
  });
  if (res.getResponseCode() !== 200) { console.error(res.getContentText()); throw new Error('AI가 응답하지 않았어요. 잠시 뒤 다시 시도해 주세요.'); }
  const j = JSON.parse(res.getContentText());
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}
function jsonFrom_(t) { const m = String(t).match(/\{[\s\S]*\}/); if (!m) throw new Error('AI 응답을 읽지 못했어요.'); return JSON.parse(m[0]); }

function aiQuestion_(cardId, cardTitle, cardQ, context) {
  const system = '너는 "AX 살롱 뤼미에르"의 조용한 조력자야. 조직에서 AX를 이끌어 온 팀장급 이상 리더들이 둥근 탁자에서 질문 카드 하나를 두고 30분 동안 이야기한다. '
    + '탁자가 적어 준 지금까지의 이야기를 읽고, 대화를 한 걸음 더 깊게 만드는 질문 하나를 제안한다. 답이나 조언은 주지 않는다. 참석자가 자기 경험에서 답을 꺼내게 하는 열린 질문이어야 하고, 기술보다 사람·결정·조직의 결을 건드리면 좋다. '
    + VOICE + ' 출력은 JSON 하나만: {"question":"두 문장 이내의 질문","why":"이 질문을 고른 이유 한 문장"}';
  const user = `카드 ${cardId} 「${cardTitle}」\n카드의 질문: ${cardQ}\n\n탁자가 적은 지금까지의 이야기:\n${context}`;
  const r = jsonFrom_(claude_(user, system, 400));
  return { question: String(r.question || ''), why: String(r.why || '') };
}

function draftFromPhoto_(mime, b64, topic) {
  const system = '너는 "AX 살롱 뤼미에르"의 기록 도우미야. 탁자 토론 워크시트를 찍은 사진의 손글씨를 읽고 발표자가 고쳐 쓸 초안을 만든다. '
    + '읽을 수 없는 부분은 추측하지 말고 [판독 어려움]으로 남긴다. 워크시트에 없는 내용은 보태지 않는다. ' + VOICE
    + ' 출력은 JSON 하나만: {"read":"사진에서 읽은 내용과 판독이 어려웠던 부분을 한두 문장으로","summary":["핵심 1","핵심 2","조직에 가져갈 포인트"],"pitch":"발표자가 1분 동안 말할 메모, 합니다체, 300자 안팎"}';
  const content = [
    { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
    { type: 'text', text: '이 탁자가 고른 카드: ' + (topic || '기록 없음') + '\n워크시트를 읽고 초안을 써 주세요.' }
  ];
  const r = jsonFrom_(claude_(content, system, 900));
  return { read: String(r.read || ''), summary: (r.summary || []).map(String).slice(0, 5), pitch: String(r.pitch || '') };
}

function aiSynthesis_() {
  const s = state_(true);
  const tables = [];
  for (let t = 1; t <= TABLES; t++) {
    const w = s.worksheets[t] || {}, p = s.topics[t];
    tables.push({ table: t, card: p ? p.cardId + ' ' + p.title : null, summary: w.summary || null, pitch: w.pitch || null, votes: s.votes.counts ? s.votes.counts[t] : null });
  }
  const data = { tables, guestbook: s.notes.slice(0, 120).map(n => n.text), lampAverage: Number(s.rating.avg.toFixed(2)), lampCount: s.rating.count };
  const system = '너는 "AX 살롱 뤼미에르"의 기록을 정리하는 공동 저자야. 조직에서 AX를 이끌어 온 리더들이 네 개의 이야기를 듣고, 여섯 탁자에서 각자 카드 하나를 골라 깊이 토론하고, 방명록을 남겼다. '
    + '이 기록을 바탕으로 참석자 모두가 다시 읽을 "오늘의 정리" 초안을 쓴다. 인문적이고 통찰 있게, 그러나 담백하게. 여러 탁자를 가로지르는 패턴을 찾아 이름 붙이고, 조직에 돌아가 해 볼 수 있는 일로 이어 준다. '
    + '사람 이름은 쓰지 않는다. 방명록 문장을 그대로 길게 옮기지 않는다. ' + VOICE
    + ' 형식은 마크다운: 오늘을 꿰는 한 줄 제목을 "## "로 쓰고(“오늘의 정리”라는 말은 쓰지 않는다) 그 아래 3~4문장 개요, "### 탁자를 가로지른 패턴" 3~4개 목록, "### 탁자마다 한 줄" 목록, "### 조직에 가져갈 것" 3개 목록, "### 아직 남은 질문" 2~3개 목록.';
  return claude_('오늘의 기록(JSON):\n' + JSON.stringify(data), system, 1800);
}

/* ---------------- Google Docs report ---------------- */
function makeReport_() {
  const s = state_(true), p = PropertiesService.getScriptProperties();
  const doc = DocumentApp.create('AX 살롱 뤼미에르 기록 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'));
  const body = doc.getBody();
  body.appendParagraph('AX 살롱 뤼미에르 기록').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('2026. 11. 28. 토 · 패스트파이브 삼성4호점');
  if (s.synthesis && s.synthesis.text) {
    String(s.synthesis.text).split('\n').forEach(l => {
      const t = l.trim(); if (!t) return;
      if (t.startsWith('### ')) body.appendParagraph(t.slice(4)).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      else if (t.startsWith('## ')) body.appendParagraph(t.slice(3)).setHeading(DocumentApp.ParagraphHeading.HEADING1);
      else if (/^[-*] /.test(t)) body.appendListItem(t.slice(2));
      else body.appendParagraph(t.replace(/\*\*/g, ''));
    });
  }
  body.appendParagraph('탁자별 기록').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  for (let t = 1; t <= TABLES; t++) {
    const w = s.worksheets[t] || {}, tp = s.topics[t];
    body.appendParagraph(t + '번 탁자' + (tp ? ' · ' + tp.cardId + ' ' + tp.title : '')).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    if (s.votes.counts) body.appendParagraph('받은 표: ' + s.votes.counts[t]);
    if (w.presenter) body.appendParagraph('발표: ' + w.presenter);
    if (w.summary) String(w.summary).split('\n').filter(Boolean).forEach(x => body.appendListItem(x));
    if (w.pitch) body.appendParagraph(w.pitch).setItalic(true);
    const id = w.img && (String(w.img).match(/id=([^&]+)/) || [])[1];
    if (id) { try { const im = body.appendImage(DriveApp.getFileById(id).getBlob()); const k = 440 / im.getWidth(); im.setWidth(440).setHeight(Math.round(im.getHeight() * k)); } catch (x) {} }
  }
  body.appendParagraph('방명록').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`등불 평균 ${s.rating.avg.toFixed(2)} / 5 (${s.rating.count}명)`);
  s.notes.forEach(n => body.appendListItem(n.text + (n.table ? ` (${n.table}번 탁자)` : '')));
  doc.saveAndClose();
  const f = DriveApp.getFileById(doc.getId());
  try { f.moveTo(DriveApp.getFolderById(p.getProperty('FOLDER_ID'))); } catch (x) {}
  return doc.getUrl();
}

/* ---------------- helpers ---------------- */
function isAdmin_(k) { const a = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY'); return !!a && String(k || '') === a; }
function append_(name, row) { SpreadsheetApp.getActive().getSheetByName(name).appendRow(row); }
function rows_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues(), head = v.shift();
  return v.map(r => { const o = {}; head.forEach((h, i) => o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i]); return o; });
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
