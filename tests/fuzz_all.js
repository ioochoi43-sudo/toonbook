// 넓은 무작위 점검: 작품 수정(화수·부·유형·상태), 모드 전환, 숨김, 삭제, 완료, 계획 이동 등을 섞어서
// 오류가 없는지, 기록이 어긋나지 않는지, 저장이 맞는지 본다
const { open, consistency, ok, summary } = require('./harness');
const LIB = require('./lib');
const NOW = new Date(2026, 10, 11, 10, 0, 0).getTime();
const opts = { now: NOW };
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const INV = `(() => { const bad = [];
  state.items.forEach(i => {
    if (i.epSeqMode === false && (i.currentEp || 0) !== contiguousCount(new Set(sortedUniq(i.epWatched)))) bad.push('개별 모드 현재 회차 불일치: ' + i.title + ' cur=' + i.currentEp + ' eps=' + sortedUniq(i.epWatched).join(','));
    if (i.totalEp > 0 && (i.currentEp || 0) > i.totalEp) bad.push('현재 회차가 전체보다 큼: ' + i.title + ' ' + i.currentEp + '/' + i.totalEp);
    if (i.totalEp > 0 && sortedUniq(i.epWatched).some(e => e > i.totalEp) && i.epSeqMode === false) bad.push('전체 화수를 넘는 체크: ' + i.title);
    if ((i.currentEp || 0) < 0 || (i.totalEp || 0) < 0) bad.push('음수 회차: ' + i.title);
    if (hasParts(i) && i.parts.reduce((s, p) => s + p.total, 0) !== i.totalEp) bad.push('부 합계 ≠ 전체: ' + i.title);
    if (i.type === 'book' && i.parts) bad.push('만화책에 부가 남음: ' + i.title);
  });
  state.plans.forEach(p => {
    if (!p.done && !(p.eps || []).length && !p.text) bad.push('빈 계획이 남음: ' + planLine(p) + ' ' + p.date);
  });
  // 화면: 숨긴 작품 제목이 어디에도 안 보여야 한다 (설정의 숨긴 작품 창 제외)
  const hiddenTitles = state.items.filter(i => i.hidden).map(i => i.title);
  ['view-timeline', 'view-all', 'view-plan', 'view-ott', 'view-stats', 'view-hall', 'view-calendar'].forEach(v => {
    const txt = document.getElementById(v).textContent;
    hiddenTitles.forEach(t => { if (txt.includes(t)) bad.push('숨긴 작품이 보임: ' + t + ' @' + v); });
  });
  return bad; })()`;
