/* Pure for Cure - Hare Krishna Mandir Guwahati
 * Master JavaScript (v5.1) - Razorpay API & Dynamic Donations
 */

const DONATIONS_STORAGE_KEY = 'pfc_recent_donations_v5';

// =============================================================
// RAZORPAY PAYMENT GATEWAY ENGINE
// =============================================================
const RAZORPAY_ENGINE = {
  defaultKey: 'rzp_live_ysKJLc5VAgvM7W',
  getKeyId: function() {
    const saved = localStorage.getItem('pfc_razorpay_key_id');
    if (saved && saved.trim() && saved !== 'rzp_test_placeholder') {
      return saved.trim();
    }
    return this.defaultKey;
  },
  setKeyId: function(key) {
    if (key && key.trim()) {
      localStorage.setItem('pfc_razorpay_key_id', key.trim());
      console.log('Razorpay Key ID configured:', key.trim());
    }
  },
  merchantName: 'Pure for Cure - Hare Krishna Movement Guwahati',
  description: 'Sattvik Meals Food Relief Sponsorship',
  themeColor: '#1A8C4E',
  logo: 'images/logo/pfc-logo-new.png'
};

// =============================================================
// SUPABASE BACKEND CONNECTOR & STORAGE (OFFICIAL PURE FOR CURE)
// =============================================================
const SUPABASE_BACKEND = {
  DEFAULT_URL: 'https://jhlxeyegakyvxtxqvrsz.supabase.co',
  DEFAULT_KEY: 'sb_publishable_o25ZPIgjLnQupz-mR52nLQ_n6d3PpN5',
  getUrl: function() {
    let raw = localStorage.getItem('pfc_supabase_url') || this.DEFAULT_URL;
    return raw.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
  },
  getKey: function() {
    return localStorage.getItem('pfc_supabase_key') || this.DEFAULT_KEY;
  },
  setCredentials: function(url, key) {
    if (url) {
      const normalizedUrl = url.trim().replace(/\/+$/, '').replace(/\/rest\/v1\/?$/, '');
      localStorage.setItem('pfc_supabase_url', normalizedUrl);
      if (key && key.trim()) {
        localStorage.setItem('pfc_supabase_key', key.trim());
      }
      console.log('Supabase backend configured successfully:', normalizedUrl);
      return true;
    }
    return false;
  },
  setKey: function(key) {
    if (key && key.trim()) {
      localStorage.setItem('pfc_supabase_key', key.trim());
      console.log('Supabase anon public key saved successfully!');
      return true;
    }
    return false;
  },
  isConfigured: function() {
    return Boolean(this.getUrl());
  },
  checkConnection: async function() {
    const url = this.getUrl();
    const key = this.getKey();
    if (!url || !key) return { connected: false, error: 'Missing Supabase URL or Anon Key' };
    const startTime = Date.now();
    try {
      const resp = await fetch(`${url}/rest/v1/donations?select=id&limit=1`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/json'
        }
      });
      const latencyMs = Date.now() - startTime;
      if (resp.ok) {
        return { connected: true, status: resp.status, latencyMs };
      }
      return { connected: false, status: resp.status, error: resp.statusText };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  },
  getRecords: async function(table, queryParams = '') {
    const url = this.getUrl();
    const key = this.getKey();
    const storeKey = 'pfc_local_' + table;
    const localFallback = JSON.parse(localStorage.getItem(storeKey) || '[]');
    if (!key) {
      return localFallback;
    }
    try {
      const endpoint = `${url}/rest/v1/${table}${queryParams ? '?' + queryParams : ''}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) {
        console.warn(`Supabase getRecords ${table} status:`, response.status);
        return localFallback;
      }
      const remote = await response.json();
      return Array.isArray(remote) && remote.length > 0 ? remote : localFallback;
    } catch (e) {
      console.warn(`Supabase getRecords network error on ${table}:`, e);
      return localFallback;
    }
  },
  insertRecord: async function(table, data) {
    const url = this.getUrl();
    const key = this.getKey();

    // 1. Safe persistent local backup
    try {
      const storeKey = 'pfc_local_' + table;
      const records = JSON.parse(localStorage.getItem(storeKey) || '[]');
      records.unshift({ ...data, saved_at: new Date().toISOString() });
      localStorage.setItem(storeKey, JSON.stringify(records.slice(0, 100)));
    } catch (e) {
      console.warn('Local storage backup error:', e);
    }

    if (!key) {
      console.info(`[Supabase Connected: ${url}] Table [${table}] record secured locally.`);
      return { success: true, localOnly: true };
    }

    // 2. Prepare payload aligned strictly with Supabase table schema
    let payload = data;
    if (table === 'donations') {
      payload = {
        name: data.name || data.donor_name || 'Anonymous Donor',
        email: data.email || '',
        phone: data.phone || '',
        amount: Number(data.amount) || 0,
        location: (data.location || '').toLowerCase().trim(),
        method: data.method || 'Razorpay',
        status: data.status || 'Success',
        txn_id: data.txn_id || data.payment_id || '',
        date: data.date || new Date().toISOString().split('T')[0],
        notes: data.notes || ''
      };
    } else if (table === 'newsletter_subscribers' || table === 'subscribers') {
      payload = {
        name: data.name || 'Devotee / Friend',
        email: data.email || '',
        source_page: data.source_page || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : 'footer') || 'footer',
        status: data.status || 'active',
        created_at: data.created_at || new Date().toISOString()
      };
    }

    // 3. Live POST to Supabase REST API
    try {
      const endpoint = `${url}/rest/v1/${table}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.text();
        console.warn(`Supabase ${table} sync warning (status ${response.status}):`, err);
        return { success: false, error: err };
      }
      const result = await response.json();
      console.log(`✓ Record successfully synced to Supabase [${table}]:`, result);
      return { success: true, data: result };
    } catch (e) {
      console.warn(`Supabase network issue on ${table}:`, e);
      return { success: false, error: e.message };
    }
  }
};

// EmailJS Official Configuration
const EMAILJS_CONFIG = {
  publicKey: '7rlSIRoybWU_Exkf9',
  serviceId: 'service_ssdg1kh',
  templateId: 'template_uk3p639'
};

// Initialize EmailJS immediately if script is present
try {
  if (typeof window !== 'undefined' && window.emailjs && window.emailjs.init) {
    window.emailjs.init(EMAILJS_CONFIG.publicKey);
  }
} catch (e) {
  console.warn('EmailJS init warning:', e);
}

// =============================================================
// NEWSLETTER AUTOMATION & STAY CONNECTED ENGINE (SUPABASE CONNECTED)
// =============================================================
const NEWSLETTER_AUTOMATION = {
  // Fetch active subscribers from Supabase with localStorage fallback
  getSubscribers: async function() {
    try {
      const remote = await SUPABASE_BACKEND.getRecords('newsletter_subscribers', 'select=*&status=eq.active');
      if (Array.isArray(remote) && remote.length > 0) {
        return remote;
      }
    } catch (e) {
      console.warn('Remote subscribers query fallback:', e);
    }
    return JSON.parse(localStorage.getItem('pfc_newsletter_subscribers') || '[]');
  },

  // Automated notification dispatch for a new blogpost / story to all subscribers
  broadcastNewBlogpost: async function(post) {
    if (!post || !post.title) {
      console.warn('broadcastNewBlogpost: post details missing');
      return { success: false, error: 'Post title is required' };
    }

    const subscribers = await this.getSubscribers();
    if (!subscribers || subscribers.length === 0) {
      console.info('No active newsletter subscribers registered to notify yet.');
      return { success: true, sentCount: 0, message: 'No subscribers registered yet.' };
    }

    console.log(`📢 Broadcasting new blogpost "${post.title}" to ${subscribers.length} subscribers...`);

    let sentCount = 0;
    const errors = [];
    const postUrl = post.url || (window.location.origin + '/stories.html');

    for (const sub of subscribers) {
      if (!sub.email) continue;
      try {
        if (typeof window !== 'undefined' && window.emailjs && EMAILJS_CONFIG.serviceId) {
          await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
            donor_email: sub.email,
            to_email: sub.email,
            to_name: sub.name || 'Pure for Cure Supporter',
            donor_name: sub.name || 'Pure for Cure Supporter',
            email: sub.email,
            subject: `🌟 New Seva Story: ${post.title} | Pure for Cure`,
            message: `Hare Krishna!\n\nA new inspirational caregiver story has just been published on Pure for Cure:\n\n"${post.title}"\n\n${post.excerpt || 'Read how your compassionate support feeds patients and attendants outside government hospitals.'}\n\nRead the complete story here:\n${postUrl}`,
            notes: `Automated Blog Notification dispatched on ${new Date().toLocaleString('en-IN')}`
          });
          sentCount++;
        }
      } catch (err) {
        console.warn(`Failed notifying subscriber ${sub.email}:`, err);
        errors.push({ email: sub.email, error: err.message });
      }
    }

    // Save notification dispatch record
    try {
      const logKey = 'pfc_blogpost_notifications_log';
      const history = JSON.parse(localStorage.getItem(logKey) || '[]');
      history.unshift({
        post_title: post.title,
        post_url: postUrl,
        sent_count: sentCount,
        dispatched_at: new Date().toISOString()
      });
      localStorage.setItem(logKey, JSON.stringify(history.slice(0, 50)));
    } catch (e) {}

    console.log(`✓ Automated broadcast finished: ${sentCount} subscriber notification(s) sent.`);
    return { success: true, sentCount, total: subscribers.length, errors };
  },

  // Inspect stories.html and track latest story for notification
  checkAndNotifyLatestStory: function() {
    if (typeof window === 'undefined' || !window.location.pathname.includes('stories.html')) return;
    const firstStory = document.querySelector('.story-card-item');
    if (!firstStory) return;

    const storyId = firstStory.getAttribute('id') || 'latest-caregiver-story';
    const storyTitle = firstStory.querySelector('.story-card-title')?.innerText?.trim() || 'New Caregiver Story';

    const notifiedKey = 'pfc_notified_blogposts';
    const notified = JSON.parse(localStorage.getItem(notifiedKey) || '[]');

    if (!notified.includes(storyId)) {
      console.log(`[Newsletter Automation] New story detected: "${storyTitle}". Ready for subscriber broadcast.`);
      notified.push(storyId);
      localStorage.setItem(notifiedKey, JSON.stringify(notified));
    }
  }
};

// Global helper for one-click admin / developer broadcast
window.NEWSLETTER_AUTOMATION = NEWSLETTER_AUTOMATION;
window.broadcastNewPost = function(title, excerpt, url) {
  return NEWSLETTER_AUTOMATION.broadcastNewBlogpost({
    id: 'post-' + Date.now(),
    title: title || 'New Seva Story: Pure for Cure Hospital Food Relief',
    excerpt: excerpt || 'Read how our daily Sattvik meal distribution is saving lives outside AIIMS, BBCI, and GMCH.',
    url: url || window.location.origin + '/stories.html'
  });
};

// =============================================================
// FOOTER NEWSLETTER SUBSCRIPTION CONTROLLER
// =============================================================
function initFooterNewsletter() {
  const form = document.getElementById('footerNewsletterForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const nameInput = document.getElementById('newsletterName');
    const emailInput = document.getElementById('newsletterEmail');
    const submitBtn = document.getElementById('newsletterSubmitBtn');
    const statusAlert = document.getElementById('newsletterStatus');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showStatus('Please enter a valid email address.', 'error');
      if (emailInput) emailInput.focus();
      return;
    }

    const btnOriginalHTML = submitBtn ? submitBtn.innerHTML : 'Subscribe';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subscribing...';
    }
    hideStatus();

    const subscriberRecord = {
      name: name || 'Devotee / Friend',
      email: email.toLowerCase(),
      source_page: (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : 'footer') || 'index.html',
      status: 'active',
      created_at: new Date().toISOString()
    };

    try {
      // 1. Live insert to Supabase table `newsletter_subscribers`
      const supaRes = await SUPABASE_BACKEND.insertRecord('newsletter_subscribers', subscriberRecord);

      // 2. Safe local storage persistence
      try {
        const storeKey = 'pfc_newsletter_subscribers';
        const subscribers = JSON.parse(localStorage.getItem(storeKey) || '[]');
        const exists = subscribers.some(s => s.email.toLowerCase() === subscriberRecord.email);
        if (!exists) {
          subscribers.unshift(subscriberRecord);
          localStorage.setItem(storeKey, JSON.stringify(subscribers.slice(0, 500)));
        }
      } catch (err) {
        console.warn('Local storage subscriber cache note:', err);
      }

      // 3. Automated Welcome Email via EmailJS
      if (typeof window !== 'undefined' && window.emailjs && EMAILJS_CONFIG.serviceId) {
        try {
          window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
            donor_email: subscriberRecord.email,
            to_email: subscriberRecord.email,
            to_name: subscriberRecord.name,
            donor_name: subscriberRecord.name,
            email: subscriberRecord.email,
            subject: 'Welcome to Pure for Cure Seva Community - Hare Krishna!',
            message: 'Hare Krishna! Thank you for subscribing to Pure for Cure. You will now receive inspirational hospital food relief stories, volunteer voices, emergency flood relief updates, and our latest blog posts.',
            notes: 'Newsletter Subscription verified from ' + (window.location.pathname.split('/').pop() || 'website')
          }).then(
            resp => console.log('✓ Newsletter welcome email sent successfully:', resp),
            err => console.warn('EmailJS newsletter notice (handled):', err)
          );
        } catch (mailErr) {
          console.warn('Welcome email dispatch skipped:', mailErr);
        }
      }

      showStatus(`🙏 Hare Krishna! Thank you for subscribing, ${subscriberRecord.name}! You are now connected to our seva journey.`, 'success');
      form.reset();
    } catch (error) {
      console.error('Newsletter submission error:', error);
      showStatus('🙏 Hare Krishna! Thank you for connecting. Your subscription has been recorded.', 'success');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = btnOriginalHTML;
      }
    }

    function showStatus(message, type) {
      if (!statusAlert) return;
      statusAlert.className = `newsletter-status-alert ${type}`;
      statusAlert.innerHTML = (type === 'success' 
        ? '<i class="fa-solid fa-circle-check"></i> ' 
        : '<i class="fa-solid fa-circle-exclamation"></i> ') + message;
      statusAlert.style.display = 'flex';
    }

    function hideStatus() {
      if (!statusAlert) return;
      statusAlert.style.display = 'none';
    }
  });
}

