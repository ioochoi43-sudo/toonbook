// jsdom 실행 테스트용: index.html을 CDN 없이 열고, 페이지 안에서 코드를 실행한다
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');
// 기본은 저장소의 index.html. 다른 파일(예: 고치기 전 버전)로 돌리려면 APP_HTML=경로
const SRC = process.env.APP_HTML || path.join(__dirname, '..', 'index.html');
function html() {
  return fs.readFileSync(SRC, 'utf8')
    .replace(/<script src="[^"]*"><\/script>/g, '')
    .replace(/<link rel="(stylesheet|preconnect)"[^>]*>/g, '');
}
function open(storage, opts = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push('jsdomError: ' + e.message); });
  vc.on('error', (...a) => { const m = a.map(String).join(' '); if (!opts.quietErrors) errors.push('console.error: ' + m); });
  const dom = new JSDOM(html(), {
    url: 'https://example.github.io/toonbook/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      if (opts.now) { // 날짜 고정
        const RealDate = w.Date; let nowMs = opts.now;
        class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(nowMs); else super(...a); } static now() { return nowMs; } }
        w.Date = FakeDate; w.__setNow = (ms) => { nowMs = ms; }; w.__tick = (ms) => { nowMs += ms; };
      }
      w.scrollTo = () => {};
      w.__clip = [];
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: t => { w.__clip.push(t); return Promise.resolve(); } }, configurable: true });
      if (!w.crypto.subtle) Object.defineProperty(w.crypto, 'subtle', { value: require('crypto').webcrypto.subtle });
      w.addEventListener('error', e => errors.push('pageerror: ' + (e.error && e.error.stack || e.message)));
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
      if (opts.beforeParse) opts.beforeParse(w);
    }
  });
  const w = dom.window;
  const ev = code => w.eval(code);
  const dump = () => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; };
  return { dom, w, ev, errors, dump, close: () => w.close() };
}
// 메모리 상태 = 저장소 = 저장소로 새로 연 창 (셋 다 같은지)
const CORE = `JSON.stringify({items: state.items, plans: state.plans, templates: state.templates, ottPlatforms: state.ottPlatforms, countries: state.countries})`;
function consistency(app, label, opts = {}) {
  const mem = app.ev(CORE);
  const raw = app.w.localStorage.getItem('toonArchive_v1');
  const problems = [];
  if (!raw) { problems.push('저장소가 비어 있음'); return problems; }
  const st = JSON.parse(raw);
  const stored = JSON.stringify({ items: st.items, plans: st.plans, templates: st.templates, ottPlatforms: st.ottPlatforms, countries: st.countries });
  if (mem !== stored) problems.push(`[${label}] 메모리 ≠ 저장소`);
  const app2 = open(app.dump(), opts);
  const mem2 = app2.ev(CORE);
  if (mem2 !== mem) problems.push(`[${label}] 새로 연 창 ≠ 메모리`);
  if (app2.errors.length) problems.push(`[${label}] 새 창 오류: ${app2.errors.join(' | ')}`);
  app2.close();
  return problems;
}
let pass = 0, fail = 0; const fails = [];
function ok(cond, name, detail) { if (cond) pass++; else { fail++; fails.push(name + (detail !== undefined ? ' → ' + JSON.stringify(detail) : '')); console.log('  ✗', name, detail !== undefined ? JSON.stringify(detail) : ''); } }
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b }); }
function summary() { console.log(`\nPASS ${pass} / FAIL ${fail}`); if (fail) console.log(fails.map(f => ' - ' + f).join('\n')); return fail; }
module.exports = { open, consistency, ok, eq, summary };
