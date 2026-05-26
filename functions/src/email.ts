/**
 * Resend email module for support ticket reply notifications.
 *
 * Setup (one-time):
 *   1. Create an account at https://resend.com
 *   2. Verify your sending domain (syncron.polyvoclub.com) in the Resend dashboard
 *   3. Deploy the secret:  firebase functions:secrets:set RESEND_API_KEY
 *   4. For local dev, create functions/.secret.local and add: RESEND_API_KEY=re_xxxxxxxx
 *   5. Update SUPPORT_FROM_EMAIL below to match your verified Resend sender.
 *
 * Error handling:
 *   sendSupportReplyEmail() throws on failure. Callers must catch the error
 *   and log it — email delivery is non-fatal (ticket message is already saved).
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * The verified Resend sender address.
 * MUST match a domain verified in your Resend account dashboard.
 */
export const SUPPORT_FROM_EMAIL = 'Syncron Support <support@syncron.polyvoclub.com>';

/** Characters of the admin reply shown in the email preview */
const MESSAGE_PREVIEW_MAX = 300;

// ─── Public interface ─────────────────────────────────────────────────────────

export interface TicketEmailParams {
  /** Recipient's email address */
  to: string;
  /** Recipient's display name (for personalisation) */
  displayName: string;
  /** Firestore ticket document ID */
  ticketId: string;
  /** Ticket subject line */
  subject: string;
  /** Full body of the admin reply message */
  messageBody: string;
}

/**
 * Sends a support reply notification email via the Resend REST API.
 *
 * Throws on:
 *   - Network / fetch errors
 *   - Non-2xx HTTP responses from Resend (e.g. 422 invalid payload, 429 rate-limit)
 *
 * Callers should catch the error, log it with functions.logger.error(),
 * and continue — email failure must not roll back the ticket message.
 */
export async function sendSupportReplyEmail(
  params: TicketEmailParams,
  resendApiKey: string,
): Promise<void> {
  const { to, displayName, ticketId, subject, messageBody } = params;

  const preview =
    messageBody.length > MESSAGE_PREVIEW_MAX
      ? messageBody.slice(0, MESSAGE_PREVIEW_MAX) + '…'
      : messageBody;

  const ticketUrl = `https://syncron.polyvoclub.com/support/my-tickets/${ticketId}`;
  // Display only first 8 chars of the UUID in the subject line for readability
  const shortId = ticketId.slice(0, 8).toUpperCase();

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SUPPORT_FROM_EMAIL,
      to: [to],
      subject: `Syncron Destek / Support — "${subject}" (#${shortId})`,
      html: buildEmailHtml({ displayName, subject, ticketId, preview, ticketUrl, shortId }),
      text: buildEmailText({ displayName, subject, preview, ticketUrl, ticketId }),
    }),
  });

  if (!response.ok) {
    // Read the error body for better diagnostics in logs
    const errorBody = await response.text().catch(() => '(unreadable)');
    throw new Error(
      `Resend API responded with ${response.status}: ${errorBody}`,
    );
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

interface HtmlParams {
  displayName: string;
  subject: string;
  ticketId: string;
  shortId: string;
  preview: string;
  ticketUrl: string;
}

/**
 * Builds an HTML email body that renders correctly in Gmail, Outlook, and
 * Apple Mail. Uses table-based layout and inline styles only.
 * Content is bilingual (TR / EN) since user language is not stored in tickets.
 */
function buildEmailHtml(p: HtmlParams): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Syncron Support</title>
</head>
<body style="margin:0;padding:0;background-color:#030712;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background-color:#030712;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:580px;">

        <!-- Main card -->
        <tr><td style="background-color:#0a0f1a;border:1px solid rgba(0,196,255,0.22);border-radius:12px;overflow:hidden;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">

            <!-- Header -->
            <tr>
              <td style="padding:24px 28px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <span style="font-size:20px;font-weight:900;color:#00ff88;letter-spacing:0.12em;text-transform:uppercase;">SYNCRON</span><br>
                <span style="font-size:10px;color:#4b5563;letter-spacing:0.22em;text-transform:uppercase;">Support System</span>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px 28px;">

                <p style="margin:0 0 8px;color:#e5e7eb;font-size:15px;">
                  Merhaba / Hello, <strong>${escapeHtml(p.displayName)}</strong>
                </p>
                <p style="margin:0 0 22px;color:#9ca3af;font-size:13px;line-height:1.7;">
                  <strong style="color:#d1d5db;">TR:</strong> Destek talebinize yeni bir yanıt alındı.<br>
                  <strong style="color:#d1d5db;">EN:</strong> Your support ticket has received a new reply.
                </p>

                <!-- Ticket info box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="background-color:rgba(0,196,255,0.05);border:1px solid rgba(0,196,255,0.18);border-radius:8px;margin-bottom:22px;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0 0 3px;color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;">Konu / Subject</p>
                      <p style="margin:0 0 16px;color:#e5e7eb;font-size:14px;font-weight:600;">${escapeHtml(p.subject)}</p>
                      <p style="margin:0 0 3px;color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:0.12em;">Yanıt / Reply</p>
                      <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.65;">${escapeHtml(p.preview).replace(/\n/g, '<br>')}</p>
                    </td>
                  </tr>
                </table>

                <!-- CTA button (table-based for Outlook compatibility) -->
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:7px;background-color:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.38);">
                      <a href="${p.ticketUrl}"
                         style="display:inline-block;padding:11px 26px;color:#00ff88;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.08em;">
                        Yanıtı Gör&nbsp;/&nbsp;View Reply →
                      </a>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 28px;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0 0 8px;color:#374151;font-size:11px;line-height:1.7;">
                  Bu e-postayı Syncron&apos;a destek talebi gönderdiğiniz için aldınız.
                  Yanıtlamak için lütfen bu e-postayı yanıtlamayın; yukarıdaki bağlantıyı kullanın.<br>
                  You received this email because you submitted a support ticket at Syncron.
                  Please do not reply to this email — use the link above to respond.
                </p>
                <p style="margin:0;color:#1f2937;font-size:11px;font-family:monospace;">
                  Ticket: ${escapeHtml(p.ticketId)}
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
        <!-- /Main card -->

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

interface TextParams {
  displayName: string;
  subject: string;
  preview: string;
  ticketUrl: string;
  ticketId: string;
}

/** Plain-text fallback for email clients that don't render HTML. */
function buildEmailText(p: TextParams): string {
  return [
    `Merhaba / Hello, ${p.displayName}`,
    '',
    'TR: Destek talebinize yeni bir yanıt alındı.',
    'EN: Your support ticket has received a new reply.',
    '',
    `Konu / Subject: ${p.subject}`,
    '',
    'Yanıt / Reply:',
    '---',
    p.preview,
    '---',
    '',
    `Yanıtı Gör / View Reply: ${p.ticketUrl}`,
    '',
    '════════════════════════════════════════',
    'TR: Bu e-postayı Syncron destek sistemine talep gönderdiğiniz için aldınız.',
    '    Lütfen bu e-postayı yanıtlamayın; yukarıdaki bağlantıyı kullanın.',
    'EN: You received this email because you submitted a support ticket at Syncron.',
    '    Please do not reply to this email — use the link above to respond.',
    '',
    `Ticket ID: ${p.ticketId}`,
  ].join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Escapes HTML special characters to prevent XSS in user-supplied content
 * embedded in the email body.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
