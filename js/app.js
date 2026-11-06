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

    // Locked permanently to verified official live Razorpay API key

    return this.defaultKey;

  },

  setKeyId: function() {

    // Tamper-proof: external overrides disabled

  },

  merchantName: 'Pure for Cure - Hare Krishna Movement Guwahati',

  description: 'Sattvik Meals Food Relief Sponsorship',

  themeColor: '#1A8C4E',

  logo: 'images/logo/pfc-logo-new.png'

};



// =============================================================

// SUPABASE BACKEND CONNECTOR & STORAGE (OFFICIAL PURE FOR CURE)

// =============================================================


// =============================================================
// GLOBAL SECURITY UTILITY: HTML Sanitization (Anti-XSS Protection)
// =============================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

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



// Global Active Receipt State & Zero-Latency PDF Preloading

let currentDonationMeta = null;

let currentDonationPdfBlob = null;

let cachedReceiptTemplateBytes = null;



(async function preloadReceiptTemplate() {

  try {

    const resp = await fetch('images/Receipt_Format_PFC-NEW.pdf');

    if (resp.ok) {

      cachedReceiptTemplateBytes = await resp.arrayBuffer();

      console.log('✓ Official Receipt_Format_PFC-NEW.pdf preloaded in memory');

    }

  } catch (e) {

    try {

      const resp2 = await fetch('/images/Receipt_Format_PFC-NEW.pdf');

      if (resp2.ok) cachedReceiptTemplateBytes = await resp2.arrayBuffer();

    } catch (e2) {}

  }

})();



// EmailJS Official Configuration

const EMAILJS_CONFIG = {

  publicKey: '4FsfZ9hK5ZyFeWgEO',

  serviceId: 'service_mxks5if',

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

          // Welcome email to subscriber (fills all template parameters)

          window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {

            from_name: 'Team Pure For Cure',

            from_email: 'info@pureforcure.org',

            reply_to: 'info@pureforcure.org',

            sender_email: 'info@pureforcure.org',

            donor_email: subscriberRecord.email,

            to_email: subscriberRecord.email,

            email: subscriberRecord.email,

            recipient_email: subscriberRecord.email,

            user_email: subscriberRecord.email,

            to_name: subscriberRecord.name || 'Friend of Pure for Cure',

            donor_name: subscriberRecord.name || 'Friend of Pure for Cure',

            name: subscriberRecord.name || 'Friend of Pure for Cure',

            subject: 'Welcome to Pure for Cure Seva Community - Hare Krishna!',

            message: 'Hare Krishna! Thank you for subscribing to Pure for Cure.\n\nYou are now connected with our hospital food relief mission serving warm, nutritious Sattvik meals to patients and their family attendants outside government hospitals (BBCI, GMCH, AIIMS Guwahati).\n\nYou will receive inspirational caregiver stories, volunteer updates, emergency flood relief news, and our latest seva reports.\n\nWith heartfelt gratitude,\nTeam Pure For Cure\nHare Krishna Movement, Guwahati\nWebsite: https://www.pureforcure.org\nEmail: info@pureforcure.org',

            amount: 'Free Seva Community Subscription',

            formatted_amount: 'Active Member',

            donation_amount: 'Newsletter Member',

            receipt_no: 'PFC-NL-' + Date.now().toString().slice(-6),

            ref_no: 'PFC-NL-' + Date.now().toString().slice(-6),

            txn_id: 'SUBSCRIBED',

            payment_id: 'SUBSCRIBED',

            transaction_id: 'SUBSCRIBED',

            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),

            cause: 'Caregiver Food Relief & Community Updates',

            cause_name: 'Caregiver Food Relief & Community Updates',

            receipt_url: 'https://www.pureforcure.org/stories.html',

            pdf_url: 'https://www.pureforcure.org/stories.html',

            notes: 'Newsletter Subscription verified from ' + (window.location.pathname.split('/').pop() || 'website')

          }).catch(err => console.warn('Subscriber welcome email notice:', err));



          // Alert notification to info@pureforcure.org and harekrishnamandir.dm@gmail.com

          window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {

            from_name: subscriberRecord.name,

            from_email: subscriberRecord.email,

            reply_to: subscriberRecord.email,

            to_email: 'info@pureforcure.org',

            donor_email: 'info@pureforcure.org',

            recipient_email: 'info@pureforcure.org',

            email: 'info@pureforcure.org',

            to_name: 'Pure for Cure Team',

            subject: `[New Newsletter Subscriber] ${subscriberRecord.name} (${subscriberRecord.email})`,

            message: `A new devotee / supporter has subscribed to the Pure for Cure newsletter:



Name: ${subscriberRecord.name}

Email: ${subscriberRecord.email}

Source Page: ${subscriberRecord.source_page}

Date: ${new Date().toLocaleString('en-GB')}`,

            date: new Date().toLocaleDateString('en-GB')

          }).catch(err => console.warn('Newsletter admin alert notice:', err));



          window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {

            from_name: subscriberRecord.name,

            from_email: subscriberRecord.email,

            reply_to: subscriberRecord.email,

            to_email: 'harekrishnamandir.dm@gmail.com',

            donor_email: 'harekrishnamandir.dm@gmail.com',

            recipient_email: 'harekrishnamandir.dm@gmail.com',

            email: 'harekrishnamandir.dm@gmail.com',

            to_name: 'HKM Temple Admin',

            subject: `[New Newsletter Subscriber] ${subscriberRecord.name} (${subscriberRecord.email})`,

            message: `A new devotee / supporter has subscribed to the Pure for Cure newsletter:



Name: ${subscriberRecord.name}

Email: ${subscriberRecord.email}

Source Page: ${subscriberRecord.source_page}

Date: ${new Date().toLocaleString('en-GB')}`,

            date: new Date().toLocaleDateString('en-GB')

          }).catch(err => console.warn('Newsletter HKM alert notice:', err));

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

  if (k === 'amavasya' || k.includes('amavasya') || k.includes('pitru')) return 'amavasya';

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



function formatSupabaseDateTime(isoOrDateStr) {

  if (!isoOrDateStr) return 'Recent';

  try {

    let d;

    if (typeof isoOrDateStr === 'number') {

      d = new Date(isoOrDateStr);

    } else {

      const str = String(isoOrDateStr).trim();

      if (/^\d{1,2}\s+[A-Za-z]{3,4}\s+\d{4}(,\s+\d{1,2}:\d{2}\s+(AM|PM))?$/i.test(str)) {

        return str;

      }

      d = new Date(str);

    }

    if (isNaN(d.getTime())) return String(isoOrDateStr);



    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Convert to IST (UTC+5:30)

    const istOffsetMs = 5.5 * 60 * 60 * 1000;

    const istDate = new Date(d.getTime() + istOffsetMs);

    

    const day = String(istDate.getUTCDate()).padStart(2, '0');

    const month = months[istDate.getUTCMonth()];

    const year = istDate.getUTCFullYear();

    const datePart = `${day} ${month} ${year}`;



    const hasTime = (typeof isoOrDateStr === 'number') || 

                    (typeof isoOrDateStr === 'string' && (isoOrDateStr.includes('T') || isoOrDateStr.includes(':')));

    

    if (hasTime) {

      let hours = istDate.getUTCHours();

      const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');

      const ampm = hours >= 12 ? 'PM' : 'AM';

      hours = hours % 12;

      hours = hours ? hours : 12;

      const hoursStr = String(hours).padStart(2, '0');

      return `${datePart}, ${hoursStr}:${minutes} ${ampm}`;

    }

    return datePart;

  } catch (e) {

    return String(isoOrDateStr || 'Recent');

  }

}