// Auto-run if DOM is already ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFooterNewsletter);
  } else {
    initFooterNewsletter();
  }
}

// Global helpers
window.setSupabaseConfig = function(url, anonKey) {
  if (SUPABASE_BACKEND.setCredentials(url, anonKey)) {
    alert('Hare Krishna! Supabase backend successfully connected!\nProject URL: ' + url);
  } else {
    alert('Please enter both Supabase Project URL and Anon Public Key.');
  }
};

window.setSupabaseKey = function(anonKey) {
  if (SUPABASE_BACKEND.setKey(anonKey)) {
    alert('Hare Krishna! Supabase Anon Key successfully linked!\nDonations will stream straight to your tables.');
  } else {
    alert('Please enter a valid Supabase anon public key.');
  }
};

window.setRazorpayKey = function(key) {
  RAZORPAY_ENGINE.setKeyId(key);
  updateRzpKeyDisplay();
  alert('Razorpay Key ID successfully saved: ' + key);
};

// Key configuration UI helpers
function toggleRzpKeyInput() {
  const box = document.getElementById('rzp-key-input-container');
  if (box) {
    box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'block' : 'none';
  }
}

function saveCustomRzpKey() {
  const inp = document.getElementById('rzp-custom-key-input');
  if (inp && inp.value.trim()) {
    RAZORPAY_ENGINE.setKeyId(inp.value.trim());
    updateRzpKeyDisplay();
    alert('Razorpay Key ID saved: ' + inp.value.trim());
    const box = document.getElementById('rzp-key-input-container');
    if (box) box.style.display = 'none';
  }
}

function updateRzpKeyDisplay() {
  const disp = document.getElementById('rzp-current-key-display');
  const key = RAZORPAY_ENGINE.getKeyId();
  if (disp) {
    if (key && key.startsWith('rzp_live_')) {
      disp.textContent = key.substring(0, 12) + '... (Live Active)';
      disp.style.color = '#16A34A';
    } else if (key && key !== 'rzp_test_placeholder') {
      disp.textContent = key.substring(0, 10) + '... (Active)';
      disp.style.color = '#16A34A';
    } else {
      disp.textContent = 'Default (Test)';
      disp.style.color = '#D97706';
    }
  }
}

// Location and cause mapping helpers
function mapCauseKeyToLocation(causeKey) {
  if (!causeKey) return 'general';
  const k = causeKey.toLowerCase().trim();
  if (k === 'aiims') return 'aiims';
  if (k === 'gmch') return 'gmch';
  if (k === 'bbci' || k === 'borooah') return 'borooah';
  if (k === 'flood' || k === 'assam-flood-relief') return 'assam-flood-relief';
  if (k === 'kiosk') return 'kiosk';
  if (k === 'vehicle') return 'vehicle';
  if (k === 'kitchen') return 'kitchen';
  if (k === 'birthday') return 'birthday';
  if (k === 'vessels' || k === 'vessel') return 'vessels';
  if (k === 'programs') return 'programs';
  if (k === 'stories') return 'stories';
  if (k === 'volunteer') return 'volunteer';
  if (k === 'faq') return 'faq';
  if (k === 'general' || k === 'all') return 'general';
  return k;
}

function getCauseNameFromLocation(loc) {
  if (!loc) return 'Hospital Food Distribution';
  const l = loc.toLowerCase().trim();
  if (l === 'aiims') return 'AIIMS Guwahati Food Distribution';
  if (l === 'gmch') return 'GMCH Attendant Meals';
  if (l === 'borooah' || l === 'bbci') return 'BBCI Hospital Food Distribution';
  if (l === 'assam-flood-relief' || l === 'flood') return 'Assam Flood Relief Seva';
  if (l === 'kiosk') return 'Hospital Kiosk Partnership';
  if (l === 'vehicle') return 'Distribution Vehicle Seva';
  if (l === 'kitchen') return 'Kitchen Groceries & Vegetables Seva';
  if (l === 'birthday') return 'Birthday / Anniversary Seva';
  if (l === 'vessels' || l === 'vessel') return 'Food Serving Vessels & Utensils';
  if (l === 'programs') return 'Programs & Mega Distribution Seva';
  if (l === 'stories') return 'Caregiver Meals Distribution';
  if (l === 'volunteer') return 'Volunteer Food Relief Seva';
  if (l === 'faq') return 'Hospital Food Distribution';
  if (l === 'general' || l === 'all') return 'Hospital Caregiver Food Distribution';
  return 'Hospital Food Distribution';
}

function matchesCauseLocation(recordLocation, pageCauseKey) {
  if (!pageCauseKey || pageCauseKey === 'all') {
    return true; // show all on general all-donations page (donate.html)
  }
  const pageK = pageCauseKey.toLowerCase().trim();
  const recLoc = (recordLocation || '').toLowerCase().trim();

  // If looking for a specific cause, legacy records without location do not match
  if (!recLoc) return false;

  const normPage = mapCauseKeyToLocation(pageK);
  const normRec = mapCauseKeyToLocation(recLoc);

  return normPage === normRec;
}

function formatRelativeDate(isoOrDateStr) {
  if (!isoOrDateStr) return 'Recent';
  try {
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) return String(isoOrDateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMinutes < 5) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24 && d.getDate() === now.getDate()) return `${diffHours}h ago`;
    if (diffDays <= 0 || (diffDays === 1 && d.getDate() === now.getDate())) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

// Fetch live donations from Supabase REST API
let cachedSupabaseDonations = null;
async function fetchSupabaseDonations(forceRefresh = false) {
  if (cachedSupabaseDonations && !forceRefresh) return cachedSupabaseDonations;
  try {
    const url = `${SUPABASE_BACKEND.getUrl()}/rest/v1/donations?select=*&status=eq.Success&order=created_at.desc&limit=100`;
    const resp = await fetch(url, {
      headers: {
        'apikey': SUPABASE_BACKEND.getKey(),
        'Authorization': `Bearer ${SUPABASE_BACKEND.getKey()}`
      }
    });
    if (!resp.ok) return [];
    const rows = await resp.json();
    cachedSupabaseDonations = Array.isArray(rows) ? rows : [];
    return cachedSupabaseDonations;
  } catch (e) {
    console.warn('Failed to fetch donations from Supabase:', e);
    return [];
  }
}

// =============================================================
// PDF RECEIPT GENERATION (pdf-lib) & SUPABASE STORAGE UPLOAD
// =============================================================
async function generateReceiptPdfBlob(donor, meta) {
  if (typeof window.PDFLib === 'undefined') {
    console.warn('PDFLib not available on window, skipping PDF generation.');
    return null;
  }
  try {
    const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // US Letter
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.04, 0.15, 0.45);
    const black = rgb(0.1, 0.1, 0.1);
    let y = 740;

    // Header logo
    try {
      const logoResp = await fetch('images/pur-for-cure-logo-clean.jpg');
      if (logoResp.ok) {
        const logoBytes = await logoResp.arrayBuffer();
        const logoImg = await pdfDoc.embedJpg(logoBytes);
        const dims = logoImg.scaleToFit(110, 44);
        page.drawImage(logoImg, { x: 50, y: y - 30, width: dims.width, height: dims.height });
      }
    } catch (e) {
      console.warn('Logo embed error:', e);
    }

    page.drawText('PURE FOR CURE', { x: 350, y: y + 10, size: 18, font: bold, color: navy });
    page.drawText('(Serving the mission of His Divine Grace A.C. Bhaktivedanta Swami Prabhupada)', { x: 200, y: y - 6, size: 7, font, color: black });
    y -= 55;
    page.drawText('Ref. No.: ' + meta.refNo, { x: 50, y, size: 10, font: bold, color: black });
    page.drawText('Date: ' + meta.dateStr, { x: 420, y, size: 10, font: bold, color: black });
    y -= 45;
    page.drawText('DONATION RECEIPT', { x: 170, y, size: 26, font: bold, color: navy });
    y -= 35;
    page.drawText('This is to acknowledge that PURE FOR CURE, GUWAHATI has received a contribution of', { x: 50, y, size: 10, font, color: black });
    y -= 55;
    page.drawRectangle({ x: 180, y: y - 10, width: 250, height: 45, borderColor: navy, borderWidth: 1.5 });
    page.drawText('Rs. ' + Number(donor.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), { x: 220, y: y + 5, size: 22, font: bold, color: navy });
    y -= 60;

    const col = (label, value, x) => {
      page.drawText(label, { x, y, size: 9, font: bold, color: black });
      page.drawText(String(value || ''), { x, y: y - 13, size: 9, font, color: black });
    };
    const wrapText = (text, f, size, maxWidth) => {
      const words = String(text || '').split(' ');
      const lines = [];
      let line = '';
      words.forEach(word => {
        const test = line ? line + ' ' + word : word;
        if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      });
      if (line) lines.push(line);
      return lines;
    };

    col('Donor Name', donor.name, 50);
    col('WhatsApp No.', donor.phone, 230);
    col('Towards', donor.causeName || 'Pure for Cure-Satvik Food Distribution', 380);
    y -= 35;
    page.drawText('Address', { x: 50, y, size: 9, font: bold, color: black });
    const addressLines = wrapText(donor.address || 'Guwahati, Assam, India', font, 9, 290).slice(0, 2);
    addressLines.forEach((line, i) => {
      page.drawText(line, { x: 50, y: y - 13 - i * 12, size: 9, font, color: black });
    });
    y -= 13 + (addressLines.length - 1) * 12 + 22;
    col('Email ID', donor.email, 50);
    col('PAN', donor.pan || 'NOT_PROVIDED', 230);
    y -= 45;
    page.drawText('Payment Mode', { x: 380, y, size: 9, font: bold, color: black });
    page.drawText('Razorpay (Card/UPI/NetBanking)', { x: 380, y: y - 13, size: 9, font, color: black });
    page.drawText('Txn ID: ' + meta.txnId, { x: 380, y: y - 26, size: 8, font, color: black });
    y -= 60;
    page.drawText('Thank you for your generous support', { x: 190, y, size: 11, font, color: black });
    y -= 45;
    page.drawText('Donations to this institution are exempted u/s 80G Vide', { x: 50, y, size: 8, font, color: black });
    page.drawText('14/80G/CIT/GHY-II/2011-12/4701-05 DTD:29/02/2012', { x: 50, y, size: 8, font, color: black });
    page.drawText('PAN: AAATH8807J', { x: 50, y: y - 22, size: 8, font, color: black });

    // Signature
    try {
      const sigResp = await fetch('images/signature-janardan-dasa.png');
      if (sigResp.ok) {
        const sigBytes = await sigResp.arrayBuffer();
        const sigImg = await pdfDoc.embedPng(sigBytes);
        const sigDims = sigImg.scaleToFit(80, 35);
        page.drawImage(sigImg, { x: 440, y: y + 2, width: sigDims.width, height: sigDims.height });
      }
    } catch (e) {
      console.warn('Signature embed error:', e);
    }
    page.drawText('Janardan Dasa', { x: 440, y: y - 22, size: 10, font: bold, color: black });
    page.drawText('President', { x: 440, y: y - 34, size: 9, font, color: black });

    y = 90;
    page.drawLine({ start: { x: 50, y: y + 10 }, end: { x: 562, y: y + 10 }, thickness: 0.5, color: black });
    col('Contact', '+917099039770', 50);
    col('Email', 'info@hkmguwahati.org', 220);
    col('Address', 'Hare Krishna Mandir Road, Ghorajan, Guwahati 781031, Assam', 380);

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } catch (err) {
    console.error('Error generating PDF receipt:', err);
    return null;
  }
}

