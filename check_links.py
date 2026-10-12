import glob
import re
import os
from urllib.parse import urlparse

files = sorted(glob.glob('*.html'))
html_basenames = set(files)

broken_links = []
external_links = set()

for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    
    # find all href
    hrefs = re.findall(r'<a[^>]+href=[\'"]([^\'"]+)[\'"]', c, re.I)
    for h in hrefs:
        h_clean = h.strip()
        if not h_clean or h_clean.startswith('#') or h_clean.startswith('javascript:') or h_clean.startswith('tel:') or h_clean.startswith('mailto:'):
            continue
        
        parsed = urlparse(h_clean)
        if parsed.scheme in ('http', 'https'):
            external_links.add(h_clean)
            continue
        
        # Internal link: extract filename without hash or query
        path = parsed.path
        if path.startswith('/'):
            path = path[1:]
        
        # Check if empty (e.g. only hash had path='')
        if not path:
            continue
            
        target = path.split('#')[0].split('?')[0]
        if target not in html_basenames and not os.path.exists(target):
            # check with .html if extension was omitted
            if target + '.html' in html_basenames:
                continue
            broken_links.append((f, h_clean, target))

print(f"Total internal links scanned.")
print(f"Broken links count: {len(broken_links)}")
for b in broken_links:
    print(f"  In {b[0]}: {b[1]} (target '{b[2]}' not found)")

print(f"\nSample external links ({len(external_links)} total):")
for e in list(external_links)[:10]:
    print(f"  {e}")