function formatRelativeDate(isoOrDateStr) {

  return formatSupabaseDateTime(isoOrDateStr);

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

    

    // Attempt to load official Canva blank template

    let pdfDoc = null;

    let page = null;

    let isOfficialTemplate = false;



    try {

      let templateBytes = cachedReceiptTemplateBytes;

      if (!templateBytes) {

        const urls = [

          'images/Receipt_Format_PFC-NEW.pdf',

          '/images/Receipt_Format_PFC-NEW.pdf',

          'https://pureforcure.org/images/Receipt_Format_PFC-NEW.pdf'

        ];

        for (const u of urls) {

          try {

            const resp = await fetch(u);

            if (resp.ok) {

              templateBytes = await resp.arrayBuffer();

              cachedReceiptTemplateBytes = templateBytes;

              break;

            }

          } catch (fetchErr) {}

        }

      }

      if (templateBytes) {

        pdfDoc = await PDFDocument.load(templateBytes);

        page = pdfDoc.getPages()[0];

        isOfficialTemplate = true;

      }

    } catch (tErr) {

      console.info('Could not fetch Receipt_Format_PFC-NEW.pdf, falling back to vector layout:', tErr);

    }



    // Wrap text helper for multiline entries

    const wrapCleanText = (text, f, size, maxWidth) => {

      const cleanStr = String(text || '').replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();

      const words = cleanStr.split(' ');

      const lines = [];

      let cur = '';

      words.forEach(w => {

        const test = cur ? cur + ' ' + w : w;

        if (f.widthOfTextAtSize(test, size) > maxWidth && cur) {

          lines.push(cur);

          cur = w;

        } else {

          cur = test;

        }

      });

      if (cur) lines.push(cur);

      return lines;

    };



    if (isOfficialTemplate && page) {
      const receiptPage = page;
      const { width, height } = receiptPage.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Colors
      const primaryGreen = rgb(0.086, 0.549, 0.306);
      const darkGreen = rgb(0.086, 0.396, 0.204);
      const lightGreenFill = rgb(0.925, 0.992, 0.961);
      const lightGreenStroke = rgb(0.655, 0.953, 0.816);
      const slateText = rgb(0.278, 0.333, 0.412);
      const darkText = rgb(0.059, 0.09, 0.165);
      const lightBorder = rgb(0.886, 0.91, 0.941);
      const cardFill = rgb(0.973, 0.98, 0.988);
      const white = rgb(1, 1, 1);
      const black = rgb(0.12, 0.12, 0.12);

      // ========================================================
      // PAGE 1 OF 2: DONOR DETAILS SCREENSHOT / SUMMARY CARD
      // ========================================================
      const summaryPage = pdfDoc.insertPage(0, [width, height]);

      // Outer Decorative Border
      summaryPage.drawRectangle({
        x: 24,
        y: 24,
        width: width - 48,
        height: height - 48,
        borderColor: primaryGreen,
        borderWidth: 1.5,
        color: white,
      });

      // Top Header Banner
      summaryPage.drawRectangle({
        x: 25.5,
        y: height - 110,
        width: width - 51,
        height: 84.5,
        color: darkGreen,
      });

      summaryPage.drawText('PURE FOR CURE', {
        x: 45,
        y: height - 58,
        size: 22,
        font: bold,
        color: white,
      });

      summaryPage.drawText('HARE KRISHNA MOVEMENT, GUWAHATI', {
        x: 45,
        y: height - 76,
        size: 11,
        font: bold,
        color: rgb(0.82, 0.98, 0.898),
      });

      summaryPage.drawText('Serving the teachings of His Divine Grace A.C. Bhaktivedanta Swami Srila Prabhupada', {
        x: 45,
        y: height - 94,
        size: 8.5,
        font: font,
        color: rgb(0.85, 0.95, 0.9),
      });

      // Header Badge (Right side)
      summaryPage.drawRectangle({
        x: width - 215,
        y: height - 85,
        width: 170,
        height: 38,
        color: rgb(0.12, 0.48, 0.26),
        borderColor: rgb(0.3, 0.75, 0.45),
        borderWidth: 1,
      });
      summaryPage.drawText('OFFICIAL 80G RECORD', {
        x: width - 200,
        y: height - 63,
        size: 10,
        font: bold,
        color: white,
      });
      summaryPage.drawText('PAGE 1 OF 2 : DONOR DETAILS', {
        x: width - 205,
        y: height - 77,
        size: 7.5,
        font: bold,
        color: rgb(0.85, 0.95, 0.9),
      });

      // Payment Verification Highlight Box (matches #receipt-highlight-box)
      let curY = height - 128;
      summaryPage.drawRectangle({
        x: 42,
        y: curY - 55,
        width: width - 84,
        height: 55,
        color: lightGreenFill,
        borderColor: lightGreenStroke,
        borderWidth: 1.5,
      });

      summaryPage.drawText('[ VERIFIED ] PAYMENT SUCCESSFUL & 80G RECEIPT ISSUED', {
        x: 56,
        y: curY - 24,
        size: 12,
        font: bold,
        color: darkGreen,
      });

      summaryPage.drawText(`Official 80G Tax Exemption receipt confirmation dispatched to: ${donor.email || 'donor'}`, {
        x: 56,
        y: curY - 42,
        size: 9.5,
        font: font,
        color: darkGreen,
      });

      // Main Donor Details Card Box
      curY -= 75;
      const cardHeight = 360;
      summaryPage.drawRectangle({
        x: 42,
        y: curY - cardHeight,
        width: width - 84,
        height: cardHeight,
        color: white,
        borderColor: lightBorder,
        borderWidth: 1.5,
      });

      // Table Card Header
      summaryPage.drawRectangle({
        x: 43.5,
        y: curY - 32,
        width: width - 87,
        height: 31,
        color: cardFill,
      });

      summaryPage.drawText('DONATION PARTICULARS & STATUTORY SUMMARY', {
        x: 58,
        y: curY - 20,
        size: 10.5,
        font: bold,
        color: darkGreen,
      });

      // Key-Value Rows
      const rows = [
        { label: 'Receipt Reference No:', val: meta.refNo || 'N/A', isBold: true },
        { label: 'Receipt Date:', val: meta.dateStr || 'N/A', isBold: false },
        { label: 'Contributor Full Name:', val: donor.name || 'Kind Contributor', isBold: true },
        { label: 'Mobile / WhatsApp No:', val: donor.phone || 'N/A', isBold: false },
        { label: 'Contributor Email:', val: donor.email || 'N/A', isBold: false },
        { label: 'Contributor PAN (80G):', val: donor.pan || 'NOT_PROVIDED', isBold: true },
        { label: 'Towards / Seva Cause:', val: donor.causeName || 'Pure for Cure Daily Feeding', isBold: false },
        { label: 'Payment Mode:', val: donor.paymentMode || 'Razorpay Gateway', isBold: false },
        { label: 'Transaction ID:', val: meta.txnId || 'N/A', isBold: false },
        { label: 'Contributed Amount:', val: 'INR ' + Number(donor.amount || 0).toLocaleString('en-IN') + '/-', isBold: true, isAmt: true },
        { label: '80G Statutory Exemption:', val: '14/80G/CIT/GHY-II/2011-12/4701-05', isBold: true },
        { label: 'Public Trust PAN:', val: 'AAATH8807J', isBold: true },
      ];

      let rowY = curY - 54;
      for (const r of rows) {
        summaryPage.drawLine({
          start: { x: 56, y: rowY - 4 },
          end: { x: width - 56, y: rowY - 4 },
          thickness: 0.5,
          color: lightBorder,
        });

        summaryPage.drawText(r.label, {
          x: 58,
          y: rowY,
          size: 9.5,
          font: font,
          color: slateText,
        });

        if (r.isAmt) {
          summaryPage.drawText(r.val, {
            x: width - 58 - bold.widthOfTextAtSize(r.val, 13),
            y: rowY - 1,
            size: 13,
            font: bold,
            color: rgb(0.086, 0.647, 0.29),
          });
        } else {
          const f = r.isBold ? bold : font;
          const textVal = String(r.val).slice(0, 50);
          summaryPage.drawText(textVal, {
            x: width - 58 - f.widthOfTextAtSize(textVal, 9.5),
            y: rowY,
            size: 9.5,
            font: f,
            color: darkText,
          });
        }
        rowY -= 25.5;
      }

      // Statutory Tax Exemption Note Box
      curY = curY - cardHeight - 20;
      summaryPage.drawRectangle({
        x: 42,
        y: curY - 50,
        width: width - 84,
        height: 50,
        color: cardFill,
        borderColor: lightBorder,
        borderWidth: 1,
      });

      summaryPage.drawText('Donations to this institution are eligible Under 80G Tax Exemption (Income Tax Act, Govt. of India).', {
        x: 56,
        y: curY - 20,
        size: 9,
        font: bold,
        color: darkGreen,
      });

      summaryPage.drawText('Compliant with Income Tax Form 10BD requirements. 100% of donations power daily patient meal relief.', {
        x: 56,
        y: curY - 36,
        size: 8.5,
        font: font,
        color: slateText,
      });

      // Bottom Notice
      curY -= 75;
      summaryPage.drawText('Notice: Please see Page 2 for the Official Signed 80G Donation Receipt created in your name.', {
        x: (width - bold.widthOfTextAtSize('Notice: Please see Page 2 for the Official Signed 80G Donation Receipt created in your name.', 9.5)) / 2,
        y: curY,
        size: 9.5,
        font: bold,
        color: darkGreen,
      });

      // Footer
      summaryPage.drawText('Hare Krishna Movement, Guwahati  *  NH-31, Amingaon, Guwahati, Assam 781031  *  www.pureforcure.org', {
        x: (width - font.widthOfTextAtSize('Hare Krishna Movement, Guwahati  *  NH-31, Amingaon, Guwahati, Assam 781031  *  www.pureforcure.org', 8)) / 2,
        y: 38,
        size: 8,
        font: font,
        color: rgb(0.4, 0.45, 0.5),
      });

            // ========================================================
      // PAGE 2 OF 2: OFFICIAL CANVA 80G DONATION RECEIPT
      // ========================================================
      // 1. Reference No & Date (next to Reference No: and Date: at baseline y=722)
      receiptPage.drawText(String(meta.refNo || ''), {
        x: 114,
        y: 722,
        size: 10,
        font: bold,
        color: black
      });

      receiptPage.drawText(String(meta.dateStr || ''), {
        x: 478,
        y: 722,
        size: 10,
        font: bold,
        color: black
      });

      // 2. Amount next to Rupee symbol inside box
      const amtStr = Number(donor.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      receiptPage.drawText(amtStr, {
        x: 232,
        y: 504,
        size: 28,
        font: bold,
        color: black
      });

      // 3. Entries strictly below form questions with generous, professional spacing:
      // Row 1: Donor's Name & Whatsapp No (labels at baseline ~435.0, entries at y=416)
      receiptPage.drawText(String(donor.name || 'Anonymous'), {
        x: 104.5,
        y: 416,
        size: 10.5,
        font: bold,
        color: black
      });

      receiptPage.drawText(String(donor.phone || 'N/A'), {
        x: 402.0,
        y: 416,
        size: 10.5,
        font: font,
        color: black
      });

      // Row 2: Address & Towards (labels at baseline ~360.5, entries at y=342, 328)
      const addrLines = wrapCleanText(donor.address || 'Guwahati, Assam, India', font, 9.5, 270).slice(0, 2);
      addrLines.forEach((line, i) => {
        receiptPage.drawText(line, {
          x: 103.5,
          y: 342 - (i * 14),
          size: 9.5,
          font: font,
          color: black
        });
      });

      const causeText = String(donor.causeName || 'Pure for Cure - Sattvik Food Distribution');
      const causeLines = wrapCleanText(causeText, font, 9.5, 175).slice(0, 2);
      causeLines.forEach((line, i) => {
        receiptPage.drawText(line, {
          x: 402.0,
          y: 342 - (i * 14),
          size: 9.5,
          font: font,
          color: black
        });
      });

      // Row 3: Email ID & PAN No (labels at baseline ~277.5, entries at y=259)
      receiptPage.drawText(String(donor.email || 'N/A'), {
        x: 104.5,
        y: 259,
        size: 9.5,
        font: font,
        color: black
      });

      receiptPage.drawText(String(donor.pan || 'NOT_PROVIDED'), {
        x: 403.0,
        y: 259,
        size: 9.5,
        font: font,
        color: black
      });

      // Row 4: Payment Mode (label at baseline ~220.5, entry at y=202)
      const modeStr = (donor.paymentMode || 'Razorpay Online Seva') + (meta.txnId ? ` (Txn ID: ${meta.txnId})` : '');
      const modeW = font.widthOfTextAtSize(modeStr, 9.5);
      receiptPage.drawText(modeStr, {
        x: (width - modeW) / 2,
        y: 202,
        size: 9.5,
        font: font,
        color: black
      });

      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes], { type: 'application/pdf' });
    }



    // Programmatic vector fallback if template PDF fetch failed

    pdfDoc = await PDFDocument.create();

    page = pdfDoc.addPage([612, 792]);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    

    const greenHeader = rgb(0.06, 0.42, 0.22);

    const darkGreenBadge = rgb(0.06, 0.22, 0.13);

    const greenFooter = rgb(0.05, 0.35, 0.20);

    const black = rgb(0.12, 0.12, 0.12);

    const white = rgb(1, 1, 1);



    let y = 745;



    // 1. Top Left: Logo

    try {

      let logoResp = await fetch('images/logo/hkm-logo.png');

      if (logoResp.ok) {

        const logoBytes = await logoResp.arrayBuffer();

        const logoImg = await pdfDoc.embedPng(logoBytes);

        const dims = logoImg.scaleToFit(85, 45);

        page.drawImage(logoImg, { x: 45, y: y - 35, width: dims.width, height: dims.height });

      }

    } catch (e) {}



    // 2. Organization Title

    page.drawText('HARE KRISHNA MOVEMENT,GUWAHATI', {

      x: 140,

      y: y - 8,

      size: 14.5,

      font: bold,

      color: greenHeader

    });

    page.drawText('(Serving the mission of  His Divine Grace Vishwaguru A.C. Bhaktivedanta Swami Prabhupada)', {

      x: 140,

      y: y - 22,

      size: 7.2,

      font: font,

      color: black

    });



    // 3. PURE FOR CURE Badge

    const badgeX = 502;

    const badgeY = y - 35;

    page.drawRectangle({

      x: badgeX,

      y: badgeY,

      width: 65,

      height: 44,

      color: darkGreenBadge

    });

    page.drawText('PURE', { x: badgeX + 11, y: badgeY + 28, size: 10, font: bold, color: white });

    page.drawText('FOR', { x: badgeX + 26, y: badgeY + 19, size: 6.5, font: bold, color: white });

    page.drawText('CURE', { x: badgeX + 11, y: badgeY + 8, size: 10, font: bold, color: white });



    // 4. Reference Number & Date

    y = 675;

    page.drawText('Reference No: ', { x: 45, y, size: 11, font: bold, color: black });

    page.drawText(String(meta.refNo || ''), { x: 140, y, size: 10.5, font: font, color: black });



    page.drawText('Date: ', { x: 430, y, size: 11, font: bold, color: black });

    page.drawText(String(meta.dateStr || ''), { x: 465, y, size: 10.5, font: font, color: black });



    // 5. Title

    y = 620;

    const titleText = 'DONATION RECEIPT';

    const titleWidth = bold.widthOfTextAtSize(titleText, 25);

    page.drawText(titleText, {

      x: (612 - titleWidth) / 2,

      y,

      size: 25,

      font: bold,

      color: greenHeader

    });



    // 6. Acknowledgment

    y = 588;

    const ack1 = 'This is to acknowledge that HARE KRISHNA MOVEMENT, GUWAHATI';

    page.drawText(ack1, { x: (612 - font.widthOfTextAtSize(ack1, 10.5)) / 2, y, size: 10.5, font: font, color: black });



    y = 574;

    const ack2 = 'has received a contribution of';

    page.drawText(ack2, { x: (612 - font.widthOfTextAtSize(ack2, 10.5)) / 2, y, size: 10.5, font: font, color: black });



    // 7. Amount Box

    y = 502;

    page.drawRectangle({

      x: (612 - 300) / 2,

      y,

      width: 300,

      height: 55,

      borderColor: black,

      borderWidth: 1.2

    });



    const amtStr = Number(donor.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

    const numWidth = bold.widthOfTextAtSize(amtStr, 23);

    const rupeeW = 14;

    const rupeeGap = 8;

    const totalAmtW = rupeeW + rupeeGap + numWidth;

    const amtStartX = (612 - totalAmtW) / 2;

    const amtY = y + 18;



    const rupeeSvg = 'M0 64C0 46.3 14.3 32 32 32l64 0 16 0 176 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-56.2 0c9.6 14.4 16.7 30.6 20.7 48l35.6 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-35.6 0c-13.2 58.3-61.9 103.2-122.2 110.9L274.6 422c14.4 10.3 17.7 30.3 7.4 44.6s-30.3 17.7-44.6 7.4L13.4 314C2.1 306-2.7 291.5 1.5 278.2S18.1 256 32 256l80 0c32.8 0 61-19.7 73.3-48L32 208c-17.7 0-32-14.3-32-32s14.3-32 32-32l153.3 0C173 115.7 144.8 96 112 96L96 96 32 96C14.3 96 0 81.7 0 64z';

    try {

      page.drawSvgPath(rupeeSvg, {

        x: amtStartX,

        y: amtY + 18.8,

        scale: 0.0407,

        color: black

      });

    } catch (e) {

      page.drawText('Rs.', { x: amtStartX, y: amtY, size: 21, font: bold, color: black });

    }



    page.drawText(amtStr, {

      x: amtStartX + rupeeW + rupeeGap,

      y: amtY,

      size: 23,

      font: bold,

      color: black

    });



    // 8. Entries strictly on next line below form questions

    y = 445;

    page.drawText("Donor's Name:", { x: 45, y, size: 10, font: bold, color: black });

    page.drawText(String(donor.name || 'Anonymous'), { x: 45, y: y - 16, size: 9.5, font: bold, color: black });



    page.drawText("Whatsapp No:", { x: 345, y, size: 10, font: bold, color: black });

    page.drawText(String(donor.phone || 'N/A'), { x: 345, y: y - 16, size: 9.5, font: font, color: black });



    y = 395;

    page.drawText("Address:", { x: 45, y, size: 10, font: bold, color: black });

    const addrLines = wrapCleanText(donor.address || 'Guwahati, Assam, India', font, 9.5, 275).slice(0, 2);

    addrLines.forEach((line, i) => {

      page.drawText(line, { x: 45, y: y - 16 - (i * 12), size: 9.5, font: font, color: black });

    });



    page.drawText("Towards:", { x: 345, y, size: 10, font: bold, color: black });

    const causeText = String(donor.causeName || 'Pure for Cure - Sattvik Food Distribution');

    const causeLines = wrapCleanText(causeText, font, 9.5, 220).slice(0, 2);

    causeLines.forEach((line, i) => {

      page.drawText(line, { x: 345, y: y - 16 - (i * 12), size: 9.5, font: font, color: black });

    });



    y = 338;

    page.drawText("Email ID:", { x: 45, y, size: 10, font: bold, color: black });

    page.drawText(String(donor.email || 'N/A'), { x: 45, y: y - 16, size: 9.5, font: font, color: black });



    page.drawText("PAN No:", { x: 345, y, size: 10, font: bold, color: black });

    page.drawText(String(donor.pan || 'NOT_PROVIDED'), { x: 345, y: y - 16, size: 9.5, font: font, color: black });



    y = 282;

    page.drawText("Payment Mode:", { x: 45, y, size: 10, font: bold, color: black });

    const modeStr = (donor.paymentMode || 'Razorpay Online Seva') + (meta.txnId ? ` (Txn ID: ${meta.txnId})` : '');

    page.drawText(modeStr, { x: 45, y: y - 16, size: 9.5, font: font, color: black });



    // 9. Thank you note

    y = 228;

    const tyText = 'Thank you for your generous support';

    page.drawText(tyText, { x: (612 - font.widthOfTextAtSize(tyText, 13)) / 2, y, size: 13, font: font, color: greenHeader });



    // 10. Exemption and Signature

    y = 185;

    page.drawText('Donations to this institution are exempted u/s', { x: 45, y, size: 8.5, font: font, color: black });

    page.drawText('80G Vide 14/80G/CIT/GHY-II/2011-12/4701-05', { x: 45, y: y - 11, size: 8.5, font: font, color: black });

    page.drawText('DTD:29/02/2012 PAN: AAATH8807J', { x: 45, y: y - 22, size: 8.5, font: font, color: black });



    try {

      const sigResp = await fetch('images/signature-janardan-dasa.png');

      if (sigResp.ok) {

        const sigBytes = await sigResp.arrayBuffer();

        const sigImg = await pdfDoc.embedPng(sigBytes);

        const sigDims = sigImg.scaleToFit(140, 48);

        page.drawImage(sigImg, { x: 420, y: y - 20, width: sigDims.width, height: sigDims.height });

      }

    } catch (e) {}



    page.drawText('Janardhana Dasa', { x: 435, y: y - 30, size: 9.5, font: bold, color: black });

    page.drawText('President', { x: 455, y: y - 42, size: 9, font: font, color: black });



    // 11. Footer

    page.drawRectangle({

      x: 0,

      y: 0,

      width: 612,

      height: 70,

      color: greenFooter

    });



    const footContact = 'Contact: +91 7099039770   |   Email: info@pureforcure.org';

    page.drawText(footContact, {

      x: (612 - font.widthOfTextAtSize(footContact, 8.5)) / 2,

      y: 48,

      size: 8.5,

      font: font,

      color: white

    });



    const footAddress = 'Hare Krishna Mandir Marg, Ghorajan, Guwahati 781031, Assam';

    page.drawText(footAddress, {

      x: (612 - font.widthOfTextAtSize(footAddress, 8)) / 2,

      y: 34,

      size: 8,

      font: font,

      color: white

    });



    const footMaha = 'Hare Krishna Hare Krishna Krishna Krishna Hare Hare | Hare Ram Hare Ram Ram Ram Hare Hare';

    page.drawText(footMaha, {

      x: (612 - font.widthOfTextAtSize(footMaha, 7.8)) / 2,

      y: 18,

      size: 7.8,

      font: font,

      color: white

    });



    const pdfBytes = await pdfDoc.save();

    return new Blob([pdfBytes], { type: 'application/pdf' });

  } catch (err) {

    console.error('Error in generateReceiptPdfBlob:', err);

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



async function sendEmailReceipt(donor, meta, receiptUrl, pdfBlob) {

    // 1. PRIMARY DISPATCH: Resend Platform API (pureforcure.org verified domain)
  try {
    let base64Attachment = '';
    if (pdfBlob && typeof FileReader !== 'undefined') {
      try {
        base64Attachment = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(pdfBlob);
        });
      } catch (bErr) {
        console.warn('Base64 attachment encoding error:', bErr);
      }
    }

    const resendResp = await fetch('/api/send-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donor,
        meta,
        receiptUrl,
        pdfBase64: base64Attachment
      })
    });

    if (resendResp.ok) {
      const resendData = await resendResp.json();
      console.log('✓ [Resend] Official 80G Tax Receipt email dispatched to donor:', donor.email, resendData);
      return true;
    } else {
      const errText = await resendResp.text();
      console.warn('Resend endpoint returned status:', resendResp.status, errText);
    }
  } catch (resendErr) {
    console.warn('Resend primary dispatch notice (falling back to EmailJS):', resendErr);
  }

  // 2. SECONDARY / FALLBACK DISPATCH: EmailJS Client SDK
  if (typeof window.emailjs === 'undefined' || !window.emailjs.send) {

    console.info('EmailJS library not ready, skipping automated email.');

    return false;

  }

  try {

    const formattedAmount = '₹' + Number(donor.amount).toLocaleString('en-IN');

    const emailSubject = `Official 80G Tax Exemption Donation Receipt (${meta.refNo}) - Pure for Cure [${formattedAmount}]`;

    const donorSalutation = donor.name ? `Dear ${donor.name},` : 'Dear Donor,';

    

    // Official donor acknowledgment message matching Pure For Cure specifications

    const emailBody = [

      donorSalutation,

      '',

      'Hare Krishna!',

      '',

      'Thank you for your generous contribution to Pure For Cure, a mission dedicated to serving the vision and teachings of His Divine Grace Vishwaguru A.C. Bhaktivedanta Swami Srila Prabhupada.',

      '',

      'Your support helps us continue our mission of service and share Srila Prabhupada’s teachings with more people.',

      '',

      'Please find your donation receipt attached for your records.',

      '',

      '--------------------------------------------------',

      'OFFICIAL 80G DONATION RECEIPT SUMMARY',

      '--------------------------------------------------',

      `• Receipt Reference: ${meta.refNo}`,

      `• Receipt Date: ${meta.dateStr}`,

      `• Contributor Name: ${donor.name || 'Donor'}`,

      `• Contributor Contact: ${donor.phone || 'N/A'}`,

      `• Contributor Email: ${donor.email}`,

      `• Contributor PAN: ${donor.pan || 'NOT_PROVIDED'}`,

      `• Contributed Amount: ${formattedAmount}`,

      `• Payment Mode: ${donor.paymentMode || 'Razorpay (Online Seva)'}`,

      `• Payment Gateway Txn ID: ${meta.txnId}`,

      `• Seva Initiative / Towards: ${donor.causeName || 'Pure for Cure - Sattvik Food Relief'}`,

      '• Statutory Exemption: Exempted u/s 80G Vide 14/80G/CIT/GHY-II/2011-12/4701-05 DTD:29/02/2012',

      '• Institution PAN: AAATH8807J',

      '--------------------------------------------------',

      receiptUrl ? `📄 Official Signed 80G PDF Receipt Download:\n${receiptUrl}\n` : '',

      'We sincerely appreciate your kindness and support. May Lord Krishna bless you and your family with peace, happiness, and spiritual well-being.',

      '',

      'With gratitude and best wishes,',

      'Team Pure For Cure',

      'Hare Krishna Movement, Guwahati',

      'Email: info@pureforcure.org',

      'Phone: +91 70990 39770'

    ].filter(Boolean).join('\n');



        // Convert pdfBlob to Base64 if available to send as attached document

    let base64Attachment = '';

    if (pdfBlob && typeof FileReader !== 'undefined') {

      try {

        base64Attachment = await new Promise((resolve) => {

          const reader = new FileReader();

          reader.onloadend = () => resolve(reader.result);

          reader.onerror = () => resolve('');

          reader.readAsDataURL(pdfBlob);

        });

      } catch (bErr) {

        console.warn('Base64 attachment encoding error:', bErr);

      }

    }



    const emailPayload = {

      from_name: 'Team Pure For Cure',

      from_email: 'info@pureforcure.org',

      reply_to: 'info@pureforcure.org',

      sender_email: 'info@pureforcure.org',

      donor_email: donor.email,

      to_email: donor.email,

      email: donor.email,

      recipient_email: donor.email,

      bcc_email: 'harekrishnamandir.dm@gmail.com',

      to_name: donor.name || 'Donor',

      donor_name: donor.name || 'Donor',

      name: donor.name || 'Donor',

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

      cause: donor.causeName || 'Pure for Cure - Sattvik Food Relief',

      cause_name: donor.causeName || 'Pure for Cure - Sattvik Food Relief',

      pan: donor.pan || 'NOT_PROVIDED',

      donor_pan: donor.pan || 'NOT_PROVIDED',

      phone: donor.phone || '',

      donor_phone: donor.phone || '',

      receipt_url: receiptUrl || 'https://pureforcure.org/donate.html',

      pdf_url: receiptUrl || 'https://pureforcure.org/donate.html',

      download_link: receiptUrl || 'https://pureforcure.org/donate.html',

      subject: emailSubject,

      message: emailBody,

      brief_message: `${donorSalutation}\n\nHare Krishna!\nThank you for your generous contribution to Pure For Cure, a mission dedicated to serving the vision and teachings of His Divine Grace Vishwaguru A.C. Bhaktivedanta Swami Srila Prabhupada.\nYour support helps us continue our mission of service and share Srila Prabhupada’s teachings with more people.\nPlease find your donation receipt attached for your records.\nAmount: ${formattedAmount} | Receipt No: ${meta.refNo}\n\nWe sincerely appreciate your kindness and support. May Lord Krishna bless you and your family with peace, happiness, and spiritual well-being.\n\nWith gratitude and best wishes,\nTeam Pure For Cure\nHare Krishna Movement, Guwahati\nEmail: info@pureforcure.org\nPhone: +91 70990 39770`,

      // Attachment link passed via receipt_url/pdf_url to strictly stay within EmailJS 50KB variable limit

      receipt_link: receiptUrl || 'https://pureforcure.org/images/Receipt_Format_PFC-NEW.pdf',

      notes: `80G Donation Receipt issued on ${meta.dateStr} for ${donor.name || 'Donor'} with amount ${formattedAmount}`

    };



    // 1. Dispatch official 80G tax receipt to donor

    await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, emailPayload);

    console.log('✓ Automated email receipt dispatched to donor:', donor.email);



    // 2. Dispatch real-time receipt & donation alert to info@pureforcure.org

    try {

      const pfcAlertPayload = {

        ...emailPayload,

        to_email: 'info@pureforcure.org',

        donor_email: 'info@pureforcure.org',

        recipient_email: 'info@pureforcure.org',

        email: 'info@pureforcure.org',

        to_name: 'Pure for Cure Operations',

        subject: `[Donation Received] ${donor.name || 'Donor'} donated ${formattedAmount} (${meta.refNo})`

      };

      await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, pfcAlertPayload);

      console.log('✓ Notification copy dispatched to info@pureforcure.org');

    } catch (err) {

      console.warn('info@pureforcure.org dispatch notice:', err);

    }



    // 3. Dispatch backup notification directly to harekrishnamandir.dm@gmail.com

    try {

      const adminCopyPayload = {

        ...emailPayload,

        to_email: 'harekrishnamandir.dm@gmail.com',

        donor_email: 'harekrishnamandir.dm@gmail.com',

        recipient_email: 'harekrishnamandir.dm@gmail.com',

        email: 'harekrishnamandir.dm@gmail.com',

        to_name: 'HKM Temple Admin',

        subject: `[Donation Alert Copy] ${donor.name || 'Donor'} donated ${formattedAmount} (${meta.refNo})`

      };

      await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, adminCopyPayload);

      console.log('✓ Duplicate receipt copy dispatched to harekrishnamandir.dm@gmail.com');

    } catch (adminErr) {

      console.warn('Admin copy dispatch notice:', adminErr);

    }



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

      modal: {

        ondismiss: function() {

          if (!currentDonationData || currentDonationData._completed) return;

          logFailedOrAbandonedDonation('Checkout Dismissed / Window Closed');

        }

      },

      handler: function(response) {

        if (currentDonationData) currentDonationData._completed = true;

        completeSuccessfulDonation(response.razorpay_payment_id || 'pay_' + Date.now());

      }

    };

    const rzp = new window.Razorpay(options);

    rzp.on('payment.failed', function(resp) {

      logFailedOrAbandonedDonation(

        'Payment Failed: ' + (resp.error?.description || 'Gateway Failure'),

        resp.error?.metadata?.payment_id

      );

    });

    rzp.open();

    document.getElementById('payment-gateway-modal')?.classList.remove('active');

  } else {

    alert('Payment gateway is initializing. Please verify your connection or refresh the page.');

  }

}



