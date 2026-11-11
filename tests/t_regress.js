// 꼭 다시 확인할 것: 체크 취소, 국가 필터, 음수, 예전 데이터, 백업 내보내기·가져오기, 복사 형식
const { open, consistency, ok, eq, summary } = require('./harness');
const LIB = require('./lib');
const NOW = new Date(2026, 10, 11, 8, 30, 0).getTime(); // 아침 8:30 (9시 전: 날짜가 하루 밀리던 시간대)
const opts = { now: NOW };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function fresh(storage, extra) { const app = open(storage || null, Object.assign({}, opts, extra || {})); app.ev(LIB); return app; }
(async () => {
  // R1: 체크 취소 때 겹친 회차가 있던 다음 계획이 사라지지 않아야 함
  { const app = fresh(); const { ev, w } = app; const T = w.T;
    const A = T.add({ title: '겹침', total: 30, cur: 4 }); w.__tick(1000);
    const p1 = T.plan({ date: '2026-11-11', itemId: A, eps: [5, 6, 7] }); w.__tick(1000);
    const p2 = T.plan({ date: '2026-11-12', itemId: A, eps: [6] }); w.__tick(1000);
    ev(`onPlanCheck('${p1}')`); ev(`planCheckTap(6)`); ev(`confirmPlanCheck()`); w.__tick(1000);
    eq(ev(`findPlan('${p2}').eps`), [7], 'R1: 6화는 읽어서 빠지고 7화를 넘겨받음');
    ev(`onPlanCheck('${p1}')`); T.confirmYes(); w.__tick(1000);
    ok(!!ev(`findPlan('${p2}')`), 'R1: 체크 취소 후 내일 계획이 남아 있음');
    eq(ev(`(findPlan('${p2}') || {}).eps`), [6], 'R1: 내일 계획이 6화로 복구');
    eq([T.item(A).currentEp, ev(`findPlan('${p1}').eps`)], [4, [5, 6, 7]], 'R1: 진행·오늘 계획 복구');
    consistency(app, 'R1', opts).forEach(x => ok(false, x));
  }
  // R2: 국가 필터에 갇히지 않기 + 숨긴 작품의 국가는 필터에 안 나옴
  { const app = fresh({ toonArchive_pinHash: 'x' }); const { ev, w } = app; const T = w.T; const d = w.document;
    const A = T.add({ title: '일본만화', total: 5 }); w.__tick(1000); const B = T.add({ title: '한국웹툰', total: 5 }); w.__tick(1000);
    const c = JSON.parse(ev(`JSON.stringify(state.countries.map(c => [c.id, c.name]))`)); const jp = c[0][0];
    ev(`T.item('${A}').country = '${jp}'; save(true); render()`);
    ev(`goTab('all')`); d.querySelector(`#countryFilter .pill[data-country="${jp}"]`).click();
    eq(d.querySelectorAll('#allList .card').length, 1, 'R2: 국가 필터 적용');
    ev(`confirmDelete('${A}')`); T.confirmYes();
    eq(ev('state.countryFilter'), 'all', 'R2: 그 국가 작품이 없어지면 필터가 전체로');
    eq(d.querySelectorAll('#allList .card').length, 1, 'R2: 남은 작품이 보임');
    ev(`T.item('${B}').country = '${jp}'; save(true); render()`);
    ok(!!d.querySelector(`#countryFilter .pill[data-country="${jp}"]`), 'R2: 국가 버튼 있음');
    ev(`hideItem('${B}')`);
    ok(!d.querySelector(`#countryFilter .pill[data-country="${jp}"]`), 'R2: 숨긴 작품만 쓰는 국가는 필터에 안 나옴');
  }
  // R3: 음수 입력
  { const app = fresh(); const { ev, w } = app; const T = w.T; const d = w.document;
    const A = T.add({ title: '음수', total: -5, cur: -3 });
    eq([T.item(A).totalEp, T.item(A).currentEp], [0, 0], 'R3: 음수는 0으로');
    ev(`openDetail('${A}')`); d.getElementById('quickCurEp').value = '-7'; ev(`updateCurrentEp('${A}')`);
    eq(T.item(A).currentEp, 0, 'R3: 빠른 입력 음수도 0으로');
  }
  // R4: 수정 중이던 노트가 다른 창에서 지워졌어도 쓴 내용은 남김
  { const app = fresh(); const { ev, w } = app; const T = w.T; const d = w.document;
    const A = T.add({ title: '노트', total: 5 }); w.__tick(1000);
    ev(`openNoteModal('${A}', null)`); d.getElementById('noteTitleInput').value = '원래'; d.getElementById('noteContent').value = '원래 내용'; ev(`saveNote()`); w.__tick(1000);
    const nid = T.item(A).notes[0].id;
    ev(`openNoteModal('${A}', '${nid}')`); d.getElementById('noteContent').value = '고쳐 쓴 내용';
    ev(`T.item('${A}').notes = []`); // 다른 창에서 지워진 상황
    ev(`saveNote()`); w.__tick(1000);
    eq(T.item(A).notes.map(n => n.content), ['고쳐 쓴 내용'], 'R4: 쓴 내용이 새 노트로 남음');
    await sleep(150); ev(`closeDetailModal()`);
    consistency(app, 'R4', opts).forEach(x => ok(false, x));
  }
  // R5: 예전 데이터(단일 ott, note 문자열, 빠진 필드, 깨진 항목) 불러오기
  { const old = { items: [
      { id: 'a', type: 'webtoon', status: 'watching', title: '옛웹툰', ott: 'naver', note: '옛 노트', totalEp: 10, currentEp: 4, createdAt: 1, updatedAt: 2 },
      { id: 'b', type: 'book', status: 'done', title: '옛책', totalEp: 3, currentEp: 3 },
      null, { title: 'id 없음' }, 'x'
    ], plans: [{ id: 'p1', date: '2026-11-11', itemId: 'a', titleSnap: '옛웹툰', typeSnap: 'webtoon', eps: [5, 6], text: '', done: false }, { id: 'bad' }, null], savedAt: 5 };
    const app = fresh({ toonArchive_v1: JSON.stringify(old) }); const { ev, w } = app; const T = w.T;
    ok(app.errors.length === 0, 'R5: 오류 없이 열림', app.errors);
    eq(ev('state.items.length'), 2, 'R5: 깨진 항목만 걸러냄');
    const a = T.item('a');
    eq([a.otts, a.ott, a.notes.map(n => n.content), a.note, a.epSeqMode, a.epWatched], [['naver'], 'naver', ['옛 노트'], undefined, true, []], 'R5: 예전 형식 변환');
    eq(T.home(), ['○ [옛웹툰] 5, 6화'], 'R5: 계획도 살아서 홈에 뜸');
    eq(ev('state.plans.length'), 1, 'R5: 깨진 계획은 걸러냄');
    eq(ev('today()'), '2026-11-11', 'R5: 아침 8:30에도 오늘 날짜가 맞음');
  }
  // R6: 백업 내보내기 → 새 기기에서 가져오기 (계획·숨김 포함)
  { const app = fresh({ toonArchive_pinHash: 'x' }); const { ev, w } = app; const T = w.T;
    const A = T.add({ title: '백업A', total: 20, cur: 3, otts: ['naver', 'kakaopage'] }); w.__tick(1000);
    const B = T.add({ type: 'book', title: '백업B', total: 9, cur: 2 }); w.__tick(1000);
    const P = T.add({ title: '백업부', parts: [5, 5], curPart: 1, curPartEp: 2 }); w.__tick(1000);
    T.plan({ date: '2026-11-11', itemId: A, eps: [4, 5, 6] }); w.__tick(1000);
    const pb = T.plan({ date: '2026-11-11', itemId: B, eps: [3] }); w.__tick(1000);
    ev(`onPlanCheck('${pb}')`); ev(`confirmPlanCheck()`); ev(`hideItem('${P}')`);
    let blob = null; w.URL.createObjectURL = b => { blob = b; return 'blob:x'; }; w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () { this.__clicked = true; };
    let fname = ''; const origCreate = w.document.createElement.bind(w.document);
    w.document.createElement = (t) => { const el = origCreate(t); if (t === 'a') Object.defineProperty(el, 'download', { set(v) { fname = v; }, get() { return fname; } }); return el; };
    ev(`exportData()`);
    eq(fname, 'toon-archive-2026-11-11.json', 'R6: 백업 파일 이름 날짜(기기 날짜)');
    const text = await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(blob); });
    const data = JSON.parse(text);
    eq([data.items.length, data.plans.length, data.items.filter(i => i.hidden).length], [3, 2, 1], 'R6: 백업에 작품·계획·숨긴 작품 포함');
    const app2 = fresh(); const w2 = app2.w;
    const input = w2.document.createElement('input'); Object.defineProperty(input, 'files', { value: [new w2.File([text], 'b.json')] });
    app2.ev(`window.__imp = importData`); w2.__imp({ target: input }); await sleep(80); w2.T.confirmYes(); await sleep(20);
    const core = `JSON.stringify({ items: [...state.items].sort((a, b) => a.id < b.id ? -1 : 1), plans: [...state.plans].sort((a, b) => a.id < b.id ? -1 : 1) })`;
    eq(app2.ev(core), ev(core), 'R6: 가져온 뒤 작품·계획이 원본과 같음');
    eq(w2.T.home(), ['○ [백업A] 4~6화', '✓ [백업B] 3권'], 'R6: 가져온 기기 홈의 오늘 계획');
    ok(!w2.document.getElementById('view-timeline').textContent.includes('백업부'), 'R6: 숨긴 작품은 가져와도 안 보임');
    consistency(app2, 'R6', opts).forEach(x => ok(false, x));
    // 같은 백업을 한 번 더 가져와도 중복되지 않음 (id 기준 병합)
    const input2 = w2.document.createElement('input'); Object.defineProperty(input2, 'files', { value: [new w2.File([text], 'b.json')] });
    w2.__imp({ target: input2 }); await sleep(80); w2.T.confirmYes(); await sleep(20);
    eq([app2.ev('state.items.length'), app2.ev('state.plans.length')], [3, 2], 'R6: 두 번 가져와도 중복 없음');
  }
  // R7: 복사 형식
  { const app = fresh(); const { ev, w } = app; const T = w.T;
    const A = T.add({ title: '화산귀환', parts: [80, 60], curPart: 1, curPartEp: 5 }); w.__tick(1000);
    const B = T.add({ type: 'book', title: '원피스', total: 100, cur: 40 }); w.__tick(1000);
    eq([ev(`buildCopyText(T.item('${A}'), true)`), ev(`buildCopyText(T.item('${B}'), true)`), ev(`buildCopyText(T.item('${B}'), false)`)], ['[화산귀환] 2부 6화~', '[원피스] 41권~', '[원피스]'], 'R7: 진행 복사');
    eq(['21', '21, 22', '21~25', '1~3, 5, 6, 8'], [ev(`rangesText([21])`), ev(`rangesText([21,22])`), ev(`rangesText([21,22,23,24,25])`), ev(`rangesText([1,2,3,5,6,8])`)], 'R7: 회차 범위');
    const p1 = T.plan({ date: '2026-11-09', itemId: A, eps: [79, 80, 81, 82] }); w.__tick(1000);
    const p2 = T.plan({ date: '2026-11-10', itemId: B, eps: [41, 42] }); w.__tick(1000);
    T.plan({ date: '2026-11-11', itemId: B, eps: [43] }); w.__tick(1000);
    ev(`copyPlanItem('${p1}')`); ev(`copyPlanItem('${p2}')`);
    eq(w.__clip.slice(-2), ['[화산귀환] 1부 79, 80화, 2부 1, 2화', '[원피스] 41, 42권'], 'R7: 계획 줄 복사');
    ev(`goTab('plan')`); ev(`copyPlanSummary(planSummaryCache.findIndex(g => g.line.includes('원피스')))`);
    eq(w.__clip.slice(-1), ['[원피스] 41~43권'], 'R7: 이 주 작품별 합치기 복사');
    ok(!w.__clip.join('').match(/[〈〉《》]/), 'R7: 〈〉《》 없음');
  }
  process.exit(summary() ? 1 : 0);
})();
