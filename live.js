/* AX 살롱 뤼미에르 · 현장 페이지 공용 스크립트 (table / program / dashboard) */
(() => {
  const CFG = Object.assign({ endpoint: '', tables: 6, eventDate: '2026-11-28', materials: {} }, window.AX_LIVE || {});
  const ENDPOINT = String(CFG.endpoint || '').trim();
  const DEMO = !ENDPOINT;
  const TABLES = Array.from({ length: CFG.tables }, (_, i) => i + 1);

  /* ---------- small utils ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const deviceId = (() => {
    let id = store.get('axl-device');
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); store.set('axl-device', id); }
    return id;
  })();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toast(msg, kind = '') {
    let box = $('#axl-toast');
    if (!box) { box = document.createElement('div'); box.id = 'axl-toast'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    box.textContent = msg; box.className = 'show ' + kind;
    clearTimeout(box._t); box._t = setTimeout(() => box.className = '', 3200);
  }

  /* 사진을 줄여 base64로 (워크시트 손글씨가 읽힐 정도로) */
  function compressImage(file, max = DEMO ? 1100 : 1700, q = DEMO ? .72 : .84) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', q));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했어요. JPG나 PNG 사진으로 다시 골라 주세요.')); };
      img.src = url;
    });
  }

  /* ---------- the cards ---------- */
  const DECKS = {
    env: { name: '환경 탁자', time: '도구와 지식', color: '#182C88', seat: 's-env', cards: [
      ["E-1", "개인의 활용에서 팀의 자산으로", "한 사람의 AI 활용이 팀 전체의 일하는 방식으로 확산된 경우와, 그 사람에게만 머문 경우를 떠올려 보세요. 두 경우를 가른 결정적 차이는 무엇이었나요?", "AI를 능숙하게 쓰는 한 사람의 방법이 팀에 공유되지 않아, 그 사람이 자리를 비우면 업무가 멈춘다."],
      ["E-2", "작은 성공을 나누게 하려면", "구성원이 '별것 아니다'라며 공유하지 않는 작은 성공을 끌어내기 위해 시도해 본 방법(자리·채널·질문 방식)이 있나요? 효과는 어땠나요?", "사내 공유회를 열어도 늘 같은 몇 사람만 발표하고, 대다수는 듣기만 한다."],
      ["E-3", "이미 있는 것을 다시 쓰게", "누군가 이미 만든 AI 도구나 프롬프트를 먼저 찾아보고 재사용하게 하려면 무엇이 필요할까요?", "세 팀이 각자 비슷한 회의록 요약 도구를 만들었지만, 서로의 존재를 알지 못했다."],
      ["E-4", "전면 개방과 선택 집중", "전 직원에게 AI 도구를 열어 각자 활용하게 하는 방식과, 조직이 핵심 업무를 골라 에이전트로 구현하는 방식 가운데 우리는 어느 쪽에 가까웠나요? 그 선택으로 무엇을 얻고 무엇을 놓쳤나요?", "전사에 AI 계정을 일괄 배포한 뒤 사용률은 높아졌지만, 핵심 업무의 방식은 거의 달라지지 않았다."],
      ["E-5", "암묵지를 지식으로", "구성원의 시간을 크게 빼앗지 않으면서, 조직의 일하는 방식과 판단 기준을 AI가 이해하고 활용할 수 있는 지식으로 정리해 본 경험이 있나요?", "지식을 모으려고 현업 인터뷰를 요청했더니 \"바쁜데 또요?\"라는 반응이 돌아왔다."] ] },
    pro: { name: '프로세스 탁자', time: '맡김과 검증', color: '#E2522F', seat: 's-pro', cards: [
      ["P-1", "어디부터 맡길까", "업무를 AI에게 넘길 때 어디부터 분리했나요? 처음 맡긴 일과, 맡겼다가 다시 사람에게 돌린 일은 무엇이었나요?", "보고서 초안은 순조롭게 맡겼지만, 고객 안내 문구를 맡겼다가 큰 오류로 이어질 뻔했다."],
      ["P-2", "좋은 결과의 기준", "AI가 만든 결과물은 누가, 어떤 기준으로 검토하나요? '이 정도면 좋다'는 기준을 명시적으로 정해 본 적이 있나요?", "팀마다 좋은 결과물의 기준이 다르다. 어떤 팀은 속도를, 어떤 팀은 정확성을, 어떤 팀은 참신함을 본다."],
      ["P-3", "맡김과 방임 사이", "어디까지 AI에게 맡기고, 어느 지점에서 사람이 개입하나요? 그 경계를 개인의 주의력이 아니라 구조(가드레일·검수 단계)로 설계해 본 적이 있나요?", "AI에 자율을 주었다가 불안해져, 다시 '실행 전에 한 번은 확인받는' 방식으로 돌아갔다."],
      ["P-4", "성과를 무엇으로 말할까", "AX의 성과를 무엇으로 측정하고 있나요? 절감한 시간이나 사용량 외에, 경영진을 설득한 근거는 무엇이었나요?", "자동화한 업무 건수를 보고했더니, 경영진이 \"그래서 무엇이 나아졌느냐\"고 되물었다."],
      ["P-5", "추진 여부는 누가 판단하나", "AI 과제의 추진 여부를 판단하는 창구와 기준이 있나요? 도입 이후의 운영 부담은 언제, 어떻게 검토하나요?", "도입 초기라 구성원들이 어떤 도구가 있는지, 누구에게 묻고 어디서 승인받아야 하는지 알지 못한다."] ] },
    chg: { name: '변화관리 탁자', time: '사람과 역할', color: '#2E5C4F', seat: 's-chg', cards: [
      ["C-1", "가장 큰 불안", "'내 일이 사라질까', '나만 뒤처질까', '서툰 모습이 드러날까', '평가에서 불리할까' 가운데 우리 조직에서 가장 두드러진 불안은 무엇이며, 어떻게 알아차렸나요?", "교육 만족도는 높은데, 실무에서는 AI를 활용했다는 사실을 드러내지 않는다."],
      ["C-2", "실패를 학습으로", "AI 실험이 실패했을 때 그것이 비난이 아닌 학습으로 남도록 어떤 말과 행동, 구조를 마련했나요? 반대로 실패가 덮인 경험이 있다면 무엇이 달랐나요?", "파일럿이 실패한 뒤로 다음 과제에 선뜻 나서는 사람이 없다."],
      ["C-3", "참여를 이끈 것", "사내 교육이나 AI 챔피언 제도 가운데 실제로 구성원의 참여를 이끈 것은 무엇이었나요? 공식 보상이 충분하지 않을 때, 챔피언에게 무엇을 줄 수 있을까요?", "AI 챔피언에게 줄 수 있는 공식 보상이 연말 시상 하나뿐이다."],
      ["C-4", "변화는 누가 이끄는가", "전사 AI 전환은 누가 이끌 때 속도가 붙었나요? IT, HR, 현업 조직장처럼 출발점이 다른 리더들과는 어떻게 공감대를 만들었나요?", "월 1회 열리는 전사 AI 협의체가 정보 공유에 그칠 뿐, 결정으로 이어지지 않는다."],
      ["C-5", "끝까지 사람의 몫", "AI가 직무의 경계를 흐리는 지금, 끝까지 '사람의 몫'으로 남는 일은 무엇일까요? AI로 줄어든 일만큼 새로 생겨난 일(검증·설계·판단·책임)은 누가 맡고 있나요?", "신입 채용을 줄인 뒤, 4~5년 후 AI 결과물을 검증하고 판단할 중간 허리가 비게 될 것이라는 우려가 나온다."] ] }
  };
  const CARDS = {};
  Object.entries(DECKS).forEach(([key, d]) => d.cards.forEach(c => CARDS[c[0]] = { id: c[0], deck: key, title: c[1], q: c[2], stuck: c[3], color: d.color, deckName: d.name, deckSub: d.time }));

  /* ---------- the program (순서지와 대시보드가 함께 씀) ---------- */
  const PROGRAM = [
    { t: '14:00', d: 10, title: '살롱 문 열기', note: '오늘의 흐름과 탁자 소개', who: '살로니에르 신지현 · 정효정' },
    { t: '14:10', d: 55, tag: '세션 1 · 현업과 거버넌스', title: 'AI와 일하는 방식, 정말 바뀌었을까?', note: '이야기 20분씩, 이어서 디브리핑 15분', who: '진행 신지현',
      talks: [
        { id: 'joo', name: '주효진 (Jamie)', org: '前 아모레퍼시픽 AX 담당', t: '14:10', title: '내 머리 꼭대기에 있는 AI와 일하는 현업 POV' },
        { id: 'yoo', name: '유창우', org: 'LG CNS', t: '14:30', title: 'AX를 위해 꼭 필요한 것들: 거버넌스 중심' } ] },
    { t: '15:05', d: 55, tag: '세션 2 · 조직과 사람', title: '조직과 사람, 무엇부터 다시 짜야 할까?', note: '이야기 20분씩, 이어서 디브리핑 15분', who: '진행 신지현',
      talks: [
        { id: 'song', name: '송인혁', org: '유니크굿컴퍼니 대표', t: '15:05', title: '지옥까지 갔다가 나노벤처로 10X 성장한 생존기' },
        { id: 'choi', name: '최환희', org: 'Fontys 응용과학대학 교수', t: '15:25', title: 'AI가 일을 가져가면, 우리 손에는 무엇이 남을까?' } ] },
    { t: '16:00', d: 15, title: '쉬는 시간 · 탁자로', note: '다과를 곁에 두고 내 탁자로 옮겨 앉아요' },
    { t: '16:15', d: 30, tag: '둥근 탁자', title: '우리 탁자에서는 어디가 막혀 있을까?', note: '카드 하나를 골라 30분 동안 깊이, 기록자는 워크시트를 올려요', link: 'table' },
    { t: '16:45', d: 20, tag: '살롱 솔루션 · Co-Creation', title: '살롱 이후, 조직에 어떻게 뿌리내릴까?', note: '탁자의 이야기를 조직 안에서 이어 가는 방법',
      talks: [ { id: 'kim', name: '김혜영', org: '단국대학교 교수', t: '16:45', title: '살롱의 대화를 조직의 일로: 코크리에이션으로 여는 AX 내재화' } ] },
    { t: '17:05', d: 30, title: '탁자별 발표', note: '탁자마다 발표자가 논의를 나눠요', link: 'stage' },
    { t: '17:35', d: 10, title: '투표와 닫는 인사', note: '가장 도움이 된 탁자에 한 표, 우승 탁자에 작은 선물', link: 'vote' }
  ];
  const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  /* 지금(서울 시각)이 순서지의 어디인지. ?now=16:20 으로 미리 볼 수 있어요 */
  function nowInfo() {
    const q = new URLSearchParams(location.search).get('now');
    let today, mins;
    if (q && /^\d{1,2}:\d{2}$/.test(q)) { today = CFG.eventDate; mins = toMin(q); }
    else {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
      today = `${p.year}-${p.month}-${p.day}`; mins = Number(p.hour) * 60 + Number(p.minute);
    }
    const start = toMin(PROGRAM[0].t), last = PROGRAM[PROGRAM.length - 1], end = toMin(last.t) + last.d;
    if (today < CFG.eventDate || (today === CFG.eventDate && mins < start)) return { phase: 'before', mins };
    if (today > CFG.eventDate || mins >= end) return { phase: 'after', mins };
    const idx = PROGRAM.findIndex(s => mins >= toMin(s.t) && mins < toMin(s.t) + s.d);
    return { phase: 'live', idx, mins, left: toMin(PROGRAM[idx].t) + PROGRAM[idx].d - mins };
  }

  /* ---------- server (Apps Script) or demo (이 브라우저 안에서만) ---------- */
  async function http(method, payload, extra = '') {
    if (method === 'GET') {
      const r = await fetch(`${ENDPOINT}?action=state${extra}&t=${Date.now()}`);
      if (!r.ok) throw new Error('기록 서버에 닿지 않았어요.');
      return r.json();
    }
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('기록 서버에 닿지 않았어요.');
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || '처리하지 못했어요.');
    return j;
  }

  const DEMO_KEY = 'axl-demo';
  const demoRaw = () => store.get(DEMO_KEY, { topics: [], worksheets: [], votes: [], notes: [], vote: 'closed', synthesis: null });
  function aggregate(raw, admin) {
    const topics = {}, worksheets = {};
    raw.topics.forEach(r => topics[r.table] = { cardId: r.cardId, title: r.title, at: r.at });
    raw.worksheets.forEach(r => { const w = worksheets[r.table] || (worksheets[r.table] = {}); Object.entries(r).forEach(([k, v]) => { if (v !== '' && v != null) w[k] = v; }); });
    const lastVote = {};
    raw.votes.forEach(v => lastVote[v.device] = v);
    const counts = {}; TABLES.forEach(t => counts[t] = 0);
    Object.values(lastVote).forEach(v => { if (v.choice !== v.voterTable && counts[v.choice] != null) counts[v.choice]++; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const lastRating = {};
    raw.notes.forEach(n => { if (n.rating) lastRating[n.device] = n.rating; });
    const rs = Object.values(lastRating), dist = [0, 0, 0, 0, 0]; rs.forEach(r => dist[r - 1]++);
    const showCounts = admin || raw.vote === 'revealed';
    const syn = raw.synthesis && (admin || raw.synthesis.published) ? raw.synthesis : null;
    return {
      vote: raw.vote, topics, worksheets,
      votes: { total, counts: showCounts ? counts : null, mine: lastVote[deviceId] ? lastVote[deviceId].choice : null },
      notes: raw.notes.filter(n => n.text).slice(-200).map(({ device, ...n }) => n).reverse(),
      rating: { avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0, count: rs.length, dist },
      synthesis: syn, updatedAt: new Date().toISOString(), demo: true
    };
  }
  const MOCK = {
    question: c => ({ question: `방금 나온 이야기에서 '${c.cardTitle || '이 주제'}'가 막힌 진짜 지점은 도구일까요, 아니면 누가 결정하느냐의 문제일까요? 각자 한 문장으로 답해 보세요.`, why: '탁자의 기록에서 기술 이야기와 역할 이야기가 섞여 있어, 둘을 나눠 보면 논의가 깊어질 것 같아요.' }),
    draft: p => ({ summary: ['(예시) 팀마다 AI 활용 수준이 달라 공유가 끊긴다', '(예시) 작은 성공을 공유하는 자리를 정례화한 사례가 효과적이었다', '(예시) 조직에 가져갈 포인트: 프롬프트·도구를 모으는 공용 서가 만들기'], pitch: `(예시 초안) 저희 탁자는 ${p.topic || '카드 하나'}를 골랐습니다. 개인의 작은 성공이 왜 팀으로 번지지 않는지 이야기했고, 공유를 의무가 아니라 습관으로 만든 사례에서 실마리를 찾았습니다.`, read: '(예시) 서버를 연결하면 AI가 워크시트 사진의 손글씨를 읽어 초안을 써요.' }),
    synthesis: () => ({ text: '## 도구보다 결정이 먼저 막혔던 오후 (예시)\n\n서버와 AI 키를 연결하면, 모든 탁자의 기록과 방명록을 바탕으로 AI가 종합 초안을 써요. 관리자가 다듬어 공개하면 참석자 순서지에 나타나요.\n\n### 탁자를 가로지른 패턴\n- 도구보다 "누가 정하느냐"에서 더 자주 막혔어요\n\n### 조직에 가져갈 것\n- 작은 성공을 모으는 공용 서가\n\n### 아직 남은 질문\n- AI가 줄인 시간만큼 생긴 일은 누가 맡나요?' })
  };
  async function demoSend(p) {
    const raw = demoRaw(), at = new Date().toISOString();
    await new Promise(r => setTimeout(r, p.action.startsWith('ai') ? 900 : 250));
    switch (p.action) {
      case 'topic': raw.topics.push({ at, table: p.table, cardId: p.cardId, title: p.title }); break;
      case 'worksheet': raw.worksheets.push({ at, table: p.table, presenter: p.presenter, topic: p.topic, img: p.image, summary: '', pitch: '' }); store.set(DEMO_KEY, raw); return { ok: true, draft: p.wantDraft ? MOCK.draft(p) : null };
      case 'memo': raw.worksheets.push({ at, table: p.table, summary: p.summary, pitch: p.pitch }); break;
      case 'vote': if (raw.vote !== 'open') throw new Error('지금은 투표 시간이 아니에요.'); if (p.choice === p.voterTable) throw new Error('내 탁자에는 투표할 수 없어요.'); raw.votes.push({ at, voterTable: p.voterTable, choice: p.choice, device: deviceId }); break;
      case 'note': raw.notes.push({ at, table: p.table, rating: p.rating || 0, text: p.text, name: p.name, device: deviceId }); break;
      case 'admin': if (p.vote) raw.vote = p.vote; if (p.publish != null && raw.synthesis) raw.synthesis.published = p.publish; if (p.synthesisText != null) raw.synthesis = Object.assign(raw.synthesis || {}, { text: p.synthesisText, at }); break;
      case 'ai_question': return { ok: true, ...MOCK.question(p) };
      case 'ai_synthesis': raw.synthesis = { text: MOCK.synthesis().text, at, published: false }; store.set(DEMO_KEY, raw); return { ok: true, synthesis: raw.synthesis };
      case 'report': return { ok: true, url: '', note: '서버를 연결하면 구글 문서로 만들어져요.' };
    }
    store.set(DEMO_KEY, raw);
    return { ok: true };
  }

  const SAMPLE_PEOPLE = [
    { name: '예시 참여자 A', company: '예시전자', title: 'AX추진팀장', phone: '010-0000-0001', email: 'a@example.com', role: '전사 AX 추진 TF 리드', interests: '환경, 변화관리' },
    { name: '예시 참여자 B', company: '예시금융', title: 'HR혁신파트장', phone: '010-0000-0002', email: 'b@example.com', role: 'HR 부문 AI 도입 총괄', interests: '변화관리' },
    { name: '예시 참여자 C', company: '예시커머스', title: '데이터플랫폼 리드', phone: '010-0000-0003', email: 'c@example.com', role: '사내 에이전트 운영과 거버넌스', interests: '프로세스, 환경' }
  ];
  const api = {
    async directory(key) {
      if (DEMO) { await new Promise(r => setTimeout(r, 400)); if (!key) throw new Error('참여자 열쇠를 넣어 주세요.'); return { ok: true, people: SAMPLE_PEOPLE }; }
      const r = await fetch(`${ENDPOINT}?action=directory&key=${encodeURIComponent(key)}&t=${Date.now()}`);
      if (!r.ok) throw new Error('기록 서버에 닿지 않았어요.');
      const j = await r.json(); if (!j.ok) throw new Error(j.error || '명함첩을 열지 못했어요.'); return j;
    },
    async state(adminKey) { return DEMO ? aggregate(demoRaw(), !!adminKey) : http('GET', null, adminKey ? `&key=${encodeURIComponent(adminKey)}` : ''); },
    async send(action, data = {}) { const p = Object.assign({ action, device: deviceId }, data); return DEMO ? demoSend(p) : http('POST', p); }
  };

  /* 같은 브라우저의 다른 탭에서 데모 기록이 바뀌면 바로 반영 */
  const listeners = new Set();
  function poll(fn, ms, adminKey) {
    let stop = false, timer;
    const tick = async () => {
      if (stop) return;
      try { fn(await api.state(typeof adminKey === 'function' ? adminKey() : adminKey), null); } catch (e) { fn(null, e); }
      timer = setTimeout(tick, document.hidden ? ms * 3 : ms);
    };
    tick();
    const wake = () => { clearTimeout(timer); tick(); };
    listeners.add(wake);
    return { refresh: wake, stop() { stop = true; clearTimeout(timer); listeners.delete(wake); } };
  }
  addEventListener('storage', e => { if (e.key === DEMO_KEY) listeners.forEach(f => f()); });


  /* 아주 작은 마크다운: ## / ### 제목, - 목록, **굵게**, 빈 줄로 문단 */
  function md(src) {
    const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const out = []; let list = null;
    String(src || '').split(/\r?\n/).forEach(line => {
      const l = line.trim();
      if (/^[-*]\s+/.test(l)) { if (!list) { list = []; } list.push(`<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`); return; }
      if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; }
      if (!l) return;
      if (l.startsWith('### ')) out.push(`<h3>${inline(l.slice(4))}</h3>`);
      else if (l.startsWith('## ')) out.push(`<h2>${inline(l.slice(3))}</h2>`);
      else if (l.startsWith('# ')) out.push(`<h2>${inline(l.slice(2))}</h2>`);
      else out.push(`<p>${inline(l)}</p>`);
    });
    if (list) out.push(`<ul>${list.join('')}</ul>`);
    return out.join('');
  }


  /* 등불: 포인터를 따라 아치 속 유화를 비춰요 (본 페이지 첫 화면과 같은 장치) */
  function lampify(el) {
    if (!el) return;
    let at = 0, x = .5, y = .34;
    function place(nx, ny) {
      x = Math.min(1, Math.max(0, nx)); y = Math.min(1, Math.max(0, ny));
      el.style.setProperty('--mx', (x * 100).toFixed(2) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(2) + '%');
      el.style.setProperty('--r', (el.clientWidth * .36).toFixed(0) + 'px');
    }
    const from = e => { const r = el.getBoundingClientRect(); at = performance.now(); place((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
    el.addEventListener('pointermove', from); el.addEventListener('pointerdown', from);
    addEventListener('resize', () => place(x, y));
    if (reduceMotion) { place(.5, .34); return; }
    (function wander(t) {
      if (!at || performance.now() - at > 5000) { const s = t / 1000; place(.5 + .26 * Math.sin(s * .5), .4 + .26 * Math.sin(s * .31 + 1.1)); }
      requestAnimationFrame(wander);
    })(0);
  }

  function lamps(n, max = 5) { return Array.from({ length: max }, (_, i) => `<i class="lamp${i < Math.round(n) ? ' on' : ''}" aria-hidden="true"></i>`).join(''); }
  function demoBanner() {
    if (!DEMO) return;
    const b = document.createElement('div'); b.className = 'demo-banner';
    b.innerHTML = '<b>미리보기</b> 기록 서버를 연결하기 전이라, 기록은 이 브라우저에만 남아요.';
    document.body.prepend(b);
  }

  window.AXL = { CFG, DEMO, TABLES, deviceId, esc, $, $$, store, toast, compressImage, DECKS, CARDS, PROGRAM, toMin, nowInfo, api, poll, lamps, md, lampify, demoBanner, reduceMotion };
})();