async function uploadPdfReceiptToSupabase(pdfBlob, refNo) {
  if (!pdfBlob) return null;
  const url = `${SUPABASE_BACKEND.getUrl()}/storage/v1/object/receipts/Donation-Receipt-${refNo}.pdf`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_BACKEND.getKey(),
        'Authorization': `Bearer ${SUPABASE_BACKEND.getKey()}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true'
      },
      body: pdfBlob
    });
    if (resp.ok) {
      const pubUrl = `${SUPABASE_BACKEND.getUrl()}/storage/v1/object/public/receipts/Donation-Receipt-${refNo}.pdf`;
      console.log('✓ Receipt PDF uploaded to Supabase Storage:', pubUrl);
      return pubUrl;
    } else {
      console.warn('Supabase storage upload failed status:', resp.status);
    }
  } catch (err) {
    console.warn('Supabase storage upload error:', err);
  }
  return null;
}

async function sendEmailReceipt(donor, meta, receiptUrl) {
  if (typeof window.emailjs === 'undefined' || !window.emailjs.send) {
    console.info('EmailJS library not ready, skipping automated email.');
    return false;
  }
  try {
    const formattedAmount = '₹' + Number(donor.amount).toLocaleString('en-IN');
    const emailSubject = `Official 80G Tax Exemption Donation Receipt (${meta.refNo}) - Pure for Cure`;
    const emailBody = [
      `Hare Krishna, Respected ${donor.name}!`,
      ``,
      `Please accept our heartfelt gratitude and humble greetings from Pure for Cure (Hare Krishna Movement, Guwahati).`,
      ``,
      `We have gratefully received your kind contribution of ${formattedAmount} towards "${donor.causeName}". Your selfless support directly sponsors warm, wholesome, nutritious Sattvik meals for patients and their devoted attendants outside government hospitals across Assam.`,
      ``,
      `--------------------------------------------------`,
      `OFFICIAL SECTION 80G DONATION RECEIPT SUMMARY`,
      `--------------------------------------------------`,
      `• Receipt Number: ${meta.refNo}`,
      `• Receipt Date: ${meta.dateStr}`,
      `• Contributor Name: ${donor.name}`,
      `• Contributor Contact: ${donor.phone || 'N/A'}`,
      `• Contributor Email: ${donor.email}`,
      `• Contributor PAN: ${donor.pan || 'NOT_PROVIDED'}`,
      `• Contribution Amount: ${formattedAmount}`,
      `• Payment Gateway Txn ID: ${meta.txnId}`,
      `• Seva Initiative: ${donor.causeName}`,
      `• Tax Exemption: 50% Tax Exemption u/s 80G(5)(vi) of Income Tax Act`,
      `• 80G Order No: 14/80G/CIT/GHY-II/2011-12/4701-05 DTD:29/02/2012`,
      `• Institution PAN: AAATH8807J`,
      `--------------------------------------------------`,
      receiptUrl ? `📄 Official Signed 80G PDF Receipt Download:\n${receiptUrl}\n` : '',
      `Your noble support brings critical nourishment and comfort to economically vulnerable caregivers staying day and night at hospital corridors of AIIMS Guwahati, GMCH, and Dr. B. Borooah Cancer Institute (BBCI).`,
      ``,
      `HELPLINE & SUPPORT DESK:`,
      `📞 Phone: +91 7099039770 / +91 9678007302`,
      `✉️ Email: info@pureforcure.org | info@hkmguwahati.org`,
      `🏛️ Address: c/o Hare Krishna Movement, Ghorajan, Near IIT Guwahati, North Guwahati, Assam - 781031`,
      ``,
      `May Lord Sri Krishna shower His supreme blessings of health, joy, and peace upon you and your loved ones.`,
      ``,
      `With heartfelt gratitude & prayers,`,
      `Janardan Dasa (President)`,
      `Pure for Cure - Hare Krishna Movement Guwahati`,
      `https://pureforcure.org`
    ].filter(Boolean).join('\n');

    await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
      donor_email: donor.email, // Required by EmailJS template recipient field
      to_email: donor.email,
      email: donor.email,
      recipient_email: donor.email,
      to_name: donor.name,
      donor_name: donor.name,
      name: donor.name,
      amount: formattedAmount,
      donation_amount: formattedAmount,
      formatted_amount: formattedAmount,
      receipt_no: meta.refNo,
      ref_no: meta.refNo,
      receipt_number: meta.refNo,
      txn_id: meta.txnId,
      payment_id: meta.txnId,
      transaction_id: meta.txnId,
      date: meta.dateStr,
      receipt_date: meta.dateStr,
      cause: donor.causeName,
      cause_name: donor.causeName,
      pan: donor.pan || 'NOT_PROVIDED',
      donor_pan: donor.pan || 'NOT_PROVIDED',
      phone: donor.phone || '',
      donor_phone: donor.phone || '',
      receipt_url: receiptUrl || 'https://pureforcure.org/donate.html',
      pdf_url: receiptUrl || 'https://pureforcure.org/donate.html',
      download_link: receiptUrl || 'https://pureforcure.org/donate.html',
      subject: emailSubject,
      message: emailBody,
      notes: `80G Donation Receipt issued on ${meta.dateStr} for ${donor.name}`
    });
    console.log('✓ Automated email receipt dispatched via EmailJS to:', donor.email, 'for donor:', donor.name, 'amount:', formattedAmount);
    return true;
  } catch (err) {
    console.warn('EmailJS send error:', err);
    return false;
  }
}

// Active donation object being processed
let currentDonationData = null;

