# Pure for Cure — Clean Production Package

> **An Initiative of Hare Krishna Mandir Guwahati**  
> Harmonized with [hkmguwahati.org](https://hkmguwahati.org/)

This folder (`pureforcure-hkm-clean`) contains the complete, clean-code, production-ready website for **Pure for Cure**, designed to be uploaded directly to Vercel, cPanel, Netlify, or self-hosted web servers.

---

## 📁 Folder Structure

```
pureforcure-hkm-clean/
├── index.html                 # Main refreshing portal (Hero, Kiosks, Seva Calculator, Gallery, Testimonials)
├── donate.html                # Dedicated 80G donation & volunteer registration page
├── css/
│   └── style.css              # Clean, modular CSS with HKM Guwahati design tokens
├── js/
│   └── app.js                 # Vanilla JS: Stats counter, kiosk tabs, meal calculator, lightbox, copy buttons
├── images/
│   ├── logo/                  # Pure for Cure & HKM branding assets
│   ├── prabhupada/            # Srila Prabhupada portrait (matching HKM Guwahati footer)
│   ├── gallery/               # Real hospital, kitchen, and community distribution photos
│   └── volunteers/            # Real volunteer portraits for testimonials
├── vercel.json                # Vercel deployment configuration
└── README.md                  # This guide
```

---

## 🚀 How to Test Locally

1. Open a terminal in this folder:
   ```bash
   cd pureforcure-hkm-clean
   python -m http.server 8000
   ```
2. Open your browser at [http://localhost:8000](http://localhost:8000)

Alternatively, you can double-click `index.html` directly in your file explorer.

---

## 🌐 How to Deploy / Upload to Website

### Option 1: Deploy on Vercel
- **Via Vercel Web Dashboard**:
  1. Zip this `pureforcure-hkm-clean` folder.
  2. Drag and drop the zip file onto your Vercel project dashboard.
- **Via Vercel CLI**:
  ```bash
  cd pureforcure-hkm-clean
  vercel --prod
  ```

### Option 2: Upload to cPanel / Apache / Nginx
1. Connect via FTP or cPanel File Manager.
2. Upload all files inside `pureforcure-hkm-clean/` to your target directory (e.g., `public_html/` or a subfolder like `public_html/pure-for-cure/`).

---

## ✨ Key Highlights of this Redesign
- **HKM Guwahati Brand Synergy**: Aligned with the Sacred Saffron (`#FCA028`), Temple Blue (`#0D80CC`), and warm white aesthetic of Hare Krishna Mandir Guwahati.
- **Unified Hospital Kiosks Hub**: Direct interactive tabs for AIIMS Guwahati, GMCH, Dr. B. Borooah Cancer Institute (BBCI), and Assam Flood Relief.
- **Live Seva Meal Calculator**: Instant plate calculations at ₹80/meal (₹800 = 10 meals, ₹4,000 = 50 meals, etc.).
- **One-Click Copy**: Fast copying of official UPI ID and Temple Bank NEFT/RTGS details with toast feedback.
- **Section 80G Tax Exemption**: Prominent guidelines for claiming 50% tax deductions under the Indian Income Tax Act.
- **Zero Bloat**: Pure HTML5, CSS3, and Vanilla JavaScript with no heavy frameworks or broken external dependencies.
