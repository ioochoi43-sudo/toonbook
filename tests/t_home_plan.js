// 홈의 "오늘 계획" 카드: 표시, 체크·취소, 숨김, 완독, 날짜 바뀜
const { open, consistency, ok, eq, summary } = require('./harness');
const LIB = require('./lib');
const NOW = new Date(2026, 10, 11, 10, 0, 0).getTime(); // 2026-11-11 (수) 10:00
const opts = { now: NOW };
const app = open(null, opts); const { ev, w } = app; ev(LIB);
const T = w.T; const chk = l => consistency(app, l, opts).forEach(p => ok(false, p));
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  eq(ev('today()'), '2026-11-11', '오늘 날짜');
  eq(T.homeHead(), '🗓 오늘 계획 아직 없어요 ›', '빈 상태 머리글');
  eq(T.home(), [], '빈 상태: 줄 없음');

  const A = T.add({ title: '화산귀환', total: 100, cur: 20 }); w.__tick(1000);
  const B = T.add({ type: 'book', title: '원피스', total: 50, cur: 40 }); w.__tick(1000);
  const W = T.add({ status: 'wishlist', title: '나혼렙', total: 10 }); w.__tick(1000);
  const P = T.add({ title: '부웹툰', parts: [80, 60], curPart: 0, curPartEp: 78 }); w.__tick(1000);
  eq([T.item(P).totalEp, T.item(P).currentEp], [140, 78], '부 웹툰 등록');
  chk('작품 4개 등록');

  // --- 오늘/내일 계획 ---
  const pA = T.plan({ date: '2026-11-11', itemId: A, eps: [21, 22, 23] }); w.__tick(1000);
  eq(T.home(), ['○ [화산귀환] 21~23화'], '오늘 계획이 홈에 뜸');
  eq(T.homeHead(), '🗓 오늘 계획 0/1 ›', '머리글 0/1');
  const pA2 = T.plan({ date: '2026-11-12', itemId: A, eps: [24, 25] }); w.__tick(1000);
  eq(T.home(), ['○ [화산귀환] 21~23화'], '내일 계획은 홈에 안 뜸');
  const pB = T.plan({ date: '2026-11-11', itemId: B, eps: [41, 42] }); w.__tick(1000);
  const pW = T.plan({ date: '2026-11-11', itemId: W, text: '정주행 시작' }); w.__tick(1000);
  const pP = T.plan({ date: '2026-11-11', itemId: P, eps: [79, 80, 81, 82] }); w.__tick(1000);
  eq(T.home(), ['○ [화산귀환] 21~23화', '○ [원피스] 41, 42권', '○ [나혼렙] 정주행 시작', '○ [부웹툰] 1부 79, 80화, 2부 1, 2화'], '홈 줄 4개 (형식: [] · 쉼표 · 물결 · 부)');
  eq(T.homeHead(), '🗓 오늘 계획 0/4 ›', '머리글 0/4');
  ev(`goTab('plan')`);
  eq(T.dayRows('2026-11-11'), T.home(), '계획 탭의 오늘과 홈이 같음');
  ev(`goTab('timeline')`);
  chk('계획 5개 추가');

  // --- 홈에서 체크: 일부만 읽음 → 남은 회차는 내일 계획으로 ---
  ev(`onPlanCheck('${pA}')`);
  ok(T.modalOpen('planCheckModal'), '체크하면 "어디까지 읽었나요?" 창');
  ev(`planCheckTap(22)`);
  ev(`confirmPlanCheck()`); w.__tick(1000);
  eq(T.home()[0], '✓ [화산귀환] 21, 22화', '홈: 체크한 줄');
  eq(T.homeHead(), '🗓 오늘 계획 1/4 ›', '머리글 1/4');
  eq(T.item(A).currentEp, 22, '진행 기록 22화');
  eq(ev(`findPlan('${pA2}').eps`), [23, 24, 25], '못 읽은 23화가 내일 계획 앞에');
  chk('홈에서 체크');

  // --- 홈에서 체크 취소 ---
  ev(`onPlanCheck('${pA}')`);
  ok(T.modalOpen('confirmModal'), '체크 취소 확인창');
  T.confirmYes(); w.__tick(1000);
  eq(T.home()[0], '○ [화산귀환] 21~23화', '홈: 체크 취소 후 원래대로');
  eq(T.item(A).currentEp, 20, '진행 기록 20화로 복구');
  eq(ev(`findPlan('${pA2}').eps`), [24, 25], '내일 계획 복구');
  eq(T.homeHead(), '🗓 오늘 계획 0/4 ›', '머리글 0/4');
  chk('홈에서 체크 취소');

  // --- 메모만 있는 계획 ---
  ev(`onPlanCheck('${pW}')`);
  ok(!T.modalOpen('planCheckModal'), '메모만 있는 계획은 바로 체크');
  eq(T.home()[2], '✓ [나혼렙] 정주행 시작', '홈: 메모 계획 체크');
  eq(T.item(W).status, 'wishlist', '메모만 체크하면 상태는 그대로');
  ev(`onPlanCheck('${pW}')`);
  eq(T.home()[2], '○ [나혼렙] 정주행 시작', '홈: 메모 계획 체크 취소');
  chk('메모 계획');

  // --- 숨긴 작품의 계획은 홈에 안 뜸 ---
  ev(`hideItem('${B}')`); await sleep(260);
  ok(T.modalOpen('pinSetupModal'), '비밀번호가 없으면 설정 창이 먼저');
  w.document.getElementById('pinNew').value = '1234'; w.document.getElementById('pinNew2').value = '1234';
  await ev(`savePin()`); await sleep(20);
  ok(T.item(B).hidden === true, '원피스 숨김');
  eq(T.home(), ['○ [화산귀환] 21~23화', '○ [나혼렙] 정주행 시작', '○ [부웹툰] 1부 79, 80화, 2부 1, 2화'], '홈: 숨긴 작품 계획 제외');
  eq(T.homeHead(), '🗓 오늘 계획 0/3 ›', '머리글에서도 제외');
  chk('숨기기');
  ev(`unhideItem('${B}')`);
  eq(T.home().length, 4, '숨김 해제하면 다시 뜸');

  // --- 부가 있는 웹툰: 부를 넘는 계획 체크 ---
  ev(`onPlanCheck('${pP}')`); ev(`confirmPlanCheck()`); w.__tick(1000);
  eq(T.home()[3], '✓ [부웹툰] 1부 79, 80화, 2부 1, 2화', '홈: 부 웹툰 체크');
  eq(T.item(P).currentEp, 82, '부 웹툰 진행 82(2부 2화)');
  chk('부 웹툰 체크');

  // --- 완독: 마지막 권까지 ---
  ev(`onPlanCheck('${pB}')`); ev(`planCheckSetUpTo && (document.getElementById('planCheckUpTo').value = '50', planCheckSetUpTo())`);
  ev(`confirmPlanCheck()`); w.__tick(1000);
  eq(T.item(B).status, 'done', '마지막 권까지 읽으면 완료');
  eq(T.item(B).endDate, '2026-11-11', '완료일 = 오늘');
  ok(/^✓ \[원피스\] 41~50권$/.test(T.home()[1]), '홈: 더 읽은 회차까지 표시', T.home()[1]);
  await sleep(400);
  ok(T.modalOpen('doneReviewModal'), '완독 후 별점·리뷰 창');
  ev(`document.getElementById('doneReviewModal').classList.remove('active'); document.body.style.overflow = ''`);
  chk('완독');
  ev(`onPlanCheck('${pB}')`); T.confirmYes(); w.__tick(1000);
  eq([T.item(B).status, T.item(B).currentEp, T.item(B).endDate], ['watching', 40, ''], '완독 체크 취소 → 읽는 중·40권');
  chk('완독 취소');

  // --- 읽고 싶은 작품에 회차 계획 → 체크하면 읽는 중 ---
  const pW2 = T.plan({ date: '2026-11-11', itemId: W, eps: [1, 2] }); w.__tick(1000);
  ev(`onPlanCheck('${pW2}')`); ev(`confirmPlanCheck()`); w.__tick(1000);
  eq([T.item(W).status, T.item(W).currentEp, T.item(W).startDate], ['watching', 2, '2026-11-11'], '읽고 싶은 → 읽는 중');
  ok(w.document.getElementById('shelf').textContent.includes('나혼렙'), '책장에 나타남');
  chk('위시 체크');

  // --- 홈에서 계획 날짜를 내일로 바꾸면 홈에서 사라짐 ---
  const n0 = T.home().length;
  ev(`openPlanEditor('2026-11-11', '${pA}')`);
  w.document.getElementById('planDate').value = '2026-11-13';
  ev(`savePlan()`); w.__tick(1000);
  eq(T.home().length, n0 - 1, '날짜를 옮기면 홈에서 빠짐');
  ok(!T.home().some(l => l.includes('화산귀환')), '화산귀환 줄 없음');
  chk('계획 날짜 변경');

  // --- 홈에서 계획 삭제 ---
  ev(`openPlanEditor('2026-11-11', '${pW}')`); ev(`deletePlan()`); T.confirmYes(); w.__tick(1000);
  ok(!T.home().some(l => l.includes('정주행 시작')), '삭제한 계획이 홈에서 사라짐');
  chk('계획 삭제');

  // --- 작품을 지우면 제목은 남고, 체크는 계획에만 ---
  const pA3 = T.plan({ date: '2026-11-11', itemId: A, eps: [21] }); w.__tick(1000);
  ev(`confirmDelete('${A}')`); T.confirmYes(); w.__tick(1000);
  ok(T.home().includes('○ [화산귀환] 21화'), '지운 작품의 계획: 제목 유지', T.home());
  ok(w.document.querySelector('#homePlan').textContent.includes('삭제된 작품이에요'), '"삭제된 작품이에요" 표시');
  ev(`onPlanCheck('${pA3}')`);
  ok(T.home().includes('✓ [화산귀환] 21화'), '지운 작품 계획 체크');
  chk('작품 삭제 후 계획');

  // --- + 추가 버튼: 오늘 날짜로 열림 ---
  w.document.querySelector('#homePlan .plan-add-btn').click();
  ok(T.modalOpen('planEditorModal'), '홈 + 추가 → 계획 추가 창');
  eq(w.document.getElementById('planDate').value, '2026-11-11', '날짜 = 오늘');
  ev(`closePlanEditor()`);

  // --- 머리글을 누르면 계획 탭(오늘) ---
  ev(`planShift(3)`);
  w.document.querySelector('#homePlan .home-plan-title').click();
  eq(ev('state.currentTab'), 'plan', '머리글 → 계획 탭');
  ok(!!w.document.querySelector('#planBody .plan-day.today'), '계획 탭이 오늘이 있는 주를 보여줌');
  ev(`goTab('timeline')`);

  // --- 다른 창에서 바뀐 내용 ---
  const before = T.home();
  // --- 날짜가 바뀌면(다음 날 다시 열기) 홈이 새 날짜 기준으로 ---
  w.__setNow(new Date(2026, 10, 12, 8, 30, 0).getTime()); // 다음 날 아침 8:30 (9시 전)
  eq(ev('today()'), '2026-11-12', '다음 날 8:30에도 오늘 = 12일');
  eq(T.home(), before, '아직 다시 그리기 전');
  w.document.dispatchEvent(new w.Event('visibilitychange'));
  eq(T.home(), ['○ [화산귀환] 24, 25화'], '날짜가 바뀌면 홈이 새 "오늘" 계획으로');
  eq(w.document.getElementById('dateLabel').textContent, '2026.11.12', '상단 날짜도 갱신');

  // --- 새로 연 창에서도 같은 홈 ---
  const app2 = open(app.dump(), { now: new Date(2026, 10, 12, 8, 30, 0).getTime() }); app2.ev(LIB);
  eq(app2.w.T.home(), ['○ [화산귀환] 24, 25화'], '새로 연 창의 홈');
  ok(app2.errors.length === 0, '새 창 오류 없음', app2.errors);
  ok(app.errors.length === 0, '실행 중 오류 없음', app.errors);
  process.exit(summary() ? 1 : 0);
})();
