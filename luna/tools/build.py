"""Build Luna's Lost Treasures.
Edit luna/tools/index.src.html, then run:  python3 luna/tools/build.py
Writes luna/index.html (GitHub Pages: pictures load from luna/assets with ?v=APP_VERSION)
and luna/tools/out/index.html (Claude artifact copy: pictures embedded as data URIs).
Never hand-edit luna/index.html."""
import base64, os, re
HERE=os.path.dirname(os.path.abspath(__file__)); GAME=os.path.dirname(HERE); ASSETS=os.path.join(GAME,'assets')
src=open(os.path.join(HERE,'index.src.html')).read()
VER=re.search(r"const APP_VERSION = '([^']+)'",src).group(1)
MIME={'.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'}
files=[f for f in sorted(os.listdir(ASSETS)) if os.path.splitext(f)[1] in MIME]
cut=src.index("<script>\nconst APP_VERSION")
# artifact copy
parts=[f"{os.path.splitext(f)[0]}:'data:{MIME[os.path.splitext(f)[1]]};base64,"+base64.b64encode(open(os.path.join(ASSETS,f),'rb').read()).decode()+"'" for f in files]
os.makedirs(os.path.join(HERE,'out'),exist_ok=True)
open(os.path.join(HERE,'out','index.html'),'w').write(src[:cut]+"<script>const ASSET_DATA={\n"+",\n".join(parts)+"};</script>\n"+src[cut:])
# GitHub Pages copy
parts=[f"{os.path.splitext(f)[0]}:'assets/{f}?v={VER}'" for f in files]
head='''<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="theme-color" content="#bfa6ff">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Luna">
'''
w=src.replace('<title>',head+'<title>',1); c=w.index("<script>\nconst APP_VERSION")
open(os.path.join(GAME,'index.html'),'w').write(w[:c]+"<script>const ASSET_DATA={"+",".join(parts)+"};</script>\n"+w[c:])
print('built',VER)
