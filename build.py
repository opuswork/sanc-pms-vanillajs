import re, sys, os
SCALE=float(os.environ.get('FONT_SCALE', os.environ.get('SCALE','1.0')))
FLOOR=float(os.environ.get('FONT_FLOOR','9.5'))
SRC='pms/src'
def scale_css(txt):
    def rep(m):
        v=float(m.group(1))*SCALE
        if v<FLOOR: v=FLOOR
        return 'font-size:%gpx'%round(v,2)
    return re.sub(r'font-size:([\d.]+)px', rep, txt)
names=['data.js','util.js','app.js','views.js','manage.js','predict.js','update.js','sheet.js','net.js','import.js','dtmgmt.js']
h=open(f'{SRC}/index.html',encoding='utf-8').read()
# CSS 스케일
m=re.search(r'<style>(.*?)</style>',h,re.S)
h=h[:m.start(1)]+scale_css(m.group(1))+h[m.end(1):]
# JS 내 인라인 스타일 스케일
inline=''
for n in names:
    inline+='<script>\n'+scale_css(open(f'{SRC}/{n}',encoding='utf-8').read())+'\n</script>'
tag=re.compile(r'(?:<script src="[^"]+\.js"></script>\s*)+')
h=tag.sub(lambda m: inline, h, count=1)
open('pms/build/app.html','w',encoding='utf-8').write(h)
print('scale=%s floor=%s bytes=%d'%(SCALE,FLOOR,len(h.encode())))