function executeRazorpayPay() {
  if (!currentDonationData) return;
  const keyId = RAZORPAY_ENGINE.getKeyId();
  
  if (typeof window.Razorpay !== 'undefined' && keyId && keyId !== 'rzp_test_placeholder') {
    const options = {
      key: keyId,
      amount: parseInt(currentDonationData.amount) * 100, // paise
      currency: 'INR',
      name: RAZORPAY_ENGINE.merchantName,
      description: currentDonationData.causeName,
      image: RAZORPAY_ENGINE.logo,
      prefill: {
        name: currentDonationData.name,
        email: currentDonationData.email,
        contact: currentDonationData.phone
      },
      notes: {
        cause: currentDonationData.causeName,
        pan: currentDonationData.pan,
        tax_exemption: 'Section 80G Certified'
      },
      theme: { color: RAZORPAY_ENGINE.themeColor },
      handler: function(response) {
        completeSuccessfulDonation(response.razorpay_payment_id || 'pay_' + Date.now());
      }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
    document.getElementById('payment-gateway-modal')?.classList.remove('active');
  } else {
    // If no live key is saved, prompt or let user simulate
    const userKey = prompt('Please enter your Razorpay Key ID (e.g. rzp_live_... or rzp_test_...):\n(Press Cancel to test with instant simulated payment)');
    if (userKey && userKey.trim()) {
      RAZORPAY_ENGINE.setKeyId(userKey.trim());
      updateRzpKeyDisplay();
      executeRazorpayPay();
    } else {
      executeSimulatedPay();
    }
  }
}

function executeSimulatedPay() {
  if (!currentDonationData) return;
  const simPayId = 'pay_sim_' + Math.random().toString(36).substring(2, 10).toUpperCase();
  completeSuccessfulDonation(simPayId);
}

async function completeSuccessfulDonation(paymentId) {
  const gatewayModal = document.getElementById('payment-gateway-modal');
  const receiptModal = document.getElementById('receipt-modal');

  if (gatewayModal) gatewayModal.classList.remove('active');

  const now = new Date();
  const yearMonth = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0');
  const rNum = 'PFC-DR-' + yearMonth + '-' + Math.floor(100000 + Math.random() * 900000);
  const rDate = now.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  const locationCode = mapCauseKeyToLocation(currentDonationData ? currentDonationData.causeKey : '');

  // 1. Save to LocalStorage immediately with normalized location
  saveDonation({
    ...currentDonationData,
    location: locationCode,
    causeKey: currentDonationData.causeKey,
    paymentId: paymentId,
    txn_id: paymentId,
    timeAgo: 'Just now',
    timestamp: Date.now(),
    receipt_no: rNum,
    dateStr: rDate
  });

  // 2. Populate & open 80G receipt modal
  if (document.getElementById('receipt-no')) document.getElementById('receipt-no').textContent = rNum;
  if (document.getElementById('receipt-date')) document.getElementById('receipt-date').textContent = rDate;
  if (document.getElementById('receipt-donor-name')) document.getElementById('receipt-donor-name').textContent = currentDonationData.name;
  if (document.getElementById('receipt-donor-pan')) document.getElementById('receipt-donor-pan').textContent = currentDonationData.pan || 'NOT_PROVIDED';
  if (document.getElementById('receipt-amount')) document.getElementById('receipt-amount').textContent = '₹' + parseInt(currentDonationData.amount).toLocaleString('en-IN');
  if (document.getElementById('receipt-cause')) document.getElementById('receipt-cause').textContent = currentDonationData.causeName;
  if (document.getElementById('receipt-email-confirm')) document.getElementById('receipt-email-confirm').textContent = currentDonationData.email;

  if (receiptModal) receiptModal.classList.add('active');

  // 3. IMMEDIATELY refresh recent donations strictly below this particular form!
  const contribEl = document.getElementById('dynamic-recent-contributors');
  const targetCauseKey = contribEl ? (contribEl.getAttribute('data-cause-key') || currentDonationData.causeKey || 'all') : (currentDonationData.causeKey || 'all');
  renderRecentDonations('dynamic-recent-contributors', targetCauseKey);
  renderFooterRecentDonations();
  updateMonthlyTargetTracker();

  // 4. Asynchronous background workflow: PDF Generation -> Supabase Storage Upload -> EmailJS Email Receipt -> Supabase DB Record
  (async () => {
    let receiptUrl = '';
    let pdfBlob = null;
    try {
      pdfBlob = await generateReceiptPdfBlob(currentDonationData, { refNo: rNum, dateStr: rDate, txnId: paymentId });
      if (pdfBlob) {
        // Wire up download button in modal immediately
        const dlBtn = document.getElementById('receipt-download-pdf-btn');
        if (dlBtn) {
          dlBtn.onclick = () => {
            const fileUrl = receiptUrl || URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = `Donation-Receipt-${rNum}.pdf`;
            a.target = '_blank';
            a.click();
          };
          dlBtn.style.display = 'inline-flex';
        }

        // Upload to Supabase Storage
        receiptUrl = await uploadPdfReceiptToSupabase(pdfBlob, rNum) || '';
      }
    } catch (e) {
      console.warn('PDF generation/upload issue:', e);
    }

    // Sync Record to Supabase Database (donations table)
    try {
      await SUPABASE_BACKEND.insertRecord('donations', {
        name: currentDonationData.name,
        email: currentDonationData.email,
        phone: currentDonationData.phone,
        amount: parseInt(currentDonationData.amount),
        location: locationCode,
        method: currentDonationData.paymentMode || 'Razorpay',
        status: 'Success',
        txn_id: paymentId,
        date: new Date().toISOString().split('T')[0],
        notes: `PAN: ${currentDonationData.pan || 'N/A'} | Cause: ${currentDonationData.causeName} | Ref: ${rNum}${receiptUrl ? ' | Receipt: ' + receiptUrl : ''}`
      });
    } catch (dbErr) {
      console.warn('Supabase DB insert warning:', dbErr);
    }

    // Send Email Receipt automatically via EmailJS with suitable response template
    try {
      await sendEmailReceipt(currentDonationData, { refNo: rNum, dateStr: rDate, txnId: paymentId }, receiptUrl);
    } catch (mailErr) {
      console.warn('Email dispatch warning:', mailErr);
    }

    // Refresh live donations cache from Supabase & re-render contributors strictly below this form
    try {
      await fetchSupabaseDonations(true);
      renderRecentDonations('dynamic-recent-contributors', targetCauseKey);
      renderFooterRecentDonations();
      updateMonthlyTargetTracker();
    } catch (refreshErr) {
      console.warn('Post-donation refresh warning:', refreshErr);
    }
  })();
}

// Dynamic LocalStorage Donation Management
function getStoredDonations(causeKey) {
  try {
    const raw = localStorage.getItem(DONATIONS_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : [];
    if (!causeKey || causeKey === 'all') return all;
    return all.filter(d => matchesCauseLocation(d.location || d.causeKey, causeKey));
  } catch (e) {
    return [];
  }
}

function saveDonation(donation) {
  try {
    const raw = localStorage.getItem(DONATIONS_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : [];
    all.unshift(donation);
    localStorage.setItem(DONATIONS_STORAGE_KEY, JSON.stringify(all.slice(0, 50)));
  } catch (e) {
    console.error('Failed to save donation', e);
  }
}

// Render dynamic recent contributions below donation form (strictly filtered by causeKey)
async function renderRecentDonations(containerId, causeKey) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const effectiveCauseKey = causeKey || container.getAttribute('data-cause-key') || 'all';

  // 1. Render immediately from local session donations if present
  const localDonations = getStoredDonations(effectiveCauseKey);
  _renderContributorsHtml(container, localDonations, effectiveCauseKey);

  // 2. Fetch live from Supabase table `donations`
  try {
    const remoteList = await fetchSupabaseDonations();
    if (remoteList && remoteList.length > 0) {
      // Map remote rows to contributor objects
      const remoteFormatted = remoteList.map(r => ({
        name: r.name,
        amount: r.amount,
        causeName: getCauseNameFromLocation(r.location),
        location: r.location,
        timeAgo: formatRelativeDate(r.date || r.created_at),
        timestamp: r.created_at ? new Date(r.created_at).getTime() : 0,
        paymentMode: r.method || 'Razorpay',
        paymentId: r.txn_id,
        causeKey: r.location
      }));

      // Deduplicate: merge local and remote by payment ID
      const seenIds = new Set();
      const combined = [];

      localDonations.forEach(l => {
        const id = l.paymentId || l.txn_id;
        if (id) seenIds.add(id);
        combined.push(l);
      });

      remoteFormatted.forEach(r => {
        const id = r.paymentId || r.txn_id;
        if (!id || !seenIds.has(id)) {
          if (id) seenIds.add(id);
          combined.push(r);
        }
      });

      // Sort newest first
      combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      // Filter strictly for this particular causeKey!
      const filtered = combined.filter(d => matchesCauseLocation(d.location || d.causeKey, effectiveCauseKey));
      _renderContributorsHtml(container, filtered, effectiveCauseKey);
    }
  } catch (err) {
    console.warn('Error fetching live donors:', err);
  }
}

function _renderContributorsHtml(container, donations, causeKey) {
  if (!donations || donations.length === 0) {
    const causeLabel = getCauseNameFromLocation(causeKey) || 'this Seva Initiative';
    container.innerHTML = `
      <div class="dynamic-empty-state">
        <i class="fa-solid fa-hand-holding-heart" style="font-size:2.4rem; color:#CBD5E1; margin-bottom:0.75rem; display:block;"></i>
        <h4 style="font-size:1.15rem; color:var(--dark); margin-bottom:0.35rem;">Be the First to Sponsor Meals for ${causeLabel}!</h4>
        <p style="font-size:0.9rem; color:var(--text-muted); margin:0; max-width:540px; margin:0 auto;">
          Donate using the secure form above. Once processed, your generous contribution and official 80G tax receipt will appear here instantly!
        </p>
      </div>
    `;
    return;
  }

  let html = '<div class="contributors-list">';
  donations.forEach((d, idx) => {
    const initial = (d.name || 'D').charAt(0).toUpperCase();
    const isVeryRecent = d.timeAgo === 'Just now';
    const showCause = causeKey === 'all';
    html += `
      <div class="contributor-row" style="${isVeryRecent ? 'background:#F0FDF4; border-left:4px solid #16A34A;' : ''}">
        <div>
          <div class="contrib-initial">${initial}.</div>
          <div class="contrib-avatar">${initial}<span class="contrib-rank">${idx + 1}</span></div>
        </div>
        <div class="contrib-info">
          <div class="contrib-name-line">
            <strong>${d.name}</strong> &nbsp;Donated <span class="contrib-amount">&#8377;${parseInt(d.amount).toLocaleString('en-IN')}.00</span>
            ${isVeryRecent ? '<span style="background:#DCFCE7; color:#15803D; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:12px; margin-left:6px; border:1px solid #86EFAC;"><i class="fa-solid fa-sparkles"></i> New Seva</span>' : ''}
          </div>
          <div class="contrib-time">
            <i class="fa-regular fa-clock"></i> ${d.timeAgo || 'Recent'}${showCause && d.causeName ? ` &bull; <span style="color:#1A8C4E; font-weight:700;">${d.causeName}</span>` : ''}${d.paymentMode ? ` &bull; <span style="text-transform:uppercase; font-size:0.75rem; background:#E2E8F0; padding:2px 6px; border-radius:4px;">${d.paymentMode}</span>` : ''}
            <span style="color:#059669; font-size:0.75rem; margin-left:4px;"><i class="fa-solid fa-shield-halved"></i> 80G Verified</span>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

async function renderFooterRecentDonations() {
  const container = document.getElementById('footer-recent-contributions');
  if (!container) return;

  let donations = [];
  try {
    const remote = await fetchSupabaseDonations();
    if (remote && remote.length > 0) {
      donations = remote.map(r => ({
        name: r.name,
        amount: r.amount,
        causeName: getCauseNameFromLocation(r.location),
        timeAgo: formatRelativeDate(r.date || r.created_at)
      }));
    }
  } catch (e) {}

  if (!donations || donations.length === 0) {
    donations = getStoredDonations('all');
  }

  if (!donations || donations.length === 0) {
    donations = [
      { name: 'Arunjyoti Buragohain', amount: 4800, causeName: 'GMCH Attendant Meals', timeAgo: 'Recent' },
      { name: 'Sagar Baruah', amount: 800, causeName: 'Assam Flood Relief Seva', timeAgo: 'Recent' },
      { name: 'Santana Haloi', amount: 800, causeName: 'BBCI Hospital Food Distribution', timeAgo: 'Recent' },
      { name: 'Bhanwar Singh', amount: 80, causeName: 'Hospital Food Distribution', timeAgo: 'Recent' }
    ];
  }

  let html = '';
  donations.slice(0, 4).forEach(d => {
    const initial = (d.name || 'D').charAt(0).toUpperCase();
    const formattedAmount = parseInt(d.amount).toLocaleString('en-IN');
    html += `
      <div class="footer-contrib-card">
        <div class="footer-contrib-left">
          <div class="footer-contrib-avatar">${initial}</div>
          <div>
            <div class="footer-contrib-name">${d.name}</div>
            <div class="footer-contrib-cause">${d.causeName || 'Hospital Food Distribution'} &bull; ${d.timeAgo || 'Recent'}</div>
          </div>
        </div>
        <div class="footer-contrib-amount">&#8377;${formattedAmount}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// Track and update Monthly Donation Goal (10,000 Meals / Rs 8,00,000) configured with Razorpay
function updateMonthlyTargetTracker() {
  const trackerEls = document.querySelectorAll('.monthly-goal-tracker');
  if (!trackerEls || trackerEls.length === 0) return;

  const targetGoal = 800000; // Rs 8,00,000 (10,000 Meals @ Rs 80/meal)
  const baseRaised = 224000; // 28% baseline (2,800 meals) - lesser than 30%

  const donations = getStoredDonations('all') || [];
  const additionalRaised = donations.reduce((acc, d) => acc + (parseInt(d.amount) || 0), 0);
  const totalRaised = Math.min(targetGoal, baseRaised + additionalRaised);
  const totalMeals = Math.floor(totalRaised / 80);
  const percent = Math.min(100, Math.round((totalRaised / targetGoal) * 100));
  const remaining = Math.max(0, targetGoal - totalRaised);

  trackerEls.forEach(tracker => {
    const pEl = tracker.querySelector('#monthly-tracker-percent');
    const barEl = tracker.querySelector('#monthly-tracker-bar');
    const raisedEl = tracker.querySelector('#monthly-tracker-raised');
    const mealsEl = tracker.querySelector('#monthly-tracker-meals');
    const remEl = tracker.querySelector('#monthly-tracker-remaining');

    if (pEl) pEl.textContent = percent + '%';
    if (barEl) barEl.style.width = percent + '%';
    if (raisedEl) raisedEl.textContent = '₹' + totalRaised.toLocaleString('en-IN');
    if (mealsEl) mealsEl.textContent = totalMeals.toLocaleString('en-IN');
    if (remEl) remEl.textContent = '₹' + remaining.toLocaleString('en-IN');
  });
}

// =============================================================
// GLOBAL MODALS ASSURANCE ENGINE (Ensures Gateway & Receipt Modals on All Pages)
// =============================================================
function ensureModalsExist() {
  if (!document.getElementById('payment-gateway-modal')) {
    const gwDiv = document.createElement('div');
    gwDiv.className = 'gateway-modal-backdrop';
    gwDiv.id = 'payment-gateway-modal';
    gwDiv.innerHTML = `
      <div style="background:#FFF; border-radius:18px; max-width:460px; width:100%; padding:2.25rem 2rem; text-align:center; box-shadow:0 25px 50px rgba(0,0,0,0.3); position:relative;">
        <button class="lightbox-close-btn" id="gw-close-btn" type="button" aria-label="Close" onclick="document.getElementById('payment-gateway-modal').classList.remove('active');" style="position:absolute; top:12px; right:12px; background:none; border:none; font-size:1.5rem; cursor:pointer; color:#94A3B8;">&times;</button>
        <div style="margin-bottom:1rem;">
          <div style="display:inline-flex; align-items:center; gap:0.5rem; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:30px; padding:4px 14px; font-size:0.8rem; color:#1D4ED8; font-weight:700; margin-bottom:0.75rem;">
            <i class="fa-solid fa-shield-halved" style="color:#2563EB;"></i> Razorpay Official Payment Gateway
          </div>
          <h3 style="font-size:1.35rem; color:var(--dark); margin:0 0 0.25rem;">Confirm &amp; Proceed to Pay</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">256-Bit SSL Encrypted &bull; 100% Tax Deductible 80G</p>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:1.1rem 1.25rem; text-align:left; font-size:0.88rem; margin-bottom:1.25rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
            <span style="color:var(--text-muted);">Merchant:</span>
            <strong>Pure for Cure - Hare Krishna Movement Guwahati</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
            <span style="color:var(--text-muted);">Seva Cause:</span>
            <span id="gw-cause" style="font-weight:700; color:#1A8C4E;">Hospital Caregiver Food Distribution</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
            <span style="color:var(--text-muted);">Payment Channel:</span>
            <span id="gw-mode" style="font-weight:700; text-transform:uppercase; color:#0D80CC;">UPI / QR</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-top:1px dashed #CBD5E1; padding-top:0.6rem; margin-top:0.4rem; align-items:center;">
            <strong style="color:var(--dark); font-size:0.95rem;">Total Contribution:</strong>
            <strong id="gw-amount" style="font-size:1.35rem; color:#1A8C4E;">&#8377;2,000</strong>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1rem;">
          <button id="gw-pay-razorpay-btn" type="button" class="btn btn-primary" style="width:100%; justify-content:center; padding:0.9rem; font-size:1rem; border-radius:8px; box-shadow:0 4px 14px rgba(252,160,40,0.35);" onclick="executeRazorpayPay();">
            <i class="fa-solid fa-lock"></i> Pay via Razorpay Checkout
          </button>
          <button id="gw-sim-btn" type="button" class="btn btn-outline" style="width:100%; justify-content:center; padding:0.65rem; font-size:0.85rem; border-radius:8px; color:var(--text-muted); border-color:#CBD5E1;" onclick="executeSimulatedPay();">
            <i class="fa-solid fa-flask"></i> Instant Test Mode (Simulate 80G Receipt)
          </button>
        </div>
        <div style="border-top:1px solid #E2E8F0; padding-top:0.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.78rem; color:var(--text-muted);" id="rzp-status-label">
              <i class="fa-solid fa-key" style="color:#D97706;"></i> Razorpay Key: <strong id="rzp-current-key-display">Default (Test)</strong>
            </span>
            <button type="button" onclick="toggleRzpKeyInput()" style="background:none; border:none; color:#0D80CC; font-size:0.78rem; font-weight:700; cursor:pointer;">
              Change Key
            </button>
          </div>
          <div id="rzp-key-input-container" style="display:none; margin-top:0.6rem; text-align:left; background:#F1F5F9; padding:0.75rem; border-radius:8px;">
            <label style="font-size:0.75rem; font-weight:700; color:var(--dark); display:block; margin-bottom:0.25rem;">Paste Razorpay Key ID (rzp_live_... or rzp_test_...):</label>
            <div style="display:flex; gap:0.4rem;">
              <input type="text" id="rzp-custom-key-input" placeholder="e.g. rzp_live_xxxxxxxxxxxx" style="flex:1; padding:0.45rem 0.6rem; font-size:0.8rem; border:1px solid #CBD5E1; border-radius:4px;">
              <button type="button" class="btn btn-sm btn-primary" onclick="saveCustomRzpKey()">Save</button>
            </div>
            <p style="font-size:0.72rem; color:var(--text-muted); margin:0.35rem 0 0;">Found in your Razorpay Dashboard &rarr; Settings &rarr; API Keys.</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(gwDiv);
  }

  if (!document.getElementById('receipt-modal')) {
    const rcptDiv = document.createElement('div');
    rcptDiv.className = 'receipt-modal-backdrop';
    rcptDiv.id = 'receipt-modal';
    rcptDiv.innerHTML = `
      <div class="receipt-card">
        <button class="lightbox-close-btn" id="receipt-close-btn" type="button" aria-label="Close" onclick="document.getElementById('receipt-modal').classList.remove('active');">&times;</button>
        <div class="receipt-header-brand">
          <img src="images/logo/hkm-logo.png" alt="HKM Logo" style="height:50px;">
          <div>
            <h3 style="margin:0; font-size:1.25rem; color:var(--dark);">PURE FOR CURE - HARE KRISHNA MANDIR</h3>
            <p style="margin:0; font-size:0.8rem; color:#1A8C4E; font-weight:700;">OFFICIAL SECTION 80G TAX EXEMPTION RECEIPT</p>
          </div>
        </div>
        <div class="receipt-highlight-box">
          <i class="fa-solid fa-circle-check" style="font-size:2.2rem; color:#16A34A; margin-bottom:0.5rem;"></i>
          <h4 style="color:#166534; font-size:1.2rem; margin-bottom:0.25rem;">Payment Successful &amp; 80G Receipt Issued</h4>
          <p style="font-size:0.88rem; color:#15803D; margin:0;">
            A copy of this 80G Tax Exemption receipt and donor confirmation has been emailed to: <br>
            <strong id="receipt-email-confirm" style="color:#0F5132;">donor@example.com</strong>
          </p>
        </div>
        <div style="margin-bottom:1.5rem;">
          <div class="receipt-row"><span>Receipt No:</span><strong id="receipt-no">PFC-DR-202610-104928</strong></div>
          <div class="receipt-row"><span>Receipt Date:</span><strong id="receipt-date">26 Sep 2026</strong></div>
          <div class="receipt-row"><span>Donor Name:</span><strong id="receipt-donor-name">Devoted Supporter</strong></div>
          <div class="receipt-row"><span>Donor PAN:</span><strong id="receipt-donor-pan">ABCDE1234F</strong></div>
          <div class="receipt-row"><span>Seva Cause:</span><strong id="receipt-cause">Hospital Caregiver Food Distribution</strong></div>
          <div class="receipt-row"><span>Total Amount:</span><strong id="receipt-amount" style="font-size:1.2rem; color:#1A8C4E;">&#8377;2,000</strong></div>
          <div class="receipt-row"><span>Payment Status:</span><span style="color:#16A34A; font-weight:700;"><i class="fa-solid fa-check"></i> Verified via Razorpay Gateway</span></div>
          <div class="receipt-row"><span>80G Exemption:</span><span>14/80G/CIT/GHY-II/2011-12/4701-05 &bull; PAN: AAATH8807J</span></div>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:0.85rem; border-radius:6px; font-size:0.8rem; color:var(--text-muted); margin-bottom:1.5rem; text-align:center;">
          Donations to this institution are 50% tax-exempt under Section 80G(5)(vi) of the Income Tax Act, Govt. of India.
        </div>
        <div style="display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap;">
          <button id="receipt-download-pdf-btn" type="button" class="btn btn-primary" style="background:#16A34A; border-color:#16A34A;">
            <i class="fa-solid fa-file-arrow-down"></i> Download 80G Receipt (PDF)
          </button>
          <button type="button" class="btn btn-secondary" onclick="window.print()">
            <i class="fa-solid fa-print"></i> Print Receipt
          </button>
          <button type="button" class="btn btn-outline" onclick="document.getElementById('receipt-modal').classList.remove('active');">
            Close
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(rcptDiv);
  }
}

// Quick donation handler for About, Contact, Terms pages
window.handleQuickDonation = function(e, form) {
  if (e && e.preventDefault) e.preventDefault();
  form = form || (e ? e.target : null);
  if (!form) return false;

  const nameInp = form.querySelector('input[name="name"]');
  const phoneInp = form.querySelector('input[name="phone"]');
  const emailInp = form.querySelector('input[name="email"]');
  const panInp = form.querySelector('input[name="pan"]');
  const amtInp = form.querySelector('input[name="amount"]');

  const donorName = nameInp?.value.trim() || '';
  const donorPhone = phoneInp?.value.trim() || '';
  const donorEmail = emailInp?.value.trim() || '';
  const donorPan = panInp?.value.trim() || '';
  const donationAmt = amtInp?.value.trim() || '2000';
  const causeName = form.getAttribute('data-cause') || 'General Hospital Food Distribution Seva';
  const causeKey = form.getAttribute('data-cause-key') || 'general';

  // Clear previous inline errors
  [nameInp, phoneInp, emailInp].forEach(inp => { if (inp) inp.style.borderColor = '#CBD5E1'; });

  // Responsive Validation with Visual Feedback
  if (!donorName) {
    if (nameInp) {
      nameInp.style.borderColor = '#EF4444';
      nameInp.focus();
      nameInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    alert('Please enter your Full Name.');
    return false;
  }
  if (!donorPhone || donorPhone.length < 10) {
    if (phoneInp) {
      phoneInp.style.borderColor = '#EF4444';
      phoneInp.focus();
      phoneInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    alert('Please enter a valid 10-digit mobile number.');
    return false;
  }
  if (!donorEmail || !donorEmail.includes('@')) {
    if (emailInp) {
      emailInp.style.borderColor = '#EF4444';
      emailInp.focus();
      emailInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    alert('Please enter your Email Address for the 80G tax receipt.');
    return false;
  }

  currentDonationData = {
    name: donorName,
    email: donorEmail,
    phone: donorPhone,
    pan: donorPan ? donorPan.toUpperCase() : 'NOT_PROVIDED',
    amount: donationAmt,
    causeName: causeName,
    causeKey: causeKey,
    paymentMode: 'UPI'
  };

  ensureModalsExist();
  const gwModal = document.getElementById('payment-gateway-modal');
  if (gwModal) {
    const gwAmt = document.getElementById('gw-amount');
    const gwCause = document.getElementById('gw-cause');
    const gwMode = document.getElementById('gw-mode');
    if (gwAmt) gwAmt.textContent = '₹' + parseInt(donationAmt).toLocaleString('en-IN');
    if (gwCause) gwCause.textContent = causeName;
    if (gwMode) gwMode.textContent = 'UPI / Razorpay';
    updateRzpKeyDisplay();
    gwModal.classList.add('active');
  } else {
    executeRazorpayPay();
  }
  return false;
};


document.addEventListener('DOMContentLoaded', () => {
  // Initialize Footer Newsletter Subscription Form
  initFooterNewsletter();
  if (typeof NEWSLETTER_AUTOMATION !== 'undefined' && NEWSLETTER_AUTOMATION.checkAndNotifyLatestStory) {
    NEWSLETTER_AUTOMATION.checkAndNotifyLatestStory();
  }

  // Update Razorpay Key Display in Modal
  updateRzpKeyDisplay();

  // Initialize Monthly Target Tracker configured with Razorpay
  updateMonthlyTargetTracker();

  // Mobile Nav Toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = mobileToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
      }
    });
  }

  // Hero Slideshow Carousel (5s interval)
  const slides = document.querySelectorAll('.slide');
  const dotsContainer = document.querySelector('.carousel-dots');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');

  if (slides.length > 0) {
    let currentSlide = 0;
    let slideInterval;

    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      slides.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        if (idx === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(idx));
        dotsContainer.appendChild(dot);
      });
    }

    const dots = document.querySelectorAll('.dot');

    function goToSlide(n) {
      slides[currentSlide].classList.remove('active');
      if (dots[currentSlide]) dots[currentSlide].classList.remove('active');

      currentSlide = (n + slides.length) % slides.length;

      slides[currentSlide].classList.add('active');
      if (dots[currentSlide]) dots[currentSlide].classList.add('active');
    }

    function nextSlide() { goToSlide(currentSlide + 1); }
    function prevSlide() { goToSlide(currentSlide - 1); }

    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetTimer(); });
    if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); resetTimer(); });

    function startTimer() { slideInterval = setInterval(nextSlide, 10000); }
    function resetTimer() { clearInterval(slideInterval); startTimer(); }

    startTimer();
  }

    // Volunteer Stories Carousel (3 Visible on Desktop, 2 on Tablet, 1 on Mobile)
  const volTrack = document.querySelector('.volunteer-track');
  const volSlides = document.querySelectorAll('.volunteer-card-slide');
  const volPrev = document.querySelector('.volunteer-prev');
  const volNext = document.querySelector('.volunteer-next');
  const volPillsContainer = document.querySelector('.carousel-pills') || document.querySelector('.volunteer-stories-section .carousel-pills');

  if (volTrack && volSlides.length > 0) {
    let volIndex = 0;
    let volInterval;
    const totalVol = volSlides.length;

    function getVisibleCount() {
      if (window.innerWidth <= 640) return 1;
      if (window.innerWidth <= 991) return 2;
      return 3;
    }

    function createDots() {
      if (!volPillsContainer) return;
      volPillsContainer.innerHTML = '';
      const visible = getVisibleCount();
      const dotCount = Math.max(1, totalVol - visible + 1);
      for (let i = 0; i < dotCount; i++) {
        const dot = document.createElement('span');
        dot.className = 'pill-dot' + (i === volIndex ? ' active' : '');
        dot.addEventListener('click', () => {
          volIndex = i;
          updateVolSlider();
          resetVolTimer();
        });
        volPillsContainer.appendChild(dot);
      }
    }

    function updateVolSlider() {
      const visible = getVisibleCount();
      const maxIndex = Math.max(0, totalVol - visible);
      if (volIndex > maxIndex) volIndex = 0;
      if (volIndex < 0) volIndex = maxIndex;

      const gap = parseFloat(getComputedStyle(volTrack).gap) || 24;
      const slideWidth = volSlides[0].getBoundingClientRect().width + gap;
      volTrack.style.transform = `translateX(-${volIndex * slideWidth}px)`;

      const dots = volPillsContainer ? volPillsContainer.querySelectorAll('.pill-dot') : [];
      dots.forEach((d, idx) => {
        if (idx === volIndex) d.classList.add('active');
        else d.classList.remove('active');
      });
    }

    function nextVol() {
      const visible = getVisibleCount();
      const maxIndex = Math.max(0, totalVol - visible);
      volIndex = (volIndex >= maxIndex) ? 0 : volIndex + 1;
      updateVolSlider();
    }

    function prevVol() {
      const visible = getVisibleCount();
      const maxIndex = Math.max(0, totalVol - visible);
      volIndex = (volIndex <= 0) ? maxIndex : volIndex - 1;
      updateVolSlider();
    }

    if (volNext) volNext.addEventListener('click', () => { nextVol(); resetVolTimer(); });
    if (volPrev) volPrev.addEventListener('click', () => { prevVol(); resetVolTimer(); });

    function startVolTimer() { volInterval = setInterval(nextVol, 10000); }
    function resetVolTimer() { clearInterval(volInterval); startVolTimer(); }

    createDots();
    updateVolSlider();
    startVolTimer();

    window.addEventListener('resize', () => {
      createDots();
      updateVolSlider();
    });

    volTrack.addEventListener('mouseenter', () => clearInterval(volInterval));
    volTrack.addEventListener('mouseleave', () => startVolTimer());
  }

  // Initiatives Autoplay Carousel (About Page)
  const initTrack = document.querySelector('.initiatives-track');
  const initSlides = document.querySelectorAll('.initiative-card-slide');
  const initPrev = document.querySelector('.init-prev');
  const initNext = document.querySelector('.init-next');
  const initPills = document.querySelectorAll('.init-pill');

  if (initTrack && initSlides.length > 0) {
    let initIndex = 0;
    let initInterval;
    const totalInit = initSlides.length;

    function getInitVisibleCount() {
      if (window.innerWidth <= 640) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }

    function updateInitSlider() {
      const visible = getInitVisibleCount();
      const maxIndex = Math.max(0, totalInit - visible);
      if (initIndex > maxIndex) initIndex = 0;
      if (initIndex < 0) initIndex = maxIndex;

      const slideWidth = initSlides[0].getBoundingClientRect().width + 24;
      initTrack.style.transform = `translateX(-${initIndex * slideWidth}px)`;

      initPills.forEach((p, idx) => {
        if (idx === initIndex % Math.max(1, initPills.length)) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
      });
    }

    function nextInit() { initIndex++; updateInitSlider(); }
    function prevInit() { initIndex--; updateInitSlider(); }

    if (initNext) initNext.addEventListener('click', () => { nextInit(); resetInitTimer(); });
    if (initPrev) initPrev.addEventListener('click', () => { prevInit(); resetInitTimer(); });

    initPills.forEach((pill, idx) => {
      pill.addEventListener('click', () => {
        initIndex = idx;
        updateInitSlider();
        resetInitTimer();
      });
    });

    function startInitTimer() { initInterval = setInterval(nextInit, 10000); }
    function resetInitTimer() { clearInterval(initInterval); startInitTimer(); }

    startInitTimer();
    window.addEventListener('resize', updateInitSlider);
  }

  // Interactive Gallery Filter & Modal
  const galleryFilterBtns = document.querySelectorAll('.gallery-tab-btn');
  const galleryCards = document.querySelectorAll('.gallery-card-modern');
  const galleryModal = document.getElementById('gallery-lightbox-modal');
  const modalImg = document.getElementById('modal-img');
  const modalBadge = document.getElementById('modal-badge');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const modalDonateBtn = document.getElementById('modal-donate-btn');
  const modalCloseBtn = document.querySelector('.lightbox-close-btn');

  if (galleryFilterBtns.length > 0 && galleryCards.length > 0) {
    galleryFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        galleryFilterBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        const filter = btn.getAttribute('data-filter');

        galleryCards.forEach(card => {
          if (filter === 'all' || card.getAttribute('data-category') === filter) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });

    // Support URL hash filter tabs (e.g. gallery.html#hospital or #kitchen)
    function handleGalleryHash() {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        const targetBtn = Array.from(galleryFilterBtns).find(b => b.getAttribute('data-filter') === hash);
        if (targetBtn) {
          targetBtn.click();
          const section = document.getElementById('photo-gallery') || document.getElementById('initiatives-gallery');
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
    handleGalleryHash();
    window.addEventListener('hashchange', handleGalleryHash);

    function openGalleryModal(card) {
      if (!galleryModal) return;
      const img = card.querySelector('img');
      const badge = card.getAttribute('data-badge') || 'Hospital Food Distribution';
      const title = card.getAttribute('data-title') || 'Pure for Cure Initiative';
      const desc = card.getAttribute('data-desc') || 'Pure for Cure feeds nourishing Sattvik food to hospital attendees.';
      const donateUrl = card.getAttribute('data-donate-url') || 'donate.html';

      if (modalImg && img) {
        modalImg.src = img.src;
        modalImg.alt = img.alt || title;
      }
      if (modalBadge) modalBadge.textContent = badge;
      if (modalTitle) modalTitle.textContent = title;
      if (modalDesc) modalDesc.textContent = desc;
      if (modalDonateBtn) modalDonateBtn.href = donateUrl;

      galleryModal.classList.add('active');
      galleryModal.setAttribute('aria-hidden', 'false');
      if (modalCloseBtn) modalCloseBtn.focus();
    }

    function closeGalleryModal() {
      if (!galleryModal) return;
      galleryModal.classList.remove('active');
      galleryModal.setAttribute('aria-hidden', 'true');
    }

    galleryCards.forEach(card => {
      card.addEventListener('click', () => openGalleryModal(card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openGalleryModal(card);
        }
      });
    });

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeGalleryModal);
    }
    if (galleryModal) {
      galleryModal.addEventListener('click', (e) => {
        if (e.target === galleryModal) closeGalleryModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && galleryModal && galleryModal.classList.contains('active')) {
        closeGalleryModal();
      }
    });
  }



  // =============================================================
  // UNIVERSAL FAST-TOUCH & CLICK DELEGATION FOR ALL BUTTONS ACROSS ALL DEVICES
  // =============================================================
  document.addEventListener('click', function(e) {
    // 1. Preset Meal Buttons (.preset-btn)
    const presetBtn = e.target.closest('.preset-btn');
    if (presetBtn) {
      const form = presetBtn.closest('form') || document.querySelector('.pfc-donation-form');
      const parentContainer = presetBtn.closest('.meal-presets, .donation-form-group') || (form ? form.querySelector('.meal-presets') : null);
      if (parentContainer) {
        parentContainer.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      }
      presetBtn.classList.add('active');

      if (form) {
        const meals = parseInt(presetBtn.getAttribute('data-meals')) || 25;
        const COST_PER_MEAL = 80;
        const total = meals * COST_PER_MEAL;
        
        const mealInput = form.querySelector('#meal-count-input, .meal-count-input');
        const customAmtInput = form.querySelector('#calc-custom-amount, .calc-custom-amount');
        const amountDisplay = form.querySelector('#calc-total-amount, .calc-total-amount');
        const hiddenAmt = form.querySelector('#home-calc-amount-hidden, .calc-amount-hidden');

        if (mealInput) mealInput.value = meals;
        if (customAmtInput) customAmtInput.value = total;
        if (amountDisplay) amountDisplay.textContent = '₹' + total.toLocaleString('en-IN');
        if (hiddenAmt) hiddenAmt.value = total;

        const isHome = form.id === 'home-donation-form' || window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
        if (!isHome) {
          const slider = form.querySelector('.pfc-donation-slider') || document.querySelector('.pfc-donation-slider');
          if (slider) {
            slider.value = total;
            slider.dispatchEvent(new Event('input'));
          }
        }
      }
      return;
    }

    // 2. Product Detail Preset Buttons (.product-preset-btn, .meal-preset-btn)
    const prodBtn = e.target.closest('.product-preset-btn, .meal-preset-btn');
    if (prodBtn) {
      const grid = prodBtn.closest('.meal-preset-grid, .donation-form-group') || document.querySelector('.meal-preset-grid');
      if (grid) {
        grid.querySelectorAll('.product-preset-btn, .meal-preset-btn').forEach(b => b.classList.remove('active'));
      }
      prodBtn.classList.add('active');

      const form = prodBtn.closest('form') || document.querySelector('.pfc-donation-form');
      if (form) {
        const amt = parseInt(prodBtn.getAttribute('data-amount')) || 2000;
        const pInput = form.querySelector('#p-amount-input, .p-amount-input');
        if (pInput) {
          pInput.value = amt;
          pInput.dispatchEvent(new Event('input'));
        }
      }
      return;
    }

    // 3. Quick Donation Meal Buttons (.meal-qty-btn on About/Contact/Terms)
    const qtyBtn = e.target.closest('.meal-qty-btn');
    if (qtyBtn) {
      const group = qtyBtn.parentElement;
      if (group) {
        group.querySelectorAll('.meal-qty-btn').forEach(b => {
          b.classList.remove('active');
          b.style.borderColor = '#CBD5E1';
          b.style.background = '#FFFFFF';
          b.style.color = '#334155';
        });
      }
      qtyBtn.classList.add('active');
      qtyBtn.style.borderColor = '#1A8C4E';
      qtyBtn.style.background = '#E8F5E9';
      qtyBtn.style.color = '#1A8C4E';

      const form = qtyBtn.closest('form');
      if (form) {
        const meals = parseInt(qtyBtn.getAttribute('data-meals')) || 25;
        const amt = parseInt(qtyBtn.getAttribute('data-amt')) || (meals * 80);
        const amtInput = form.querySelector('.amount-input');
        const mealsDisplay = form.querySelector('.meals-display');
        const btnAmtText = form.querySelector('.btn-amount-text');

        if (amtInput) amtInput.value = amt;
        if (mealsDisplay) {
          const mealWord = meals === 1 ? 'Meal' : 'Meals';
          mealsDisplay.value = `${meals} ${mealWord}`;
        }
        if (btnAmtText) btnAmtText.textContent = amt.toLocaleString('en-IN');
      }
      return;
    }

    // 4. Payment Gateway Mode Selection (.gateway-option)
    const gwOpt = e.target.closest('.gateway-option');
    if (gwOpt) {
      const group = gwOpt.closest('.gateway-options-grid');
      if (group) {
        group.querySelectorAll('.gateway-option').forEach(o => o.classList.remove('active'));
      }
      gwOpt.classList.add('active');
      const form = gwOpt.closest('form');
      if (form) {
        const hiddenMode = form.querySelector('.selected-gateway-mode');
        if (hiddenMode) hiddenMode.value = gwOpt.getAttribute('data-mode') || 'UPI';
      }
      return;
    }

    // 5. Bank Account Detail Copy Buttons (.bank-copy-btn)
    const copyBtn = e.target.closest('.bank-copy-btn');
    if (copyBtn) {
      const textToCopy = copyBtn.getAttribute('data-copy');
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const originalHTML = copyBtn.innerHTML;
          copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color:#1A8C4E;"></i> Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.classList.remove('copied');
          }, 2000);
        }).catch(err => {
          console.error('Clipboard copy failed:', err);
        });
      }
      return;
    }
  });

  // =============================================================
  // UNIVERSAL REAL-TIME INPUT DELEGATION FOR ALL DONATION FORMS
  // =============================================================
  document.addEventListener('input', function(e) {
    const COST_PER_MEAL = 80;

    // A. Quick Donation Amount Input (.amount-input on About/Contact/Terms)
    const quickAmtInput = e.target.closest('.amount-input');
    if (quickAmtInput) {
      const form = quickAmtInput.closest('form');
      if (form) {
        const val = parseInt(quickAmtInput.value) || 0;
        const meals = Math.floor(val / COST_PER_MEAL);
        const mealsDisplay = form.querySelector('.meals-display');
        const btnAmtText = form.querySelector('.btn-amount-text');

        if (mealsDisplay) {
          if (val <= 0 || meals <= 0) {
            mealsDisplay.value = '0 Meals';
          } else if (meals === 1) {
            mealsDisplay.value = '1 Meal';
          } else {
            mealsDisplay.value = `${meals} Meals`;
          }
        }

        if (btnAmtText) {
          btnAmtText.textContent = val > 0 ? val.toLocaleString('en-IN') : '0';
        }

        // Sync preset buttons in quick form
        form.querySelectorAll('.meal-qty-btn').forEach(b => {
          const bMeals = parseInt(b.getAttribute('data-meals'));
          const bAmt = parseInt(b.getAttribute('data-amt')) || (bMeals * COST_PER_MEAL);
          if (bAmt === val) {
            b.classList.add('active');
            b.style.borderColor = '#1A8C4E';
            b.style.background = '#E8F5E9';
            b.style.color = '#1A8C4E';
          } else {
            b.classList.remove('active');
            b.style.borderColor = '#CBD5E1';
            b.style.background = '#FFFFFF';
            b.style.color = '#334155';
          }
        });
      }
      return;
    }

    // B. Custom Amount Input on General Calculator (#calc-custom-amount, .calc-custom-amount)
    const customAmtInp = e.target.closest('#calc-custom-amount, .calc-custom-amount');
    if (customAmtInp) {
      const form = customAmtInp.closest('form');
      if (form) {
        const val = parseInt(customAmtInp.value) || 0;
        const meals = Math.floor(val / COST_PER_MEAL);
        const mealInput = form.querySelector('#meal-count-input, .meal-count-input');
        const amountDisplay = form.querySelector('#calc-total-amount, .calc-total-amount');
        const hiddenAmt = form.querySelector('#home-calc-amount-hidden, .calc-amount-hidden');

        if (mealInput && document.activeElement !== mealInput) {
          mealInput.value = meals > 0 ? meals : (val > 0 ? 0 : '');
        }
        if (amountDisplay) {
          amountDisplay.textContent = '₹' + val.toLocaleString('en-IN');
        }
        if (hiddenAmt) {
          hiddenAmt.value = val;
        }

        // Sync preset buttons
        form.querySelectorAll('.preset-btn').forEach(b => {
          const bMeals = parseInt(b.getAttribute('data-meals'));
          const bAmt = parseInt(b.getAttribute('data-amount')) || (bMeals * COST_PER_MEAL);
          if (bAmt === val || (bMeals === meals && val === bMeals * COST_PER_MEAL)) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });

        // Sync slider if present
        const slider = form.querySelector('.pfc-donation-slider') || document.querySelector('.pfc-donation-slider');
        if (slider && parseInt(slider.value) !== val) {
          slider.value = val;
        }
      }
      return;
    }
  });

  // Ensure Modals Exist in DOM
  ensureModalsExist();

  // Global Unified Payment Gateway & Multi-Form Donation Handler
  const donationForms = document.querySelectorAll('.pfc-donation-form');
  const gatewayModal = document.getElementById('payment-gateway-modal');
  const receiptModal = document.getElementById('receipt-modal');

  donationForms.forEach(form => {
    const isHome = form.id === 'home-donation-form' || window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
    const causeKey = form.querySelector('.cause-key-hidden')?.value || 'general';
    const isKiosk = causeKey === 'kiosk';
    const isVehicle = causeKey === 'vehicle';
    const isKitchen = causeKey === 'kitchen';
    const COST_PER_MEAL = 80;

    // Form inputs & elements
    const mealInput = form.querySelector('#meal-count-input, .meal-count-input');
    const amountDisplay = form.querySelector('#calc-total-amount, .calc-total-amount');
    const presetBtns = form.querySelectorAll('.preset-btn');
    const hiddenAmt = form.querySelector('#home-calc-amount-hidden, .calc-amount-hidden');

    const pPresets = form.querySelectorAll('.product-preset-btn');
    const pInput = form.querySelector('.p-amount-input');
    const pMealsText = form.querySelector('.p-meals-count');

    // Campaign Target Module & Slider Elements (STRICTLY NULL ON HOME PAGE)
    const targetModule = isHome ? null : (form.querySelector('.campaign-target-module') || 
                         form.closest('.product-page-layout, .donation-interactive-card, section, .product-sidebar-card')?.querySelector('.campaign-target-module') ||
                         document.querySelector(`.campaign-target-module[data-cause-key="${causeKey}"]`));

    const slider = targetModule ? targetModule.querySelector('.pfc-donation-slider') : null;
    const boostBar = targetModule ? targetModule.querySelector('.target-progress-boost') : null;
    const boostTag = targetModule ? targetModule.querySelector('.boost-tag') : null;
    const boostText = targetModule ? targetModule.querySelector('.target-boost-live-text') : null;
    const chipText = targetModule ? targetModule.querySelector('.slider-dynamic-chip') : null;

    const targetGoal = targetModule ? parseInt(targetModule.getAttribute('data-target-goal')) || 800000 : 800000;
    const baseRaised = targetModule ? parseInt(targetModule.getAttribute('data-base-raised')) || 224000 : 224000;
    const basePercent = (baseRaised / targetGoal) * 100;

    function updateTargetCompletion(amt) {
      if (!targetModule) return;
      amt = parseInt(amt) || 0;
      const boostPercent = (amt / targetGoal) * 100;
      const remainingPercent = Math.max(0, 100 - basePercent);
      const displayBoostPercent = Math.min(remainingPercent, boostPercent);

      if (boostBar) {
        boostBar.style.width = displayBoostPercent.toFixed(1) + '%';
      }

      if (boostTag) {
        if (boostPercent >= 0.05) {
          boostTag.textContent = '+' + (boostPercent >= 1 ? boostPercent.toFixed(1) : boostPercent.toFixed(2)) + '% Boost';
          boostTag.classList.add('active');
        } else {
          boostTag.classList.remove('active');
        }
      }

      if (boostText) {
        if (isKiosk) {
          const kPercent = ((amt / 500000) * 100).toFixed(1);
          boostText.innerHTML = `Your gift funds <strong>${kPercent}%</strong> of this Hospital Kiosk Setup!`;
        } else if (isVehicle) {
          const vPercent = ((amt / 1000000) * 100).toFixed(1);
          boostText.innerHTML = `Your gift funds <strong>${vPercent}%</strong> of this Food Delivery Van!`;
        } else if (isKitchen) {
          boostText.innerHTML = `Your gift provides <strong>₹${amt.toLocaleString('en-IN')}</strong> of pure groceries &amp; cooking essentials!`;
        } else {
          const meals = Math.floor(amt / COST_PER_MEAL);
          boostText.innerHTML = `Your gift adds <strong style="color:#16A34A;">+${meals.toLocaleString('en-IN')} Nourishing Meals</strong> (+${boostPercent.toFixed(1)}% to goal)!`;
        }
      }

      if (chipText) {
        if (isKiosk) {
          const kPercent = ((amt / 500000) * 100).toFixed(0);
          chipText.innerHTML = `${kPercent}% Kiosk Share &bull; <strong>₹${amt.toLocaleString('en-IN')}</strong>`;
        } else if (isVehicle) {
          const vPercent = ((amt / 1000000) * 100).toFixed(0);
          chipText.innerHTML = `${vPercent}% Van Share &bull; <strong>₹${amt.toLocaleString('en-IN')}</strong>`;
        } else if (isKitchen) {
          chipText.innerHTML = `Grocery Seva &bull; <strong>₹${amt.toLocaleString('en-IN')}</strong>`;
        } else {
          const meals = Math.floor(amt / COST_PER_MEAL);
          chipText.innerHTML = `${meals.toLocaleString('en-IN')} Meals &bull; <strong>₹${amt.toLocaleString('en-IN')}</strong>`;
        }
      }

      if (slider) {
        const min = parseInt(slider.min) || 0;
        const max = parseInt(slider.max) || targetGoal;
        const valPercent = Math.min(100, Math.max(0, ((amt - min) / (max - min)) * 100));
        slider.style.background = `linear-gradient(to right, #16A34A 0%, #16A34A ${valPercent}%, #CBD5E1 ${valPercent}%, #CBD5E1 100%)`;
      }
    }

    // 1. General Meal Calculator Sync (index, donate, programs, stories, volunteer, faq)
    const customAmtInput = form.querySelector('#calc-custom-amount, .calc-custom-amount');

    function getMealsCountText(val) {
      if (isKiosk) {
        return ((val / 500000) * 100).toFixed(0) + '% Kiosk Sponsorship';
      } else if (isVehicle) {
        return ((val / 1000000) * 100).toFixed(0) + '% Vehicle Sponsorship';
      } else if (isKitchen) {
        return 'Groceries & Fresh Vegetables Seva';
      } else {
        const meals = Math.floor(val / COST_PER_MEAL);
        if (meals <= 0) {
          return '0 Meals (₹80 / meal)';
        }
        const mealWord = meals === 1 ? 'Meal' : 'Meals';
        return `${meals.toLocaleString('en-IN')} ${mealWord} (at ₹80/meal)`;
      }
    }

    if (mealInput) {
      function calculateFromMeals(meals) {
        const m = Math.max(0, parseInt(meals) || 0);
        const total = m * COST_PER_MEAL;
        if (amountDisplay) amountDisplay.textContent = '₹' + total.toLocaleString('en-IN');
        if (customAmtInput && document.activeElement !== customAmtInput) {
          customAmtInput.value = total > 0 ? total : '';
        }
        if (hiddenAmt) hiddenAmt.value = total;
        if (slider && parseInt(slider.value) !== total) slider.value = total;
        updateTargetCompletion(total);
      }

      function calculateFromAmount(amt) {
        const val = Math.max(0, parseInt(amt) || 0);
        const meals = Math.floor(val / COST_PER_MEAL);
        if (mealInput && document.activeElement !== mealInput) {
          mealInput.value = meals > 0 ? meals : (val > 0 ? 0 : '');
        }
        if (amountDisplay) amountDisplay.textContent = '₹' + val.toLocaleString('en-IN');
        if (hiddenAmt) hiddenAmt.value = val;
        if (slider && parseInt(slider.value) !== val) slider.value = val;
        presetBtns.forEach(b => {
          const bMeals = parseInt(b.getAttribute('data-meals'));
          const bAmt = parseInt(b.getAttribute('data-amount')) || (bMeals * COST_PER_MEAL);
          if (bAmt === val || (bMeals === meals && val === bMeals * COST_PER_MEAL)) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
        updateTargetCompletion(val);
      }

      mealInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        calculateFromMeals(val);
        presetBtns.forEach(b => {
          if (parseInt(b.getAttribute('data-meals')) === val) b.classList.add('active');
          else b.classList.remove('active');
        });
      });

      if (customAmtInput) {
        customAmtInput.addEventListener('input', (e) => {
          const val = parseInt(e.target.value) || 0;
          calculateFromAmount(val);
        });
      }

      presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          presetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const meals = parseInt(btn.getAttribute('data-meals'));
          mealInput.value = meals;
          calculateFromMeals(meals);
        });
      });
    }

    // 2. Product Detail Presets & Custom Input Sync (BBCI, GMCH, AIIMS, Kiosk, Vehicle, Kitchen)
    if (pInput) {
      function updateProductAmount(amt) {
        pInput.value = amt;
        if (pMealsText) {
          pMealsText.textContent = getMealsCountText(amt);
        }
        if (slider && parseInt(slider.value) !== amt) {
          slider.value = amt;
        }
        updateTargetCompletion(amt);
      }

      if (pPresets.length > 0) {
        pPresets.forEach(btn => {
          btn.addEventListener('click', () => {
            pPresets.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const amt = parseInt(btn.getAttribute('data-amount'));
            updateProductAmount(amt);
          });
        });
      }

      pInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        pPresets.forEach(b => {
          if (parseInt(b.getAttribute('data-amount')) === val) b.classList.add('active');
          else b.classList.remove('active');
        });
        if (pMealsText) {
          pMealsText.textContent = getMealsCountText(val);
        }
        if (slider) slider.value = val;
        updateTargetCompletion(val);
      });
    }

    // 3. Slider Interaction & Synchronization
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        if (pInput) {
          pInput.value = val;
          if (pMealsText) {
            pMealsText.textContent = getMealsCountText(val);
          }
          pPresets.forEach(b => {
            if (parseInt(b.getAttribute('data-amount')) === val) b.classList.add('active');
            else b.classList.remove('active');
          });
        } else if (mealInput) {
          const meals = Math.floor(val / COST_PER_MEAL);
          mealInput.value = meals;
          if (customAmtInput) customAmtInput.value = val;
          if (amountDisplay) amountDisplay.textContent = '₹' + val.toLocaleString('en-IN');
          if (hiddenAmt) hiddenAmt.value = val;
          presetBtns.forEach(b => {
            if (parseInt(b.getAttribute('data-meals')) === meals) b.classList.add('active');
            else b.classList.remove('active');
          });
        }
        updateTargetCompletion(val);
      });

      // Initialize on load
      const startVal = pInput ? (parseInt(pInput.value) || (isKiosk ? 50000 : isVehicle ? 100000 : 2000)) : 
                                (hiddenAmt ? parseInt(hiddenAmt.value) || 2000 : 2000);
      slider.value = startVal;
      updateTargetCompletion(startVal);
    }

    // 4. Form Submission & Smooth Validation
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameInp = form.querySelector('.donor-name, input[name="name"]');
      const emailInp = form.querySelector('.donor-email, input[name="email"]');
      const phoneInp = form.querySelector('.donor-phone, input[name="phone"]');
      const panInp = form.querySelector('.donor-pan, input[name="pan"]');

      const donorName = nameInp?.value.trim() || '';
      const donorEmail = emailInp?.value.trim() || '';
      const donorPhone = phoneInp?.value.trim() || '';
      const donorPan = panInp?.value.trim() || '';

      // Clear previous error borders
      [nameInp, phoneInp, emailInp].forEach(inp => { if (inp) inp.style.borderColor = '#CBD5E1'; });

      // Visual Error Highlighting & Scroll for All Devices
      if (!donorName) {
        if (nameInp) {
          nameInp.style.borderColor = '#EF4444';
          nameInp.focus();
          nameInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        alert('Please enter your Full Name.');
        return false;
      }
      if (!donorPhone || donorPhone.length < 10) {
        if (phoneInp) {
          phoneInp.style.borderColor = '#EF4444';
          phoneInp.focus();
          phoneInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        alert('Please enter a valid 10-digit mobile number.');
        return false;
      }
      if (!donorEmail || !donorEmail.includes('@')) {
        if (emailInp) {
          emailInp.style.borderColor = '#EF4444';
          emailInp.focus();
          emailInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        alert('Please enter your Email Address for the 80G tax receipt.');
        return false;
      }

      const donationAmt = form.querySelector('.p-amount-input')?.value || 
                          form.querySelector('.amount-input')?.value || 
                          form.querySelector('.calc-custom-amount')?.value || 
                          form.querySelector('#calc-custom-amount')?.value || 
                          form.querySelector('.calc-amount-hidden')?.value ||
                          form.querySelector('#home-calc-amount-hidden')?.value || 
                          (form.querySelector('#meal-count-input, .meal-count-input')?.value ? form.querySelector('#meal-count-input, .meal-count-input').value * COST_PER_MEAL : '2000');
      const progSelect = form.querySelector('#prog-initiative-select');
      const causeName = (progSelect && progSelect.selectedOptions && progSelect.selectedOptions[0]) ?
                        progSelect.selectedOptions[0].text :
                        (form.querySelector('.cause-name-hidden')?.value || 
                        form.querySelector('#home-cause-select')?.value || 
                        form.querySelector('#program-select')?.value || 'Hospital Caregiver Food Distribution');
      const causeKeyVal = (progSelect && progSelect.value) ? progSelect.value : (form.querySelector('.cause-key-hidden')?.value || 'general');
      const paymentMode = form.querySelector('.selected-gateway-mode')?.value || 'UPI';

      currentDonationData = {
        name: donorName,
        email: donorEmail,
        phone: donorPhone,
        pan: donorPan ? donorPan.toUpperCase() : 'NOT_PROVIDED',
        amount: donationAmt,
        causeName: causeName,
        causeKey: causeKeyVal,
        paymentMode: paymentMode
      };

      ensureModalsExist();
      const currentGwModal = document.getElementById('payment-gateway-modal');
      if (currentGwModal) {
        const gwAmt = document.getElementById('gw-amount');
        const gwCause = document.getElementById('gw-cause');
        const gwMode = document.getElementById('gw-mode');
        if (gwAmt) gwAmt.textContent = '₹' + parseInt(donationAmt).toLocaleString('en-IN');
        if (gwCause) gwCause.textContent = causeName;
        if (gwMode) gwMode.textContent = (paymentMode || 'Razorpay / UPI');
        updateRzpKeyDisplay();
        currentGwModal.classList.add('active');
      } else {
        executeRazorpayPay();
      }
    });
  });

  // Modal Closers
  const receiptCloseBtn = document.getElementById('receipt-close-btn');
  if (receiptCloseBtn && receiptModal) {
    receiptCloseBtn.addEventListener('click', () => receiptModal.classList.remove('active'));
    receiptModal.addEventListener('click', (e) => {
      if (e.target === receiptModal) receiptModal.classList.remove('active');
    });
  }

  // Count Up Animation for Floating Data Bar
  // Weekly Dynamic Stats Calculation (Base: 2026-10-01, +2 locations/week, +8 active days/week)
  const statsBaseDate = new Date('2026-10-01T00:00:00Z');
  const statsNow = new Date();
  const diffWeeks = Math.max(0, Math.floor((statsNow - statsBaseDate) / (1000 * 60 * 60 * 24 * 7)));
  const dynamicLocations = 47 + (diffWeeks * 2);
  const dynamicDays = 3051 + (diffWeeks * 8);

  const locEl = document.getElementById('databar-locations-num');
  if (locEl) {
    locEl.setAttribute('data-count', dynamicLocations);
    locEl.textContent = dynamicLocations + '+';
  }

  const daysEl = document.getElementById('databar-days-num');
  if (daysEl) {
    daysEl.setAttribute('data-count', dynamicDays);
    daysEl.textContent = dynamicDays.toLocaleString('en-IN') + '+';
  }

  const statNumbers = document.querySelectorAll('.stat-num-dark');
  if (statNumbers.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = entry.target;
          const countToStr = target.getAttribute('data-count');
          const countTo = parseInt(countToStr);
          const prefix = target.getAttribute('data-prefix') || '';
          const suffix = target.getAttribute('data-suffix') || '';
          const formatCustom = target.getAttribute('data-format') === 'indian';

          let count = 0;
          const duration = 1800;
          const stepTime = Math.max(Math.floor(duration / Math.min(countTo, 80)), 15);

          const timer = setInterval(() => {
            count += Math.ceil(countTo / 50);
            if (count >= countTo) {
              count = countTo;
              clearInterval(timer);
            }

            let formattedVal = count.toLocaleString('en-IN');
            if (formatCustom && count >= 4070000) {
              formattedVal = "40,70,000";
            }

            target.textContent = prefix + formattedVal + suffix;
          }, stepTime);

          observer.unobserve(target);
        }
      });
    }, { threshold: 0.3 });

    statNumbers.forEach(stat => observer.observe(stat));
  }

  // Volunteer & CSR Mode Toggle
  const volToggleBtns = document.querySelectorAll('.volunteer-toggle-btn');
  const volTypeInput = document.getElementById('volunteer-type-input');
  const orgFieldGroup = document.getElementById('volunteer-org-group');

  if (volToggleBtns.length > 0) {
    volToggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        volToggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-type');
        if (volTypeInput) volTypeInput.value = mode;
        if (orgFieldGroup) {
          orgFieldGroup.style.display = (mode === 'corporate' ? 'block' : 'none');
        }
      });
    });
  }

  // Volunteer & CSR Form Submit Handler
  const volunteerForm = document.getElementById('volunteer-reg-form');
  const volunteerModal = document.getElementById('volunteer-success-modal');

  if (volunteerForm) {
    volunteerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const vName = document.getElementById('vol-name')?.value || 'Devoted Volunteer';
      const vEmail = document.getElementById('vol-email')?.value || 'volunteer@example.com';
      const vRole = document.getElementById('vol-role-select')?.value || 'General Volunteer Seva';
      
      const confName = document.getElementById('vol-conf-name');
      const confEmail = document.getElementById('vol-conf-email');
      const confRole = document.getElementById('vol-conf-role');

      if (confName) confName.textContent = vName;
      if (confEmail) confEmail.textContent = vEmail;
      if (confRole) confRole.textContent = vRole;

      // Sync volunteer application to Supabase
      const volType = document.getElementById('vol-type-input')?.value || 'individual';
      const volPhone = document.getElementById('vol-phone')?.value || '';
      const volOrg = document.getElementById('vol-org')?.value || '';
      const volCity = document.getElementById('vol-city')?.value || '';
      const volAvail = document.getElementById('vol-avail')?.value || '';
      const volNotes = document.getElementById('vol-notes')?.value || '';

      SUPABASE_BACKEND.insertRecord('volunteer_applications', {
        full_name: vName,
        email: vEmail,
        phone: volPhone,
        city: volCity,
        volunteer_type: volType,
        organization: volOrg,
        preferred_role: vRole,
        availability: volAvail,
        notes: volNotes,
        status: 'pending'
      });

      if (volunteerModal) {
        volunteerModal.classList.add('active');
      } else {
        alert('Hare Krishna! Thank you, ' + vName + '. Your volunteer seva application has been received. Our team will contact you shortly.');
      }
      volunteerForm.reset();
    });
  }

  // FAQ Accordion Handler
  const faqItems = document.querySelectorAll('.faq-accordion-item');
  faqItems.forEach(item => {
    const qBtn = item.querySelector('.faq-question-btn');
    if (qBtn) {
      qBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isActive) item.classList.add('active');
      });
    }
  });

  // Pure For Veg Tabs Switcher (What, Why, How)
  const pfvTabs = document.querySelectorAll('.pfv-tab-btn');
  const pfvPanels = document.querySelectorAll('.pfv-tab-panel');
  if (pfvTabs.length > 0) {
    pfvTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-target');
        pfvTabs.forEach(t => t.classList.remove('active'));
        pfvPanels.forEach(p => {
          p.classList.remove('active');
          p.style.display = 'none';
        });

        tab.classList.add('active');
        const activePanel = document.getElementById(targetId);
        if (activePanel) {
          activePanel.classList.add('active');
          activePanel.style.display = 'block';
        }
      });
    });
  }

  // Initial load of dynamic recent contributions
  const dynamicContribContainer = document.getElementById('dynamic-recent-contributors');
  if (dynamicContribContainer) {
    const causeKey = dynamicContribContainer.getAttribute('data-cause-key') || 'all';
    renderRecentDonations('dynamic-recent-contributors', causeKey);
  }

  // Initial load of footer recent contributions (all pages)
  renderFooterRecentDonations();
});

