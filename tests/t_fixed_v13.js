// v1.3 버그 점검에서 찾아 고친 문제들 (다시 생기지 않는지 확인)
const { open, consistency, ok, eq, summary } = require('./harness');
const LIB = require('./lib');
const NOW = new Date(2026, 10, 11, 10, 0, 0).getTime();
const opts = { now: NOW };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function fresh() { const app = open(null, opts); app.ev(LIB); return app; }
function edit(app, id, fn) { app.ev(`openAddModal('${id}')`); if (fn) fn(app.w.document); app.ev(`saveContent(new Event('submit'))`); app.w.__tick(1000); }
(async () => {
  // C1: 연재 중(전체 화수 없음) + 건너뛰어 읽어서 개별 모드가 된 작품을 수정
  { const app = fresh(); const { ev, w } = app; const T = w.T;
    const A = T.add({ title: '연재중', cur: 10 }); w.__tick(1000);
    const p = T.plan({ date: '2026-11-11', itemId: A, eps: [12, 13] }); w.__tick(1000);
    ev(`onPlanCheck('${p}')`); ev(`confirmPlanCheck()`); w.__tick(1000);
    eq([T.item(A).epSeqMode, T.seen(A).join(',')], [false, '1,2,3,4,5,6,7,8,9,10,12,13'], 'C1 준비: 건너뛰어 읽어 개별 모드');
    edit(app, A, d => { d.getElementById('fMemo').value = '메모만 수정'; });
    eq(T.seen(A).join(','), '1,2,3,4,5,6,7,8,9,10,12,13', 'C1: 메모만 고쳤는데 읽은 회차가 그대로여야 함');
    ev(`onPlanCheck('${p}')`); T.confirmYes(); w.__tick(1000);
    eq([T.item(A).currentEp, T.seen(A).join(',')], [10, '1,2,3,4,5,6,7,8,9,10'], 'C1: 체크 취소 후 10화까지로 복구');
    consistency(app, 'C1', opts).forEach(x => ok(false, x));
  }
  // C2: 개별 모드 작품을 수정 화면에서 현재 회차만 바꿈
  { const app = fresh(); const { ev, w } = app; const T = w.T;
    const A = T.add({ title: '개별', total: 20, cur: 3 }); w.__tick(1000);
    ev(`setEpMode('${A}', false)`); ev(`toggleEpisode('${A}', 6)`); ev(`closeDetailModal()`);
    eq([T.item(A).currentEp, T.seen(A).join(',')], [3, '1,2,3,6'], 'C2 준비');
    edit(app, A, d => { d.getElementById('fCurrentEp').value = '8'; });
    const it = T.item(A);
    ok(it.currentEp === ev(`contiguousCount(seenSet(T.item('${A}')))`), 'C2: 현재 회차와 체크 기록이 서로 맞아야 함', { currentEp: it.currentEp, seen: T.seen(A) });
  }
  // C3: 연재 중 + 개별 모드에서 "업데이트"(현재 화 빠른 입력)
  { const app = fresh(); const { ev, w } = app; const T = w.T;
    const A = T.add({ title: '연재중2', cur: 10 }); w.__tick(1000);
    const p = T.plan({ date: '2026-11-11', itemId: A, eps: [12] }); w.__tick(1000);
    ev(`onPlanCheck('${p}')`); ev(`confirmPlanCheck()`); w.__tick(1000);
    ev(`openDetail('${A}')`); w.document.getElementById('quickCurEp').value = '15'; ev(`updateCurrentEp('${A}')`);
    const it = T.item(A);
    ok(it.currentEp === ev(`contiguousCount(seenSet(T.item('${A}')))`), 'C3: 빠른 입력 뒤 현재 회차와 체크 기록이 맞아야 함', { currentEp: it.currentEp, seen: T.seen(A) });
  }
  // C4: 아주 예전 형식(note 문자열, 단일 ott)의 백업 가져오기
  { const app = fresh(); const { ev, w } = app; const T = w.T;
    const backup = { items: [{ id: 'old1', type: 'webtoon', status: 'watching', title: '옛날', ott: 'naver', note: '예전 노트 내용', totalEp: 10, currentEp: 3, createdAt: 1, updatedAt: 2 }] };
    const file = new w.File([JSON.stringify(backup)], 'b.json', { type: 'application/json' });
    const input = w.document.createElement('input'); Object.defineProperty(input, 'files', { value: [file] });
    ev(`window.__imp = importData`); w.__imp({ target: input }); await sleep(80);
    ok(T.modalOpen('confirmModal'), 'C4: 가져오기 확인창'); T.confirmYes(); await sleep(20);
    const it = T.item('old1');
    ok((it.notes || []).some(n => n.content === '예전 노트 내용'), 'C4: 예전 노트가 노트 목록으로 옮겨져야 함');
    const app2 = open(app.dump(), opts); app2.ev(LIB);
    ok((app2.w.T.item('old1').notes || []).some(n => n.content === '예전 노트 내용'), 'C4: 다시 열어도 예전 노트가 보여야 함');
    consistency(app, 'C4', opts).forEach(x => ok(false, x));
  }
  // C5: 상세 화면을 열기만 해도 메모리와 저장소가 달라지는지 (노트 순서)
  { const app = fresh(); const { ev, w } = app; const T = w.T;
    const A = T.add({ title: '노트', total: 5, cur: 1 }); w.__tick(1000);
    for (const t of ['첫째', '둘째']) { ev(`openNoteModal('${A}', null)`); w.document.getElementById('noteTitleInput').value = t; w.document.getElementById('noteContent').value = t + ' 내용'; ev(`saveNote()`); w.__tick(5000); }
    ev(`openDetail('${A}')`);
    consistency(app, 'C5 상세 열기', opts).forEach(x => ok(false, x));
    ev(`closeDetailModal()`);
  }
  process.exit(summary() ? 1 : 0);
})();
