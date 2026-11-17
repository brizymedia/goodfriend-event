# -*- coding: utf-8 -*-
"""
대표님 수정 요청 반영기 — 굿프랜드유아체육연구소 & 이벤트 홈페이지

대표님이 사이트에서 ?edit=열쇠 로 고친 내용은 두 갈래로 온다.
  1) 큰길브리지 문의 메일 「굿프랜드 홈페이지 수정 요청」 — 본문 끝에 [JSON] 블록 (글 수정)
  2) 수정 파일 굿프랜드-수정요청-YYYYMMDDHHMM.json — 카톡 · 메일 첨부 (글 + 사진)

쓰는 법 (둘 다 같은 명령):
  python tools/apply_edits.py 수정파일.json
  python tools/apply_edits.py 메일본문을저장한.txt      ← 메일 글을 통째로 파일에 붙여 넣어도 JSON 을 찾아낸다

하는 일: 각 페이지 HTML 에서 원문(old innerHTML)을 찾아 새 글로 바꾸고, 사진은 같은 파일 이름으로 덮어쓴다.
못 찾은 것은 「수동 확인」으로 표시하니 그 부분만 손으로 고치면 된다. 끝나면 git diff 로 확인하고 push.

주의: 사진을 덮어써도 파일 이름이 그대로라 브라우저가 옛 사진을 계속 쓸 수 있다.
      사진이 바뀐 날은 네 HTML 의 style.css · app.js · edit.js 뒤 ?v= 를 같이 올리는 편이 안전하다.
"""
import os, re, sys, json, base64, io, html

# 윈도 명령창은 cp949 라서 「—」 같은 글자를 찍다가 멈춘다(UnicodeEncodeError).
# 반영은 다 해놓고 화면에 찍는 중에 죽으면 파일이 안 써지므로, 출력을 UTF-8 로 돌려 둔다.
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ('index.html', 'gwangyang.html', 'suncheon.html', 'yeosu.html')

def load(path):
    raw = open(path, encoding='utf-8', errors='ignore').read()
    if path.lower().endswith('.json'):
        return json.loads(raw)
    # 메일 본문 등에서 JSON 블록 찾기
    i = raw.find('{"v":1')
    if i < 0: i = raw.find('{&quot;v&quot;:1')
    if i < 0: raise SystemExit('JSON 블록({"v":1 …)을 찾지 못했습니다.')
    seg = html.unescape(raw[i:])
    depth = 0
    for k, ch in enumerate(seg):
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0: return json.loads(seg[:k + 1])
    raise SystemExit('JSON 이 중간에 끊겨 있습니다.')

def norm(s):
    s = s.replace('&nbsp;', ' ').replace('&amp;', '&')
    return re.sub(r'\s+', ' ', s).strip()

def find_all(hay, needle):
    out, i = [], 0
    while True:
        j = hay.find(needle, i)
        if j < 0: return out
        out.append(j); i = j + 1

def loose_pattern(old):
    # 공백 · 개행 차이를 무시하는 정규식
    parts = [re.escape(p) for p in re.split(r'\s+', old.strip()) if p]
    return re.compile(r'\s+'.join(parts).replace(r'\&nbsp;', r'(?:&nbsp;| )'))

def apply_text(src, t):
    old, new, occ = t['old'], t['new'], int(t.get('occ', 0))
    new = re.sub(r'<(script|style|iframe)[^>]*>.*?</\1>', '', new, flags=re.S | re.I)
    pos = find_all(src, old)
    if pos:
        k = occ if occ < len(pos) else 0
        p = pos[k]
        return src[:p] + new + src[p + len(old):], 'ok' + (' (%d번째)' % (k + 1) if len(pos) > 1 else '')
    ms = list(loose_pattern(old).finditer(src))
    if ms:
        k = occ if occ < len(ms) else 0
        m = ms[k]
        return src[:m.start()] + new + src[m.end():], 'ok(공백 차이 무시)'
    return src, None