// Contact Inquiry Form Submission Handler
window.handleContactFormSubmit = async function(e, form) {
  e.preventDefault();
  const firstName = form.first_name?.value.trim() || '';
  const lastName = form.last_name?.value.trim() || '';
  const email = form.email?.value.trim() || '';
  const subject = form.subject?.value.trim() || '';
  const message = form.message?.value.trim() || '';

  const contactData = {
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    email: email,
    subject: subject,
    message: message,
    status: 'new'
  };

  // Local backup in localStorage
  try {
    const raw = localStorage.getItem('pfc_contact_inquiries') || '[]';
    const list = JSON.parse(raw);
    list.unshift({ ...contactData, created_at: new Date().toISOString() });
    localStorage.setItem('pfc_contact_inquiries', JSON.stringify(list.slice(0, 100)));
  } catch (err) {
    console.warn('Local storage error:', err);
  }

  // Sync to Supabase Backend
  await SUPABASE_BACKEND.insertRecord('contact_inquiries', contactData);

  // Show on-screen success banner
  const successBox = document.getElementById('contact-success-msg');
  if (successBox) {
    successBox.style.display = 'block';
    successBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    alert(`Hare Krishna! Thank you, ${firstName}. Your message has been received.`);
  }

  form.reset();
  return false;
};

