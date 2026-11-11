// 실제 브라우저(Chromium, 아이폰 크기 390×844)에서 홈의 오늘 계획 카드를 직접 눌러 보고 화면을 찍는다
// 사용법: node browser_home.js   (Playwright가 설치돼 있어야 한다. 사진은 tests/shots/ 에 저장)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const LIB = require('./lib');
const ROOT = path.join(__dirname, '..'); const OUT = path.join(__dirname, 'shots');
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.md': 'text/plain; charset=utf-8' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // GitHub Pages처럼 /toonbook/ 아래에서 열리게 한다
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/toonbook\//, '');
    if (rel === '' || rel === '/') rel = 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/toonbook/`;
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Seoul', locale: 'ko-KR', hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(base, { waitUntil: 'load' }); await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(OUT, '0-home-empty.png') });
  const icon = await p.request.get(await p.$eval('link[rel="apple-touch-icon"]', l => l.href));
  await p.evaluate(LIB);
  const ids = await p.evaluate(() => {
    const d = today();
    const A = T.add({ title: '화산귀환', total: 100, cur: 20, otts: ['naver'] });
    const B = T.add({ type: 'book', title: '원피스', total: 50, cur: 40 });
    const P = T.add({ title: '제목이 아주아주 길어서 두 줄로 넘어가는 웹툰의 제목입니다', parts: [80, 60], curPart: 0, curPartEp: 78 });
    const W = T.add({ status: 'wishlist', title: '나 혼자만 레벨업', total: 10 });
    const py = T.plan({ date: addDaysYmd(d, -1), itemId: A, eps: [21, 22, 23] });
    onPlanCheck(py); planCheckTap(21); confirmPlanCheck();           // 어제 22, 23화를 못 읽어 오늘로 넘어옴
    const pB = T.plan({ date: d, itemId: B, eps: [41, 42] });
    onPlanCheck(pB); confirmPlanCheck();
    T.plan({ date: d, itemId: P, eps: [79, 80, 81, 82] });
    T.plan({ date: d, itemId: W, text: '정주행 시작' });
    dismissBackupBanner(); goTab('timeline'); document.getElementById('toast').classList.remove('show');
    return { P };
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, '1-home.png') });
  const r = {};
  // 동그라미 → "어디까지 읽었나요?" → 확인
  await p.locator('#homePlan .plan-row').nth(2).locator('.plan-check').tap(); await p.waitForTimeout(350);
  await p.screenshot({ path: path.join(OUT, '2-home-check.png') });
  r.checkOpen = await p.evaluate(() => T.modalOpen('planCheckModal'));
  await p.locator('#planCheckConfirm').tap(); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('toast').classList.remove('show'));
  await p.screenshot({ path: path.join(OUT, '3-home-after-check.png') });
  r.head = await p.evaluate(() => T.homeHead());
  // 글자 → 계획 수정, + 추가 → 계획 추가(오늘 날짜)
  await p.locator('#homePlan .plan-row').nth(0).locator('.plan-row-text').tap(); await p.waitForTimeout(300);
  r.editTitle = await p.evaluate(() => T.modalOpen('planEditorModal') && document.getElementById('planEditorTitle').textContent);
  await p.evaluate(() => closePlanEditor());
  await p.locator('#homePlan .plan-add-btn').tap(); await p.waitForTimeout(300);
  r.addTitle = await p.evaluate(() => T.modalOpen('planEditorModal') && document.getElementById('planEditorTitle').textContent);
  r.addDateIsToday = await p.evaluate(() => document.getElementById('planDate').value === today());
  await p.evaluate(() => closePlanEditor());
  // 📋 → 복사
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await p.locator('#homePlan .plan-row').nth(0).locator('.plan-row-copy').tap(); await p.waitForTimeout(200);
  r.clip = await p.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e.message));
  // 머리글 → 계획 탭
  await p.locator('#homePlan .home-plan-title').tap(); await p.waitForTimeout(300);
  r.tab = await p.evaluate(() => state.currentTab);
  await p.screenshot({ path: path.join(OUT, '4-plan-tab.png') });
  // 모든 탭과 상세 화면을 열어 오류가 없는지
  for (const t of ['all', 'ott', 'stats', 'hall', 'calendar', 'settings', 'timeline']) { await p.evaluate(t => goTab(t), t); await p.waitForTimeout(120); }
  await p.evaluate(id => openDetail(id), ids.P); await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT, '5-detail.png') });
  await p.evaluate(() => closeDetailModal());
  r.noSideScroll = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  r.version = await p.evaluate(() => [...document.querySelectorAll('div')].map(d => d.textContent.trim()).find(t => /데이터는 브라우저에 저장됩니다$/.test(t)));
  await b.close(); server.close();
  const want = { checkOpen: true, head: '🗓 오늘 계획 2/4 ›', editTitle: '계획 수정', addTitle: '계획 추가', addDateIsToday: true, clip: '[화산귀환] 22, 23화', tab: 'plan', noSideScroll: true };
  let fail = 0;
  for (const k of Object.keys(want)) if (r[k] !== want[k]) { fail++; console.log('  ✗', k, JSON.stringify(r[k]), '≠', JSON.stringify(want[k])); }
  if (icon.status() !== 200) { fail++; console.log('  ✗ 아이콘을 불러오지 못함', icon.status()); }
  if (errs.length) { fail++; console.log('  ✗ 화면 오류:', errs); }
  console.log(`${r.version} · 사진: tests/shots/ · ${fail ? 'FAIL ' + fail : 'PASS'}`);
  process.exit(fail ? 1 : 0);
})();
