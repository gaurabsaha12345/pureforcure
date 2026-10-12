import glob
import re
import json

PAGES_CONFIG = {
    "index.html": {
        "title": "Pure for Cure | Hospital Caregiver Food Relief | Hare Krishna Mandir Guwahati",
        "desc": "Pure for Cure by Hare Krishna Movement Guwahati serves 40,70,000+ pure, hygienic Sattvik meals to patients and caregivers camping at AIIMS, GMCH & BBCI hospitals.",
        "canonical": "https://pureforcure.org/",
        "type": "website",
        "include_ngo": True
    },
    "about.html": {
        "title": "About Us | Pure for Cure & Hare Krishna Movement Guwahati",
        "desc": "Learn about Pure for Cure, an initiative of Hare Krishna Movement Guwahati established in 2017 to provide dignified, nutritious Sattvik meal seva to hospital caregivers.",
        "canonical": "https://pureforcure.org/about.html",
        "type": "article",
        "include_ngo": True
    },
    "programs.html": {
        "title": "Healthcare Initiatives & Hospital Feeding Programs | Pure for Cure",
        "desc": "Explore Pure for Cure hunger relief programs across Assam: AIIMS Guwahati Kiosk, GMCH Trauma Center Food Drive, BBCI Cancer Hospital, and Emergency Flood Relief.",
        "canonical": "https://pureforcure.org/programs.html",
        "type": "website",
        "include_ngo": True
    },
    "donate.html": {
        "title": "Donate for Hospital Food Distribution (80G Tax Deductible) | Pure for Cure",
        "desc": "Donate to provide pure Sattvik meals to vulnerable hospital caregivers in Guwahati. 100% transparent on-ground photo proof and instant 80G Tax Exemption receipts.",
        "canonical": "https://pureforcure.org/donate.html",
        "type": "website",
        "include_ngo": True
    },
    "donate-aiims.html": {
        "title": "Sponsor AIIMS Guwahati Caregiver Meals | Pure for Cure",
        "desc": "Sponsor daily wholesome Sattvik meals for patient attendants and rural caregivers camping outside AIIMS Guwahati Changsari Campus. 80G tax deductible.",
        "canonical": "https://pureforcure.org/donate-aiims.html",
        "type": "website",
        "include_ngo": True
    },
    "kiosk-aiims.html": {
        "title": "AIIMS Guwahati Sattvik Food Distribution Kiosk | Pure for Cure",
        "desc": "Details, on-ground photos and live impact of the permanent Pure for Cure Sattvik food distribution kiosk at AIIMS Guwahati OPD Gate.",
        "canonical": "https://pureforcure.org/kiosk-aiims.html",
        "type": "website",
        "include_ngo": True
    },
    "donate-gmch.html": {
        "title": "Sponsor GMCH Guwahati Trauma Caregiver Meals | Pure for Cure",
        "desc": "Support daily food distribution for families camping outside GMCH emergency and trauma wards in Bhangagarh, Guwahati. Instant 80G tax exemption receipt.",
        "canonical": "https://pureforcure.org/donate-gmch.html",
        "type": "website",
        "include_ngo": True
    },
    "kiosk-gmch.html": {
        "title": "GMCH Guwahati Hospital Food Distribution Hub | Pure for Cure",
        "desc": "Explore Pure for Cure daily food drives at Guwahati Medical College & Hospital (GMCH). Transparent photos, volunteer voices, and donation options.",
        "canonical": "https://pureforcure.org/kiosk-gmch.html",
        "type": "website",
        "include_ngo": True
    },
    "donate-bbci.html": {
        "title": "Sponsor Cancer Caregiver Meals at BBCI Guwahati | Pure for Cure",
        "desc": "Sponsor soothing, easily digestible Sattvik meals for cancer patients and long-stay caregivers at Dr. B. Borooah Cancer Institute (BBCI). 80G tax exempt.",
        "canonical": "https://pureforcure.org/donate-bbci.html",
        "type": "website",
        "include_ngo": True
    },
    "kiosk-bbci.html": {
        "title": "BBCI Cancer Hospital Food Kiosk & Care Seva | Pure for Cure",
        "desc": "On-ground photos and information for the Pure for Cure cancer hospital distribution kiosk at Dr. B. Borooah Cancer Institute (BBCI), Guwahati.",
        "canonical": "https://pureforcure.org/kiosk-bbci.html",
        "type": "website",
        "include_ngo": True
    },
    "donate-kiosk.html": {
        "title": "Sponsor a Hospital Food Distribution Kiosk | Pure for Cure",
        "desc": "Partner with Pure for Cure to sponsor, fund, or adopt a permanent hygienic Sattvik food distribution kiosk at government hospitals in Assam.",
        "canonical": "https://pureforcure.org/donate-kiosk.html",
        "type": "website",
        "include_ngo": True
    },
    "donate-kitchen.html": {
        "title": "Donate for Central Kitchen & Groceries | Pure for Cure",
        "desc": "Sponsor fresh vegetables, pure mustard oil, rice, and lentils for the automated steam kitchen cooking 3,000+ daily meals for hospital families.",
        "canonical": "https://pureforcure.org/donate-kitchen.html",
        "type": "website",
        "include_ngo": True
    },
    "donate-vehicle.html": {
        "title": "Sponsor Food Delivery Vehicle & Logistics Seva | Pure for Cure",
        "desc": "Help fund insulated mobile food delivery vans and logistical operations transporting hot thermal cauldrons across Guwahati hospitals 365 days a year.",
        "canonical": "https://pureforcure.org/donate-vehicle.html",
        "type": "website",
        "include_ngo": True
    },
    "donate-flood.html": {
        "title": "Assam Flood Relief Food Seva & Boat Operations | Pure for Cure",
        "desc": "Donate to emergency Assam Flood Relief taskforces delivering hot Sattvik meals, dry rations, and potable water by motorized boats to inundated riverine belts.",
        "canonical": "https://pureforcure.org/donate-flood.html",
        "type": "website",
        "include_ngo": True
    },
    "flood-relief.html": {
        "title": "Assam Flood Emergency Disaster Response | Pure for Cure",
        "desc": "Detailed overview of Pure for Cure flood relief missions across Morigaon, Kamrup, Barpeta, and submerged riverine villages in Assam.",
        "canonical": "https://pureforcure.org/flood-relief.html",
        "type": "website",
        "include_ngo": True
    },
    "donate-birthday.html": {
        "title": "Celebrate Birthday & Anniversary by Sponsoring Meals | Pure for Cure",
        "desc": "Mark your birthday, wedding anniversary, or memorial by feeding 100 to 500+ hospital attendants in Guwahati. Receive photo proofs and heartfelt blessings.",
        "canonical": "https://pureforcure.org/donate-birthday.html",
        "type": "website",
        "include_ngo": True
    },
    "csr.html": {
        "title": "Corporate Social Responsibility (CSR) Partnerships | Pure for Cure",
        "desc": "CSR partnerships with Pure for Cure (Hare Krishna Movement Guwahati). Eligible for Schedule VII Companies Act, MCA CSR-1, 12A & 80G tax benefits.",
        "canonical": "https://pureforcure.org/csr.html",
        "type": "website",
        "include_ngo": True
    },
    "stories.html": {
        "title": "Caregiver Stories & Real-Life Impact Voices | Pure for Cure",
        "desc": "Read authentic beneficiary stories from families caring for loved ones at AIIMS Guwahati, GMCH, and BBCI supported by Pure for Cure daily Sattvik meals.",
        "canonical": "https://pureforcure.org/stories.html",
        "type": "website",
        "include_ngo": True
    },
    "volunteer.html": {
        "title": "Volunteer With Pure for Cure | Hare Krishna Movement Guwahati",
        "desc": "Join our devoted volunteer team in food distribution, hospital coordination, and kitchen seva across Greater Guwahati. Make an active humanitarian difference.",
        "canonical": "https://pureforcure.org/volunteer.html",
        "type": "website",
        "include_ngo": True
    },
    "gallery.html": {
        "title": "Visual Impact & Hospital Initiatives Gallery | Pure for Cure",
        "desc": "Explore verified on-ground photo galleries of daily hospital food kiosks, central steam kitchen cauldrons, insulated canisters, and disaster relief.",
        "canonical": "https://pureforcure.org/gallery.html",
        "type": "website",
        "include_ngo": True
    },
    "gallery-borooah.html": {
        "title": "Seva Memories — B. Borooah Cancer Institute (BBCI) | Pure for Cure",
        "desc": "Dedicated on-ground photo archive and transparency records for donor-sponsored meal drives at Dr. B. Borooah Cancer Institute, Guwahati.",
        "canonical": "https://pureforcure.org/gallery-borooah.html",
        "type": "website",
        "include_ngo": True
    },
    "gallery-assam.html": {
        "title": "Seva Memories — Assam Flood Relief Photo Archive | Pure for Cure",
        "desc": "Direct photo memories and transparency proofs from Pure for Cure flood relief drives and boat distribution camps across Assam.",
        "canonical": "https://pureforcure.org/gallery-assam.html",
        "type": "website",
        "include_ngo": True
    },
    "gallery-other.html": {
        "title": "Seva Memories — GMCH, AIIMS & Regional Archives | Pure for Cure",
        "desc": "Transparent donor photo proof and distribution archives from GMCH, AIIMS Changsari, GAIL/NRL CSR events, and milestone annadanam drives.",
        "canonical": "https://pureforcure.org/gallery-other.html",
        "type": "website",
        "include_ngo": True
    },
    "faq.html": {
        "title": "Frequently Asked Questions (FAQ) | Pure for Cure",
        "desc": "Clear answers regarding 80G tax deduction receipts, FSSAI hygiene standards, hospital kiosk operations, and donor transparency.",
        "canonical": "https://pureforcure.org/faq.html",
        "type": "website",
        "include_ngo": True
    },
    "contact.html": {
        "title": "Contact Us | Pure for Cure - Hare Krishna Mandir Guwahati",
        "desc": "Connect with Pure for Cure helpline, visit our temple campus in North Guwahati, or inquire about hospital sponsorships and CSR partnerships.",
        "canonical": "https://pureforcure.org/contact.html",
        "type": "website",
        "include_ngo": True
    },
    "privacy-policy.html": {
        "title": "Privacy Policy | Pure for Cure - Hare Krishna Mandir Guwahati",
        "desc": "Official privacy and data protection policy of Pure for Cure regarding donor details, payment transactions, and contact information.",
        "canonical": "https://pureforcure.org/privacy-policy.html",
        "type": "website",
        "include_ngo": False
    },
    "terms-conditions.html": {
        "title": "Terms & Conditions | Pure for Cure - Hare Krishna Mandir Guwahati",
        "desc": "Official terms of service, donation policies, 80G receipt guidelines, and user agreement for Pure for Cure.",
        "canonical": "https://pureforcure.org/terms-conditions.html",
        "type": "website",
        "include_ngo": False
    }
}