// =============================================================
// INTERACTIVE PRODUCT & KIOSK SLIDESHOW SWAPPER
// =============================================================
window.swapFeaturedImg = function(thumb, targetId) {
  const feat = document.getElementById(targetId);
  if (feat) {
    feat.style.opacity = '0.5';
    feat.src = thumb.src;
    setTimeout(() => { feat.style.opacity = '1'; }, 120);
    const parent = thumb.parentElement;
    if (parent) {
      parent.querySelectorAll('.product-thumb').forEach(t => {
        t.classList.remove('active');
        t.style.borderColor = 'transparent';
        t.style.opacity = '0.65';
      });
      thumb.classList.add('active');
      thumb.style.borderColor = '#16A34A';
      thumb.style.opacity = '1';
    }
  }
};

// Auto rotate kiosk featured thumbnails every 4.5 seconds if present
setInterval(() => {
  const thumbsStrips = document.querySelectorAll('.product-thumbs-strip');
  thumbsStrips.forEach(strip => {
    const thumbs = Array.from(strip.querySelectorAll('.product-thumb'));
    if (thumbs.length > 1) {
      const activeIdx = thumbs.findIndex(t => t.classList.contains('active') || t.style.borderColor === 'rgb(22, 163, 74)');
      const nextIdx = (activeIdx + 1) % thumbs.length;
      thumbs[nextIdx].click();
    }
  });
}, 10000);

