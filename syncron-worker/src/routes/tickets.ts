import { Hono } from 'hono';
import type { AppContext } from '../types';
import { createTicketSchema } from '../schemas/tickets';
import { firebaseAuth } from '../middleware/auth';
import { getAdminAccessToken } from '../services/serviceAccount';
import { fsGet, fsCommit, docPath, nowTimestamp, fromDoc } from '../services/firestore';
import { writeAuditLog } from '../services/auditLog';
import type { CreateTicketResponse } from '../types';

export const ticketsRouter = new Hono<AppContext>();

// Rate limiting map: uid -> timestamp[]
const ticketRateLimits = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_TICKETS = 2;

ticketsRouter.post('/create-ticket', firebaseAuth, async (c) => {
  const uid = c.get('uid');
  console.log(`[CreateTicket] Handling ticket creation request for UID: ${uid}`);

  // 1. Parse JSON safely
  let body;
  try {
    body = await c.req.json();
    console.log('[CreateTicket] Successfully parsed JSON payload');
  } catch (err: any) {
    console.error('[CreateTicket] Failed to parse JSON payload:', err?.message || err);
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  // 2. Validate with Zod
  const validation = createTicketSchema.safeParse(body);
  if (!validation.success) {
    const error = validation.error.errors[0]?.message || 'Invalid request';
    console.warn('[CreateTicket] Zod validation failed:', error, validation.error.format());
    return c.json({ success: false, error }, 400);
  }

  const { category, subject, body: ticketBody } = validation.data;
  console.log(`[CreateTicket] Payload validated. Category: ${category}, Subject: "${subject}"`);

  // 3. Rate limiting check
  const nowMs = Date.now();
  const history = ticketRateLimits.get(uid) ?? [];
  const activeHistory = history.filter((ts) => nowMs - ts < RATE_LIMIT_WINDOW_MS);
  console.log(`[CreateTicket] Rate limit state for ${uid}: ${activeHistory.length}/${RATE_LIMIT_MAX_TICKETS} tickets in window`);

  if (activeHistory.length >= RATE_LIMIT_MAX_TICKETS) {
    console.warn(`[CreateTicket] Rate limit exceeded for UID: ${uid}`);
    return c.json({ success: false, error: 'RATE_LIMIT_EXCEEDED' }, 429);
  }

  activeHistory.push(nowMs);
  ticketRateLimits.set(uid, activeHistory);

  // 4. Get admin access token
  let adminToken: string;
  try {
    adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
    console.log('[CreateTicket] Google OAuth Admin access token retrieved successfully');
  } catch (e) {
    console.error('[CreateTicket] Service account token retrieval failed:', e);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }

  const projectId = c.env.FIREBASE_PROJECT_ID;

  // 5. Fetch user profile from Firestore
  let userDoc;
  try {
    userDoc = await fsGet(projectId, `users/${uid}`, adminToken);
    console.log(`[CreateTicket] User document fetch completed. Found: ${!!userDoc}`);
  } catch (e) {
    console.error(`[CreateTicket] Failed to fetch user doc for ${uid}:`, e);
    return c.json({ success: false, error: 'Failed to fetch user profile' }, 500);
  }

  if (!userDoc) {
    console.warn(`[CreateTicket] User profile doc not found in Firestore for UID: ${uid}`);
    return c.json({ success: false, error: 'User profile not found' }, 404);
  }

  const userData = fromDoc(userDoc);

  // 6. Block anonymous users
  console.log(`[CreateTicket] User provider: ${userData.authProvider}, email: ${userData.email}`);
  if (userData.authProvider === 'anonymous') {
    console.warn(`[CreateTicket] Blocking anonymous ticket creation for UID: ${uid}`);
    return c.json({ success: false, error: 'ANONYMOUS_NOT_ALLOWED' }, 403);
  }

  // 7. Prepare ticket and initial message fields
  const ticketId = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const now = nowTimestamp();

  const ticketFields = {
    uid: { stringValue: uid },
    email: { stringValue: (userData.email as string) || '' },
    displayName: { stringValue: (userData.displayName as string) || 'User' },
    tag: userData.tag ? { stringValue: userData.tag as string } : { nullValue: null },
    category: { stringValue: category },
    subject: { stringValue: subject },
    status: { stringValue: 'open' },
    priority: { stringValue: 'normal' },
    hasUnreadAdmin: { booleanValue: true },
    hasUnreadUser: { booleanValue: false },
    createdAt: { timestampValue: now },
    updatedAt: { timestampValue: now },
    closedAt: { nullValue: null },
    adminNote: { nullValue: null },
  };

  const messageFields = {
    senderType: { stringValue: 'user' },
    senderUid: { stringValue: uid },
    senderName: { stringValue: (userData.displayName as string) || 'User' },
    body: { stringValue: ticketBody },
    createdAt: { timestampValue: now },
  };

  // 8. Batch write: create ticket and initial message atomically
  const writes = [
    {
      update: {
        name: docPath(projectId, `supportTickets/${ticketId}`),
        fields: ticketFields,
      },
    },
    {
      update: {
        name: docPath(projectId, `supportTickets/${ticketId}/messages/${messageId}`),
        fields: messageFields,
      },
    },
  ];

  try {
    console.log(`[CreateTicket] Initiating atomic batch commit for Ticket: ${ticketId}`);
    await fsCommit(projectId, writes, adminToken);
    console.log(`[CreateTicket] Batch commit successful. Ticket created: ${ticketId}`);
  } catch (e) {
    console.error('[CreateTicket] Commit error for support ticket:', e);
    return c.json({ success: false, error: 'Failed to save support ticket' }, 500);
  }

  // 9. Write audit log (non-blocking)
  c.executionCtx.waitUntil(
    writeAuditLog(c.env.AUDIT_DB, uid, 'ticket.create', 'support', {
      ticketId,
      category: validation.data.category,
      subject:  validation.data.subject,
    }).catch((err) => console.error('[AuditLog] ticket.create write failed:', err)),
  );

  // 10. Respond
  const response: CreateTicketResponse = {
    success: true,
    ticketId,
  };

  return c.json(response);
});