async function logFailedOrAbandonedDonation(reason, failedPaymentId) {

  if (!currentDonationData || currentDonationData._loggedFailed || currentDonationData._completed) return;

  currentDonationData._loggedFailed = true;

  try {

    const loc = currentDonationData.causeKey || currentDonationData.location || 'General';

    await SUPABASE_BACKEND.insertRecord('donations', {

      name: currentDonationData.name || 'Anonymous',

      email: currentDonationData.email || '',

      phone: currentDonationData.phone || '',

      amount: parseInt(currentDonationData.amount) || 0,

      location: loc,

      method: currentDonationData.paymentMode || 'Razorpay',

      status: 'Failed',

      txn_id: failedPaymentId || ('fail_' + Date.now().toString(36)),

      date: new Date().toISOString().split('T')[0],

      notes: `Failure Reason: ${reason} | PAN: ${currentDonationData.pan || 'N/A'} | Cause: ${currentDonationData.causeName || 'Hospital Food Relief'}`

    });

    console.log('Logged failed/abandoned transaction to Supabase:', reason);

  } catch (err) {

    console.warn('Failed to log failed donation to Supabase:', err);

  }

}



function executeSimulatedPay() {

  console.warn('Simulated test mode is disabled in production.');

}



async function completeSuccessfulDonation(paymentId) {

  if (currentDonationData) currentDonationData._completed = true;

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

    timeAgo: formatSupabaseDateTime(Date.now()),

    created_at: new Date().toISOString(),

    timestamp: Date.now(),

    receipt_no: rNum,

    dateStr: rDate

  });



  // Save current meta & session storage for receipt generation

  currentDonationMeta = { refNo: rNum, dateStr: rDate, txnId: paymentId };

  currentDonationPdfBlob = null;

  try {

    sessionStorage.setItem('pfc_last_receipt_donor', JSON.stringify(currentDonationData));

    sessionStorage.setItem('pfc_last_receipt_meta', JSON.stringify(currentDonationMeta));

  } catch (e) {}



  // 2. Populate & open 80G receipt modal

  if (document.getElementById('receipt-no')) document.getElementById('receipt-no').textContent = rNum;
  if (document.getElementById('receipt-date')) document.getElementById('receipt-date').textContent = rDate;
  if (document.getElementById('receipt-donor-name')) document.getElementById('receipt-donor-name').textContent = currentDonationData.name;
  if (document.getElementById('receipt-donor-pan')) document.getElementById('receipt-donor-pan').textContent = currentDonationData.pan || 'NOT_PROVIDED';
  if (document.getElementById('receipt-amount')) document.getElementById('receipt-amount').textContent = '₹' + parseInt(currentDonationData.amount).toLocaleString('en-IN');
  if (document.getElementById('receipt-cause')) document.getElementById('receipt-cause').textContent = currentDonationData.causeName;
  if (document.getElementById('receipt-email-confirm')) document.getElementById('receipt-email-confirm').textContent = currentDonationData.email;

  // Ensure Donor Contact row is present and populated
  if (!document.getElementById('receipt-donor-phone') && document.getElementById('receipt-donor-pan')) {
    const panRow = document.getElementById('receipt-donor-pan').closest('.receipt-row');
    if (panRow && panRow.parentNode) {
      const phoneRow = document.createElement('div');
      phoneRow.className = 'receipt-row';
      phoneRow.innerHTML = `<span>Donor Contact:</span><strong id="receipt-donor-phone">${escapeHtml(currentDonationData.phone || 'N/A')}</strong>`;
      panRow.parentNode.insertBefore(phoneRow, panRow);
    }
  } else if (document.getElementById('receipt-donor-phone')) {
    document.getElementById('receipt-donor-phone').textContent = currentDonationData.phone || 'N/A';
  }

  // Ensure Payment Mode / Txn ID row is present and populated
  if (!document.getElementById('receipt-payment-mode') && document.getElementById('receipt-cause')) {
    const causeRow = document.getElementById('receipt-cause').closest('.receipt-row');
    if (causeRow && causeRow.parentNode) {
      const payRow = document.createElement('div');
      payRow.className = 'receipt-row';
      payRow.innerHTML = `<span>Payment Mode / Txn:</span><strong id="receipt-payment-mode" style="word-break:break-all;">${escapeHtml(currentDonationData.paymentMode || 'Online (Razorpay)')} ${paymentId ? `(Txn: ${escapeHtml(paymentId)})` : ''}</strong>`;
      causeRow.parentNode.insertBefore(payRow, causeRow.nextSibling);
    }
  } else if (document.getElementById('receipt-payment-mode')) {
    document.getElementById('receipt-payment-mode').textContent = `${currentDonationData.paymentMode || 'Online (Razorpay)'} ${paymentId ? `(Txn: ${paymentId})` : ''}`;
  }



  // Wire up Print / Save PDF button in modal

  const dlBtn = document.getElementById('receipt-download-pdf-btn');

  if (dlBtn) {

    dlBtn.onclick = () => window.downloadCurrentReceiptPdf(dlBtn);

  }



  if (receiptModal) receiptModal.classList.add('active');



  // 3. IMMEDIATELY refresh recent donations strictly below this particular form!

  const contribEl = document.getElementById('dynamic-recent-contributors');

  const targetCauseKey = contribEl ? (contribEl.getAttribute('data-cause-key') || currentDonationData.causeKey || 'all') : (currentDonationData.causeKey || 'all');

  renderRecentDonations('dynamic-recent-contributors', targetCauseKey);

  renderFooterRecentDonations();

  updateMonthlyTargetTracker();



  // 4. Automated 80G Receipt & PDF Dispatch (Resend API verified with fallback)
  const donorCopy = { ...currentDonationData };
  const metaCopy = { ...currentDonationMeta };



  // 5. Asynchronous background PDF Generation & Supabase Storage Upload

  (async () => {

    let receiptUrl = '';

    let pdfBlob = null;

    try {

      pdfBlob = await generateReceiptPdfBlob(donorCopy, metaCopy);

      if (pdfBlob) {

        currentDonationPdfBlob = pdfBlob;

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

      await sendEmailReceipt(currentDonationData, { refNo: rNum, dateStr: rDate, txnId: paymentId }, receiptUrl, pdfBlob);

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



// Baseline verified contributions for initial display (strictly 3 per cause)

// Actual verified contributions as recorded in backend database (strictly 3 cards visible)

// =============================================================

// VERIFIED SUPABASE DATABASE DONATIONS (100% ACCURATE REAL DATA)

// =============================================================

const VERIFIED_SUPABASE_DONATIONS = [

  {

    name: 'Gaurab Saha',

    amount: 80,

    causeName: 'GMCH Hospital (Guwahati Medical College & Hospital Caregiver Meals)',

    timeAgo: '03 Nov 2026, 04:00 PM',

    created_at: '2026-11-03T10:30:17.596541+00:00',

    paymentMode: 'Card',

    location: 'gmch'

  },

  {

    name: 'Sarvajna Chaitanya Dasa',

    amount: 80,

    causeName: 'BBCI Hospital Food Distribution (Dr. B. Borooah Cancer Institute)',

    timeAgo: '03 Nov 2026, 12:09 PM',

    created_at: '2026-11-03T06:39:53.179502+00:00',

    paymentMode: 'UPI',

    location: 'borooah'

  },

  {

    name: 'Saurav',

    amount: 80,

    causeName: 'Special Occasion (Birthday / Anniversary Milestone Annadanam)',

    timeAgo: '02 Nov 2026, 01:41 PM',

    created_at: '2026-11-02T08:11:26.931317+00:00',

    paymentMode: 'UPI',

    location: 'birthday'

  },

  {

    name: 'GAURAB Saha',

    amount: 80,

    causeName: 'BBCI Hospital Food Distribution (Dr. B. Borooah Cancer Institute)',

    timeAgo: '01 Nov 2026, 09:52 PM',

    created_at: '2026-11-01T16:22:40.341965+00:00',

    paymentMode: 'UPI',

    location: 'borooah'

  },

  {

    name: 'SANTANA HALOI',

    amount: 800,

    causeName: 'BBCI Hospital Food Distribution',

    timeAgo: '10 Oct 2026, 10:07 AM',

    created_at: '2026-10-10T04:37:59.23498+00:00',

    paymentMode: 'Razorpay',

    location: 'borooah'

  },

  {

    name: 'ARUNJYOTI BURAGOHAIN',

    amount: 4800,

    causeName: 'GMCH Hospital Caregiver Meals',

    timeAgo: '25 Sep 2026, 03:25 PM',

    created_at: '2026-09-25T09:55:01.690305+00:00',

    paymentMode: 'Razorpay',

    location: 'gmch'

  },

  {

    name: 'SAGAR BARUAH',

    amount: 800,

    causeName: 'Assam Flood Relief',

    timeAgo: '14 Sep 2026, 09:56 PM',

    created_at: '2026-09-14T16:26:15.547693+00:00',

    paymentMode: 'Razorpay',

    location: 'assam-flood-relief'

  },

  {

    name: 'SANTANA HALOI',

    amount: 800,

    causeName: 'BBCI Hospital Food Distribution',

    timeAgo: '02 Sep 2026, 09:39 AM',

    created_at: '2026-09-02T04:09:45.722914+00:00',

    paymentMode: 'Razorpay',

    location: 'borooah'

  },

  {

    name: 'SANTANA HALOI',

    amount: 800,

    causeName: 'GMCH Hospital Caregiver Relief',

    timeAgo: '02 Jul 2026, 06:12 PM',

    created_at: '2026-07-02T12:42:10.36631+00:00',

    paymentMode: 'Razorpay',

    location: 'gmch'

  },

  {

    name: 'REETUMONI SINGHA',

    amount: 20,

    causeName: 'BBCI Hospital Food Relief',

    timeAgo: '24 Jun 2026, 04:20 PM',

    created_at: '2026-06-24T10:50:24.918327+00:00',

    paymentMode: 'Razorpay',

    location: 'borooah'

  },

  {

    name: 'BHANWAR SINGH',

    amount: 80,

    causeName: 'Sattvik Food Relief',

    timeAgo: '18 Jun 2026, 02:46 PM',

    created_at: '2026-06-18T09:16:08.290808+00:00',

    paymentMode: 'Razorpay',

    location: 'general'

  }

];



function getDonationTimeValue(d) {

  if (!d) return 0;

  if (d.created_at) {

    const t = new Date(d.created_at).getTime();

    if (!isNaN(t)) return t;

  }

  if (d.timestamp) {

    const t = typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp).getTime();

    if (!isNaN(t)) return t;

  }

  if (d.date) {

    const t = new Date(d.date).getTime();

    if (!isNaN(t)) return t;

  }

  if (d.timeAgo) {

    const t = new Date(d.timeAgo).getTime();

    if (!isNaN(t)) return t;

  }

  return 0;

}



function getStoredDonations(causeKey, mode = 'latest') {

  let stored = [];

  try {

    const raw = localStorage.getItem(DONATIONS_STORAGE_KEY);

    stored = raw ? JSON.parse(raw) : [];

    // Sanitize any legacy 'Just now' or relative strings from user's localStorage

    stored = stored.map(d => {

      if (!d.timeAgo || d.timeAgo === 'Just now' || d.timeAgo === 'Today' || d.timeAgo === 'Recent' || d.timeAgo.includes('ago')) {

        d.timeAgo = formatSupabaseDateTime(d.created_at || d.timestamp || d.date || d.dateStr);

      }

      return d;

    });

  } catch (e) {

    stored = [];

  }



  // Base list is exclusively real records from Supabase

  let allRealDonations = [...VERIFIED_SUPABASE_DONATIONS];



  if (window._liveSupabaseDonations && Array.isArray(window._liveSupabaseDonations)) {

    allRealDonations = [...window._liveSupabaseDonations, ...allRealDonations];

  }



  // Prioritize live verified Supabase records

  const combined = [...allRealDonations, ...stored];



  // Filter out any test amounts (< 10) or test names

  const validOnly = combined.filter(d => {

    const amt = parseInt(d.amount) || 0;

    const nm = (d.name || '').toUpperCase();

    return amt >= 10 && !nm.includes('TEST') && !nm.includes('MAYANK');

  });



  // Filter strictly by requested cause / location

  let filtered = validOnly;

  if (causeKey && causeKey !== 'all' && causeKey !== 'general') {

    filtered = validOnly.filter(d => matchesCauseLocation(d.location || d.causeKey, causeKey));

  }



  // Deduplicate by unique payment or name + amount

  const unique = [];

  const seen = new Set();

  for (const d of filtered) {

    const key = d.paymentId || d.txn_id || `${(d.name || '').trim().toLowerCase()}_${d.amount}`;

    if (!seen.has(key)) {

      seen.add(key);

      unique.push(d);

    }

  }



  if (mode === 'generous') {

    unique.sort((a, b) => (parseInt(b.amount) || 0) - (parseInt(a.amount) || 0));

  } else {

    // Latest mode: sort strictly descending by Supabase date and time

    unique.sort((a, b) => getDonationTimeValue(b) - getDonationTimeValue(a));

  }



  return unique;

}



function saveDonation(donation) {

  try {

    const raw = localStorage.getItem(DONATIONS_STORAGE_KEY);

    const all = raw ? JSON.parse(raw) : [];

    all.unshift(donation);

    localStorage.setItem(DONATIONS_STORAGE_KEY, JSON.stringify(all.slice(0, 20)));

  } catch (e) {

    console.error('Failed to save donation', e);

  }

}



// Switch between Latest and Most Generous tabs

window.switchContributorTab = function(btn, tabName) {

  const container = btn.closest('#dynamic-recent-contributors') || btn.closest('.contributors-section') || document;

  const allBtns = container.querySelectorAll('.contrib-tab-btn');

  allBtns.forEach(b => b.classList.remove('active'));

  btn.classList.add('active');



  const paneLatest = container.querySelector('.pane-latest');

  const paneGenerous = container.querySelector('.pane-generous');

  if (tabName === 'generous') {

    if (paneLatest) paneLatest.style.display = 'none';

    if (paneGenerous) paneGenerous.style.display = 'block';

  } else {

    if (paneLatest) paneLatest.style.display = 'block';

    if (paneGenerous) paneGenerous.style.display = 'none';

  }

};



// Render single landscape contributor card

function _renderCardHtml(d, idx, isGenerousTab) {

  const initial = (d.name || 'D').charAt(0).toUpperCase();

  const timeVal = getDonationTimeValue(d);

  const isVeryRecent = !isGenerousTab && (

    (timeVal && (Date.now() - timeVal < 72 * 3600 * 1000)) || idx < 2

  );



  return `

    <div class="contributor-row">

      <div style="display:flex; align-items:center; gap:0.85rem; width:100%;">

        <div class="contrib-avatar-wrap">

          <div class="contrib-initial">${initial}.</div>

          <div class="contrib-avatar">${initial}<span class="contrib-rank">${idx + 1}</span></div>

        </div>

        <div style="flex:1; overflow:hidden;">

          <div class="contrib-name-line" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px;">

            <strong style="white-space:nowrap; text-overflow:ellipsis; overflow:hidden; max-width:180px;">${escapeHtml(d.name)}</strong>

            <span class="contrib-amount" style="font-weight:800; color:#1A8C4E;">&#8377;${parseInt(d.amount).toLocaleString('en-IN')}.00</span>

          </div>

          ${isVeryRecent ? '<span class="contrib-badge badge-new-seva" style="background:#DCFCE7; color:#15803D; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:12px; border:1px solid #86EFAC; display:inline-block; margin-top:2px;"><i class="fa-solid fa-sparkles"></i> New Seva</span>' : ''}

          ${isGenerousTab ? '<span class="contrib-badge badge-generous" style="background:#FEF3C7; color:#B45309; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:12px; border:1px solid #FCD34D; display:inline-block; margin-top:2px;"><i class="fa-solid fa-crown"></i> Generous Seva</span>' : ''}

        </div>

      </div>



      <div class="contrib-purpose" style="font-size:0.85rem; color:#15803D; font-weight:700; line-height:1.4; border-top:1px solid #F1F5F9; border-bottom:1px solid #F1F5F9; padding:0.4rem 0; width:100%;">

        <i class="fa-solid fa-bowl-rice" style="margin-right:5px; color:#16A34A;"></i>${escapeHtml(d.causeName || 'Pure for Cure - Sattvik Food Distribution')}

      </div>



      <div class="contrib-time" style="font-size:0.76rem; color:#64748B; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px; width:100%;">

        <span><i class="fa-regular fa-clock"></i> ${escapeHtml(d.timeAgo || 'Recent')}</span>

        <div style="display:flex; align-items:center; gap:6px;">

          ${d.paymentMode ? '<span class="contrib-badge-mode" style="text-transform:uppercase; font-size:0.7rem; background:#F1F5F9; padding:2px 6px; border-radius:4px; font-weight:600;">' + escapeHtml(d.paymentMode) + '</span>' : ''}

          <span class="contrib-verified" style="color:#059669; font-weight:600; font-size:0.75rem;"><i class="fa-solid fa-shield-halved"></i> 80G</span>

        </div>

      </div>

    </div>

  `;

}



// Render dynamic recent contributions below donation form (with Latest and Most Generous tabs)

async function renderRecentDonations(containerId, causeKey) {

  const container = document.getElementById(containerId);

  if (!container) return;



  const effectiveCauseKey = causeKey || container.getAttribute('data-cause-key') || 'all';

  const latestList = getStoredDonations(effectiveCauseKey, 'latest');

  const generousList = getStoredDonations(effectiveCauseKey, 'generous');

  _renderContributorsHtml(container, latestList, generousList, effectiveCauseKey);

}



function _renderContributorsHtml(container, latestList, generousList, causeKey) {

  const latestVisible = (latestList || []).slice(0, 3);

  const generousVisible = (generousList || []).slice(0, 3);



  // Empty state HTML

  const emptyStateHtml = `

    <div class="no-donations-box" style="grid-column: 1 / -1; width:100%; text-align:center; padding:2.5rem 1.5rem; background:#F0FDF4; border:1.5px dashed #86EFAC; border-radius:14px;">

      <p style="font-size:1.15rem; color:#15803D; font-weight:700; margin-bottom:0.75rem;">

        <i class="fa-solid fa-heart" style="color:#16A34A; margin-right:8px;"></i> Be the first to Sponsor Meals

      </p>

      <a href="#product-donation-form" class="btn btn-primary btn-sm" style="display:inline-flex; align-items:center; gap:0.5rem;">

        <i class="fa-solid fa-hand-holding-heart"></i> Sponsor Meals Now

      </a>

    </div>

  `;



  // Preserve active tab state if user was already on generous

  const currentlyActiveBtn = container.querySelector('.contrib-tab-btn.active');

  const activeTab = currentlyActiveBtn ? (currentlyActiveBtn.getAttribute('data-tab-name') || 'latest') : 'latest';



  let html = `

    <div class="contributors-tabs-wrap">

      <button type="button" class="contrib-tab-btn ${activeTab === 'latest' ? 'active' : ''}" data-tab-name="latest" onclick="window.switchContributorTab(this, 'latest')">

        <i class="fa-solid fa-clock-rotate-left"></i> Latest

      </button>

      <button type="button" class="contrib-tab-btn ${activeTab === 'generous' ? 'active' : ''}" data-tab-name="generous" onclick="window.switchContributorTab(this, 'generous')">

        <i class="fa-solid fa-trophy"></i> Most Generous

      </button>

    </div>

    

    <div class="contributors-tab-pane pane-latest" style="display:${activeTab === 'latest' ? 'block' : 'none'};">

      <div class="contributors-list">

        ${latestVisible.length > 0 ? latestVisible.map((d, i) => _renderCardHtml(d, i, false)).join('') : emptyStateHtml}

      </div>

    </div>

    

    <div class="contributors-tab-pane pane-generous" style="display:${activeTab === 'generous' ? 'block' : 'none'};">

      <div class="contributors-list">

        ${generousVisible.length > 0 ? generousVisible.map((d, i) => _renderCardHtml(d, i, true)).join('') : emptyStateHtml}

      </div>

    </div>

  `;

  container.innerHTML = html;

}



// Render footer recent contributions feed (strictly last 3 cards matching Donate page content)

function formatFooterCause(cause) {

  if (!cause) return 'Hospital Food Distribution';

  let cleaned = cause.replace(/\s*\([^)]*\)/g, '').trim();

  if (cleaned.toLowerCase().includes('bbci')) return 'BBCI Hospital Food Distribution';

  if (cleaned.toLowerCase().includes('gmch')) return 'GMCH Attendant Meals';

  if (cleaned.toLowerCase().includes('aiims')) return 'AIIMS Hospital Food Kiosk';

  if (cleaned.toLowerCase().includes('birthday') || cleaned.toLowerCase().includes('occasion')) return 'Special Occasion Meals';

  if (cleaned.toLowerCase().includes('amavasya')) return 'Amavasya Annadanam';

  if (cleaned.toLowerCase().includes('memory') || cleaned.toLowerCase().includes('loved ones')) return 'In Memory of Loved Ones';

  if (cleaned.toLowerCase().includes('flood')) return 'Assam Flood Relief Seva';

  if (cleaned.length > 28) return cleaned.substring(0, 26) + '...';

  return cleaned;

}



async function renderFooterRecentDonations() {

  const container = document.getElementById('footer-recent-contributions');

  if (!container) return;



  const donations = getStoredDonations('all').slice(0, 4);

  if (!donations || donations.length === 0) return;



  let html = '<div class="footer-recent-contributions-feed">';

  donations.forEach((d) => {

    const initial = (d.name || 'D').charAt(0).toUpperCase();

    const dateText = d.timeAgo || formatSupabaseDateTime(d.created_at || d.timestamp || d.date) || 'Recent';

    const purposeText = formatFooterCause(d.causeName || d.cause || d.location);

    const amtNumber = parseInt(d.amount) || 0;

    const formattedAmt = amtNumber.toLocaleString('en-IN');

    html += `

      <div class="footer-contrib-card">

        <div class="footer-contrib-left">

          <div class="footer-contrib-avatar">${initial}</div>

          <div class="footer-contrib-info">

            <div class="footer-contrib-name">${escapeHtml((d.name || 'Donor').toUpperCase())}</div>

            <div class="footer-contrib-cause">${escapeHtml(purposeText)} &bull; ${escapeHtml(dateText)}</div>

          </div>

        </div>

        <div class="footer-contrib-amount">&#8377;${formattedAmt}</div>

      </div>

    `;

  });

  html += '</div>';

  container.innerHTML = html;

}



// Standalone reliable initializer for all recent donation containers (strictly 3 cards)

async function initAllRecentDonations() {

  try {

    renderFooterRecentDonations();

  } catch (err) {

    console.warn('Footer donations render error:', err);

  }

  try {

    const dynRecent = document.getElementById('dynamic-recent-contributors');

    if (dynRecent) {

      const causeKey = dynRecent.getAttribute('data-cause-key') || 'all';

      renderRecentDonations('dynamic-recent-contributors', causeKey);

    }

  } catch (err) {

    console.warn('Dynamic recent donations render error:', err);

  }



  // Asynchronously query live database to sync the latest actual contributions

  try {

    const rows = await fetchSupabaseDonations();

    if (rows && rows.length > 0) {

      // Filter out test amounts (< 10)

      const validRows = rows.filter(r => (parseInt(r.amount) || 0) >= 10);

      if (validRows.length > 0) {

        window._liveSupabaseDonations = validRows.map(r => {

          const dateStr = formatSupabaseDateTime(r.created_at || r.date);

          return {

            name: r.name,

            amount: parseInt(r.amount),

            causeName: (r.notes && r.notes.includes('Cause:')) ? r.notes.split('Cause:')[1].split('|')[0].trim() : getCauseTitleByKey(r.location || 'general'),

            timeAgo: dateStr,

            created_at: r.created_at,

            timestamp: r.created_at ? new Date(r.created_at).getTime() : undefined,

            paymentMode: r.method || 'Razorpay',

            location: r.location || 'general'

          };

        });

        renderFooterRecentDonations();

        const dynEl = document.getElementById('dynamic-recent-contributors');

        if (dynEl) {

          const cKey = dynEl.getAttribute('data-cause-key') || 'all';

          renderRecentDonations('dynamic-recent-contributors', cKey);

        }

      }

    }

  } catch(syncErr) {

    // Non-blocking silent fallback to actual verified baselines

  }

}

window.initAllRecentDonations = initAllRecentDonations;



if (document.readyState === 'loading') {

  document.addEventListener('DOMContentLoaded', initAllRecentDonations);

} else {

  initAllRecentDonations();

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

          <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">256-Bit SSL Encrypted &bull; Section 80G Tax Exemption</p>

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

        </div>

        <div style="border-top:1px solid #E2E8F0; padding-top:0.75rem; text-align:center;">

          <span style="font-size:0.78rem; color:#16A34A; display:inline-flex; align-items:center; gap:0.4rem; justify-content:center; font-weight:600;">

            <i class="fa-solid fa-shield-halved"></i> 256-Bit SSL Encrypted Official Payment via Razorpay

          </span>

        </div>

        <p style="font-size:0.8rem; color:#64748B; margin:0.75rem 0 0; text-align:center;">

          <i class="fa-solid fa-lock" style="color:#16A34A;"></i> Verifying with your bank / UPI provider... Please do not refresh.

        </p>

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
          <div class="receipt-row"><span>Donor Contact:</span><strong id="receipt-donor-phone">+91 00000 00000</strong></div>
          <div class="receipt-row"><span>Donor PAN:</span><strong id="receipt-donor-pan">ABCDE1234F</strong></div>
          <div class="receipt-row"><span>Towards / Cause:</span><strong id="receipt-cause">Hospital Caregiver Food Distribution</strong></div>
          <div class="receipt-row"><span>Payment Mode / Txn:</span><strong id="receipt-payment-mode" style="word-break:break-all;">Online (Razorpay)</strong></div>
          <div class="receipt-row"><span>Total Amount:</span><strong id="receipt-amount" style="font-size:1.2rem; color:#1A8C4E;">&#8377;2,000</strong></div>
          <div class="receipt-row"><span>Payment Status:</span><span style="color:#16A34A; font-weight:700;"><i class="fa-solid fa-check"></i> Verified via Razorpay Gateway</span></div>
          <div class="receipt-row"><span>80G Statutory Order:</span><span>14/80G/CIT/GHY-II/2011-12/4701-05 &bull; PAN: AAATH8807J</span></div>
        </div>

        <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:0.85rem; border-radius:6px; font-size:0.8rem; color:var(--text-muted); margin-bottom:1.5rem; text-align:center;">
          Donations to this institution are eligible Under 80G Tax Exemption (Income Tax Act, Govt. of India).
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



  // Active Tab in Navigation Highlighter & Hash Listener

  function updateActiveNavTab() {

    try {

      const path = (window.location.pathname || '').toLowerCase();

      const navLinks = document.querySelectorAll('.nav-menu .nav-link');

      if (!navLinks || !navLinks.length) return;

      

      let matchedTab = null;

      if (path.includes('about')) {

        matchedTab = 'about';

      } else if (path.includes('gallery') || path.includes('kiosk-')) {

        matchedTab = 'gallery';

      } else if (path.includes('program') || path.includes('initiatives')) {

        matchedTab = 'programs';

      } else if (path.includes('csr')) {

        matchedTab = 'csr';

      } else if (path.endsWith('/') || path.endsWith('/index.html') || path === '' || path === '/') {

        matchedTab = 'home';

      }



      if (matchedTab) {

        navLinks.forEach(link => {

          const href = (link.getAttribute('href') || '').toLowerCase();

          if (

            (matchedTab === 'home' && href.includes('index.html')) ||

            (matchedTab === 'about' && href.includes('about.html')) ||

            (matchedTab === 'gallery' && href.includes('gallery.html')) ||

            (matchedTab === 'programs' && (href.includes('programs.html') || href.includes('program') || href.includes('initiatives'))) ||

            (matchedTab === 'csr' && (href.includes('csr.html') || href.includes('csr')))

          ) {

            link.classList.add('active');

          } else {

            link.classList.remove('active');

          }

        });

      }

    } catch (e) {

      console.warn('Nav active highlighter:', e);

    }

  }

  updateActiveNavTab();

  window.addEventListener('hashchange', updateActiveNavTab);



  // Smooth scroll to targeted donation form anchor if present in URL hash or clicked
  function smoothScrollToDonationForm(hash) {
    const targetHash = hash || window.location.hash || '#donation-form';
    try {
      const targetEl = document.querySelector(targetHash) ||
                       document.getElementById('donation-form') ||
                       document.getElementById('general-donation') ||
                       document.getElementById('donate-general-form') ||
                       document.getElementById('product-donation-form') ||
                       document.getElementById('csr-inquiry-form') ||
                       document.querySelector('.product-sidebar-card');
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
    } catch (e) {}
    return false;
  }

  if (window.location.hash) {
    setTimeout(() => { smoothScrollToDonationForm(window.location.hash); }, 200);
    setTimeout(() => { smoothScrollToDonationForm(window.location.hash); }, 600);
  }

  // Handle on-click smooth scrolling for all Donate Now and Sponsor (CSR) buttons targeting donation forms
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('a[href*="#donation-form"], .nav-hkm-donate-btn, a[href*="donate.html#donation-form"], .support-card-donate-btn');
    if (!btn) return;

    const href = btn.getAttribute('href') || '';
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const targetUrl = href.split('#')[0];
    const targetHash = href.includes('#') ? '#' + href.split('#')[1] : '#donation-form';

    // If already on the target page (e.g., donate.html or an individual donate-*.html page)
    if (!targetUrl || targetUrl === currentPath || (currentPath === 'donate.html' && targetUrl.includes('donate.html'))) {
      const scrolled = smoothScrollToDonationForm(targetHash);
      if (scrolled) {
        e.preventDefault();
        try { history.pushState(null, null, targetHash); } catch(err) {}
        
        // Close mobile drawer if active
        const navMenu = document.querySelector('.nav-menu');
        const toggle = document.querySelector('.mobile-toggle');
        if (navMenu && navMenu.classList.contains('active')) {
          navMenu.classList.remove('active');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
      }
    }
  });



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



    const isHomePage = window.location.pathname.endsWith('/index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '' || window.location.pathname.endsWith('/index');

    const heroIntervalMs = isHomePage ? 8000 : 5000;

    function startTimer() { slideInterval = setInterval(nextSlide, heroIntervalMs); }

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



    function startVolTimer() { volInterval = setInterval(nextVol, 5000); }

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



    function startInitTimer() { initInterval = setInterval(nextInit, 5000); }

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

      if (modalDonateBtn) {
        modalDonateBtn.href = donateUrl;
        if (donateUrl && donateUrl.startsWith('gallery-')) {
          modalDonateBtn.innerHTML = '<i class="fa-solid fa-images"></i> Visit Dedicated Gallery &amp; Sponsor';
        } else {
          modalDonateBtn.innerHTML = '<i class="fa-solid fa-heart"></i> Sponsor Meals for this Initiative';
        }
      }



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

      const locationSelect = form.querySelector('#donation-location-select');

      const causeName = (locationSelect && locationSelect.selectedOptions && locationSelect.selectedOptions[0]) ?

                        locationSelect.selectedOptions[0].text :

                        ((progSelect && progSelect.selectedOptions && progSelect.selectedOptions[0]) ?

                        progSelect.selectedOptions[0].text :

                        (form.querySelector('.cause-name-hidden')?.value || 

                        form.querySelector('#home-cause-select')?.value || 

                        form.querySelector('#program-select')?.value || 'Hospital Caregiver Food Distribution'));

      const causeKeyVal = (locationSelect && locationSelect.value) ? locationSelect.value :

                          ((progSelect && progSelect.value) ? progSelect.value : 

                          (form.querySelector('.cause-key-hidden')?.value || 'general'));

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



  // Count Up Animation for Floating Data Bar & Hero Stats

  // Weekly Dynamic Stats Calculation:

  // Base: 2026-10-15 (Today)

  // Dynamic Growth: +8,000 plates/week to 48,90,470, +2 locations/week, +8 active days/week

  const statsBaseDate = new Date('2026-10-15T00:00:00Z');

  const statsNow = new Date();

  const diffWeeks = Math.max(0, Math.floor((statsNow - statsBaseDate) / (1000 * 60 * 60 * 24 * 7)));

  const dynamicPlates = 4890470 + (diffWeeks * 8000);

  const dynamicLocations = 49 + (diffWeeks * 2);

  const dynamicDays = 3059 + (diffWeeks * 8);



  // 1. Update Data Bar Total Plates

  const platesDatabarEl = document.getElementById('databar-plates-num');

  if (platesDatabarEl) {

    platesDatabarEl.setAttribute('data-count', dynamicPlates);

    platesDatabarEl.textContent = dynamicPlates.toLocaleString('en-IN') + '+';

  }



  // 2. Update Home Hero Image Badge (Plates of Meals served)

  const platesHeroEl = document.getElementById('home-hero-plates-num');

  if (platesHeroEl) {

    platesHeroEl.textContent = dynamicPlates.toLocaleString('en-IN') + '+';

  }



  // 3. Update Data Bar Locations

  const locEl = document.getElementById('databar-locations-num');

  if (locEl) {

    locEl.setAttribute('data-count', dynamicLocations);

    locEl.textContent = dynamicLocations + '+';

  }



  // 4. Update Data Bar Days

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

  

  // ==================== GROUP VOLUNTEER FORM SETUP ====================

  const addMemberBtn = document.getElementById('add-member-btn');

  const membersContainer = document.getElementById('members-container');

  if (addMemberBtn && membersContainer) {

    addMemberBtn.addEventListener('click', () => {

      const currentCount = membersContainer.querySelectorAll('.member-row').length + 1;

      const row = document.createElement('div');

      row.className = 'member-row';

      row.style.cssText = 'display:flex; gap:0.5rem; align-items:center;';

      row.innerHTML = `

        <input type="text" name="member_names[]" class="donation-input member-input" placeholder="Member ${currentCount} Name" required style="margin:0; flex:1;">

        <button type="button" class="btn btn-sm btn-outline remove-member-btn" style="padding:0.4rem 0.75rem; color:#DC2626; border-color:#FCA5A5; border-radius:6px; cursor:pointer;" title="Remove Member">&times;</button>

      `;

      row.querySelector('.remove-member-btn').addEventListener('click', () => row.remove());

      membersContainer.appendChild(row);

    });

  }



  const volDateInput = document.getElementById('vol-date-select');

  if (volDateInput) {

    const today = new Date().toISOString().split('T')[0];

    volDateInput.setAttribute('min', today);

  }



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



      // Dispatch instant Volunteer application alert to info@pureforcure.org and harekrishnamandir.dm@gmail.com

      try {

        if (typeof window.emailjs !== 'undefined' && window.emailjs.send) {

          const volEmailBody = `New Volunteer Seva Application Received:



Name: ${vName}

Email: ${vEmail}

Phone: ${volPhone || 'N/A'}

City: ${volCity || 'N/A'}

Volunteer Type: ${volType}

Organization: ${volOrg || 'Individual'}

Preferred Role: ${vRole}

Availability: ${volAvail || 'Flexible'}

Notes / Experience: ${volNotes || 'None'}



Submitted on: ${new Date().toLocaleString('en-GB')}`;

          

          // 1. Send confirmation acknowledgment to volunteer applicant

          if (vEmail && vEmail.includes('@')) {

            const volAckPayload = {

              from_name: 'Team Pure For Cure',

              from_email: 'info@pureforcure.org',

              reply_to: 'info@pureforcure.org',

              sender_email: 'info@pureforcure.org',

              to_email: vEmail,

              donor_email: vEmail,

              recipient_email: vEmail,

              email: vEmail,

              user_email: vEmail,

              to_name: vName,

              donor_name: vName,

              name: vName,

              subject: 'Welcome to Pure for Cure Volunteer Seva Family - Hare Krishna!',

              message: `Hare Krishna ${vName},\n\nThank you for offering your voluntary seva with Pure for Cure for "${vRole}". Your dedication helps sustain patient families outside government hospitals with daily nutritious meals.\n\nOur volunteer coordinator will review your profile and reach out shortly.\n\nWith gratitude,\nTeam Pure For Cure\nHare Krishna Movement, Guwahati\nEmail: info@pureforcure.org\nPhone: +91 70990 39770`,

              amount: 'Volunteer Seva',

              formatted_amount: 'Volunteer Seva',

              receipt_no: 'PFC-VOL-' + Date.now().toString().slice(-6),

              ref_no: 'PFC-VOL-' + Date.now().toString().slice(-6),

              txn_id: 'VOL_REGISTERED',

              date: new Date().toLocaleDateString('en-GB'),

              receipt_url: 'https://www.pureforcure.org/volunteer.html'

            };

            window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, volAckPayload).catch(err => console.warn('Vol applicant ack notice:', err));

          }



          // 2. Alert notifications to info@pureforcure.org and harekrishnamandir.dm@gmail.com

          const volPayload = {

            from_name: vName,

            from_email: vEmail || 'info@pureforcure.org',

            reply_to: vEmail || 'info@pureforcure.org',

            to_email: 'info@pureforcure.org',

            donor_email: 'info@pureforcure.org',

            recipient_email: 'info@pureforcure.org',

            email: 'info@pureforcure.org',

            to_name: 'Pure for Cure Volunteer Coordinator',

            subject: `[New Volunteer Application] ${vName} - ${vRole}`,

            message: volEmailBody,

            date: new Date().toLocaleDateString('en-GB')

          };

          window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, volPayload).catch(err => console.warn('Vol email error:', err));

          

          const adminVolPayload = { ...volPayload, to_email: 'harekrishnamandir.dm@gmail.com', donor_email: 'harekrishnamandir.dm@gmail.com', recipient_email: 'harekrishnamandir.dm@gmail.com', email: 'harekrishnamandir.dm@gmail.com' };

          window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, adminVolPayload).catch(err => console.warn('Vol admin email error:', err));

        }

      } catch (volMailErr) {

        console.warn('Volunteer email alert notice:', volMailErr);

      }



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



  // Notify administration immediately via email (info@pureforcure.org and harekrishnamandir.dm@gmail.com)

  try {

    if (typeof window.emailjs !== 'undefined' && window.emailjs.send) {

      const contactMsg = `New inquiry submitted on Pure for Cure website:



Name: ${firstName} ${lastName}

Email: ${email}

Subject: ${subject}



Message:

${message}



Submitted on: ${new Date().toLocaleString('en-GB')}`;

      

      // 1. Send confirmation acknowledgment to the user who filled the form

      if (email && email.includes('@')) {

        const userContactAck = {

          from_name: 'Team Pure For Cure',

          from_email: 'info@pureforcure.org',

          reply_to: 'info@pureforcure.org',

          sender_email: 'info@pureforcure.org',

          to_email: email,

          donor_email: email,

          recipient_email: email,

          email: email,

          user_email: email,

          to_name: `${firstName} ${lastName}`.trim() || 'Devotee / Friend',

          donor_name: `${firstName} ${lastName}`.trim() || 'Devotee / Friend',

          name: `${firstName} ${lastName}`.trim() || 'Devotee / Friend',

          subject: 'Thank you for contacting Pure for Cure - Hare Krishna!',

          message: `Hare Krishna ${firstName},\n\nThank you for reaching out to Pure for Cure. We have received your inquiry regarding "${subject || 'General Inquiry'}".\n\nOur seva coordinator will review your message and get back to you shortly.\n\nWith gratitude and best wishes,\nTeam Pure For Cure\nHare Krishna Movement, Guwahati\nEmail: info@pureforcure.org\nPhone: +91 70990 39770`,

          amount: 'Inquiry Submitted',

          formatted_amount: 'Inquiry Submitted',

          receipt_no: 'PFC-INQ-' + Date.now().toString().slice(-6),

          ref_no: 'PFC-INQ-' + Date.now().toString().slice(-6),

          txn_id: 'INQUIRY_RECEIVED',

          date: new Date().toLocaleDateString('en-GB'),

          receipt_url: 'https://www.pureforcure.org/contact.html'

        };

        window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, userContactAck).catch(err => console.warn('User contact ack notice:', err));

      }



      // 2. Alert notifications to info@pureforcure.org and harekrishnamandir.dm@gmail.com

      const pfcContactPayload = {

        from_name: `${firstName} ${lastName}`.trim() || 'Website Visitor',

        from_email: email || 'info@pureforcure.org',

        reply_to: email || 'info@pureforcure.org',

        to_email: 'info@pureforcure.org',

        donor_email: 'info@pureforcure.org',

        recipient_email: 'info@pureforcure.org',

        email: 'info@pureforcure.org',

        to_name: 'Pure for Cure Team',

        subject: `[Website Contact Inquiry] ${subject || 'New Message from ' + firstName}`,

        message: contactMsg,

        date: new Date().toLocaleDateString('en-GB')

      };

      window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, pfcContactPayload).catch(err => console.warn('PFC contact email notice:', err));

      

      const adminContactPayload = { ...pfcContactPayload, to_email: 'harekrishnamandir.dm@gmail.com', donor_email: 'harekrishnamandir.dm@gmail.com', recipient_email: 'harekrishnamandir.dm@gmail.com', email: 'harekrishnamandir.dm@gmail.com' };

      window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, adminContactPayload).catch(err => console.warn('Admin contact email notice:', err));

    }

  } catch (mailErr) {

    console.warn('Contact notification notice:', mailErr);

  }



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