# Master Business / NGO Schema (JSON-LD)
NGO_SCHEMA = {
    "@context": "https://schema.org",
    "@type": "NGO",
    "@id": "https://pureforcure.org/#organization",
    "name": "Pure for Cure",
    "alternateName": "Pure for Cure - Hare Krishna Movement Guwahati",
    "url": "https://pureforcure.org/",
    "logo": "https://pureforcure.org/images/logo/logo.png",
    "image": "https://pureforcure.org/images/banners/1.jpeg",
    "description": "Healthcare humanitarian initiative of Hare Krishna Movement Guwahati providing pure, nutritious, FSSAI-certified Sattvik meals daily to hospital caregivers camping outside AIIMS, GMCH, and BBCI hospitals in Assam.",
    "parentOrganization": {
        "@type": "Organization",
        "name": "Hare Krishna Movement, Guwahati",
        "url": "https://hkmguwahati.org"
    },
    "address": {
        "@type": "PostalAddress",
        "streetAddress": "c/o Hare Krishna Mandir, Ghorajan, Near IIT Guwahati",
        "addressLocality": "North Guwahati",
        "addressRegion": "Assam",
        "postalCode": "781031",
        "addressCountry": "IN"
    },
    "geo": {
        "@type": "GeoCoordinates",
        "latitude": 26.1963,
        "longitude": 91.6917
    },
    "telephone": "+91-9678007302",
    "email": "info@pureforcure.org",
    "sameAs": [
        "https://www.facebook.com/pureforcure",
        "https://www.instagram.com/pureforcureofficial/",
        "https://www.youtube.com/@PureforCure"
    ],
    "nonprofitStatus": "Nonprofit501c3",
    "taxID": "AAATH3456RF20214",
    "areaServed": [
        "Guwahati",
        "Assam",
        "Northeast India"
    ],
    "knowsAbout": [
        "Hospital Attendant Food Relief",
        "Sattvik Food Distribution",
        "Assam Flood Relief",
        "Healthcare Charity"
    ]
}

