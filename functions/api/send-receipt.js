// Cloudflare Pages Function: Official 80G Tax Exemption Receipt Dispatch via Resend API
// Handles POST requests to /api/send-receipt on Cloudflare Pages

const DEFAULT_RESEND_API_KEY = typeof atob === 'function' 
  ? atob('cmVfVjJXbVM0SldfRkVmRDdCTHpnWmZONFM0SzRxZ1VrNjFN')
  : '';
const SENDER_EMAIL = 'Pure for Cure <info@pureforcure.org>';
const AUDIT_BCC = ['info@pureforcure.org', 'harekrishnamandir.dm@gmail.com', 'bookallot@gmail.com'];

// 1. In-memory IP Rate Limiting (per edge instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

function isRateLimited(clientIp) {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(clientIp) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(clientIp, timestamps);
  if (rateLimitMap.size > 500) {
    for (const [ip, list] of rateLimitMap.entries()) {
      const active = list.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (active.length === 0) rateLimitMap.delete(ip);
      else rateLimitMap.set(ip, active);
    }
  }
  return false;
}

// 2. HTML Escaper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 3. RFC 5322 Email Validation + Anti-CRLF
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  if (/[\r\n]/.test(email)) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

// 4. CORS Origins
const ALLOWED_ORIGINS = [
  'https://pureforcure.org',
  'https://www.pureforcure.org',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8000',
  'http://localhost:8000'
];

function getCorsOrigin(origin) {
  if (!origin) return 'https://pureforcure.org';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.endsWith('.pages.dev') || origin.endsWith('.vercel.app')) return origin;
  return 'https://pureforcure.org';
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(origin),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
}

// Cloudflare Pages OPTIONS handler
export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  return new Response(null, {
    status: 200,
    headers: corsHeaders(origin)
  });
}

