// Cloudflare Pages Function: Official 80G Tax Exemption Receipt Dispatch via Resend API
// Handles POST requests to /api/send-receipt on Cloudflare Pages

const DEFAULT_RESEND_API_KEY = typeof atob === 'function' 
  ? atob('cmVfRzZ5d3pZb3FfQldwNkZ3a3VRZDNlaExTdHBiY2g4SHVx')
  : '';
const SENDER_EMAIL = 'Pure for Cure <info@pureforcure.org>';
const AUDIT_BCC = ['info@pureforcure.org', 'harekrishnamandir.dm@gmail.com'];

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

    const htmlEmail = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family:'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased; color:#1E293B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; background-color:#FFFFFF; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(15,23,42,0.08); border:1px solid #E2E8F0;">
          <tr>
            <td style="background: linear-gradient(135deg, #115E2E 0%, #166534 50%, #15803D 100%); padding:28px 24px; text-align:center;">
              <div style="color:#FEF3C7; font-size:12px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:6px;">HARE KRISHNA MOVEMENT, GUWAHATI</div>
              <h1 style="color:#FFFFFF; font-size:26px; font-weight:800; margin:0 0 4px 0; letter-spacing:0.5px;">PURE FOR CURE</h1>
              <div style="color:#BBF7D0; font-size:13px; font-weight:500;">Healthcare Humanitarian Food Mission &bull; Section 80G Tax-Exempt Seva</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 20px 24px;">
              <p style="font-size:16px; line-height:1.6; margin:0 0 16px 0; color:#0F172A;">
                Dear <strong>${donorName}</strong>,
              </p>
              <p style="font-size:15px; line-height:1.7; margin:0 0 16px 0; color:#15803D; font-weight:700;">
                Hare Krishna!
              </p>
              <p style="font-size:14px; line-height:1.7; margin:0 0 16px 0; color:#334155;">
                Thank you for your noble and heartfelt contribution to <strong>Pure For Cure</strong>, a charitable feeding mission dedicated to serving the divine vision and teachings of His Divine Grace Vishwaguru A.C. Bhaktivedanta Swami Prabhupada.
              </p>
              <p style="font-size:14px; line-height:1.7; margin:0 0 20px 0; color:#334155;">
                Your generous support directly empowers our centralized mechanized kitchen to serve warm, nutritious, piping-hot Sattvik meals to patient caregivers and families facing medical hardships outside government hospitals for patients, Old-Age Homes, Orphanages &amp; places in need across Assam.
              </p>
              <div style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:18px 20px; margin-bottom:24px;">
                <div style="font-size:13px; font-weight:700; color:#0F172A; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:12px; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
                  Official Donation Details
                </div>
                <table width="100%" cellpadding="4" cellspacing="0" style="font-size:14px; color:#334155;">
                  <tr>
                    <td style="color:#64748B; width:40%;">Receipt Reference:</td>
                    <td style="font-weight:700; color:#0F172A;">${refNo}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748B;">Date of Contribution:</td>
                    <td>${dateStr}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748B;">Donated Amount:</td>
                    <td style="font-weight:800; color:#15803D; font-size:16px;">${formattedAmount}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748B;">Seva / Cause:</td>
                    <td>${causeName}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748B;">Donor PAN:</td>
                    <td style="font-family:monospace; font-weight:600;">${pan}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748B;">Transaction ID:</td>
                    <td style="font-family:monospace; font-size:12px;">${txnId}</td>
                  </tr>
                </table>
              </div>
              <div style="background:#FEF3C7; border-left:4px solid #D97706; padding:12px 16px; border-radius:4px; margin-bottom:24px; font-size:13px; color:#92400E; line-height:1.5;">
                <strong>80G Statutory Exemption Notice:</strong> All monetary donations to Hare Krishna Movement Guwahati are eligible for tax relief under Section 80G of the Income Tax Act, 1961 (Order No. 14/80G/CIT/GHY-II/2011-12/4701-05 &bull; PAN: AAATH8807J). A digitally certified PDF receipt is attached to this email.
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0F172A; padding:20px 24px; text-align:center; color:#94A3B8; font-size:12px; line-height:1.6;">
              <div style="color:#FFFFFF; font-weight:700; margin-bottom:4px;">HARE KRISHNA MOVEMENT, GUWAHATI</div>
              <div>Hare Krishna Mandir Marg, Ghorajan, North Guwahati, Assam 781031</div>
              <div>Phone: +91 7099039770 / +91 9678007302 &bull; Email: info@pureforcure.org</div>
              <div style="margin-top:10px; color:#64748B; font-size:11px;">Serving the vision of His Divine Grace A.C. Bhaktivedanta Swami Prabhupada</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

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