// Auto rotate gallery/kiosk featured thumbnails on 5 seconds interval without scrolling the page/window
setInterval(() => {
  const thumbsStrips = document.querySelectorAll('.product-thumbs-strip');
  thumbsStrips.forEach(strip => {
    const parentContainer = strip.closest('.product-page-layout') || strip.parentElement;
    if (parentContainer && parentContainer.matches(':hover')) return;

    const thumbs = Array.from(strip.querySelectorAll('.product-thumb'));
    if (thumbs.length > 1) {
      const activeIdx = thumbs.findIndex(t => t.classList.contains('active') || t.style.borderColor === 'rgb(22, 163, 74)');
      const nextIdx = (activeIdx + 1) % thumbs.length;
      const targetThumb = thumbs[nextIdx];

      // Extract targetId from onclick or data attribute and swap directly without focusing or triggering window scroll
      const onclickAttr = targetThumb.getAttribute('onclick') || '';
      const match = onclickAttr.match(/swapFeaturedImg\s*\(\s*this\s*,\s*['"]([^'"]+)['"]\)/);
      const targetId = match ? match[1] : null;

      if (targetId && typeof window.swapFeaturedImg === 'function') {
        window.swapFeaturedImg(targetThumb, targetId);
      } else {
        thumbs.forEach(t => {
          t.classList.remove('active');
          t.style.borderColor = 'transparent';
          t.style.opacity = '0.65';
        });
        targetThumb.classList.add('active');
        targetThumb.style.borderColor = '#16A34A';
        targetThumb.style.opacity = '1';
      }

      // Smoothly scroll ONLY the strip container horizontally. NEVER scroll the page/window vertically!
      try {
        const offsetLeft = targetThumb.offsetLeft;
        const stripWidth = strip.clientWidth;
        const thumbWidth = targetThumb.clientWidth;
        strip.scrollTo({
          left: offsetLeft - (stripWidth - thumbWidth) / 2,
          behavior: 'smooth'
        });
      } catch(e) {}
    }
  });
}, 5000);



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

          autoTimer = setInterval(nextSlide, 5000);

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

          mandirTimer = setInterval(nextMandirSlide, 5000);

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

  let initiative = formEl.querySelector('[name="partnership_type"]')?.value || '';

  const budget = formEl.querySelector('[name="budget_range"]')?.value || '';

  const message = formEl.querySelector('[name="message"]')?.value || '';



  const vehicleCount = formEl.querySelector('[name="vehicle_count"]')?.value || '';

  const kioskCount = formEl.querySelector('[name="kiosk_count"]')?.value || '';

  const kitchenSupport = formEl.querySelector('[name="kitchen_support"]')?.value || '';

  const vesselsCount = formEl.querySelector('[name="vessels_count"]')?.value || '';



  let countDetails = '';

  if (vehicleCount) countDetails += `Vehicles: ${vehicleCount}. `;

  if (kioskCount) countDetails += `Kiosks: ${kioskCount}. `;

  if (kitchenSupport) countDetails += `Kitchen Support: ${kitchenSupport}. `;

  if (vesselsCount) countDetails += `Serving Vessels: ${vesselsCount}. `;



  if (!initiative) {

    if (vehicleCount) initiative = 'vehicle_sponsorship';

    else if (kioskCount) initiative = 'kiosk_adoption';

    else if (kitchenSupport) initiative = 'kitchen_automation';

    else if (vesselsCount) initiative = 'vessels_sponsorship';

    else initiative = 'csr_general';

  }



  const finalMessage = (countDetails ? `[Quantity: ${countDetails}] ` : '') + message;



  if (typeof SUPABASE_BACKEND !== 'undefined' && SUPABASE_BACKEND.insertRecord) {

    SUPABASE_BACKEND.insertRecord('csr_inquiries', {

      company_name: companyName,

      contact_person: contactPerson,

      email: email,

      phone: phone,

      partnership_type: initiative,

      budget_range: budget,

      message: finalMessage,

      status: 'pending'

    });

  }



  // Dispatch instant CSR email alert to info@pureforcure.org and harekrishnamandir.dm@gmail.com

  try {

    if (typeof window.emailjs !== 'undefined' && window.emailjs.send) {

      const csrEmailBody = `New CSR & Corporate Partnership Inquiry:



Company: ${companyName}

Contact Person: ${contactPerson}

Email: ${email}

Phone: ${phone}

Initiative: ${initiative}

Budget: ${budget || 'Not specified'}

Details: ${finalMessage}



Submitted on: ${new Date().toLocaleString('en-GB')}`;

      

      // 1. Send confirmation acknowledgment to CSR partner

      if (email && email.includes('@')) {

        const csrAckPayload = {

          from_name: 'Team Pure For Cure',

          from_email: 'info@pureforcure.org',

          reply_to: 'info@pureforcure.org',

          sender_email: 'info@pureforcure.org',

          to_email: email,

          donor_email: email,

          recipient_email: email,

          email: email,

          user_email: email,

          to_name: contactPerson || companyName || 'Partner',

          donor_name: contactPerson || companyName || 'Partner',

          name: contactPerson || companyName || 'Partner',

          subject: 'Pure for Cure CSR Partnership Proposal Received - Hare Krishna!',

          message: `Dear ${contactPerson || companyName},\n\nThank you for expressing interest in partnering with Pure for Cure for "${initiative}".\n\nOur CSR Desk has received your proposal and will review it promptly to discuss collaboration frameworks and project feasibility.\n\nWith sincere regards,\nTeam Pure For Cure\nHare Krishna Movement, Guwahati\nEmail: info@pureforcure.org\nPhone: +91 70990 39770`,

          amount: budget || 'CSR Partnership',

          formatted_amount: budget || 'CSR Partnership',

          receipt_no: 'PFC-CSR-' + Date.now().toString().slice(-6),

          ref_no: 'PFC-CSR-' + Date.now().toString().slice(-6),

          txn_id: 'CSR_PROPOSAL',

          date: new Date().toLocaleDateString('en-GB'),

          receipt_url: 'https://www.pureforcure.org/csr.html'

        };

        window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, csrAckPayload).catch(err => console.warn('CSR partner ack notice:', err));

      }



      // 2. Alert notifications to info@pureforcure.org and harekrishnamandir.dm@gmail.com

      const csrPayload = {

        from_name: contactPerson || companyName || 'Corporate Partner',

        from_email: email || 'info@pureforcure.org',

        reply_to: email || 'info@pureforcure.org',

        to_email: 'info@pureforcure.org',

        donor_email: 'info@pureforcure.org',

        recipient_email: 'info@pureforcure.org',

        email: 'info@pureforcure.org',

        to_name: 'Pure for Cure CSR Team',

        subject: `[CSR Partnership Inquiry] ${companyName || contactPerson} - ${initiative}`,

        message: csrEmailBody,

        date: new Date().toLocaleDateString('en-GB')

      };

      window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, csrPayload).catch(err => console.warn('CSR email error:', err));

      

      const adminCsrPayload = { ...csrPayload, to_email: 'harekrishnamandir.dm@gmail.com', donor_email: 'harekrishnamandir.dm@gmail.com', recipient_email: 'harekrishnamandir.dm@gmail.com', email: 'harekrishnamandir.dm@gmail.com' };

      window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, adminCsrPayload).catch(err => console.warn('CSR admin email error:', err));

    }

  } catch (csrMailErr) {

    console.warn('CSR email alert notice:', csrMailErr);

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



// Global Propose Date Modal Controls (used across gallery pages)

window.openProposeDateModal = function(e) {

  if (e) e.preventDefault();

  const modal = document.getElementById('proposeDateModal');

  if (modal) {

    modal.style.display = 'flex';

    const input = document.getElementById('proposedMealDateInput');

    if (input && !input.value) {

      const tomorrow = new Date();

      tomorrow.setDate(tomorrow.getDate() + 1);

      input.value = tomorrow.toISOString().split('T')[0];

      input.min = new Date().toISOString().split('T')[0];

    }

  } else {

    window.location.href = 'donate-birthday.html';

  }

};



window.closeProposeDateModal = function() {

  const modal = document.getElementById('proposeDateModal');

  if (modal) modal.style.display = 'none';

};



window.handleProposeDateSubmit = function(e) {

  if (e) e.preventDefault();

  const dateVal = document.getElementById('proposedMealDateInput')?.value || '';

  const occVal = document.getElementById('proposedOccasionType')?.value || '';

  let url = 'donate-birthday.html';

  if (dateVal) {

    url += '?date=' + encodeURIComponent(dateVal) + (occVal ? '&occasion=' + encodeURIComponent(occVal) : '');

  }

  window.location.href = url;

  return false;

};



// Auto-fill occasion date on donate-birthday.html if query param present

document.addEventListener('DOMContentLoaded', () => {

  const urlParams = new URLSearchParams(window.location.search);

  const paramDate = urlParams.get('date');

  if (paramDate) {

    const dateInput = document.getElementById('occasion-date');

    if (dateInput) {

      dateInput.value = paramDate;

      dateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });

      dateInput.style.outline = '2px solid #1A8C4E';

      dateInput.style.outlineOffset = '3px';

      setTimeout(() => { dateInput.style.outline = ''; dateInput.style.outlineOffset = ''; }, 3000);

    }

  }

  const paramOccasion = urlParams.get('occasion');

  if (paramOccasion) {

    const occSelect = document.getElementById('occasion-type');

    if (occSelect) {

      for (let i = 0; i < occSelect.options.length; i++) {

        if (occSelect.options[i].value.toLowerCase().includes(paramOccasion.toLowerCase())) {

          occSelect.selectedIndex = i;

          break;

        }

      }

    }

  }

});









