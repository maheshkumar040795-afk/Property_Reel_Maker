"""Builds ../index.html (the client Reel Maker) from src/app.html.
Usage:  python3 src/build.py      (needs: pip install fonttools brotli)
Set the Worker URL in src/config.json before building."""
import base64, json, os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
cfg = json.load(open(os.path.join(here, 'config.json')))
POP = os.environ.get('POPPINS_DIR', '/usr/share/fonts/truetype/google-fonts')
fonts = {}
for k, f in [('REG', 'Regular'), ('MED', 'Medium'), ('BOLD', 'Bold')]:
    cache = os.path.join(here, 'vendor', f'poppins-{f}.subset.ttf')
    if not os.path.exists(cache):
        subprocess.run(['pyftsubset', f'{POP}/Poppins-{f}.ttf', '--unicodes=U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+20B9,U+2190-2193,U+2713', f'--output-file={cache}', '--layout-features=kern,liga'], check=True)
    fonts[k] = base64.b64encode(open(cache, 'rb').read()).decode()
fonts['SERIF'] = base64.b64encode(open(os.path.join(here, 'vendor', 'playfair-display-latin-700-normal.woff2'), 'rb').read()).decode()
s = open(os.path.join(here, 'app.html')).read()
for k, v in fonts.items(): s = s.replace(f'__FONT_{k}__', v)
s = s.replace('__MP4MUXER__', open(os.path.join(here, 'vendor', 'mp4-muxer.js')).read())
s = s.replace('__DEMO_IMAGES__', open(os.path.join(here, 'demo.json')).read())
s = s.replace('__API_URL__', cfg['api'].rstrip('/'))
open(os.path.join(root, 'index.html'), 'w').write(s)
print('index.html', len(s) // 1024, 'KB  · API =', cfg['api'])
