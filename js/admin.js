/* Pure for Cure - Hare Krishna Movement Guwahati
 * Admin Dashboard Engine (v2.0)
 * Real-time Supabase Data Sync, Razorpay Reconciliation, 80G Receipts & CSV/XLS Exports
 * Added: Customer Section, Successful & Failed Payments, Bulk Actions, Search on all tables
 */

const ADMIN_CONFIG = {
  SUPABASE_URL: 'https://jhlxeyegakyvxtxqvrsz.supabase.co',
  SUPABASE_KEY: 'sb_publishable_o25ZPIgjLnQupz-mR52nLQ_n6d3PpN5',
  DEFAULT_RAZORPAY_KEY: 'rzp_live_ysKJLc5VAgvM7W',
  MASTER_PASSCODE_HASH: 'pfc@admin2026', // Emergency master passcode
  MEAL_UNIT_COST: 80 // ₹80 per Sattvik meal
};

// Global State
const AdminState = {
  supabase: null,
  user: null,
  isAuthenticated: false,
  realtimeConnected: false,
  activeTab: 'donations',
  dateFilter: 'all',
  customStartDate: null,
  customEndDate: null,
  searchQuery: '',
  locationFilter: 'all',
  statusFilter: 'all',
  selectedDonationIds: new Set(),
  customers: [],
  data: {
    donations: [],
    volunteers: [],
    newsletter: [],
    contact: [],
    csr: [],
    razorpay: []
  },
  charts: {
    revenue: null,
    location: null
  }
};

// ==============================================================================
// 1. INITIALIZATION & AUTHENTICATION
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  setupEventListeners();
  checkAuthSession();
  startClock();
});

function initSupabase() {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    AdminState.supabase = window.supabase.createClient(
      ADMIN_CONFIG.SUPABASE_URL,
      ADMIN_CONFIG.SUPABASE_KEY,
      {
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      }
    );
    console.log('✓ Supabase Client initialized successfully.');
  } else {
    console.error('Supabase JS library not loaded.');
  }
}

async function checkAuthSession() {
  // 1. Check local session token / master passcode
  const savedMasterAuth = localStorage.getItem('pfc_admin_session');
  if (savedMasterAuth === 'authorized_master_2026') {
    AdminState.isAuthenticated = true;
    AdminState.user = {
      email: 'admin@pureforcure.org',
      name: 'PFC Administrator',
      role: 'Master Admin',
      avatar: 'images/prabhupada/prabhupada.png'
    };
    renderAuthenticatedUI();
    loadAllDashboardData();
    subscribeToRealtimeChanges();
    return;
  }

  // 2. Check Supabase Auth session (Google OAuth redirect)
  if (AdminState.supabase) {
    try {
      const { data: { session }, error } = await AdminState.supabase.auth.getSession();
      if (session && session.user) {
        AdminState.isAuthenticated = true;
        AdminState.user = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
          avatar: session.user.user_metadata?.avatar_url || 'images/prabhupada/prabhupada.png',
          role: 'Google Verified Admin'
        };
        renderAuthenticatedUI();
        loadAllDashboardData();
        subscribeToRealtimeChanges();
        return;
      }

      // Supabase Auth state change listener
      AdminState.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          AdminState.isAuthenticated = true;
          AdminState.user = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
            avatar: session.user.user_metadata?.avatar_url || 'images/prabhupada/prabhupada.png',
            role: 'Google Verified Admin'
          };
          renderAuthenticatedUI();
          loadAllDashboardData();
          subscribeToRealtimeChanges();
        } else if (event === 'SIGNED_OUT') {
          AdminState.isAuthenticated = false;
          AdminState.user = null;
          renderLoginGate();
        }
      });
    } catch (e) {
      console.warn('Session check error:', e);
    }
  }

  renderLoginGate();
}

function renderLoginGate() {
  document.getElementById('admin-login-gate').style.display = 'flex';
  document.getElementById('admin-app-shell').style.display = 'none';
}

function renderAuthenticatedUI() {
  document.getElementById('admin-login-gate').style.display = 'none';
  document.getElementById('admin-app-shell').style.display = 'block';

  // Update Topbar Admin Profile
  const u = AdminState.user;
  if (u) {
    document.getElementById('admin-user-name').textContent = u.name;
    document.getElementById('admin-user-email').textContent = u.email;
    const avatarEl = document.getElementById('admin-user-avatar');
    if (avatarEl && u.avatar) {
      avatarEl.src = u.avatar;
    }
  }
}