def apply_image(item):
    src = item['src'].replace('\\', '/').lstrip('/')
    if not src.startswith('assets/img/') or '..' in src:
        return '거부: 허용되지 않은 경로 ' + src
    data = item.get('data', '')
    m = re.match(r'data:image/(\w+);base64,(.+)$', data, re.S)
    if not m: return '건너뜀(사진 데이터 없음 — 수정 파일로 받아야 함): ' + src
    raw = base64.b64decode(m.group(2))
    target = os.path.join(SITE, src)
    try:
        from PIL import Image, ImageOps
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
        if im.width > 1920: im = im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
        ext = os.path.splitext(target)[1].lower()
        os.makedirs(os.path.dirname(target), exist_ok=True)
        if ext == '.webp': im.save(target, 'WEBP', quality=82, method=6)
        elif ext in ('.jpg', '.jpeg'): im.save(target, 'JPEG', quality=86)
        elif ext == '.png': im.save(target, 'PNG')
        else: return '거부: 알 수 없는 확장자 ' + src
        return 'ok %dx%d → %s (%dKB)' % (im.width, im.height, src, os.path.getsize(target) // 1024)
    except ImportError:
        open(target, 'wb').write(raw); return 'ok(원본 그대로, PIL 없음) ' + src

def main():
    if len(sys.argv) < 2: raise SystemExit(__doc__)
    pl = load(sys.argv[1])
    print('보낸 분:', pl.get('who'), pl.get('tel'), '|', pl.get('at'))
    if pl.get('memo'): print('남긴 말:', pl['memo'])
    manual = []; wrapped = []
    for page, pg in pl.get('pages', {}).items():
        if page not in PAGES: print('!', page, '— 반영 대상이 아닌 페이지, 건너뜀'); continue
        path = os.path.join(SITE, page); s = open(path, encoding='utf-8').read(); n = 0
        for t in pg.get('texts', []):
            s2, r = apply_text(s, t)
            if r:
                s = s2; n += 1; print('  [%s] %s: %s → %s' % (page, r, strip(t['old'])[:30], strip(t['new'])[:40]))
                # 히어로 제목은 글자마다 <span class="w"> 로 쪼개야 글자별 등장 애니메이션(wordUp)이 산다.
                # 대표님이 제목을 고치면 그 껍데기가 깨지므로 여기서 짚어 준다.
                if 'class="w"' in t['old'] and 'class="w"' not in t['new']:
                    wrapped.append((page, strip(t['new'])))
            else: manual.append((page, t)); print('  [%s] 수동 확인: %s → %s' % (page, strip(t['old'])[:40], strip(t['new'])[:40]))
        if n: open(path, 'w', encoding='utf-8').write(s)
        for im in pg.get('images', []):
            try: r = apply_image(im)
            except Exception as e: r = '실패(%s): %s — 사진을 다시 받아야 합니다' % (e, im.get('src'))
            print('  [%s] 사진 %s' % (page, r))
    if manual:
        print('\n수동 확인 %d건 (원문을 못 찾음 — 페이지가 그새 바뀌었을 수 있음):' % len(manual))
        for page, t in manual: print('  -', page, '|', t['sel'], '\n     원문:', t['old'][:120], '\n     새글:', t['new'][:120])
    if wrapped:
        print('\n[손봐야 함] 글자별 애니메이션 껍데기가 풀린 곳 %d건:' % len(wrapped))
        for page, txt in wrapped:
            print('  -', page, '|', txt[:40])
        print('  → 히어로 제목은 글자마다 <span class="w">글자</span> 로 감싸야 등장 애니메이션(wordUp)이 산다.')
        print('     줄은 <span class="line">…</span>, 강조할 글자에는 class="w hl", 띄어쓰기 자리는 <span class="w gap"></span>.')
    print('\n끝. git diff 로 확인한 뒤 push 하세요.')

def strip(h): return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', h)).strip()

if __name__ == '__main__':
    main()