// Cloudflare Pages POST handler
export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';
  const clientIp = (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };

  if (isRateLimited(clientIp)) {
    return new Response(JSON.stringify({ error: 'Too many receipt dispatch requests. Please try again in 1 minute.' }), {
      status: 429,
      headers
    });
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers });
    }

    const { donor = {}, meta = {}, receiptUrl = '', pdfBase64 = '' } = body || {};

    const rawEmail = String(donor.email || '').trim();
    if (!isValidEmail(rawEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid or missing donor email address format' }), { status: 400, headers });
    }

    if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.length > 8 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Receipt attachment exceeds allowable size limit (max 6MB)' }), { status: 413, headers });
    }

    const donorName = escapeHtml(String(donor.name || 'Kind Contributor').trim().slice(0, 100));
    const refNo = escapeHtml(String(meta.refNo || `PFC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-GEN`).trim().slice(0, 50));
    const dateStr = escapeHtml(String(meta.dateStr || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })).trim().slice(0, 50));
    const txnId = escapeHtml(String(meta.txnId || 'N/A').trim().slice(0, 60));
    const amtNumber = Math.max(0, Math.min(Number(donor.amount) || 0, 100000000));
    const formattedAmount = '₹' + amtNumber.toLocaleString('en-IN');
    const causeName = escapeHtml(String(donor.causeName || 'Pure for Cure - Daily Sattvik Meal Distribution').trim().slice(0, 150));
    const pan = escapeHtml(String(donor.pan || 'NOT_PROVIDED').trim().toUpperCase().slice(0, 20));
    const phone = escapeHtml(String(donor.phone || 'N/A').trim().slice(0, 20));
    const paymentMode = escapeHtml(String(donor.paymentMode || 'Online Payment (Razorpay)').trim().slice(0, 50));

    let safeReceiptUrl = '';
    if (receiptUrl && typeof receiptUrl === 'string') {
      try {
        const parsed = new URL(receiptUrl);
        if (parsed.protocol === 'https:' && (parsed.hostname.includes('supabase.co') || parsed.hostname.includes('pureforcure.org'))) {
          safeReceiptUrl = escapeHtml(receiptUrl);
        }
      } catch (uErr) {}
    }

    const emailSubject = `Official 80G Tax Exemption Donation Receipt (${refNo}) - Pure for Cure [${formattedAmount}]`;

    const htmlEmail = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC; color: #334155;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06); border: 1px solid #E2E8F0;">
          <tr>
            <td style="background-color: #166534; padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">PURE FOR CURE</h1>
              <p style="margin: 6px 0 0 0; color: #DCFCE7; font-size: 13px; font-weight: 500;">HARE KRISHNA MOVEMENT, GUWAHATI</p>
              <p style="margin: 4px 0 0 0; color: #BBF7D0; font-size: 11px; font-style: italic;">Under 80G Tax Exemption | Form 10BD Compliant</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #0F172A;">
                Dear ${donorName},
              </p>
              
              <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #166534;">
                Hare Krishna!
              </p>

              <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.65; color: #475569;">
                Thank you for your noble and heartfelt contribution to <strong>Pure For Cure</strong>, a charitable feeding mission dedicated to serving the divine vision and teachings of His Divine Grace Vishwaguru A.C. Bhaktivedanta Swami Prabhupada.
              </p>

              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.65; color: #475569;">
                Your generous support directly empowers our centralized mechanized kitchen to serve warm, nutritious, piping-hot Sattvik meals to patient caregivers and families facing medical hardships outside government hospitals for patients, Old-Age Homes, Orphanages &amp; places in need across Assam.
              </p>

              <!-- Itemized Receipt Summary Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #ECFDF5; border-bottom: 1.5px solid #A7F3D0;">
                    <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #047857;">Official Receipt Summary</span>
                    <div style="font-size: 26px; font-weight: 800; color: #065F46; margin-top: 4px;">${formattedAmount}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-size: 13px;">Receipt Number:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-size: 13px; font-weight: 700; text-align: right;">${refNo}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-size: 13px;">Donation Date:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-size: 13px; font-weight: 600; text-align: right;">${dateStr}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-size: 13px;">Donor Name:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-size: 13px; font-weight: 600; text-align: right;">${donorName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-size: 13px;">Mobile / WhatsApp:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-size: 13px; font-weight: 600; text-align: right;">${phone}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-size: 13px;">Donor PAN:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-size: 13px; font-weight: 600; text-align: right;">${pan}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-size: 13px;">Cause Supported:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-size: 13px; font-weight: 600; text-align: right;">${causeName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-size: 13px;">Payment Transaction ID:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-size: 13px; font-weight: 600; text-align: right;">${txnId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-size: 13px;">80G Exemption Order:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-size: 12px; font-weight: 700; text-align: right;">14/80G/CIT/GHY-II/2011-12/4701-05</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; font-size: 13px;">Trust PAN:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-size: 12px; font-weight: 700; text-align: right;">AAATH8807J</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 13.5px; line-height: 1.6; color: #64748B;">
                <em>Note: Please find your official signed 2-page PDF receipt attached with this email for your tax exemption filing (Form 10BD compliant). Page 1 provides your verified Donor Details Record, and Page 2 provides the Official 80G Tax Exemption Receipt.</em>
              </p>

              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                May Lord Krishna shower you and your family with boundless peace, vibrant health, and spiritual prosperity.
              </p>

              <!-- Sign-off Block -->
              <div style="border-top: 1px solid #E2E8F0; padding-top: 18px; font-size: 13.5px; color: #475569; line-height: 1.6;">
                <strong>With heartfelt gratitude,</strong><br>
                <span style="color: #166534; font-weight: 700;">Team Pure For Cure</span><br>
                Hare Krishna Movement, Guwahati<br>
                NH-31, Amingaon, Guwahati, Assam 781031<br>
                Email: <a href="mailto:info@pureforcure.org" style="color: #1D4ED8; text-decoration: none;">info@pureforcure.org</a> | 
                Phone: <a href="tel:+917099039770" style="color: #1D4ED8; text-decoration: none;">+91 70990 39770</a><br>
                Website: <a href="https://pureforcure.org" target="_blank" rel="noopener noreferrer" style="color: #1D4ED8; text-decoration: none;">www.pureforcure.org</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0F172A; padding: 18px 24px; text-align: center; color: #94A3B8; font-size: 12px; line-height: 1.5;">
              This is an automated system confirmation of your donation to Hare Krishna Movement, Guwahati (Pure For Cure). All contributions are 100% transparent and deployed for daily charitable hunger relief.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendApiKey = (env && env.RESEND_API_KEY) ? env.RESEND_API_KEY : DEFAULT_RESEND_API_KEY;

    const resendPayload = {
      from: SENDER_EMAIL,
      to: [rawEmail],
      bcc: AUDIT_BCC,
      subject: emailSubject,
      html: htmlEmail,
    };

    if (pdfBase64 && typeof pdfBase64 === 'string') {
      const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '');
      const safeFilenameRef = refNo.replace(/[^a-zA-Z0-9_-]/g, '_');
      resendPayload.attachments = [
        {
          filename: `PureForCure_80G_Receipt_${safeFilenameRef}.pdf`,
          content: cleanBase64
        }
      ];
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload)
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errorText);
      return new Response(JSON.stringify({
        error: 'Failed to send email via Resend',
        details: errorText
      }), { status: resendResponse.status, headers });
    }

    const data = await resendResponse.json();
    return new Response(JSON.stringify({
      success: true,
      message: 'Receipt email dispatched successfully via Resend',
      id: data.id,
      recipient: rawEmail,
      refNo: refNo
    }), { status: 200, headers });

  } catch (err) {
    console.error('Server error handling receipt dispatch:', err);
    return new Response(JSON.stringify({
      error: 'Internal server error dispatching receipt',
      details: err.message
    }), { status: 500, headers });
  }
}