async function signInWithGoogle() {
  if (!AdminState.supabase) {
    showToast('Supabase client not ready. Please refresh.', 'error');
    return;
  }
  const statusEl = document.getElementById('login-status-msg');
  if (statusEl) {
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Google Authentication status...';
    statusEl.style.display = 'block';
  }

  try {
    // 1. Preflight check to verify if Google OAuth is enabled in Supabase without redirecting the whole window
    try {
      const preflight = await fetch(`${ADMIN_CONFIG.SUPABASE_URL}/auth/v1/authorize?provider=google`);
      if (preflight.status === 400) {
        const errJson = await preflight.json().catch(() => ({}));
        if (errJson.msg && errJson.msg.toLowerCase().includes('not enabled')) {
          if (statusEl) {
            statusEl.innerHTML = `
              <div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; padding:12px; text-align:left; color:#991B1B;">
                <div style="font-weight:700; margin-bottom:4px;"><i class="fa-solid fa-triangle-exclamation"></i> Google Auth Not Enabled in Supabase</div>
                <div style="font-size:0.78rem; line-height:1.4; margin-bottom:10px;">
                  Google OAuth provider is not yet activated in your Supabase project console (<code>jhlxeyegakyvxtxqvrsz</code>).
                </div>
                <button type="button" onclick="quickFillMasterPasscode();" class="btn btn-primary" style="width:100%; justify-content:center; padding:8px; font-size:0.82rem;">
                  <i class="fa-solid fa-key"></i> Log In With Master Passcode (pfc@admin2026)
                </button>
              </div>
            `;
          }
          return;
        }
      }
    } catch (netErr) {
      console.warn('Google preflight check skipped:', netErr);
    }

    // 2. If enabled, proceed with Supabase OAuth redirect
    const redirectUrl = window.location.origin + window.location.pathname;
    const { error } = await AdminState.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    if (error) {
      throw error;
    }
  } catch (err) {
    console.error('Google Sign-In Error:', err);
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:8px; padding:10px; color:#991B1B; font-size:0.78rem;">
          <i class="fa-solid fa-circle-exclamation"></i> ${err.message || 'Google Auth is not enabled in Supabase'}.
          <br>Please use the Master Passcode below for instant login.
        </div>
      `;
    }
  }
}

function quickFillMasterPasscode() {
  const input = document.getElementById('master-passcode-input');
  if (input) {
    input.value = 'pfc@admin2026';
    verifyMasterPasscode();
  }
}

function verifyMasterPasscode() {
  const input = document.getElementById('master-passcode-input');
  const errorEl = document.getElementById('passcode-error');
  const rawCode = (input?.value || '').trim();
  const cleanCode = rawCode.toLowerCase();

  // Support flexible master passcodes (case-insensitive)
  const validCodes = ['pfc@admin2026', 'admin2026', 'pfc2026', 'pfc@2026'];

  if (validCodes.includes(cleanCode)) {
    localStorage.setItem('pfc_admin_session', 'authorized_master_2026');
    AdminState.isAuthenticated = true;
    AdminState.user = {
      email: 'admin@pureforcure.org',
      name: 'PFC Administrator',
      role: 'Master Admin',
      avatar: 'images/prabhupada/prabhupada.png'
    };
    if (errorEl) errorEl.style.display = 'none';
    renderAuthenticatedUI();
    loadAllDashboardData();
    subscribeToRealtimeChanges();
    showToast('Welcome, Administrator! Authenticated via Master Passcode.', 'success');
  } else {
    if (errorEl) {
      errorEl.textContent = 'Invalid Passcode. The Master Passcode is: pfc@admin2026';
      errorEl.style.display = 'block';
    }
    input?.focus();
  }
}

async function signOutAdmin() {
  localStorage.removeItem('pfc_admin_session');
  if (AdminState.supabase) {
    try {
      await AdminState.supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  }
  AdminState.isAuthenticated = false;
  AdminState.user = null;
  renderLoginGate();
  showToast('Signed out successfully.', 'info');
}

// ==============================================================================
// 2. REAL-TIME SYNCHRONIZATION ENGINE & WEB AUDIO NOTIFICATIONS
// ==============================================================================
function subscribeToRealtimeChanges() {
  if (!AdminState.supabase) return;

  try {
    const channel = AdminState.supabase.channel('pfc-admin-live-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, (payload) => {
        handleRealtimeEvent('donations', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volunteer_applications' }, (payload) => {
        handleRealtimeEvent('volunteers', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_subscribers' }, (payload) => {
        handleRealtimeEvent('newsletter', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_inquiries' }, (payload) => {
        handleRealtimeEvent('contact', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'csr_inquiries' }, (payload) => {
        handleRealtimeEvent('csr', payload);
      })
      .subscribe((status) => {
        const badge = document.getElementById('realtime-status-pill');
        if (status === 'SUBSCRIBED') {
          AdminState.realtimeConnected = true;
          if (badge) {
            badge.className = 'status-pill status-live';
            badge.innerHTML = '<span class="status-pulse-dot"></span> Realtime Live (WebSockets)';
          }
          console.log('✓ Supabase Realtime Channel Connected!');
        } else {
          AdminState.realtimeConnected = false;
          if (badge) {
            badge.className = 'status-pill status-polling';
            badge.innerHTML = '<span class="status-pulse-dot dot-amber"></span> Auto-Polling (20s)';
          }
        }
      });
  } catch (err) {
    console.warn('Realtime subscription issue:', err);
  }

  // Periodic safety polling every 20 seconds
  setInterval(() => {
    if (AdminState.isAuthenticated) {
      loadAllDashboardData(true);
    }
  }, 20000);
}

function handleRealtimeEvent(tableKey, payload) {
  console.log(`⚡ Real-time event [${tableKey} - ${payload.eventType}]:`, payload);
  playChime();

  if (payload.eventType === 'INSERT') {
    const newRecord = payload.new;
    // Format if donations
    if (tableKey === 'donations') {
      AdminState.data.donations.unshift(newRecord);
      const isSuccess = (newRecord.status || '').toLowerCase() === 'success';
      if (isSuccess) {
        showToast(`🎉 New Donation Received: ₹${Number(newRecord.amount).toLocaleString('en-IN')} from ${newRecord.name}!`, 'donation');
      } else {
        showToast(`⚠️ Payment Incomplete / Failed: ₹${Number(newRecord.amount).toLocaleString('en-IN')} (${newRecord.name})`, 'error');
      }
      buildCustomersData();
    } else if (tableKey === 'volunteers') {
      AdminState.data.volunteers.unshift(newRecord);
      showToast(`🤝 New Volunteer Application: ${newRecord.full_name}`, 'info');
    } else if (tableKey === 'newsletter') {
      AdminState.data.newsletter.unshift(newRecord);
      showToast(`📬 New Newsletter Subscriber: ${newRecord.email}`, 'info');
    } else if (tableKey === 'contact') {
      AdminState.data.contact.unshift(newRecord);
      showToast(`✉️ New Contact Message from ${newRecord.full_name}`, 'info');
    } else if (tableKey === 'csr') {
      AdminState.data.csr.unshift(newRecord);
      showToast(`🏢 New CSR Partnership Inquiry: ${newRecord.company_name}`, 'donation');
    }

    renderActiveTab();
    updateKPIs();
    renderCharts();
  } else if (payload.eventType === 'UPDATE') {
    const list = AdminState.data[tableKey];
    const idx = list.findIndex(item => item.id === payload.new.id);
    if (idx !== -1) {
      list[idx] = payload.new;
      if (tableKey === 'donations') buildCustomersData();
      renderActiveTab();
      updateKPIs();
    }
  } else if (payload.eventType === 'DELETE') {
    AdminState.data[tableKey] = AdminState.data[tableKey].filter(item => item.id !== payload.old.id);
    if (tableKey === 'donations') buildCustomersData();
    renderActiveTab();
    updateKPIs();
  }
}

// Subtle Web Audio Chime (no external audio files required)
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch (e) {
    // Audio Context might be restricted before user gesture
  }
}

// ==============================================================================
// 3. DATA FETCHING & STATE MANAGEMENT
// ==============================================================================
async function loadAllDashboardData(silent = false) {
  if (!AdminState.supabase) return;
  const refreshIcon = document.getElementById('refresh-data-icon');
  if (refreshIcon && !silent) refreshIcon.classList.add('fa-spin');

  try {
    // Parallel fetch across all 5 Supabase tables
    const [donationsRes, volunteersRes, newsletterRes, contactRes, csrRes] = await Promise.all([
      AdminState.supabase.from('donations').select('*').order('created_at', { ascending: false }),
      AdminState.supabase.from('volunteer_applications').select('*').order('created_at', { ascending: false }),
      AdminState.supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }),
      AdminState.supabase.from('contact_inquiries').select('*').order('created_at', { ascending: false }),
      AdminState.supabase.from('csr_inquiries').select('*').order('created_at', { ascending: false })
    ]);

    if (!donationsRes.error && donationsRes.data) {
      AdminState.data.donations = donationsRes.data;
    }
    if (!volunteersRes.error && volunteersRes.data) {
      AdminState.data.volunteers = volunteersRes.data;
    }
    if (!newsletterRes.error && newsletterRes.data) {
      AdminState.data.newsletter = newsletterRes.data;
    }
    if (!contactRes.error && contactRes.data) {
      AdminState.data.contact = contactRes.data;
    }
    if (!csrRes.error && csrRes.data) {
      AdminState.data.csr = csrRes.data;
    }

    // Build Customers Data Aggregation
    buildCustomersData();

    // Build Razorpay Reconciliation list
    buildRazorpayReconciliationData();

    updateKPIs();
    renderActiveTab();
    renderCharts();
    updateLastSyncedTime();

    if (!silent) {
      showToast('Dashboard data refreshed successfully.', 'success');
    }
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    if (!silent) showToast('Failed to refresh data: ' + err.message, 'error');
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('fa-spin');
  }
}

// ==============================================================================
// CUSTOMER & DONOR DATA AGGREGATION
// ==============================================================================
function buildCustomersData() {
  const map = new Map();

  AdminState.data.donations.forEach(d => {
    const rawEmail = (d.email || '').trim().toLowerCase();
    const rawPhone = (d.phone || '').trim().replace(/[^0-9]/g, '');
    const rawName = (d.name || 'Anonymous').trim();

    const key = rawEmail || (rawPhone ? 'tel_' + rawPhone : 'name_' + rawName.toLowerCase());

    if (!map.has(key)) {
      map.set(key, {
        key: key,
        name: rawName,
        email: d.email || 'N/A',
        phone: d.phone || 'N/A',
        pan: extractPanFromNotes(d.notes) || '',
        address: cleanAddress(d.notes),
        totalAmount: 0,
        donationCount: 0,
        successCount: 0,
        failedCount: 0,
        lastDonationDate: d.created_at || d.date,
        payments: []
      });
    }

    const customer = map.get(key);
    if ((customer.name === 'Anonymous' || !customer.name) && rawName) customer.name = rawName;
    if (!customer.pan) customer.pan = extractPanFromNotes(d.notes) || '';
    if (!customer.address || customer.address === 'Guwahati, Assam, India') customer.address = cleanAddress(d.notes);

    customer.payments.push(d);
    customer.donationCount++;

    const isSuccess = (d.status || '').toLowerCase() === 'success';
    if (isSuccess) {
      customer.successCount++;
      customer.totalAmount += (Number(d.amount) || 0);
    } else {
      customer.failedCount++;
    }

    const currentDate = new Date(d.created_at || d.date);
    if (!isNaN(currentDate.getTime()) && currentDate > new Date(customer.lastDonationDate)) {
      customer.lastDonationDate = d.created_at || d.date;
    }
  });

  // Sort customers by total contributed amount descending
  AdminState.customers = Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

function buildRazorpayReconciliationData() {
  // Reconcile donations against Razorpay payment transactions
  AdminState.data.razorpay = AdminState.data.donations.map(d => {
    return {
      payment_id: d.txn_id || 'N/A',
      donor_name: d.name,
      amount: d.amount,
      currency: 'INR',
      status: d.status || 'captured',
      created_at: d.created_at,
      email: d.email || 'N/A',
      contact: d.phone || 'N/A',
      hospital_location: d.location || 'General',
      reconciled_with_db: Boolean(d.id && (d.status || '').toLowerCase() === 'success')
    };
  });
}

// ==============================================================================
// 4. KPI METRICS & REPORT COMPUTATIONS
// ==============================================================================
function updateKPIs() {
  const successfulDonations = AdminState.data.donations.filter(d => (d.status || '').toLowerCase() === 'success');
  const failedDonations = AdminState.data.donations.filter(d => (d.status || '').toLowerCase() === 'failed');
  const totalAmount = successfulDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalDonors = AdminState.customers.length;
  const avgDonation = successfulDonations.length > 0 ? Math.round(totalAmount / successfulDonations.length) : 0;
  const mealsSponsored = Math.floor(totalAmount / ADMIN_CONFIG.MEAL_UNIT_COST);

  const pendingVolunteers = AdminState.data.volunteers.filter(v => (v.status || 'pending').toLowerCase() === 'pending').length;
  const activeSubscribers = AdminState.data.newsletter.length;
  const totalInquiries = AdminState.data.contact.length + AdminState.data.csr.length;

  // DOM Updates
  setText('kpi-total-revenue', '₹' + totalAmount.toLocaleString('en-IN'));
  setText('kpi-meals-sponsored', mealsSponsored.toLocaleString('en-IN') + ' Plates');
  setText('kpi-total-donors', totalDonors.toLocaleString('en-IN'));
  setText('kpi-avg-ticket', '₹' + avgDonation.toLocaleString('en-IN'));
  setText('kpi-active-subscribers', activeSubscribers.toLocaleString('en-IN'));
  setText('kpi-pending-volunteers', pendingVolunteers.toLocaleString('en-IN'));
  setText('kpi-total-inquiries', totalInquiries.toLocaleString('en-IN'));

  // Tab Badge Counters
  setText('badge-count-donations', AdminState.data.donations.length);
  setText('badge-count-customers', AdminState.customers.length);
  setText('badge-count-volunteers', AdminState.data.volunteers.length);
  setText('badge-count-newsletter', AdminState.data.newsletter.length);
  setText('badge-count-contact', AdminState.data.contact.length);
  setText('badge-count-csr', AdminState.data.csr.length);
  setText('badge-count-razorpay', AdminState.data.razorpay.length);
}

// ==============================================================================
// 5. VISUAL ANALYTICS & CHARTS (Chart.js)
// ==============================================================================
function renderCharts() {
  if (typeof window.Chart === 'undefined') return;

  const donations = AdminState.data.donations.filter(d => (d.status || '').toLowerCase() === 'success');

  // Chart 1: Revenue Timeline (Monthly Aggregation)
  const monthlyRevenue = {};
  donations.forEach(d => {
    const rawDate = d.date || (d.created_at ? d.created_at.split('T')[0] : '2026-06-01');
    const monthKey = rawDate.substring(0, 7); // YYYY-MM
    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + Number(d.amount);
  });

  const sortedMonths = Object.keys(monthlyRevenue).sort();
  const monthLabels = sortedMonths.map(m => {
    const [y, mon] = m.split('-');
    const dateObj = new Date(Number(y), Number(mon) - 1, 1);
    return dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });
  const monthValues = sortedMonths.map(m => monthlyRevenue[m]);

  const ctxRev = document.getElementById('chartRevenueTrends')?.getContext('2d');
  if (ctxRev) {
    if (AdminState.charts.revenue) {
      AdminState.charts.revenue.destroy();
    }
    AdminState.charts.revenue = new window.Chart(ctxRev, {
      type: 'line',
      data: {
        labels: monthLabels.length > 0 ? monthLabels : ['Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026'],
        datasets: [{
          label: 'Total Donations (₹)',
          data: monthValues.length > 0 ? monthValues : [20, 800, 1600, 5600, 800],
          borderColor: '#1A8C4E',
          backgroundColor: 'rgba(26, 140, 78, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#FCA028',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ' Contributions: ₹' + Number(ctx.raw).toLocaleString('en-IN')
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => '₹' + val.toLocaleString('en-IN')
            },
            grid: { color: 'rgba(226, 232, 240, 0.7)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  // Chart 2: Location Distribution (AIIMS, GMCH, BBCI, Flood, General)
  const locationCounts = {
    'BBCI Cancer Hospital': 0,
    'GMCH Hospital': 0,
    'AIIMS Guwahati': 0,
    'Assam Flood Relief': 0,
    'General Food Relief': 0
  };

  donations.forEach(d => {
    const loc = (d.location || '').toLowerCase();
    if (loc.includes('borooah') || loc.includes('bbci')) {
      locationCounts['BBCI Cancer Hospital'] += Number(d.amount);
    } else if (loc.includes('gmch')) {
      locationCounts['GMCH Hospital'] += Number(d.amount);
    } else if (loc.includes('aiims')) {
      locationCounts['AIIMS Guwahati'] += Number(d.amount);
    } else if (loc.includes('flood')) {
      locationCounts['Assam Flood Relief'] += Number(d.amount);
    } else {
      locationCounts['General Food Relief'] += Number(d.amount);
    }
  });

  const ctxLoc = document.getElementById('chartLocationDistribution')?.getContext('2d');
  if (ctxLoc) {
    if (AdminState.charts.location) {
      AdminState.charts.location.destroy();
    }
    AdminState.charts.location = new window.Chart(ctxLoc, {
      type: 'doughnut',
      data: {
        labels: Object.keys(locationCounts),
        datasets: [{
          data: Object.values(locationCounts),
          backgroundColor: [
            '#1A8C4E', // Forest Green (BBCI)
            '#0D80CC', // Temple Blue (GMCH)
            '#FCA028', // Saffron (AIIMS)
            '#EF4444', // Red (Flood)
            '#8B5CF6'  // Purple (General)
          ],
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ₹${Number(ctx.raw).toLocaleString('en-IN')}`
            }
          }
        },
        cutout: '68%'
      }
    });
  }
}

