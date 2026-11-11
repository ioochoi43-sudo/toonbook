# 정적 점검: 함수 중복, 인라인 핸들러가 부르는 함수, getElementById로 찾는 id, 중복 id
# 사용법: python3 static.py ../index.html [스크립트를_꺼내_쓸_경로]
import re, sys, collections
h = open(sys.argv[1], encoding='utf-8').read()
scripts = re.findall(r'<script>(.*?)</script>', h, re.S)
js = max(scripts, key=len)
if len(sys.argv) > 2:
    open(sys.argv[2], 'w', encoding='utf-8').write(js)
html_only = h.replace(js, '')
# 1) 함수 정의 / 중복
defs = re.findall(r'^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', js, re.M)
cnt = collections.Counter(defs)
# 중복은 맨 바깥 함수만 본다 (다른 함수 안의 같은 이름 도우미는 괜찮다)
top = collections.Counter(re.findall(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', js, re.M))
dups = {k: v for k, v in top.items() if v > 1}
print('functions:', len(cnt), '| duplicates:', dups or 'none')
defined = set(cnt) | set(re.findall(r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>', js))
# 2) 인라인 핸들러가 부르는 함수 (HTML + JS 템플릿 안)
handlers = re.findall(r'\bon(?:click|change|input|submit|keydown|keyup|blur|focus|error|load|touchstart|touchend)\s*=\s*"([^"]*)"', h)
called = set()
for code in handlers:
    for name in re.findall(r'(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(', code):
        called.add(name)
builtin = {'if','for','while','return','event','parseInt','parseFloat','Number','String','alert','confirm','setTimeout','encodeURIComponent','function','switch','catch'}
missing = sorted(n for n in called if n not in defined and n not in builtin)
print('inline handlers:', len(handlers), '| called fns:', len(called), '| undefined:', missing or 'none')
# 3) getElementById / querySelector('#id')
ids_html = set(re.findall(r'\bid\s*=\s*"([^"${}]+)"', h)) | set(re.findall(r"\bid\s*=\s*'([^'${}]+)'", h))
used = set(re.findall(r"getElementById\(\s*'([^'${}]+)'\s*\)", js)) | set(re.findall(r'getElementById\(\s*"([^"${}]+)"\s*\)', js))
miss_ids = sorted(i for i in used if i not in ids_html)
print('getElementById ids:', len(used), '| not in HTML:', miss_ids or 'none')
dyn = sorted(set(re.findall(r"getElementById\(\s*([^'\")][^)]*)\)", js)))
print('dynamic getElementById exprs:', dyn[:20])
# 4) 중복 id (정적 HTML)
static_ids = re.findall(r'\bid\s*=\s*"([^"${}]+)"', html_only)
dupid = [k for k, v in collections.Counter(static_ids).items() if v > 1]
print('duplicate static ids:', dupid or 'none')
bad = bool(dups or missing or miss_ids or dupid)
print('STATIC', 'FAIL' if bad else 'OK')
sys.exit(1 if bad else 0)
