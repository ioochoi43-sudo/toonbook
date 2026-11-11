// 계획 체크 ↔ 체크 취소 무작위 점검: 바로 취소하면 체크 전과 완전히 같아야 한다
const { open, consistency, ok, eq, summary } = require('./harness');
const LIB = require('./lib');
const NOW = new Date(2026, 10, 11, 10, 0, 0).getTime();
const opts = { now: NOW };
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const SNAP = `JSON.stringify({
  items: state.items.map(i => ({ id: i.id, currentEp: i.currentEp || 0, epWatched: sortedUniq(i.epWatched), seq: i.epSeqMode !== false, status: i.status, startDate: i.startDate || '', endDate: i.endDate || '' })),
  plans: [...state.plans].sort((a, b) => a.id < b.id ? -1 : 1).map(p => ({ id: p.id, date: p.date, itemId: p.itemId, eps: sortedUniq(p.eps), text: p.text || '', done: !!p.done, carried: !!p.carried, check: p.check ? 1 : 0 }))
})`;
const INV = `(() => { const bad = [];
  state.items.forEach(i => {
    if (i.epSeqMode === false && (i.currentEp || 0) !== contiguousCount(new Set(sortedUniq(i.epWatched)))) bad.push('개별 모드 현재 회차 불일치: ' + i.title + ' cur=' + i.currentEp + ' eps=' + sortedUniq(i.epWatched).join(','));
    if (i.totalEp > 0 && (i.currentEp || 0) > i.totalEp) bad.push('현재 회차가 전체보다 큼: ' + i.title);
    if (i.totalEp > 0 && sortedUniq(i.epWatched).some(e => e > i.totalEp)) bad.push('전체 화수를 넘는 체크: ' + i.title);
    if ((i.currentEp || 0) < 0) bad.push('음수 회차: ' + i.title);
  });
  state.plans.forEach(p => {
    if (JSON.stringify(p.eps) !== JSON.stringify(sortedUniq(p.eps))) bad.push('계획 회차 정렬·중복: ' + p.id);
    if (!p.done && !(p.eps || []).length && !p.text) bad.push('빈 계획이 남음: ' + planLine(p) + ' ' + p.date);
    if (p.done && !p.check && (p.eps || []).length && planItem(p)) bad.push('회차 있는 체크인데 되돌리기 기록 없음: ' + p.id);
  });
  return bad; })()`;
