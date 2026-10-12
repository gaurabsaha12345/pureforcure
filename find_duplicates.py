import glob
import re
from collections import Counter

for f in sorted(glob.glob('*.html')):
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    # Find all img src
    imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', content, re.IGNORECASE)
    # Filter out common layout icons/logos/payment QR/prabhupada
    content_imgs = [i for i in imgs if not any(x in i.lower() for x in ['logo', 'icon', 'qr', 'upi', 'badge', 'bank', 'prabhupada', 'razorpay', 'favicon'])]
    counts = Counter(content_imgs)
    dups = {k: v for k, v in counts.items() if v > 1}
    if dups:
        print(f"=== {f} ===")
        for k, v in dups.items():
            print(f"  {v}x: {k}")