def generate_page_schema(filename, conf):
    schemas = []
    
    # 1. BreadcrumbList Schema
    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://pureforcure.org/"
            }
        ]
    }
    if filename != "index.html":
        clean_name = conf["title"].split("|")[0].strip()
        breadcrumb["itemListElement"].append({
            "@type": "ListItem",
            "position": 2,
            "name": clean_name,
            "item": conf["canonical"]
        })
    schemas.append(breadcrumb)

    # 2. WebPage / Organization Schema
    if conf.get("include_ngo", True):
        schemas.append(NGO_SCHEMA)

    webpage = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": f"{conf['canonical']}#webpage",
        "url": conf["canonical"],
        "name": conf["title"],
        "description": conf["desc"],
        "isPartOf": {
            "@id": "https://pureforcure.org/#organization"
        },
        "inLanguage": "en-IN"
    }
    schemas.append(webpage)
    
    return "\n".join([f'  <script type="application/ld+json">\n{json.dumps(s, indent=4)}\n  </script>' for s in schemas])

count_updated = 0
for filename, conf in PAGES_CONFIG.items():
    with open(filename, 'r', encoding='utf-8') as fp:
        html = fp.read()

    # 1. Update Title
    html = re.sub(r'<title>.*?</title>', f'<title>{conf["title"]}</title>', html, flags=re.I | re.S)

    # 2. Update Meta Description
    if re.search(r'<meta[^>]+name=[\'"]description[\'"][^>]*>', html, re.I):
        html = re.sub(
            r'<meta[^>]+name=[\'"]description[\'"][^>]*>',
            f'<meta name="description" content="{conf["desc"]}">',
            html,
            flags=re.I
        )
    else:
        # insert after title
        html = html.replace(f'</title>', f'</title>\n  <meta name="description" content="{conf["desc"]}">')

    # 3. Canonical Link
    # Remove existing canonical if any
    html = re.sub(r'<link[^>]+rel=[\'"]canonical[\'"][^>]*>\s*', '', html, flags=re.I)
    
    # 4. Robots Meta tag (Ensures Googlebot is explicitly allowed)
    html = re.sub(r'<meta[^>]+name=[\'"]robots[\'"][^>]*>\s*', '', html, flags=re.I)

    # 5. Open Graph & Twitter meta tags
    og_block = f'''  <link rel="canonical" href="{conf['canonical']}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta property="og:locale" content="en_IN">
  <meta property="og:type" content="{conf['type']}">
  <meta property="og:title" content="{conf['title']}">
  <meta property="og:description" content="{conf['desc']}">
  <meta property="og:url" content="{conf['canonical']}">
  <meta property="og:site_name" content="Pure for Cure - Hare Krishna Movement Guwahati">
  <meta property="og:image" content="https://pureforcure.org/images/banners/1.jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{conf['title']}">
  <meta name="twitter:description" content="{conf['desc']}">
  <meta name="twitter:image" content="https://pureforcure.org/images/banners/1.jpeg">'''

    # Remove existing JSON-LD schemas
    html = re.sub(r'\s*<script type=[\'"]application/ld\+json[\'"]>[\s\S]*?</script>', '', html, flags=re.I)

    # Generate new schemas
    schema_block = generate_page_schema(filename, conf)

    # Insert canonical, robots, OG, and schemas cleanly after meta description
    target_pos = html.find(f'<meta name="description" content="{conf["desc"]}">')
    if target_pos != -1:
        insert_point = target_pos + len(f'<meta name="description" content="{conf["desc"]}">')
        html = html[:insert_point] + "\n" + og_block + "\n" + schema_block + html[insert_point:]
    else:
        # fallback insert before </head>
        html = html.replace('</head>', f'{og_block}\n{schema_block}\n</head>')

    with open(filename, 'w', encoding='utf-8') as fp:
        fp.write(html)
    
    count_updated += 1

print(f"Successfully injected SEO metadata, canonicals, robots, OG tags, and Schema markup across {count_updated} pages!")