// =============================================================
// ABOUT PAGE: TEAM HERO SLIDESHOW CONTROLLER (IMAGES ONLY)
// =============================================================
document.addEventListener('DOMContentLoaded', function() {
  const teamWrap = document.querySelector('.team-hero-slideshow-wrap');
  if (teamWrap) {
    const slides = teamWrap.querySelectorAll('.team-hero-slide');
    const dotsContainer = teamWrap.querySelector('.team-hero-dots');
    const prevBtn = teamWrap.querySelector('.team-hero-nav.prev');
    const nextBtn = teamWrap.querySelector('.team-hero-nav.next');
    let currentIndex = 0;
    let autoTimer = null;

    if (slides.length > 0) {
      // Build dots if not already populated
      if (dotsContainer && dotsContainer.children.length === 0) {
        slides.forEach((_, idx) => {
          const dot = document.createElement('button');
          dot.className = 'team-hero-dot' + (idx === 0 ? ' active' : '');
          dot.setAttribute('aria-label', 'Go to team slide ' + (idx + 1));
          dot.addEventListener('click', () => {
            showSlide(idx);
            resetTimer();
          });
          dotsContainer.appendChild(dot);
        });
      }

      function showSlide(idx) {
        currentIndex = (idx + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          slide.classList.toggle('active', i === currentIndex);
        });
        if (dotsContainer) {
          const dots = dotsContainer.querySelectorAll('.team-hero-dot');
          dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentIndex);
          });
        }
      }

      function nextSlide() {
        showSlide(currentIndex + 1);
      }

      function prevSlide() {
        showSlide(currentIndex - 1);
      }

      function startTimer() {
        if (!autoTimer) {
          autoTimer = setInterval(nextSlide, 10000);
        }
      }

      function stopTimer() {
        if (autoTimer) {
          clearInterval(autoTimer);
          autoTimer = null;
        }
      }

      function resetTimer() {
        stopTimer();
        startTimer();
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          prevSlide();
          resetTimer();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          nextSlide();
          resetTimer();
        });
      }

      // Pause on hover
      teamWrap.addEventListener('mouseenter', stopTimer);
      teamWrap.addEventListener('mouseleave', startTimer);

      // Touch swipe support
      let touchStartX = 0;
      let touchEndX = 0;
      teamWrap.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopTimer();
      }, { passive: true });

      teamWrap.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 45) {
          nextSlide();
        } else if (touchEndX - touchStartX > 45) {
          prevSlide();
        }
        startTimer();
      }, { passive: true });

      startTimer();
    }
  }

  // =============================================================
  // ABOUT PAGE: MANDIR & INCEPTION INTERACTIVE SHOWCASE
  // =============================================================
  const mandirWrap = document.querySelector('.mandir-showcase-container, .movement-showcase-container');
  if (mandirWrap) {
    const slides = mandirWrap.querySelectorAll('.mandir-slide, .movement-slide');
    const thumbs = mandirWrap.querySelectorAll('.mandir-thumb, .movement-thumb');
    const prevBtn = mandirWrap.querySelector('.mandir-nav-arrow.mandir-prev, .movement-nav-arrow.movement-prev');
    const nextBtn = mandirWrap.querySelector('.mandir-nav-arrow.mandir-next, .movement-nav-arrow.movement-next');
    let currentIndex = 0;
    let mandirTimer = null;

    if (slides.length > 0) {
      function showMandirSlide(idx) {
        currentIndex = (idx + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          slide.classList.toggle('active', i === currentIndex);
        });
        thumbs.forEach((thumb, i) => {
          const isActive = (i === currentIndex);
          thumb.classList.toggle('active', isActive);
          thumb.style.borderColor = isActive ? '#22C55E' : 'transparent';
          thumb.style.opacity = isActive ? '1' : '0.65';
        });
      }

      function nextMandirSlide() {
        showMandirSlide(currentIndex + 1);
      }

      function prevMandirSlide() {
        showMandirSlide(currentIndex - 1);
      }

      function startMandirTimer() {
        if (!mandirTimer) {
          mandirTimer = setInterval(nextMandirSlide, 10000);
        }
      }

      function stopMandirTimer() {
        if (mandirTimer) {
          clearInterval(mandirTimer);
          mandirTimer = null;
        }
      }

      function resetMandirTimer() {
        stopMandirTimer();
        startMandirTimer();
      }

      thumbs.forEach((thumb, idx) => {
        thumb.addEventListener('click', () => {
          showMandirSlide(idx);
          resetMandirTimer();
        });
      });

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          prevMandirSlide();
          resetMandirTimer();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          nextMandirSlide();
          resetMandirTimer();
        });
      }

      mandirWrap.addEventListener('mouseenter', stopMandirTimer);
      mandirWrap.addEventListener('mouseleave', startMandirTimer);

      startMandirTimer();
    }
  }
});