let totalChecks = 0, totalOps = 0;
const FROM = parseInt(process.argv[2] || '1'), TO = parseInt(process.argv[3] || '10');
const memEq = (app) => { const st = JSON.parse(app.w.localStorage.getItem('toonArchive_v1')); return app.ev(`JSON.stringify({items: state.items, plans: state.plans})`) === JSON.stringify({ items: st.items, plans: st.plans }); };
for (let seed = FROM; seed <= TO; seed++) {
  const R = rng(seed * 7919); const ri = (a, b) => a + Math.floor(R() * (b - a + 1)); const pick = arr => arr[Math.floor(R() * arr.length)];
  const app = open(null, opts); const { ev, w } = app; ev(LIB); const T = w.T;
  const ids = [];
  ids.push(T.add({ title: '순차', total: 30, cur: ri(0, 12) })); w.__tick(1000);
  ids.push(T.add({ title: '부', parts: [10, 8, 12], curPart: 0, curPartEp: ri(0, 9) })); w.__tick(1000);
  ids.push(T.add({ title: '연재', cur: ri(0, 10) })); w.__tick(1000);
  ids.push(T.add({ type: 'book', title: '책', total: 12, cur: ri(0, 6) })); w.__tick(1000);
  ids.push(T.add({ status: 'wishlist', title: '위시', total: 8 })); w.__tick(1000);
  if (R() < 0.5) { ev(`setEpMode('${ids[0]}', false)`); ev(`closeDetailModal()`); }
  const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'];
  const fail = (msg) => ok(false, `seed ${seed}: ${msg}`);
  for (let step = 0; step < 40; step++) {
    const op = R(); totalOps++;
    try {
      if (op < 0.35) { // 계획 추가
        const id = pick(ids); const it = T.item(id); const base = ev(`contiguousCount(seenSet(T.item('${id}')))`);
        const lim = it.totalEp > 0 ? it.totalEp : base + 15; const from = ri(Math.max(1, base - 1), Math.min(lim, base + 6)); const n = ri(1, 5);
        const eps = []; for (let g = from; g < from + n && g <= lim; g++) if (R() < 0.85) eps.push(g);
        T.plan({ date: pick(days), itemId: id, eps, text: R() < 0.2 ? '메모' : '' });
      } else if (op < 0.70) { // 체크 (무작위로 고르고, 가끔 더 읽음) → 바로 취소해서 원래대로인지
        const undone = JSON.parse(ev(`JSON.stringify(state.plans.filter(p => !p.done && planVisible(p)).map(p => p.id))`));
        if (!undone.length) continue;
        const pid = pick(undone); const before = ev(SNAP);
        ev(`onPlanCheck('${pid}')`);
        if (T.modalOpen('planCheckModal')) {
          const planned = JSON.parse(ev(`JSON.stringify(planCheckCtx().planned)`)); const mode = R();
          if (mode < 0.25) ev(`planCheckAll(false)`);
          else if (mode < 0.6) ev(`planCheckTap(${pick(planned)})`);
          else if (mode < 0.8) ev(`planCheckMore(${pick([1, 3, 5])})`);
          if (R() < 0.3) ev(`planCheckTap(${pick(planned)})`);
          ev(`confirmPlanCheck()`);
          ev(`document.getElementById('doneReviewModal').classList.remove('active')`);
        }
        w.__tick(1000); totalChecks++;
        if (!memEq(app)) fail(`step ${step}: 체크 후 메모리 ≠ 저장소`);
        JSON.parse(ev(`JSON.stringify(${INV})`)).forEach(fail);
        if (R() < 0.6) { // 바로 취소
          ev(`onPlanCheck('${pid}')`); if (T.modalOpen('confirmModal')) T.confirmYes(); w.__tick(1000);
          const after = ev(SNAP);
          if (after !== before) {
            const A = JSON.parse(before), B = JSON.parse(after); const d = [];
            A.items.forEach((x, i) => { if (JSON.stringify(x) !== JSON.stringify(B.items[i])) d.push('작품 전 ' + JSON.stringify(x) + ' / 후 ' + JSON.stringify(B.items[i])); });
            const ids2 = new Set([...A.plans.map(p => p.id), ...B.plans.map(p => p.id)]);
            ids2.forEach(id => { const x = A.plans.find(p => p.id === id), y = B.plans.find(p => p.id === id); if (JSON.stringify(x) !== JSON.stringify(y)) d.push('계획 전 ' + JSON.stringify(x) + ' / 후 ' + JSON.stringify(y)); });
            fail(`step ${step}: 체크→취소 후 원래와 다름 (체크한 계획 ${pid})\n      ` + d.join('\n      '));
          }
        }
      } else if (op < 0.80) { // 예전에 체크한 계획 취소 (그 사이 다른 변화가 있었을 수 있음)
        const done = JSON.parse(ev(`JSON.stringify(state.plans.filter(p => p.done && planVisible(p)).map(p => p.id))`));
        if (!done.length) continue;
        ev(`onPlanCheck('${pick(done)}')`); if (T.modalOpen('confirmModal')) T.confirmYes();
      } else if (op < 0.90) { // 상세 화면에서 회차 직접 체크
        const id = pick(ids.slice(0, 2).concat(ids[3])); const it = T.item(id);
        ev(`toggleEpisode('${id}', ${ri(1, it.totalEp)})`); ev(`closeDetailModal()`); ev(`document.getElementById('doneReviewModal').classList.remove('active')`);
      } else if (op < 0.95) { // 계획 삭제
        const all = JSON.parse(ev(`JSON.stringify(state.plans.map(p => [p.date, p.id]))`)); if (!all.length) continue;
        const [d, pid] = pick(all); ev(`openPlanEditor('${d}', '${pid}')`); ev(`deletePlan()`); T.confirmYes();
      } else { // 작품 수정(메모만)
        const id = pick(ids); ev(`openAddModal('${id}')`); w.document.getElementById('fMemo').value = 'm' + step; ev(`saveContent(new Event('submit'))`);
      }
      w.__tick(1000);
      JSON.parse(ev(`JSON.stringify(${INV})`)).forEach(fail);
      if (!memEq(app)) fail(`step ${step}: 메모리 ≠ 저장소`);
    } catch (e) { fail(`step ${step}: 예외 ${e && e.stack || e}`); break; }
  }
  consistency(app, `seed ${seed} 끝`, opts).forEach(fail);
  if (app.errors.length) fail('오류: ' + app.errors.slice(0, 3).join(' | '));
  ok(true, 'seed ' + seed);
  app.close();
}
console.log(`무작위 동작 ${totalOps}번, 체크 ${totalChecks}번`);
process.exit(summary() ? 1 : 0);
