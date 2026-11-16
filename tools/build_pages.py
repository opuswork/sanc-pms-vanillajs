# -*- coding: utf-8 -*-
"""GitHub Pages(웹 브라우저) 테스트용 단일 HTML 빌드.

원본 build.py 와 같은 방식으로 모듈을 index.html 에 인라인 병합한다. 원본 소스는 수정하지 않는다.
  - 시드 데이터: 기본은 빈 배열(공개 배포용). 로컬에서 data.js 를 넣으려면 --with-seed
  - 자동 업데이트(net.js): 외부 저장소 주소를 비워 원격 교체를 막는다. 유지하려면 --keep-update

사용:
  python tools/build_pages.py              -> dist/index.html (시드 없음, 자동 업데이트 끔)
  python tools/build_pages.py --with-seed  -> 로컬 확인용 (data.js 포함, 외부 공개 금지)
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'dist')
NAMES = ['data.js', 'util.js', 'app.js', 'views.js', 'manage.js', 'predict.js',
         'update.js', 'sheet.js', 'net.js', 'import.js', 'dtmgmt.js']
SCALE = float(os.environ.get('FONT_SCALE', '1.0'))
FLOOR = float(os.environ.get('FONT_FLOOR', '9.5'))
WITH_SEED = '--with-seed' in sys.argv
KEEP_UPDATE = '--keep-update' in sys.argv


def read(name):
    with open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return f.read()


def scale_css(txt):
    if SCALE == 1.0:
        return txt
    def rep(m):
        v = max(float(m.group(1)) * SCALE, FLOOR)
        return 'font-size:%gpx' % round(v, 2)
    return re.sub(r'font-size:([\d.]+)px', rep, txt)


def module(name):
    if name == 'data.js':
        if WITH_SEED and os.path.exists(os.path.join(ROOT, name)):
            return read(name)
        return '/* 공개 배포용 빌드: 시드 데이터 없음. [데이터] 탭의 가져오기로 직접 넣는다. */\nwindow.SEED=[];'
    src = read(name)
    if name == 'net.js' and not KEEP_UPDATE:
        src, n = re.subn(r'const NET_URLS=\[.*?\];', 'const NET_URLS=[]; /* 테스트 배포: 원격 자동 업데이트 끔 */',
                         src, count=1, flags=re.S)
        if n != 1:
            sys.exit('net.js 의 NET_URLS 를 찾지 못했습니다')
    return src


def main():
    html = read('index.html')
    m = re.search(r'<style>(.*?)</style>', html, re.S)
    if m:
        html = html[:m.start(1)] + scale_css(m.group(1)) + html[m.end(1):]
    inline = ''.join('<script>\n' + scale_css(module(n)) + '\n</script>' for n in NAMES)
    tag = re.compile(r'(?:<script src="[^"]+\.js"></script>\s*)+')
    html, n = tag.subn(lambda _: inline, html, count=1)
    if n != 1:
        sys.exit('index.html 에서 <script src> 묶음을 찾지 못했습니다')
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, 'index.html')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    open(os.path.join(OUT_DIR, '.nojekyll'), 'w').close()
    print('built %s  bytes=%d  seed=%s  auto-update=%s' % (
        os.path.relpath(out, ROOT), len(html.encode('utf-8')),
        'included' if (WITH_SEED and os.path.exists(os.path.join(ROOT, 'data.js'))) else 'empty',
        'on' if KEEP_UPDATE else 'off'))


if __name__ == '__main__':
    main()