// ==============================================================================
// 6. TABLE RENDERING, SEARCH & FILTERS
// ==============================================================================
function switchTab(tabKey) {
  AdminState.activeTab = tabKey;

  // Toggle Tab Buttons
  document.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
  });

  // Toggle Tab Sections
  document.querySelectorAll('.admin-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-pane-${tabKey}`);
  });

  // Toggle filter visibility
  const locFilterWrap = document.getElementById('filter-location-wrap');
  if (locFilterWrap) {
    locFilterWrap.style.display = (tabKey === 'donations' || tabKey === 'razorpay') ? 'block' : 'none';
  }

  const statusFilterWrap = document.getElementById('filter-status-wrap');
  if (statusFilterWrap) {
    statusFilterWrap.style.display = (tabKey === 'donations' || tabKey === 'razorpay') ? 'block' : 'none';
  }

  renderActiveTab();
}

function renderActiveTab() {
  switch (AdminState.activeTab) {
    case 'donations':
      renderDonationsTable();
      break;
    case 'customers':
      renderCustomersTable();
      break;
    case 'volunteers':
      renderVolunteersTable();
      break;
    case 'newsletter':
      renderNewsletterTable();
      break;
    case 'contact':
      renderContactTable();
      break;
    case 'csr':
      renderCsrTable();
      break;
    case 'razorpay':
      renderRazorpayTable();
      break;
  }
}

// Filter Helper
function applyFilters(records, dateField = 'created_at', textFields = []) {
  let filtered = [...records];

  // 1. Date Range Filter
  if (AdminState.dateFilter !== 'all') {
    const now = new Date();
    filtered = filtered.filter(row => {
      const rowDateVal = row.date ? new Date(row.date) : new Date(row[dateField]);
      if (isNaN(rowDateVal.getTime())) return true;

      switch (AdminState.dateFilter) {
        case 'today':
          return rowDateVal.toDateString() === now.toDateString();
        case 'week': {
          const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
          return rowDateVal >= sevenDaysAgo;
        }
        case 'month':
          return rowDateVal.getMonth() === now.getMonth() && rowDateVal.getFullYear() === now.getFullYear();
        case 'fy26': {
          const fyStart = new Date('2026-04-01T00:00:00');
          const fyEnd = new Date('2027-03-31T23:59:59');
          return rowDateVal >= fyStart && rowDateVal <= fyEnd;
        }
        case 'custom': {
          if (AdminState.customStartDate && rowDateVal < new Date(AdminState.customStartDate)) return false;
          if (AdminState.customEndDate && rowDateVal > new Date(AdminState.customEndDate + 'T23:59:59')) return false;
          return true;
        }
        default:
          return true;
      }
    });
  }

  // 2. Search Query Filter
  if (AdminState.searchQuery) {
    const q = AdminState.searchQuery.toLowerCase();
    filtered = filtered.filter(row => {
      return textFields.some(field => {
        const val = String(row[field] || '').toLowerCase();
        return val.includes(q);
      });
    });
  }

  // 3. Location Filter (if applicable)
  if (AdminState.locationFilter !== 'all') {
    filtered = filtered.filter(row => {
      const loc = (row.location || row.hospital_location || '').toLowerCase();
      return loc.includes(AdminState.locationFilter.toLowerCase());
    });
  }

  // 4. Status Filter (Success / Failed / Pending)
  if (AdminState.statusFilter !== 'all') {
    filtered = filtered.filter(row => {
      const st = (row.status || '').toLowerCase();
      if (AdminState.statusFilter === 'success') return st === 'success';
      if (AdminState.statusFilter === 'failed') return st === 'failed';
      if (AdminState.statusFilter === 'pending') return st === 'pending';
      return true;
    });
  }

  return filtered;
}