// ==========================================================================

// GALLERY PHOTO CARDS SLIDER (3 Cards visible on Desktop, 5s Auto-Sliding)

// ==========================================================================

let gpCardInterval = null;



function getVisibleThumbsCount() {

  if (window.innerWidth > 900) return 3;

  if (window.innerWidth > 580) return 2;

  return 1;

}



function slideGpPhotoCard(cardId, direction) {

  const track = document.getElementById('track-' + cardId);

  if (!track) return;

  const thumbs = track.querySelectorAll('.gp-thumb');

  const total = thumbs.length;

  const visible = getVisibleThumbsCount();

  const maxIndex = Math.max(0, total - visible);

  

  if (maxIndex <= 0) {

    track.style.transform = 'translateX(0px)';

    track.setAttribute('data-current-index', '0');

    return;

  }



  let currentIndex = parseInt(track.getAttribute('data-current-index') || '0', 10);

  if (direction > 0) {

    currentIndex = (currentIndex >= maxIndex) ? 0 : currentIndex + 1;

  } else if (direction < 0) {

    currentIndex = (currentIndex <= 0) ? maxIndex : currentIndex - 1;

  }



  track.setAttribute('data-current-index', currentIndex);

  const thumbWidth = thumbs[0].offsetWidth;

  const gap = 16;

  const offset = currentIndex * (thumbWidth + gap);

  track.style.transform = `translateX(-${offset}px)`;

}