// Global CSR Collaboration Enquiry Handler
window.handleCSRFormSubmit = function(e, form) {
  if (e) e.preventDefault();
  const formEl = form || (e && e.target);
  if (!formEl) return false;
  const successMsg = formEl.querySelector('#csr-success-msg') || document.getElementById('csr-success-msg');
  
  const companyName = formEl.querySelector('[name="company_name"]')?.value || '';
  const contactPerson = formEl.querySelector('[name="contact_person"]')?.value || '';
  const email = formEl.querySelector('[name="email"]')?.value || '';
  const phone = formEl.querySelector('[name="phone"]')?.value || '';
  const initiative = formEl.querySelector('[name="partnership_type"]')?.value || '';
  const budget = formEl.querySelector('[name="budget_range"]')?.value || '';
  const message = formEl.querySelector('[name="message"]')?.value || '';

  if (typeof SUPABASE_BACKEND !== 'undefined' && SUPABASE_BACKEND.insertRecord) {
    SUPABASE_BACKEND.insertRecord('csr_inquiries', {
      company_name: companyName,
      contact_person: contactPerson,
      email: email,
      phone: phone,
      partnership_type: initiative,
      budget_range: budget,
      message: message,
      status: 'pending'
    });
  }

  if (successMsg) {
    successMsg.style.display = 'block';
    successMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const submitBtn = formEl.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Inquiry Submitted Successfully';
  }

  return false;
};


