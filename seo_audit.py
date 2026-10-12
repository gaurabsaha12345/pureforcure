import os
import glob
import re

files = sorted(glob.glob('*.html'))
print(f"Total HTML files: {len(files)}\n")

for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    
    robots = re.findall(r'<meta[^>]+name=[\'"]robots[\'"][^>]*>', c, re.I)
    title = re.findall(r'<title>(.*?)</title>', c, re.I | re.S)
    title_str = title[0].strip() if title else 'NO TITLE'
    
    canonical = re.findall(r'<link[^>]+rel=[\'"]canonical[\'"][^>]*>', c, re.I)
    can_str = canonical[0].strip() if canonical else 'NO CANONICAL'
    
    mdesc = re.findall(r'<meta[^>]+name=[\'"]description[\'"][^>]*>', c, re.I)
    desc_str = mdesc[0].strip() if mdesc else 'NO DESC'

    schema = re.findall(r'<script[^>]+type=[\'"]application/ld\+json[\'"][^>]*>', c, re.I)

    print(f"=== {f} ===")
    print(f"  Title: {title_str}")
    print(f"  Robots: {robots if robots else 'NONE'}")
    print(f"  Canonical: {can_str}")
    print(f"  Desc: {desc_str[:90]}...")
    print(f"  JSON-LD Schemas: {len(schema)}")
    print()