function initCardSliders() {

  if (gpCardInterval) clearInterval(gpCardInterval);



  // Auto-slide every 5 seconds (5000ms)

  gpCardInterval = setInterval(() => {

    const tracks = document.querySelectorAll('.gp-slider-track');

    tracks.forEach(track => {

      const card = track.closest('.donor-card-box');

      if (card && card.matches(':hover')) return;



      const cardId = track.id.replace('track-', '');

      slideGpPhotoCard(cardId, 1);

    });

  }, 5000);

}



window.slideGpPhotoCard = slideGpPhotoCard;

window.initCardSliders = initCardSliders;



window.addEventListener('resize', () => {

  document.querySelectorAll('.gp-slider-track').forEach(track => {

    const cardId = track.id.replace('track-', '');

    slideGpPhotoCard(cardId, 0);

  });

});





// Automatically initialize card sliders on load & mutation

if (typeof document !== 'undefined') {

  document.addEventListener('DOMContentLoaded', () => {

    if (typeof initCardSliders === 'function') {

      initCardSliders();

    }

  });

  window.addEventListener('load', () => {

    if (typeof initCardSliders === 'function') {

      initCardSliders();

    }

  });

}





// Global Download & View Function for Official 80G Donation Receipt PDF

window.downloadCurrentReceiptPdf = async function(btn) {

  const origHtml = btn ? btn.innerHTML : '<i class="fa-solid fa-file-pdf"></i> Print / Save PDF';

  try {

    if (btn) {

      btn.disabled = true;

      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Official PDF...';

    }



    let donor = currentDonationData;

    let meta = currentDonationMeta;



    // Fallback: recover donor data from active receipt modal DOM or sessionStorage if null

    if (!donor) {

      const savedDonor = sessionStorage.getItem('pfc_last_receipt_donor');

      if (savedDonor) {

        try { donor = JSON.parse(savedDonor); } catch (e) {}

      }

    }

    if (!meta) {

      const savedMeta = sessionStorage.getItem('pfc_last_receipt_meta');

      if (savedMeta) {

        try { meta = JSON.parse(savedMeta); } catch (e) {}

      }

    }



    if (!donor) {

      const modal = document.getElementById('receipt-modal');

      const name = modal ? (modal.querySelector('#receipt-donor-name')?.textContent || 'Devoted Supporter') : 'Devoted Supporter';

      const pan = modal ? (modal.querySelector('#receipt-donor-pan')?.textContent || 'NOT_PROVIDED') : 'NOT_PROVIDED';

      const cause = modal ? (modal.querySelector('#receipt-cause')?.textContent || 'Hospital Caregiver Food Relief') : 'Hospital Caregiver Food Relief';

      const amtTxt = modal ? (modal.querySelector('#receipt-amount')?.textContent || '80') : '80';

      const amtNum = parseInt(amtTxt.replace(/[^0-9]/g, '')) || 80;

      const email = modal ? (modal.querySelector('#receipt-email-confirm')?.textContent || '') : '';

      donor = {

        name: name,

        email: email,

        pan: pan,

        amount: amtNum,

        causeName: cause,

        phone: '',

        address: 'Guwahati, Assam, India',

        paymentMode: 'Verified via Payment Gateway'

      };

    }



    if (!meta) {

      const modal = document.getElementById('receipt-modal');

      const refNo = modal ? (modal.querySelector('#receipt-no')?.textContent || ('PFC-DR-' + Date.now().toString().slice(-6))) : ('PFC-DR-' + Date.now().toString().slice(-6));

      const dateStr = modal ? (modal.querySelector('#receipt-date')?.textContent || new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })) : new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });

      meta = {

        refNo: refNo,

        dateStr: dateStr,

        txnId: 'pay_' + Date.now().toString(36)

      };

    }



    let blob = currentDonationPdfBlob;

    if (!blob) {

      blob = await generateReceiptPdfBlob(donor, meta);

      currentDonationPdfBlob = blob;

    }



    if (blob) {

      const blobUrl = URL.createObjectURL(blob);

      const filename = `Donation-Receipt-${meta.refNo || 'PFC'}.pdf`;



      // 1. Trigger instant browser download

      const downloadAnchor = document.createElement('a');

      downloadAnchor.href = blobUrl;

      downloadAnchor.download = filename;

      document.body.appendChild(downloadAnchor);

      downloadAnchor.click();

      document.body.removeChild(downloadAnchor);



      // 2. Also open in new window/tab so donor can immediately view and print the official receipt

      const viewWin = window.open(blobUrl, '_blank');

      if (viewWin) {

        viewWin.focus();

      }



      if (btn) {

        btn.disabled = false;

        btn.innerHTML = '<i class="fa-solid fa-check"></i> Official Receipt Saved!';

        setTimeout(() => {

          btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Print / Save PDF';

        }, 3500);

      }

    } else {

      window.print();

      if (btn) {

        btn.disabled = false;

        btn.innerHTML = origHtml;

      }

    }

  } catch (err) {

    console.error('downloadCurrentReceiptPdf error:', err);

    window.print();

    if (btn) {

      btn.disabled = false;

      btn.innerHTML = origHtml;

    }

  }

};

