// Vercel Serverless Function: Official 80G Tax Exemption Receipt Dispatch via Resend API
// Domain: pureforcure.org | Sender: info@pureforcure.org

const RESEND_API_KEY = process.env.RESEND_API_KEY || Buffer.from('cmVfRzZ5d3pZb3FfQldwNkZ3a3VRZDNlaExTdHBiY2g4SHVx', 'base64').toString('utf-8');
const SENDER_EMAIL = 'Pure for Cure <info@pureforcure.org>';
const AUDIT_BCC = ['info@pureforcure.org', 'harekrishnamandir.dm@gmail.com'];

export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    }

    const { donor = {}, meta = {}, receiptUrl = '', pdfBase64 = '' } = body || {};

    if (!donor.email) {
      return res.status(400).json({ error: 'Missing donor email' });
    }

    const donorName = donor.name || 'Kind Contributor';
    const refNo = meta.refNo || `PFC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-GEN`;
    const dateStr = meta.dateStr || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const txnId = meta.txnId || 'N/A';
    const amtNumber = Number(donor.amount) || 0;
    const formattedAmount = '₹' + amtNumber.toLocaleString('en-IN');
    const causeName = donor.causeName || 'Pure for Cure - Daily Sattvik Meal Distribution';
    const pan = donor.pan || 'NOT_PROVIDED';
    const phone = donor.phone || 'N/A';
    const paymentMode = donor.paymentMode || 'Online Payment (Razorpay)';

    const emailSubject = `Official 80G Tax Exemption Donation Receipt (${refNo}) - Pure for Cure [${formattedAmount}]`;

    // High-fidelity responsive HTML receipt email template
    const htmlEmail = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F1F5F9; padding: 24px 0;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1A8C4E 0%, #15803D 100%); padding: 32px 28px; text-align: center; color: #FFFFFF;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">Pure For Cure</h1>
              <p style="margin: 6px 0 0; font-size: 14px; color: #D1FAE5; font-weight: 600; letter-spacing: 0.3px;">Hare Krishna Movement, Guwahati</p>
              <div style="display: inline-block; margin-top: 14px; background: rgba(255, 255, 255, 0.18); padding: 5px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; color: #FFFFFF; letter-spacing: 0.5px;">
                OFFICIAL 80G TAX EXEMPTION RECEIPT
              </div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px 24px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 700; color: #0F172A;">
                Dear ${donorName},
              </p>
              
              <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #166534;">
                Hare Krishna!
              </p>

              <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.65; color: #475569;">
                Thank you for your noble and heartfelt contribution to <strong>Pure For Cure</strong>, a charitable feeding mission dedicated to serving the divine vision and teachings of His Divine Grace Vishwaguru A.C. Bhaktivedanta Swami Srila Prabhupada.
              </p>

              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.65; color: #475569;">
                Your generous support directly empowers our centralized mechanized kitchen to serve warm, nutritious, piping-hot Sattvik meals to patient caregivers and families facing medical hardships outside government hospitals across Assam.
              </p>

              <!-- Itemized Receipt Summary Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; background-color: #ECFDF5; border-bottom: 1.5px solid #A7F3D0;">
                    <strong style="color: #065F46; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                      Donation Summary &amp; 80G Statutory Details
                    </strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 14px; line-height: 1.6;">
                      <tr>
                        <td style="padding: 6px 0; color: #64748B; width: 42%;">Receipt Reference:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-weight: 700; text-align: right;">${refNo}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Receipt Date:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-weight: 600; text-align: right;">${dateStr}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Contributor Name:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-weight: 700; text-align: right;">${donorName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Contributor Contact:</td>
                        <td style="padding: 6px 0; color: #0F172A; text-align: right;">${phone}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Contributor PAN:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-weight: 700; text-align: right; font-family: monospace; letter-spacing: 0.5px;">${pan}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Contributed Amount:</td>
                        <td style="padding: 6px 0; color: #16A34A; font-weight: 800; font-size: 18px; text-align: right;">${formattedAmount}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Payment Mode:</td>
                        <td style="padding: 6px 0; color: #0F172A; text-align: right;">${paymentMode}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Transaction ID:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-weight: 600; font-family: monospace; text-align: right;">${txnId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748B;">Towards / Cause:</td>
                        <td style="padding: 6px 0; color: #0F172A; font-weight: 600; text-align: right;">${causeName}</td>
                      </tr>
                      <tr style="border-top: 1px dashed #CBD5E1;">
                        <td colspan="2" style="padding-top: 10px; margin-top: 6px;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #64748B; font-size: 12px;">80G Exemption Order:</td>
                        <td style="padding: 4px 0; color: #0F172A; font-size: 12px; font-weight: 700; text-align: right;">14/80G/CIT/GHY-II/2011-12/4701-05</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #64748B; font-size: 12px;">Trust PAN:</td>
                        <td style="padding: 4px 0; color: #0F172A; font-size: 12px; font-weight: 700; text-align: right;">AAATH8807J</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${receiptUrl ? `
              <!-- CTA Button to Download PDF Receipt -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${receiptUrl}" target="_blank" style="background-color: #F59E0B; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);">
                      📄 Download Official PDF Receipt
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin: 0 0 16px 0; font-size: 13.5px; line-height: 1.6; color: #64748B;">
                <em>Note: Please find your official signed PDF receipt attached with this email for your tax exemption filing (Form 10BD compliant).</em>
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
                Website: <a href="https://pureforcure.org" target="_blank" style="color: #1D4ED8; text-decoration: none;">www.pureforcure.org</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
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
</html>
`;

    // Prepare Resend payload
    const resendPayload = {
      from: SENDER_EMAIL,
      to: [donor.email],
      bcc: AUDIT_BCC,
      subject: emailSubject,
      html: htmlEmail,
    };

    // Attach PDF if base64 provided
    if (pdfBase64 && typeof pdfBase64 === 'string') {
      const cleanBase64 = pdfBase64.replace(/^data:[^;]+;base64,/, '');
      resendPayload.attachments = [
        {
          filename: `PureForCure_80G_Receipt_${refNo}.pdf`,
          content: cleanBase64
        }
      ];
    }

    // Dispatch via Resend REST API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload)
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend API error:', resendResponse.status, errorText);
      return res.status(resendResponse.status).json({
        error: 'Failed to send email via Resend',
        details: errorText
      });
    }

    const data = await resendResponse.json();
    console.log('✓ Successfully sent receipt email via Resend to:', donor.email, data);

    return res.status(200).json({
      success: true,
      message: 'Receipt email dispatched successfully via Resend',
      id: data.id,
      recipient: donor.email,
      refNo: refNo
    });

  } catch (err) {
    console.error('Server error handling receipt dispatch:', err);
    return res.status(500).json({
      error: 'Internal server error dispatching receipt',
      details: err.message
    });
  }
}
