export interface Env {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_API_KEY: string;
  ALLOWED_ORIGIN: string;
  /** Service account JSON string — set via `wrangler secret put GOOGLE_SERVICE_ACCOUNT` */
  GOOGLE_SERVICE_ACCOUNT: string;
}

export interface CompleteLevelRequest {
  levelId: string;
  moves: string[];
  timeSpent: number;
}

export type StarCount = 1 | 2 | 3;

export interface CompleteLevelResponse {
  success: boolean;
  isFirstCompletion: boolean;
  isNewBestSolution: boolean; // strictly better than previous global best (or first ever)
  isBestSolution: boolean;    // tied the current global best move count
  isGoodSolution: boolean;    // made it into top-3 (but not best/new-best)
  stars: StarCount;
  scoreDelta: number;
}

export const MOVES_LIMIT = 500;

// ─── Support Ticket Types ─────────────────────────────────────────────────────

/**
 * The 7 supported ticket categories.
 * This array is used at runtime in the worker for input validation.
 */
export const TICKET_CATEGORIES = [
  'general',
  'bug',
  'account',
  'level',
  'purchase',
  'suggestion',
  'data_deletion',
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

// Validation constraints — shared with Faz 3 client-side validation
export const TICKET_SUBJECT_MIN = 5;
export const TICKET_SUBJECT_MAX = 100;
export const TICKET_BODY_MIN = 20;
export const TICKET_BODY_MAX = 2000;

export interface CreateTicketRequest {
  category: TicketCategory;
  /** Short descriptive title. Must be between TICKET_SUBJECT_MIN and TICKET_SUBJECT_MAX chars. */
  subject: string;
  /** Initial message body. Must be between TICKET_BODY_MIN and TICKET_BODY_MAX chars. */
  body: string;
}

export interface CreateTicketResponse {
  success: boolean;
  /** Present on success */
  ticketId?: string;
  /** Present on failure */
  error?: string;
}