const FROM = parseInt(process.argv[2] || '1'), TO = parseInt(process.argv[3] || '10');
let ops = 0;
const memEq = (app) => { const st = JSON.parse(app.w.localStorage.getItem('toonArchive_v1')); return app.ev(`JSON.stringify({items: state.items, plans: state.plans})`) === JSON.stringify({ items: st.items, plans: st.plans }); };
(async () => {
for (let seed = FROM; seed <= TO; seed++) {
  const R = rng(seed * 104729 + 3); const ri = (a, b) => a + Math.floor(R() * (b - a + 1)); const pick = arr => arr[Math.floor(R() * arr.length)];
  const app = open({ toonArchive_pinHash: 'x' }, opts); const { ev, w } = app; ev(LIB); const T = w.T; const d = w.document;
  let n = 0; const names = () => JSON.parse(ev(`JSON.stringify(state.items.map(i => i.id))`));
  const mk = () => { n++; const k = R();
    if (k < 0.3) return T.add({ title: '웹툰#' + n + '#', total: ri(5, 30), cur: ri(0, 5) });
    if (k < 0.5) return T.add({ title: '부웹툰#' + n + '#', parts: [ri(3, 8), ri(3, 8)], curPart: ri(0, 1), curPartEp: ri(0, 3) });
    if (k < 0.7) return T.add({ title: '연재#' + n + '#', cur: ri(0, 8) });
    if (k < 0.9) return T.add({ type: 'book', title: '책#' + n + '#', total: ri(3, 15), cur: ri(0, 3) });
    return T.add({ status: 'wishlist', title: '위시#' + n + '#', total: ri(3, 10) }); };
  for (let i = 0; i < 4; i++) { mk(); w.__tick(1000); }
  const days = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
  const fail = (msg) => ok(false, `seed ${seed}: ${msg}`);
  const closeAll = () => ev(`document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active')); closeConfirm(); planEdit = null; planCheck = null; document.body.style.overflow = ''`);
  for (let step = 0; step < 50; step++) {
    const ids = names(); if (!ids.length) { mk(); continue; }
    const id = pick(ids); const it = T.item(id); const op = R(); ops++; let what = '';
    try {
      if (op < 0.08) { what = '추가'; mk(); }
      else if (op < 0.22) { what = '계획 추가'; const base = ev(`contiguousCount(seenSet(T.item('${id}')))`); const lim = it.totalEp > 0 ? it.totalEp : base + 12;
        const from = ri(1, Math.max(1, Math.min(lim, base + 4))); const eps = []; for (let g = from; g < from + ri(1, 4) && g <= lim; g++) eps.push(g);
        if (!it.hidden) T.plan({ date: pick(days), itemId: id, eps, text: R() < 0.2 ? '메모' : '' }); closeAll(); }
      else if (op < 0.38) { what = '계획 체크/취소'; const ps = JSON.parse(ev(`JSON.stringify(state.plans.filter(planVisible).map(p => p.id))`)); if (ps.length) { const pid = pick(ps);
        ev(`onPlanCheck('${pid}')`);
        if (T.modalOpen('planCheckModal')) { const planned = JSON.parse(ev(`JSON.stringify(planCheckCtx().planned)`)); const m = R();
          if (m < 0.2) ev(`planCheckAll(false)`); else if (m < 0.6) ev(`planCheckTap(${pick(planned)})`); else if (m < 0.8) ev(`planCheckMore(${pick([1, 3, 5])})`);
          ev(`confirmPlanCheck()`); }
        else if (T.modalOpen('confirmModal')) T.confirmYes(); } closeAll(); }
      else if (op < 0.50) { what = '회차 탭'; if (it.totalEp > 0) { ev(`toggleEpisode('${id}', ${ri(1, it.totalEp)})`); } closeAll(); }
      else if (op < 0.56) { what = '모드 전환'; if (it.totalEp > 0) ev(`setEpMode('${id}', ${R() < 0.5})`); closeAll(); }
      else if (op < 0.62) { what = '빠른 입력'; if (!(it.totalEp > 0) && it.status !== 'done') { ev(`openDetail('${id}')`); d.getElementById('quickCurEp').value = String(ri(-1, 20)); ev(`updateCurrentEp('${id}')`); } closeAll(); }
      else if (op < 0.74) { what = '수정'; ev(`openAddModal('${id}')`); const k = R();
        if (k < 0.25) { what += '(전체 화수)'; if (!d.getElementById('fUseParts').checked) d.getElementById('fTotalEp').value = pick(['', '3', '10', '25', '-2']); }
        else if (k < 0.45) { what += '(현재 회차)'; if (!d.getElementById('fUseParts').checked) d.getElementById('fCurrentEp').value = String(ri(-1, 30)); else d.getElementById('fCurPartEp').value = String(ri(0, 9)); }
        else if (k < 0.6) { what += '(부 켜고 끄기)'; if (it.type === 'webtoon') { const cb = d.getElementById('fUseParts'); cb.checked = !cb.checked; ev(`togglePartsMode(${cb.checked})`);
            if (cb.checked) { ev(`while (state.formParts.length < 2) addPartRow()`); ev(`state.formParts.forEach((p, i) => onPartInput(i, 'total', '${ri(2, 9)}')); renderPartsEditor()`); } } }
        else if (k < 0.72) { what += '(유형)'; d.querySelector(`#typePicker [data-type="${it.type === 'book' ? 'webtoon' : 'book'}"]`).click(); }
        else if (k < 0.9) { what += '(상태)'; d.querySelector(`#statusPicker .status-option[data-status="${pick(['watching', 'wishlist', 'done', 'dropped'])}"]`).click(); }
        else { what += '(제목)'; d.getElementById('fTitle').value = it.title + '!'; }
        ev(`saveContent(new Event('submit'))`); closeAll(); }
      else if (op < 0.80) { what = '숨김/해제'; ev(it.hidden ? `unhideItem('${id}')` : `hideItem('${id}')`); closeAll(); }
      else if (op < 0.84) { what = '완료 표시'; ev(`markDone('${id}')`); closeAll(); }
      else if (op < 0.88) { what = '부 전체 읽음'; if (ev(`hasParts(T.item('${id}'))`)) { const r = JSON.parse(ev(`JSON.stringify(partRanges(T.item('${id}')).filter(r => r.total > 0))`)); const x = pick(r); ev(`markPartRead('${id}', ${x.start}, ${x.end})`); } closeAll(); }
      else if (op < 0.92) { what = '삭제'; ev(`confirmDelete('${id}')`); T.confirmYes(); closeAll(); }
      else if (op < 0.97) { what = '계획 날짜·메모 수정'; const all = JSON.parse(ev(`JSON.stringify(state.plans.filter(planVisible).map(p => [p.date, p.id]))`)); if (all.length) { const [dd, pid] = pick(all);
        ev(`openPlanEditor('${dd}', '${pid}')`); d.getElementById('planDate').value = pick(days); d.getElementById('planText').value = R() < 0.5 ? '' : '바꿈'; ev(`savePlan()`); } closeAll(); }
      else { what = '탭 이동'; for (const t of ['all', 'plan', 'ott', 'stats', 'hall', 'calendar', 'settings', 'timeline']) ev(`goTab('${t}')`); ev(`setPlanView('${pick(['week', 'month'])}')`); }
      w.__tick(1000);
      await new Promise(r => setTimeout(r, 0));
      JSON.parse(ev(`JSON.stringify(${INV})`)).forEach(m => fail(`step ${step} [${what}] ${m}`));
      if (!memEq(app)) fail(`step ${step} [${what}] 메모리 ≠ 저장소`);
      if (app.errors.length) { fail(`step ${step} [${what}] 오류: ` + app.errors.slice(0, 2).join(' | ').slice(0, 600)); app.errors.length = 0; }
    } catch (e) { fail(`step ${step} [${what}] 예외 ${String(e && e.stack || e).slice(0, 500)}`); closeAll(); }
  }
  consistency(app, `seed ${seed} 끝`, opts).forEach(fail);
  ok(true, 'seed ' + seed); app.close();
}
console.log(`무작위 동작 ${ops}번`);
process.exit(summary() ? 1 : 0);
})();