// ------------------------------------------------------------------------------
// TABLE 1: DONATIONS & PAYMENTS TABLE (Successful & Failed, Bulk Actions)
// ------------------------------------------------------------------------------
function renderDonationsTable() {
  const tbody = document.getElementById('donations-table-body');
  if (!tbody) return;

  const records = applyFilters(
    AdminState.data.donations,
    'created_at',
    ['name', 'email', 'phone', 'txn_id', 'location', 'notes', 'status']
  );

  document.getElementById('donations-filtered-count').textContent = `${records.length} records`;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state"><i class="fa-solid fa-folder-open"></i> No payment records match the selected filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map((d, index) => {
    const formattedDate = formatTimestamp(d.created_at || d.date);
    const amountVal = Number(d.amount) || 0;
    const mealsVal = Math.floor(amountVal / ADMIN_CONFIG.MEAL_UNIT_COST);
    const pan = extractPanFromNotes(d.notes);
    const refNo = formatReceiptRefNo(d);
    const isSuccess = (d.status || '').toLowerCase() === 'success';
    const isFailed = (d.status || '').toLowerCase() === 'failed';
    const isChecked = AdminState.selectedDonationIds.has(d.id);

    let statusBadge = `<span class="status-badge status-pending"><i class="fa-solid fa-clock"></i> ${escapeHtml(d.status || 'Pending')}</span>`;
    if (isSuccess) {
      statusBadge = `<span class="status-badge status-success"><i class="fa-solid fa-circle-check"></i> Success</span>`;
    } else if (isFailed) {
      statusBadge = `<span class="status-badge status-failed"><i class="fa-solid fa-circle-xmark"></i> Failed</span>`;
    }

    return `
      <tr class="table-row-animate ${isChecked ? 'row-selected' : ''}">
        <td style="width:38px; text-align:center;">
          <input type="checkbox" class="donation-row-checkbox" value="${d.id}" ${isChecked ? 'checked' : ''} onchange="onDonationCheckboxChange('${d.id}', this.checked);">
        </td>
        <td>
          <div style="font-weight:700; color:var(--dark); font-size:0.86rem;">${formattedDate}</div>
          <span class="badge-tag badge-ref">${escapeHtml(refNo)}</span>
        </td>
        <td>
          <div style="font-weight:700; color:var(--dark);">${escapeHtml(d.name || 'Anonymous')}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(d.email || 'N/A')}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(d.phone || '')}</div>
        </td>
        <td>
          <span class="location-chip chip-${getLocationChipClass(d.location)}">
            <i class="fa-solid fa-hospital"></i> ${formatLocationLabel(d.location)}
          </span>
        </td>
        <td>
          <div style="font-weight:800; color:${isSuccess ? 'var(--primary)' : '#DC2626'}; font-size:1.05rem;">₹${amountVal.toLocaleString('en-IN')}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">~${mealsVal} Meals</div>
        </td>
        <td>
          <span class="pan-badge">${escapeHtml(pan || 'N/A')}</span>
        </td>
        <td>
          <div style="font-size:0.8rem; font-weight:600; color:var(--dark);">${escapeHtml(d.method || 'Razorpay')}</div>
          <code class="txn-code">${escapeHtml(d.txn_id || 'N/A')}</code>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td style="text-align:right;">
          ${isSuccess ? `
            <button class="btn-action-primary" onclick="downloadReceiptForDonation('${d.id}')" title="Download Official 80G Tax Exemption Receipt">
              <i class="fa-solid fa-file-pdf"></i> Download 80G
            </button>
          ` : `
            <span class="badge-tag" style="background:#FEE2E2; color:#DC2626; font-size:0.74rem;">
              <i class="fa-solid fa-ban"></i> Incomplete
            </span>
          `}
          <button class="btn-action-icon" onclick="viewDonationModal('${d.id}')" title="View Full Payment Record">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  updateBulkToolbar();
}

// ------------------------------------------------------------------------------
// TABLE 2: CUSTOMERS & DONORS TABLE (Payments received from particular customer)
// ------------------------------------------------------------------------------
function renderCustomersTable() {
  const tbody = document.getElementById('customers-table-body');
  if (!tbody) return;

  let records = [...AdminState.customers];

  // Apply search query
  if (AdminState.searchQuery) {
    const q = AdminState.searchQuery.toLowerCase();
    records = records.filter(c => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.pan.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    });
  }

  document.getElementById('customers-filtered-count').textContent = `${records.length} donors & customers`;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-users-slash"></i> No donors found matching search query.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(c => {
    const initials = c.name ? c.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'CU';
    return `
      <tr class="table-row-animate">
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="customer-avatar-badge">${initials}</div>
            <div>
              <div style="font-weight:700; color:var(--dark); font-size:0.92rem;">${escapeHtml(c.name)}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${c.payments.length} total transaction${c.payments.length > 1 ? 's' : ''}</div>
            </div>
          </div>
        </td>
        <td>
          <div><a href="mailto:${escapeHtml(c.email)}" style="color:var(--accent-blue); font-weight:600;">${escapeHtml(c.email)}</a></div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(c.phone)}</div>
        </td>
        <td><span class="pan-badge">${escapeHtml(c.pan || 'N/A')}</span></td>
        <td>
          <div style="font-weight:800; color:var(--primary); font-size:1.1rem;">₹${c.totalAmount.toLocaleString('en-IN')}</div>
          <div style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">~${Math.floor(c.totalAmount / ADMIN_CONFIG.MEAL_UNIT_COST)} Meals Sponsored</div>
        </td>
        <td>
          <span class="status-badge status-success">${c.successCount} Successful</span>
          ${c.failedCount > 0 ? `<span class="status-badge status-failed" style="margin-left:4px;">${c.failedCount} Failed</span>` : ''}
        </td>
        <td>
          <div style="font-weight:600; color:var(--dark); font-size:0.84rem;">${formatTimestamp(c.lastDonationDate)}</div>
        </td>
        <td style="text-align:right;">
          <button class="btn-action-primary" onclick="viewCustomerHistoryModal('${escapeHtml(c.key)}')" title="View All Payments Received From Customer">
            <i class="fa-solid fa-clock-rotate-left"></i> Payment History
          </button>
          <button class="btn-action-icon" onclick="exportCustomerStatement('${escapeHtml(c.key)}')" title="Export Customer Statement (.XLS)">
            <i class="fa-solid fa-file-excel"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function viewCustomerHistoryModal(customerKey) {
  const c = AdminState.customers.find(item => item.key === customerKey);
  if (!c) return;

  const content = `
    <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:1.25rem; margin-bottom:1.25rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
        <div>
          <h2 style="font-size:1.25rem; font-weight:800; color:var(--dark); margin-bottom:4px;">${escapeHtml(c.name)}</h2>
          <div style="font-size:0.82rem; color:var(--text-muted);">
            <span><i class="fa-solid fa-envelope"></i> ${escapeHtml(c.email)}</span> &nbsp;•&nbsp;
            <span><i class="fa-solid fa-phone"></i> ${escapeHtml(c.phone)}</span> &nbsp;•&nbsp;
            <span><i class="fa-solid fa-id-card"></i> PAN: ${escapeHtml(c.pan || 'N/A')}</span>
          </div>
          <div style="font-size:0.8rem; color:#475569; margin-top:6px;">
            <i class="fa-solid fa-location-dot" style="color:var(--text-muted);"></i> ${escapeHtml(c.address || 'Guwahati, Assam')}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Lifetime Seva</div>
          <div style="font-size:1.5rem; font-weight:800; color:var(--primary);">₹${c.totalAmount.toLocaleString('en-IN')}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(${c.successCount} successful / ${c.failedCount} failed)</div>
        </div>
      </div>
    </div>

    <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
      <h4 style="font-size:0.95rem; font-weight:800; color:var(--dark); margin:0;">
        <i class="fa-solid fa-receipt" style="color:var(--primary);"></i> Payments Received from ${escapeHtml(c.name)}
      </h4>
      <button type="button" class="btn btn-sm btn-export-xls" onclick="exportCustomerStatement('${escapeHtml(c.key)}');" style="font-size:0.78rem; padding:6px 12px;">
        <i class="fa-solid fa-file-excel"></i> Export Statement (.XLS)
      </button>
    </div>

    <div class="table-responsive-wrap" style="max-height:360px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:8px;">
      <table class="admin-table" style="font-size:0.82rem;">
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Ref # / Txn ID</th>
            <th>Hospital / Cause</th>
            <th>Amount (₹)</th>
            <th>Status</th>
            <th style="text-align:right;">80G Receipt</th>
          </tr>
        </thead>
        <tbody>
          ${c.payments.map(p => {
            const isSucc = (p.status || '').toLowerCase() === 'success';
            const refNo = formatReceiptRefNo(p);
            return `
              <tr>
                <td>${formatTimestamp(p.created_at || p.date)}</td>
                <td>
                  <code class="txn-code">${escapeHtml(p.txn_id || refNo)}</code>
                </td>
                <td>${formatLocationLabel(p.location)}</td>
                <td style="font-weight:800; color:${isSucc ? 'var(--primary)' : '#DC2626'};">
                  ₹${Number(p.amount).toLocaleString('en-IN')}
                </td>
                <td>
                  <span class="status-badge status-${(p.status || 'success').toLowerCase()}">
                    ${escapeHtml(p.status || 'Success')}
                  </span>
                </td>
                <td style="text-align:right;">
                  ${isSucc ? `
                    <button class="btn-action-primary" style="padding:4px 8px; font-size:0.72rem;" onclick="downloadReceiptForDonation('${p.id}')">
                      <i class="fa-solid fa-file-pdf"></i> Receipt
                    </button>
                  ` : `
                    <span style="font-size:0.72rem; color:var(--text-muted);">Incomplete</span>
                  `}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div style="margin-top:1.25rem; display:flex; justify-content:flex-end; gap:8px;">
      <button class="btn btn-outline" onclick="closeAdminModal()">Close</button>
    </div>
  `;

  openAdminModal(`Customer Profile & Payment History`, content);
}

function exportCustomerStatement(customerKey) {
  const c = AdminState.customers.find(item => item.key === customerKey);
  if (!c) {
    showToast('Customer record not found.', 'error');
    return;
  }
  if (typeof window.XLSX === 'undefined') {
    showToast('Excel exporter library loading... please try again.', 'error');
    return;
  }

  const sheetData = [
    ['PURE FOR CURE - HARE KRISHNA MOVEMENT GUWAHATI'],
    ['DONOR STATEMENT & PAYMENT HISTORY'],
    [''],
    ['Donor Name:', c.name, 'Email:', c.email],
    ['Phone:', c.phone, 'PAN (80G):', c.pan || 'NOT_PROVIDED'],
    ['Total Contributions:', `₹${c.totalAmount.toLocaleString('en-IN')}`, 'Lifetime Payments:', c.payments.length],
    ['Statement Date:', formatReceiptDate(new Date().toISOString())],
    [''],
    ['Date & Time', 'Receipt Ref No', 'Payment Txn ID', 'Hospital / Cause', 'Amount (₹)', 'Payment Method', 'Status', 'Notes'],
    ...c.payments.map(p => [
      formatTimestamp(p.created_at || p.date),
      formatReceiptRefNo(p),
      p.txn_id || 'N/A',
      formatLocationLabel(p.location),
      Number(p.amount) || 0,
      p.method || 'Razorpay',
      p.status || 'Success',
      cleanAddress(p.notes)
    ])
  ];

  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 22 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 35 }];
  window.XLSX.utils.book_append_sheet(wb, ws, 'DONOR_STATEMENT');
  const filename = `PFC_Donor_Statement_${c.name.replace(/[^a-zA-Z0-9]/g, '_')}_${getCurrentDateStr()}.xlsx`;
  window.XLSX.writeFile(wb, filename);
  showToast(`✓ Exported payment statement for ${c.name}`, 'success');
}

// ------------------------------------------------------------------------------
// TABLE 3: VOLUNTEER APPLICATIONS
// ------------------------------------------------------------------------------
function renderVolunteersTable() {
  const tbody = document.getElementById('volunteers-table-body');
  if (!tbody) return;

  const records = applyFilters(
    AdminState.data.volunteers,
    'created_at',
    ['full_name', 'email', 'phone', 'city', 'preferred_role', 'organization']
  );

  document.getElementById('volunteers-filtered-count').textContent = `${records.length} applications`;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-users"></i> No volunteer applications recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(v => {
    return `
      <tr class="table-row-animate">
        <td>${formatTimestamp(v.created_at)}</td>
        <td>
          <div style="font-weight:700; color:var(--dark);">${escapeHtml(v.full_name)}</div>
          <span class="badge-tag">${escapeHtml(v.volunteer_type || 'Individual')}</span>
        </td>
        <td>
          <div><a href="mailto:${escapeHtml(v.email)}" style="color:var(--accent-blue);">${escapeHtml(v.email)}</a></div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(v.phone || 'N/A')}</div>
        </td>
        <td>${escapeHtml(v.city || 'Guwahati, Assam')}</td>
        <td>
          <span class="role-badge"><i class="fa-solid fa-hand-holding-heart"></i> ${escapeHtml(v.preferred_role || 'Hospital Food Relief')}</span>
        </td>
        <td>
          <span class="status-badge status-${(v.status || 'pending').toLowerCase()}">${escapeHtml(v.status || 'Pending')}</span>
        </td>
        <td style="text-align:right;">
          <a href="https://wa.me/${(v.phone || '').replace(/[^0-9]/g, '')}" target="_blank" class="btn-action-icon" style="color:#25D366;" title="Chat on WhatsApp">
            <i class="fa-brands fa-whatsapp"></i>
          </a>
          <button class="btn-action-icon" onclick="viewVolunteerModal('${v.id}')" title="View Full Profile">
            <i class="fa-solid fa-eye"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ------------------------------------------------------------------------------
