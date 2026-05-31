/**
 * Client-side type definitions for the support ticket system.
 *
 * Convention: all Firestore Timestamps are converted to Unix milliseconds
 * (number) by the fetch functions in support.ts — the same pattern used by
 * LevelRequest in firestore.ts.
 */

// ─── Enums / Unions ───────────────────────────────────────────────────────────

/**
 * The 7 supported ticket categories.
 * Keep in sync with TICKET_CATEGORIES in syncron-worker/src/types.ts.
 */
export type TicketCategory =
  | 'general'
  | 'bug'
  | 'account'
  | 'level'
  | 'purchase'
  | 'suggestion'
  | 'data_deletion';

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_user'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

// ─── Document shapes ──────────────────────────────────────────────────────────

/**
 * Mirrors the `supportTickets/{ticketId}` Firestore document.
 * Subcollection messages are fetched separately via getTicketMessages().
 */
export interface SupportTicket {
  id: string;
  /** UID of the user who opened the ticket. */
  uid: string;
  email: string;
  displayName: string;
  tag: string | null;
  category: TicketCategory;
  /** Short descriptive subject line (5–100 chars). */
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  /** True while the admin has not read the latest user message. */
  hasUnreadAdmin: boolean;
  /** True while the user has not read the latest admin reply. */
  hasUnreadUser: boolean;
  /** Unix ms. */
  createdAt: number;
  /** Unix ms — updated whenever a message is sent or status changes. */
  updatedAt: number;
  /** Unix ms, or null if not yet closed. */
  closedAt: number | null;
  /**
   * Admin-only internal note. Never exposed to the ticket owner.
   * Will be null/absent when read by non-admin clients (Firestore rules
   * do NOT restrict field-level reads — we simply never display it in user UI).
   */
  adminNote: string | null;
}

/**
 * One message inside the `supportTickets/{ticketId}/messages/{messageId}`
 * subcollection.
 */
export interface TicketMessage {
  id: string;
  senderType: 'user' | 'admin';
  senderUid: string;
  senderName: string;
  /** Message body (20–2000 chars). */
  body: string;
  /** Unix ms. */
  createdAt: number;
}

// ─── Request / filter shapes ──────────────────────────────────────────────────

/**
 * Payload sent to the Worker's POST /create-ticket endpoint.
 * The worker derives uid / email / displayName / tag from the ID token.
 */
export interface CreateTicketPayload {
  category: TicketCategory;
  subject: string;
  body: string;
}

/**
 * Filters used in the admin ticket list page.
 * 'all' means no filter is applied for that dimension.
 */
export interface TicketFilter {
  status: TicketStatus | 'all';
  category: TicketCategory | 'all';
}

// ─── Validation constraints (client mirror of worker constants) ───────────────

export const TICKET_SUBJECT_MIN = 5;
export const TICKET_SUBJECT_MAX = 100;
export const TICKET_BODY_MIN = 20;
export const TICKET_BODY_MAX = 2000;
export const TICKET_REPLY_MIN = 5;
export const TICKET_REPLY_MAX = 2000;

// ─── Display helpers (labels, colours) ───────────────────────────────────────

export const CATEGORY_LABELS: Record<TicketCategory, { en: string; tr: string }> = {
  general:       { en: 'General Question',        tr: 'Genel Soru' },
  bug:           { en: 'Bug / Error Report',      tr: 'Bug / Hata Raporu' },
  account:       { en: 'Account Issue',           tr: 'Hesap Sorunu' },
  level:         { en: 'Level Issue',             tr: 'Level Sorunu' },
  purchase:      { en: 'Purchase / Subscription', tr: 'Satın Alma / Abonelik' },
  suggestion:    { en: 'Suggestion / Feedback',   tr: 'Öneri / Geri Bildirim' },
  data_deletion: { en: 'Data Deletion (KVKK)',    tr: 'Veri Silme Talebi (KVKK)' },
};

export const STATUS_LABELS: Record<TicketStatus, { en: string; tr: string }> = {
  open:          { en: 'Open',              tr: 'Açık' },
  in_progress:   { en: 'In Progress',      tr: 'İşlemde' },
  waiting_user:  { en: 'Waiting for You',  tr: 'Yanıtınız Bekleniyor' },
  resolved:      { en: 'Resolved',         tr: 'Çözüldü' },
  closed:        { en: 'Closed',           tr: 'Kapatıldı' },
};

/** Neon accent colours for each status — consistent with the app theme. */
export const STATUS_COLORS: Record<TicketStatus, string> = {
  open:         '#00ff88', // green
  in_progress:  '#00c4ff', // cyan
  waiting_user: '#ffd700', // gold
  resolved:     '#6b7280', // grey
  closed:       '#ec4899', // pink
};

export const PRIORITY_LABELS: Record<TicketPriority, { en: string; tr: string }> = {
  low:    { en: 'Low',    tr: 'Düşük' },
  normal: { en: 'Normal', tr: 'Normal' },
  high:   { en: 'High',   tr: 'Yüksek' },
  urgent: { en: 'Urgent', tr: 'Acil' },
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low:    '#6b7280',
  normal: '#00c4ff',
  high:   '#ffd700',
  urgent: '#ec4899',
};
