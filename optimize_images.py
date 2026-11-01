import glob
import re

count_modified = 0

for f in sorted(glob.glob('*.html')):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    
    # We want to add loading="lazy" and decoding="async" to images that don't already have loading=
    # Exclude header logo, favicon, first hero image if desired, or add lazy to images that are not top logo
    def replacer(match):
        img_tag = match.group(0)
        # Skip if already has loading=
        if 'loading=' in img_tag.lower():
            return img_tag
        # Keep logo without lazy for instant LCP
        if any(x in img_tag.lower() for x in ['logo', 'hkm-mandir-header', 'acharya-img', 'slide-banner-img']):
            # For hero/logo images, add decoding="async"
            if 'decoding=' not in img_tag.lower():
                return img_tag[:-1] + ' decoding="async">'
            return img_tag
        
        # Add loading="lazy" decoding="async"
        new_tag = img_tag[:-1].rstrip() + ' loading="lazy" decoding="async">'
        return new_tag

    new_c = re.sub(r'<img[^>]+>', replacer, c, flags=re.I)
    if new_c != c:
        with open(f, 'w', encoding='utf-8') as fp:
            fp.write(new_c)
        count_modified += 1

print(f"Added loading='lazy' and decoding='async' across {count_modified} HTML files.")