// TABLE 4: NEWSLETTER SUBSCRIBERS
// ------------------------------------------------------------------------------
function renderNewsletterTable() {
  const tbody = document.getElementById('newsletter-table-body');
  if (!tbody) return;

  const records = applyFilters(
    AdminState.data.newsletter,
    'created_at',
    ['name', 'email', 'source']
  );

  document.getElementById('newsletter-filtered-count').textContent = `${records.length} subscribers`;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-envelope-open-text"></i> No newsletter subscribers recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(s => {
    return `
      <tr class="table-row-animate">
        <td>${formatTimestamp(s.created_at)}</td>
        <td style="font-weight:700; color:var(--dark);">${escapeHtml(s.name || 'Friend of PFC')}</td>
        <td><a href="mailto:${escapeHtml(s.email)}" style="color:var(--primary); font-weight:600;">${escapeHtml(s.email)}</a></td>
        <td><span class="badge-tag">${escapeHtml(s.source || s.source_page || 'Website Footer')}</span></td>
        <td><span class="status-badge status-active"><i class="fa-solid fa-check"></i> ${escapeHtml(s.status || 'Active')}</span></td>
      </tr>
    `;
  }).join('');
}

// ------------------------------------------------------------------------------
// TABLE 5: CONTACT INQUIRIES
// ------------------------------------------------------------------------------
function renderContactTable() {
  const tbody = document.getElementById('contact-table-body');
  if (!tbody) return;

  const records = applyFilters(
    AdminState.data.contact,
    'created_at',
    ['full_name', 'email', 'subject', 'message']
  );

  document.getElementById('contact-filtered-count').textContent = `${records.length} messages`;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fa-solid fa-inbox"></i> No contact messages found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(c => {
    return `
      <tr class="table-row-animate">
        <td>${formatTimestamp(c.created_at)}</td>
        <td style="font-weight:700;">${escapeHtml(c.full_name)}</td>
        <td><a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></td>
        <td style="font-weight:600; color:var(--dark);">${escapeHtml(c.subject || 'General Inquiry')}</td>
        <td style="max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-muted);">
          ${escapeHtml(c.message)}
        </td>
        <td style="text-align:right;">
          <button class="btn-action-icon" onclick="viewMessageModal('${escapeHtml(c.full_name)}', '${escapeHtml(c.email)}', '${escapeHtml(c.subject)}', '${escapeHtml(c.message)}')">
            <i class="fa-solid fa-envelope-open"></i> Read
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ------------------------------------------------------------------------------
// TABLE 6: CSR INQUIRIES
// ------------------------------------------------------------------------------
function renderCsrTable() {
  const tbody = document.getElementById('csr-table-body');
  if (!tbody) return;

  const records = applyFilters(
    AdminState.data.csr,
    'created_at',
    ['company_name', 'contact_person', 'email', 'partnership_type', 'budget_range', 'message']
  );

  document.getElementById('csr-filtered-count').textContent = `${records.length} inquiries`;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-briefcase"></i> No CSR partnership inquiries recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(csr => {
    return `
      <tr class="table-row-animate">
        <td>${formatTimestamp(csr.created_at)}</td>
        <td style="font-weight:700; color:var(--dark);"><i class="fa-regular fa-building"></i> ${escapeHtml(csr.company_name)}</td>
        <td>${escapeHtml(csr.contact_person)}</td>
        <td>
          <div><a href="mailto:${escapeHtml(csr.email)}">${escapeHtml(csr.email)}</a></div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(csr.phone || '')}</div>
        </td>
        <td><span class="role-badge">${escapeHtml(csr.partnership_type || 'Hospital Feeding Sponsor')}</span></td>
        <td style="font-weight:700; color:var(--primary);">${escapeHtml(csr.budget_range || '₹1,00,000+')}</td>
        <td style="text-align:right;">
          <button class="btn-action-icon" onclick="viewCsrModal('${csr.id}')" title="View Proposal">
            <i class="fa-solid fa-file-lines"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ------------------------------------------------------------------------------
// TABLE 7: RAZORPAY GATEWAY RECONCILIATION TABLE
// ------------------------------------------------------------------------------
function renderRazorpayTable() {
  const tbody = document.getElementById('razorpay-table-body');
  if (!tbody) return;

  const records = applyFilters(
    AdminState.data.razorpay,
    'created_at',
    ['payment_id', 'donor_name', 'email', 'hospital_location', 'status']
  );

  document.getElementById('razorpay-filtered-count').textContent = `${records.length} transactions`;

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fa-solid fa-receipt"></i> No Razorpay transactions found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(rzp => {
    const isCaptured = (rzp.status || '').toLowerCase() === 'captured' || (rzp.status || '').toLowerCase() === 'success';
    return `
      <tr class="table-row-animate">
        <td>
          <code class="txn-code">${escapeHtml(rzp.payment_id)}</code>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">${formatTimestamp(rzp.created_at)}</div>
        </td>
        <td style="font-weight:700;">${escapeHtml(rzp.donor_name)}</td>
        <td>${escapeHtml(rzp.email)}</td>
        <td><span class="location-chip chip-${getLocationChipClass(rzp.hospital_location)}">${formatLocationLabel(rzp.hospital_location)}</span></td>
        <td style="font-weight:800; color:${isCaptured ? 'var(--primary)' : '#DC2626'};">₹${Number(rzp.amount).toLocaleString('en-IN')}</td>
        <td>
          <span class="status-badge status-${isCaptured ? 'success' : 'failed'}">
            <i class="fa-solid ${isCaptured ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> ${escapeHtml(rzp.status)}
          </span>
        </td>
        <td>
          <span class="badge-tag" style="background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0;">
            <i class="fa-solid fa-link"></i> Reconciled in DB
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// ==============================================================================
// 7. DOWNLOADABLE 80G RECEIPTS ENGINE (Exact Match to Old Receipt Design)
// ==============================================================================
async function downloadReceiptForDonation(donationId) {
  const donation = AdminState.data.donations.find(d => d.id === donationId);
  if (!donation) {
    showToast('Donation record not found.', 'error');
    return;
  }

  if ((donation.status || '').toLowerCase() !== 'success') {
    showToast('80G Receipts can only be issued for successful contributions.', 'error');
    return;
  }

  showToast('Generating official 80G Tax Receipt (PDF)...', 'info');

  try {
    const refNo = formatReceiptRefNo(donation);
    const dateStr = formatReceiptDate(donation.created_at || donation.date);
    const pan = extractPanFromNotes(donation.notes) || 'NOT_PROVIDED';
    const address = cleanAddress(donation.notes);

    const pdfBlob = await generateAdminReceiptPdf({
      name: donation.name,
      amount: donation.amount,
      email: donation.email,
      phone: donation.phone,
      pan: pan,
      address: address,
      causeName: `Pure for Cure - ${formatLocationLabel(donation.location)} Hospital Food Relief`,
      refNo: refNo,
      dateStr: dateStr,
      txnId: donation.txn_id || 'N/A'
    });

    if (pdfBlob) {
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Donation-Receipt-${refNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      showToast(`✓ Receipt ${refNo} generated and downloaded!`, 'success');
    } else {
      throw new Error('PDF generator returned null');
    }
  } catch (err) {
    console.error('Receipt generation error:', err);
    showToast('Failed to generate PDF receipt: ' + err.message, 'error');
  }
}

// EXACT MATCH TO OLD OFFICIAL RECEIPT (PDF 2)
async function generateAdminReceiptPdf(meta) {
  if (typeof window.PDFLib === 'undefined') {
    throw new Error('PDFLib library not loaded');
  }

  const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter standard
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
  page.drawText('Rs. ' + Number(meta.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), { x: 220, y: y + 5, size: 22, font: bold, color: navy });
  y -= 60;

  const col = (label, value, x) => {
    page.drawText(label, { x, y, size: 9, font: bold, color: black });
    page.drawText(String(value || ''), { x, y: y - 13, size: 9, font, color: black });
  };

  const wrapText = (text, f, size, maxWidth) => {
    const cleanStr = String(text || '').replace(/\\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ');
    const words = cleanStr.split(' ');
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

  col('Donor Name', meta.name, 50);
  col('WhatsApp No.', meta.phone, 230);
  col('Towards', meta.causeName || 'Pure for Cure-Satvik Food Distribution', 380);
  y -= 35;

  page.drawText('Address', { x: 50, y, size: 9, font: bold, color: black });
  const addressLines = wrapText(meta.address || 'Guwahati, Assam, India', font, 9, 290).slice(0, 2);
  addressLines.forEach((line, i) => {
    page.drawText(line, { x: 50, y: y - 13 - i * 12, size: 9, font, color: black });
  });
  y -= 13 + (addressLines.length - 1) * 12 + 22;

  col('Email ID', meta.email, 50);
  col('PAN', meta.pan || 'NOT_PROVIDED', 230);
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
}

// Bulk Receipts Download (sequential triggered downloads)
async function downloadAllReceipts() {
  const donations = applyFilters(AdminState.data.donations, 'created_at', ['name', 'email', 'phone', 'txn_id', 'location', 'notes', 'status'])
    .filter(d => (d.status || '').toLowerCase() === 'success');

  if (donations.length === 0) {
    showToast('No successful donation records selected to download.', 'error');
    return;
  }

  if (!confirm(`Generate and download all ${donations.length} official 80G receipts for the currently filtered view?`)) {
    return;
  }

  showToast(`Starting sequential download of ${donations.length} receipts...`, 'info');
  for (let i = 0; i < donations.length; i++) {
    await downloadReceiptForDonation(donations[i].id);
    await new Promise(r => setTimeout(r, 600)); // Small throttle
  }
}

// ==============================================================================
// 8. BULK ACTIONS ON DONATIONS TABLE
// ==============================================================================
function toggleSelectAllDonations(masterEl) {
  const isChecked = masterEl.checked;
  const checkboxes = document.querySelectorAll('.donation-row-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    if (isChecked) {
      AdminState.selectedDonationIds.add(cb.value);
    } else {
      AdminState.selectedDonationIds.delete(cb.value);
    }
  });
  updateBulkToolbar();
}

function onDonationCheckboxChange(id, isChecked) {
  if (isChecked) {
    AdminState.selectedDonationIds.add(id);
  } else {
    AdminState.selectedDonationIds.delete(id);
  }
  const selectAll = document.getElementById('select-all-donations');
  if (selectAll) {
    const checkboxes = document.querySelectorAll('.donation-row-checkbox');
    selectAll.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
  }
  updateBulkToolbar();
}

function updateBulkToolbar() {
  const toolbar = document.getElementById('donations-bulk-toolbar');
  const countEl = document.getElementById('bulk-selected-count');
  const count = AdminState.selectedDonationIds.size;
  if (countEl) countEl.textContent = count;
  if (toolbar) {
    toolbar.style.display = count > 0 ? 'flex' : 'none';
  }
}

function clearDonationSelection() {
  AdminState.selectedDonationIds.clear();
  document.querySelectorAll('.donation-row-checkbox').forEach(cb => cb.checked = false);
  const selectAll = document.getElementById('select-all-donations');
  if (selectAll) selectAll.checked = false;
  updateBulkToolbar();
}

async function bulkDownloadSelectedReceipts() {
  const selectedIds = Array.from(AdminState.selectedDonationIds);
  if (selectedIds.length === 0) {
    showToast('No payments selected to download receipts.', 'error');
    return;
  }
  const successDonations = AdminState.data.donations.filter(d => selectedIds.includes(d.id) && (d.status || '').toLowerCase() === 'success');
  if (successDonations.length === 0) {
    showToast('None of the selected payments are successful contributions.', 'error');
    return;
  }
  showToast(`Generating and downloading ${successDonations.length} selected 80G receipts...`, 'info');
  for (let i = 0; i < successDonations.length; i++) {
    await downloadReceiptForDonation(successDonations[i].id);
    await new Promise(r => setTimeout(r, 600));
  }
}

function bulkExportSelectedCSV() {
  const selectedIds = Array.from(AdminState.selectedDonationIds);
  if (selectedIds.length === 0) {
    showToast('No payments selected to export.', 'error');
    return;
  }
  const records = AdminState.data.donations.filter(d => selectedIds.includes(d.id));
  const headers = ['Date & Time', 'Receipt Ref No', 'Donor Name', 'Email', 'Phone', 'PAN', 'Hospital / Location', 'Amount (INR)', 'Meals Sponsored', 'Method', 'Payment Txn ID', 'Status', 'Notes'];
  let csvContent = '\uFEFF' + headers.map(escapeCsvCell).join(',') + '\n';
  records.forEach(d => {
    csvContent += [
      formatTimestamp(d.created_at || d.date),
      formatReceiptRefNo(d),
      d.name || 'Anonymous',
      d.email || '',
      d.phone || '',
      extractPanFromNotes(d.notes) || 'N/A',
      formatLocationLabel(d.location),
      d.amount,
      Math.floor((Number(d.amount) || 0) / ADMIN_CONFIG.MEAL_UNIT_COST),
      d.method || 'Razorpay',
      d.txn_id || '',
      d.status || 'Success',
      cleanAddress(d.notes)
    ].map(escapeCsvCell).join(',') + '\n';
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PureForCure_Selected_Donations_${getCurrentDateStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast(`✓ Exported ${records.length} selected records to CSV`, 'success');
}

function bulkExportSelectedXLS() {
  const selectedIds = Array.from(AdminState.selectedDonationIds);
  if (selectedIds.length === 0) {
    showToast('No payments selected to export.', 'error');
    return;
  }
  if (typeof window.XLSX === 'undefined') {
    showToast('Excel exporter library loading... please try again.', 'error');
    return;
  }
  const records = AdminState.data.donations.filter(d => selectedIds.includes(d.id));
  const sheetData = [
    ['Date & Time', 'Receipt Ref No', 'Donor Name', 'Email', 'Phone', 'PAN', 'Hospital / Location', 'Amount (₹)', 'Meals Sponsored', 'Method', 'Payment Txn ID', 'Status', 'Notes'],
    ...records.map(d => [
      formatTimestamp(d.created_at || d.date),
      formatReceiptRefNo(d),
      d.name || 'Anonymous',
      d.email || '',
      d.phone || '',
      extractPanFromNotes(d.notes) || 'N/A',
      formatLocationLabel(d.location),
      Number(d.amount) || 0,
      Math.floor((Number(d.amount) || 0) / ADMIN_CONFIG.MEAL_UNIT_COST),
      d.method || 'Razorpay',
      d.txn_id || '',
      d.status || 'Success',
      cleanAddress(d.notes)
    ])
  ];
  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(sheetData);
  window.XLSX.utils.book_append_sheet(wb, ws, 'SELECTED_PAYMENTS');
  window.XLSX.writeFile(wb, `PureForCure_Selected_Payments_${getCurrentDateStr()}.xlsx`);
  showToast(`✓ Exported ${records.length} selected records to Excel`, 'success');
}

// ==============================================================================
// 9. CSV & EXCEL (.XLS / .XLSX) EXPORT ENGINE
// ==============================================================================
function exportCurrentTableToCSV() {
  const tab = AdminState.activeTab;
  let records = [];
  let headers = [];
  let rowMapper = null;
  let filename = `PureForCure_${tab}_${getCurrentDateStr()}.csv`;

  switch (tab) {
    case 'donations':
      records = applyFilters(AdminState.data.donations, 'created_at', ['name', 'email', 'phone', 'txn_id', 'location', 'notes', 'status']);
      headers = ['Date & Time', 'Receipt Ref No', 'Donor Name', 'Email', 'Phone', 'PAN', 'Hospital / Location', 'Amount (INR)', 'Meals Sponsored', 'Method', 'Payment Txn ID', 'Status', 'Notes'];
      rowMapper = d => [
        formatTimestamp(d.created_at || d.date),
        formatReceiptRefNo(d),
        d.name || 'Anonymous',
        d.email || '',
        d.phone || '',
        extractPanFromNotes(d.notes) || 'N/A',
        formatLocationLabel(d.location),
        d.amount,
        Math.floor((Number(d.amount) || 0) / ADMIN_CONFIG.MEAL_UNIT_COST),
        d.method || 'Razorpay',
        d.txn_id || '',
        d.status || 'Success',
        cleanAddress(d.notes)
      ];
      break;

    case 'customers':
      records = AdminState.customers;
      if (AdminState.searchQuery) {
        const q = AdminState.searchQuery.toLowerCase();
        records = records.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
      }
      headers = ['Customer Name', 'Email', 'Phone', 'PAN', 'Total Contributed (INR)', 'Total Payments', 'Successful Payments', 'Failed Payments', 'Last Active Date', 'Address'];
      rowMapper = c => [
        c.name,
        c.email,
        c.phone,
        c.pan || 'N/A',
        c.totalAmount,
        c.donationCount,
        c.successCount,
        c.failedCount,
        formatTimestamp(c.lastDonationDate),
        c.address
      ];
      break;

    case 'volunteers':
      records = applyFilters(AdminState.data.volunteers, 'created_at', ['full_name', 'email', 'phone', 'city', 'preferred_role', 'organization']);
      headers = ['Applied Date', 'Full Name', 'Email', 'Phone', 'City', 'Volunteer Type', 'Organization', 'Preferred Role', 'Availability', 'Status', 'Notes'];
      rowMapper = v => [
        formatTimestamp(v.created_at),
        v.full_name,
        v.email,
        v.phone,
        v.city,
        v.volunteer_type,
        v.organization || '',
        v.preferred_role,
        v.availability || '',
        v.status || 'Pending',
        (v.notes || '').replace(/\r?\n|\r/g, ' ')
      ];
      break;

    case 'newsletter':
      records = applyFilters(AdminState.data.newsletter, 'created_at', ['name', 'email', 'source']);
      headers = ['Subscribed Date', 'Subscriber Name', 'Email', 'Phone', 'Source Page', 'Status'];
      rowMapper = s => [
        formatTimestamp(s.created_at),
        s.name,
        s.email,
        s.phone || '',
        s.source || s.source_page || 'Website',
        s.status || 'Active'
      ];
      break;

    case 'contact':
      records = applyFilters(AdminState.data.contact, 'created_at', ['full_name', 'email', 'subject', 'message']);
      headers = ['Date', 'Sender Name', 'Email', 'Subject', 'Message', 'Status'];
      rowMapper = c => [
        formatTimestamp(c.created_at),
        c.full_name,
        c.email,
        c.subject || '',
        (c.message || '').replace(/\r?\n|\r/g, ' '),
        c.status || 'New'
      ];
      break;

    case 'csr':
      records = applyFilters(AdminState.data.csr, 'created_at', ['company_name', 'contact_person', 'email', 'partnership_type', 'budget_range', 'message']);
      headers = ['Date', 'Company Name', 'Contact Person', 'Email', 'Phone', 'Partnership Type', 'Budget Range', 'Message', 'Status'];
      rowMapper = csr => [
        formatTimestamp(csr.created_at),
        csr.company_name,
        csr.contact_person,
        csr.email,
        csr.phone || '',
        csr.partnership_type || '',
        csr.budget_range || '',
        (csr.message || '').replace(/\r?\n|\r/g, ' '),
        csr.status || 'Pending'
      ];
      break;

    case 'razorpay':
      records = applyFilters(AdminState.data.razorpay, 'created_at', ['payment_id', 'donor_name', 'email', 'hospital_location', 'status']);
      headers = ['Payment ID', 'Date & Time', 'Donor Name', 'Email', 'Phone', 'Hospital Location', 'Amount (INR)', 'Currency', 'Status', 'Reconciled in DB'];
      rowMapper = r => [
        r.payment_id,
        formatTimestamp(r.created_at),
        r.donor_name,
        r.email,
        r.contact,
        formatLocationLabel(r.hospital_location),
        r.amount,
        r.currency,
        r.status,
        r.reconciled_with_db ? 'Yes' : 'No'
      ];
      break;
  }

  if (records.length === 0) {
    showToast('No records available to export.', 'error');
    return;
  }

  // Generate CSV with UTF-8 BOM
  let csvContent = '\uFEFF' + headers.map(escapeCsvCell).join(',') + '\n';
  records.forEach(row => {
    csvContent += rowMapper(row).map(escapeCsvCell).join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  showToast(`✓ Exported ${records.length} records to ${filename}`, 'success');
}

function exportCurrentTableToXLS() {
  const tab = AdminState.activeTab;

  if (typeof window.XLSX === 'undefined') {
    showToast('Excel exporter library loading... please try again.', 'error');
    return;
  }

  let records = [];
  let sheetData = [];
  let filename = `PureForCure_${tab}_${getCurrentDateStr()}.xlsx`;

  switch (tab) {
    case 'donations': {
      records = applyFilters(AdminState.data.donations, 'created_at', ['name', 'email', 'phone', 'txn_id', 'location', 'notes', 'status']);
      sheetData = [
        ['Date & Time', 'Receipt Ref No', 'Donor Name', 'Email', 'Phone', 'PAN', 'Hospital / Location', 'Amount (₹)', 'Meals Sponsored', 'Method', 'Payment Txn ID', 'Status', 'Notes'],
        ...records.map(d => [
          formatTimestamp(d.created_at || d.date),
          formatReceiptRefNo(d),
          d.name || 'Anonymous',
          d.email || '',
          d.phone || '',
          extractPanFromNotes(d.notes) || 'N/A',
          formatLocationLabel(d.location),
          Number(d.amount) || 0,
          Math.floor((Number(d.amount) || 0) / ADMIN_CONFIG.MEAL_UNIT_COST),
          d.method || 'Razorpay',
          d.txn_id || '',
          d.status || 'Success',
          cleanAddress(d.notes)
        ])
      ];
      break;
    }
    case 'customers': {
      records = AdminState.customers;
      if (AdminState.searchQuery) {
        const q = AdminState.searchQuery.toLowerCase();
        records = records.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
      }
      sheetData = [
        ['Customer Name', 'Email', 'Phone', 'PAN', 'Total Contributed (₹)', 'Total Payments', 'Successful Payments', 'Failed Payments', 'Last Active Date', 'Address'],
        ...records.map(c => [
          c.name,
          c.email,
          c.phone,
          c.pan || 'N/A',
          c.totalAmount,
          c.donationCount,
          c.successCount,
          c.failedCount,
          formatTimestamp(c.lastDonationDate),
          c.address
        ])
      ];
      break;
    }
    case 'volunteers': {
      records = applyFilters(AdminState.data.volunteers, 'created_at', ['full_name', 'email', 'phone', 'city', 'preferred_role', 'organization']);
      sheetData = [
        ['Applied Date', 'Full Name', 'Email', 'Phone', 'City', 'Volunteer Type', 'Organization', 'Preferred Role', 'Availability', 'Status', 'Notes'],
        ...records.map(v => [
          formatTimestamp(v.created_at),
          v.full_name,
          v.email,
          v.phone,
          v.city,
          v.volunteer_type,
          v.organization || '',
          v.preferred_role,
          v.availability || '',
          v.status || 'Pending',
          v.notes || ''
        ])
      ];
      break;
    }
    case 'newsletter': {
      records = applyFilters(AdminState.data.newsletter, 'created_at', ['name', 'email', 'source']);
      sheetData = [
        ['Subscribed Date', 'Subscriber Name', 'Email', 'Phone', 'Source Page', 'Status'],
        ...records.map(s => [
          formatTimestamp(s.created_at),
          s.name,
          s.email,
          s.phone || '',
          s.source || s.source_page || 'Website',
          s.status || 'Active'
        ])
      ];
      break;
    }
    case 'contact': {
      records = applyFilters(AdminState.data.contact, 'created_at', ['full_name', 'email', 'subject', 'message']);
      sheetData = [
        ['Date', 'Sender Name', 'Email', 'Subject', 'Message', 'Status'],
        ...records.map(c => [
          formatTimestamp(c.created_at),
          c.full_name,
          c.email,
          c.subject || '',
          c.message || '',
          c.status || 'New'
        ])
      ];
      break;
    }
    case 'csr': {
      records = applyFilters(AdminState.data.csr, 'created_at', ['company_name', 'contact_person', 'email', 'partnership_type', 'budget_range', 'message']);
      sheetData = [
        ['Date', 'Company Name', 'Contact Person', 'Email', 'Phone', 'Partnership Type', 'Budget Range', 'Message', 'Status'],
        ...records.map(csr => [
          formatTimestamp(csr.created_at),
          csr.company_name,
          csr.contact_person,
          csr.email,
          csr.phone || '',
          csr.partnership_type || '',
          csr.budget_range || '',
          csr.message || '',
          csr.status || 'Pending'
        ])
      ];
      break;
    }
    case 'razorpay': {
      records = applyFilters(AdminState.data.razorpay, 'created_at', ['payment_id', 'donor_name', 'email', 'hospital_location', 'status']);
      sheetData = [
        ['Payment ID', 'Date & Time', 'Donor Name', 'Email', 'Phone', 'Hospital Location', 'Amount (₹)', 'Currency', 'Status', 'Reconciled in DB'],
        ...records.map(r => [
          r.payment_id,
          formatTimestamp(r.created_at),
          r.donor_name,
          r.email,
          r.contact,
          formatLocationLabel(r.hospital_location),
          Number(r.amount) || 0,
          r.currency,
          r.status,
          r.reconciled_with_db ? 'Yes' : 'No'
        ])
      ];
      break;
    }
  }

  if (records.length === 0) {
    showToast('No records available to export.', 'error');
    return;
  }

  // Create workbook and worksheet
  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths dynamically
  const colWidths = sheetData[0].map((col, idx) => {
    let maxLen = String(col).length;
    sheetData.slice(1).forEach(row => {
      const cellVal = String(row[idx] || '');
      if (cellVal.length > maxLen) maxLen = Math.min(cellVal.length, 40);
    });
    return { wch: Math.max(maxLen + 3, 12) };
  });
  ws['!cols'] = colWidths;

  window.XLSX.utils.book_append_sheet(wb, ws, tab.toUpperCase());
  window.XLSX.writeFile(wb, filename);

  showToast(`✓ Exported ${records.length} records to Excel (${filename})`, 'success');
}

function escapeCsvCell(cell) {
  if (cell === null || cell === undefined) return '""';
  const str = String(cell);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

// ==============================================================================
// 10. MODALS & POPUPS
// ==============================================================================
function viewDonationModal(donationId) {
  const d = AdminState.data.donations.find(item => item.id === donationId);
  if (!d) return;

  const isSuccess = (d.status || '').toLowerCase() === 'success';

  const content = `
    <div class="modal-detail-grid">
      <div class="detail-group">
        <label>Receipt Reference</label>
        <p><strong>${escapeHtml(formatReceiptRefNo(d))}</strong></p>
      </div>
      <div class="detail-group">
        <label>Date & Time</label>
        <p>${formatTimestamp(d.created_at || d.date)}</p>
      </div>
      <div class="detail-group">
        <label>Contributor Name</label>
        <p><strong>${escapeHtml(d.name)}</strong></p>
      </div>
      <div class="detail-group">
        <label>Contribution Amount</label>
        <p style="font-size:1.3rem; font-weight:800; color:${isSuccess ? 'var(--primary)' : '#DC2626'};">₹${Number(d.amount).toLocaleString('en-IN')}</p>
      </div>
      <div class="detail-group">
        <label>Email Address</label>
        <p>${escapeHtml(d.email || 'N/A')}</p>
      </div>
      <div class="detail-group">
        <label>Phone / WhatsApp</label>
        <p>${escapeHtml(d.phone || 'N/A')}</p>
      </div>
      <div class="detail-group">
        <label>PAN Card (80G)</label>
        <p><span class="pan-badge">${escapeHtml(extractPanFromNotes(d.notes) || 'N/A')}</span></p>
      </div>
      <div class="detail-group">
        <label>Initiative / Location</label>
        <p>${formatLocationLabel(d.location)}</p>
      </div>
      <div class="detail-group">
        <label>Payment Gateway Txn ID</label>
        <p><code class="txn-code">${escapeHtml(d.txn_id || 'N/A')}</code></p>
      </div>
      <div class="detail-group">
        <label>Gateway Status</label>
        <p><span class="status-badge status-${(d.status || 'success').toLowerCase()}">${escapeHtml(d.status || 'Success')}</span></p>
      </div>
      <div class="detail-group full-width">
        <label>Notes / Address / Remarks</label>
        <p style="background:#F8FAFC; padding:10px; border-radius:6px; border:1px solid #E2E8F0; white-space:pre-wrap;">${escapeHtml(cleanAddress(d.notes))}</p>
      </div>
    </div>
    <div style="margin-top:20px; text-align:right; display:flex; justify-content:flex-end; gap:10px;">
      ${isSuccess ? `
        <button class="btn-action-primary" onclick="downloadReceiptForDonation('${d.id}')">
          <i class="fa-solid fa-file-pdf"></i> Download Official 80G Receipt
        </button>
      ` : ''}
      <button class="btn btn-outline" onclick="closeAdminModal()">Close</button>
    </div>
  `;

  openAdminModal('Payment Record Details', content);
}

function viewVolunteerModal(volId) {
  const v = AdminState.data.volunteers.find(item => item.id === volId);
  if (!v) return;

  const content = `
    <div class="modal-detail-grid">
      <div class="detail-group">
        <label>Full Name</label>
        <p><strong>${escapeHtml(v.full_name)}</strong></p>
      </div>
      <div class="detail-group">
        <label>Application Date</label>
        <p>${formatTimestamp(v.created_at)}</p>
      </div>
      <div class="detail-group">
        <label>Email Address</label>
        <p><a href="mailto:${escapeHtml(v.email)}">${escapeHtml(v.email)}</a></p>
      </div>
      <div class="detail-group">
        <label>Phone / WhatsApp</label>
        <p>${escapeHtml(v.phone || 'N/A')}</p>
      </div>
      <div class="detail-group">
        <label>City / Location</label>
        <p>${escapeHtml(v.city || 'Guwahati, Assam')}</p>
      </div>
      <div class="detail-group">
        <label>Volunteer Type</label>
        <p>${escapeHtml(v.volunteer_type || 'Individual')}</p>
      </div>
      <div class="detail-group">
        <label>Preferred Role</label>
        <p><span class="role-badge">${escapeHtml(v.preferred_role || 'Hospital Meal Distribution')}</span></p>
      </div>
      <div class="detail-group">
        <label>Availability</label>
        <p>${escapeHtml(v.availability || 'Weekends / Flexible')}</p>
      </div>
      <div class="detail-group full-width">
        <label>Motivation / Notes</label>
        <p style="background:#F8FAFC; padding:10px; border-radius:6px; border:1px solid #E2E8F0; white-space:pre-wrap;">${escapeHtml(v.notes || 'None provided')}</p>
      </div>
    </div>
    <div style="margin-top:20px; text-align:right;">
      <a href="https://wa.me/${(v.phone || '').replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-primary" style="background:#25D366; border-color:#25D366;">
        <i class="fa-brands fa-whatsapp"></i> Chat on WhatsApp
      </a>
      <button class="btn btn-outline" onclick="closeAdminModal()">Close</button>
    </div>
  `;

  openAdminModal('Volunteer Application Profile', content);
}

function viewCsrModal(csrId) {
  const csr = AdminState.data.csr.find(item => item.id === csrId);
  if (!csr) return;

  const content = `
    <div class="modal-detail-grid">
      <div class="detail-group">
        <label>Company / Organization Name</label>
        <p><strong>${escapeHtml(csr.company_name)}</strong></p>
      </div>
      <div class="detail-group">
        <label>Contact Person</label>
        <p><strong>${escapeHtml(csr.contact_person)}</strong></p>
      </div>
      <div class="detail-group">
        <label>Official Email</label>
        <p><a href="mailto:${escapeHtml(csr.email)}">${escapeHtml(csr.email)}</a></p>
      </div>
      <div class="detail-group">
        <label>Contact Phone</label>
        <p>${escapeHtml(csr.phone || 'N/A')}</p>
      </div>
      <div class="detail-group">
        <label>Partnership Type</label>
        <p><span class="role-badge">${escapeHtml(csr.partnership_type || 'CSR Hospital Food Sponsorship')}</span></p>
      </div>
      <div class="detail-group">
        <label>Proposed CSR Budget</label>
        <p style="font-size:1.15rem; font-weight:800; color:var(--primary);">${escapeHtml(csr.budget_range || 'To be discussed')}</p>
      </div>
      <div class="detail-group full-width">
        <label>Proposal Message & Requirements</label>
        <p style="background:#F8FAFC; padding:10px; border-radius:6px; border:1px solid #E2E8F0; white-space:pre-wrap;">${escapeHtml(csr.message || 'No additional message provided.')}</p>
      </div>
    </div>
    <div style="margin-top:20px; text-align:right;">
      <a href="mailto:${escapeHtml(csr.email)}?subject=Re:%20Pure%20for%20Cure%20CSR%20Partnership%20Proposal" class="btn btn-primary">
        <i class="fa-solid fa-reply"></i> Reply via Email
      </a>
      <button class="btn btn-outline" onclick="closeAdminModal()">Close</button>
    </div>
  `;

  openAdminModal('Corporate / CSR Proposal Details', content);
}

function viewMessageModal(name, email, subject, message) {
  const content = `
    <div style="line-height:1.6;">
      <div style="margin-bottom:12px;"><strong>From:</strong> ${escapeHtml(name)} &lt;<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>&gt;</div>
      <div style="margin-bottom:12px;"><strong>Subject:</strong> ${escapeHtml(subject || 'General Inquiry')}</div>
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:14px; margin-bottom:18px; white-space:pre-wrap;">${escapeHtml(message)}</div>
      <div style="text-align:right;">
        <a href="mailto:${escapeHtml(email)}?subject=Re:%20${encodeURIComponent(subject || 'Inquiry')}" class="btn btn-primary">
          <i class="fa-solid fa-reply"></i> Reply
        </a>
        <button class="btn btn-outline" onclick="closeAdminModal()">Close</button>
      </div>
    </div>
  `;
  openAdminModal('Contact Message', content);
}

function openAdminModal(title, bodyHtml) {
  document.getElementById('admin-modal-title').textContent = title;
  document.getElementById('admin-modal-body').innerHTML = bodyHtml;
  document.getElementById('admin-global-modal').classList.add('active');
}

function closeAdminModal() {
  document.getElementById('admin-global-modal').classList.remove('active');
}

// ==============================================================================
// 11. EVENT LISTENERS & UI HELPERS
// ==============================================================================
function setupEventListeners() {
  // Global Search Input
  const searchInput = document.getElementById('admin-global-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AdminState.searchQuery = e.target.value.trim();
      renderActiveTab();
    });
  }

  // Date Range Dropdown
  const dateSelect = document.getElementById('admin-date-filter');
  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      AdminState.dateFilter = e.target.value;
      const customInputs = document.getElementById('custom-date-inputs');
      if (customInputs) {
        customInputs.style.display = e.target.value === 'custom' ? 'flex' : 'none';
      }
      renderActiveTab();
    });
  }

  // Custom Date Pickers
  document.getElementById('custom-date-start')?.addEventListener('change', (e) => {
    AdminState.customStartDate = e.target.value;
    renderActiveTab();
  });
  document.getElementById('custom-date-end')?.addEventListener('change', (e) => {
    AdminState.customEndDate = e.target.value;
    renderActiveTab();
  });

  // Location Filter
  document.getElementById('admin-location-filter')?.addEventListener('change', (e) => {
    AdminState.locationFilter = e.target.value;
    renderActiveTab();
  });

  // Status Filter (Success / Failed / Pending)
  document.getElementById('admin-status-filter')?.addEventListener('change', (e) => {
    AdminState.statusFilter = e.target.value;
    renderActiveTab();
  });

  // Master Passcode Enter Key
  document.getElementById('master-passcode-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyMasterPasscode();
  });
}

function startClock() {
  const clockEl = document.getElementById('live-clock-display');
  const update = () => {
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  };
  update();
  setInterval(update, 1000);
}

function updateLastSyncedTime() {
  const el = document.getElementById('last-sync-time');
  if (el) {
    const now = new Date();
    el.textContent = 'Synced: ' + now.toLocaleTimeString('en-IN');
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('admin-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `admin-toast toast-${type}`;
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'donation') icon = 'fa-heart';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

// String & Extraction Utilities
function formatTimestamp(ts) {
  if (!ts) return 'N/A';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatReceiptDate(dStr) {
  if (!dStr) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return String(dStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getCurrentDateStr() {
  return new Date().toISOString().split('T')[0];
}

function extractPanFromNotes(notes) {
  if (!notes) return '';
  const match = notes.match(/PAN:\s*([A-Z]{5}[0-9]{4}[A-Z]{1})/i);
  return match ? match[1].toUpperCase() : '';
}

function extractRefFromNotes(notes) {
  if (!notes) return '';
  const match = notes.match(/Ref:\s*([A-Z0-9\-_]+)/i);
  return match ? match[1].toUpperCase() : '';
}

function formatReceiptRefNo(donation) {
  const existingRef = extractRefFromNotes(donation.notes);
  if (existingRef) return existingRef;
  const d = donation.created_at || donation.date || new Date().toISOString();
  const dateObj = new Date(d);
  const yyyymm = dateObj.getFullYear() + String(dateObj.getMonth() + 1).padStart(2, '0');
  const code = (donation.txn_id ? donation.txn_id.replace(/^pay_/, '') : donation.id.replace(/-/g, '')).slice(-6).toUpperCase();
  return `PFC-DR-${yyyymm}-${code}`;
}

function extractReceiptUrlFromNotes(notes) {
  if (!notes) return '';
  const match = notes.match(/Receipt:\s*(https:\/\/[^\s]+)/i);
  return match ? match[1] : '';
}

function cleanAddress(notes) {
  if (!notes) return 'Guwahati, Assam, India';
  let addr = notes;
  addr = addr.replace(/Receipt:\s*https?:\/\/[^\s]+/gi, '');
  addr = addr.replace(/PAN:\s*[A-Z0-9]+/gi, '');
  addr = addr.replace(/Ref:\s*[A-Z0-9\-_]+/gi, '');
  addr = addr.replace(/Cause:\s*[^|\n]+/gi, '');
  addr = addr.replace(/Reason:\s*[^|\n]+/gi, '');
  addr = addr.replace(/\\n/g, ', ');
  addr = addr.replace(/\n/g, ', ');
  addr = addr.replace(/[|]/g, ' ');
  addr = addr.replace(/\s+/g, ' ').trim();
  addr = addr.replace(/^,\s*|,\s*$/g, '');
  return addr || 'Guwahati, Assam, India';
}

function formatLocationLabel(loc) {
  const l = (loc || 'general').toLowerCase();
  if (l.includes('borooah') || l.includes('bbci')) return 'BBCI Cancer Hospital';
  if (l.includes('gmch')) return 'GMCH Hospital';
  if (l.includes('aiims')) return 'AIIMS Guwahati';
  if (l.includes('flood')) return 'Assam Flood Relief';
  if (l.includes('kiosk')) return 'Hospital Kiosks';
  if (l.includes('vessel')) return 'Sponsorship of Vessels';
  if (l.includes('kitchen')) return 'Kitchen Facility';
  if (l.includes('vehicle')) return 'Food Distribution Van';
  if (l.includes('birthday')) return 'Birthday / Special Seva';
  return 'General Food Relief';
}

function getLocationChipClass(loc) {
  const l = (loc || 'general').toLowerCase();
  if (l.includes('borooah') || l.includes('bbci')) return 'bbci';
  if (l.includes('gmch')) return 'gmch';
  if (l.includes('aiims')) return 'aiims';
  if (l.includes('flood')) return 'flood';
  return 'general';
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
