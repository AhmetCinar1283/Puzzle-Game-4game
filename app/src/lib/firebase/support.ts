import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import type {
  SupportTicket,
  TicketMessage,
  TicketFilter,
  TicketStatus,
  TicketCategory,
  TicketPriority,
} from './supportTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Robustly converts any Firestore timestamp or number to Unix milliseconds (number).
 */
function toMs(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'seconds' in v && 'nanoseconds' in v) {
    return (v as { seconds: number }).seconds * 1000;
  }
  return Date.now();
}

/**
 * Maps a Firestore document snapshot to a SupportTicket object.
 */
function mapDocToSupportTicket(d: any): SupportTicket {
  const data = d.data();
  return {
    id: d.id,
    uid: data.uid || '',
    email: data.email || '',
    displayName: data.displayName || 'User',
    tag: data.tag || null,
    category: data.category || 'general',
    subject: data.subject || '',
    status: data.status || 'open',
    priority: data.priority || 'normal',
    hasUnreadAdmin: !!data.hasUnreadAdmin,
    hasUnreadUser: !!data.hasUnreadUser,
    createdAt: toMs(data.createdAt),
    updatedAt: toMs(data.updatedAt),
    closedAt: data.closedAt ? toMs(data.closedAt) : null,
    adminNote: data.adminNote || null,
  };
}

/**
 * Maps a Firestore document snapshot to a TicketMessage object.
 */
function mapDocToTicketMessage(d: any): TicketMessage {
  const data = d.data();
  return {
    id: d.id,
    senderType: data.senderType || 'user',
    senderUid: data.senderUid || '',
    senderName: data.senderName || '',
    body: data.body || '',
    createdAt: toMs(data.createdAt),
  };
}

// ─── User Functions ──────────────────────────────────────────────────────────

/**
 * Fetches all support tickets for a specific user.
 */
export async function getUserTickets(uid: string): Promise<SupportTicket[]> {
  try {
    const q = query(
      collection(db, 'supportTickets'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapDocToSupportTicket);
  } catch (error) {
    console.error('[getUserTickets] Error fetching user tickets:', error);
    throw error;
  }
}

/**
 * Subscribes to all support tickets of a user in real-time.
 */
export function subscribeToUserTickets(
  uid: string,
  callback: (tickets: SupportTicket[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'supportTickets'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const tickets = snap.docs.map(mapDocToSupportTicket);
      callback(tickets);
    },
    (error) => {
      console.error('[subscribeToUserTickets] Error in user tickets subscription:', error);
    }
  );
}

/**
 * Fetches all messages inside a support ticket, in chronological order.
 */
export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  try {
    const q = query(
      collection(db, 'supportTickets', ticketId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(mapDocToTicketMessage);
  } catch (error) {
    console.error('[getTicketMessages] Error fetching ticket messages:', error);
    throw error;
  }
}

/**
 * Appends a new message from the user to a ticket.
 */
export async function sendTicketMessage(
  ticketId: string,
  uid: string,
  displayName: string,
  body: string,
): Promise<void> {
  try {
    await addDoc(collection(db, 'supportTickets', ticketId, 'messages'), {
      senderType: 'user',
      senderUid: uid,
      senderName: displayName || 'User',
      body,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[sendTicketMessage] Error sending ticket message:', error);
    throw error;
  }
}

/**
 * Marks a ticket as read by the user (clears the unread reply badge).
 */
export async function markTicketAsRead(ticketId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'supportTickets', ticketId), {
      hasUnreadUser: false,
    });
  } catch (error) {
    console.error('[markTicketAsRead] Error marking ticket as read:', error);
    throw error;
  }
}

/**
 * Subscribes to the messages of a ticket in real-time.
 */
export function subscribeToMessages(
  ticketId: string,
  callback: (msgs: TicketMessage[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'supportTickets', ticketId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map(mapDocToTicketMessage);
      callback(msgs);
    },
    (error) => {
      console.error('[subscribeToMessages] Error in messages subscription:', error);
    }
  );
}

// ─── Admin Functions ─────────────────────────────────────────────────────────

/**
 * Fetches all tickets in the system, ordered by last update first.
 * If status filter is applied, utilizes status index.
 * Category filtering is done client-side to ensure query performance and avoid missing index issues.
 */
export async function getAllTickets(filter?: TicketFilter): Promise<SupportTicket[]> {
  try {
    let q = query(collection(db, 'supportTickets'));

    if (filter && filter.status !== 'all') {
      q = query(q, where('status', '==', filter.status), orderBy('updatedAt', 'desc'));
    } else {
      q = query(q, orderBy('updatedAt', 'desc'));
    }

    const snap = await getDocs(q);
    let tickets = snap.docs.map(mapDocToSupportTicket);

    if (filter && filter.category !== 'all') {
      tickets = tickets.filter((t) => t.category === filter.category);
    }

    return tickets;
  } catch (error) {
    console.error('[getAllTickets] Error fetching all tickets:', error);
    throw error;
  }
}

/**
 * Subscribes to all tickets in real-time, ordered by last update first.
 */
export function subscribeToAllTickets(
  callback: (tickets: SupportTicket[]) => void,
  filter?: TicketFilter,
): Unsubscribe {
  let q = query(collection(db, 'supportTickets'));

  if (filter && filter.status !== 'all') {
    q = query(q, where('status', '==', filter.status), orderBy('updatedAt', 'desc'));
  } else {
    q = query(q, orderBy('updatedAt', 'desc'));
  }

  return onSnapshot(
    q,
    (snap) => {
      let tickets = snap.docs.map(mapDocToSupportTicket);
      if (filter && filter.category !== 'all') {
        tickets = tickets.filter((t) => t.category === filter.category);
      }
      callback(tickets);
    },
    (error) => {
      console.error('[subscribeToAllTickets] Error in all tickets subscription:', error);
    }
  );
}

/**
 * Updates a ticket's current status and updates closedAt timestamp if resolved/closed.
 */
export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  try {
    const updateData: any = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (status === 'resolved' || status === 'closed') {
      updateData.closedAt = serverTimestamp();
    } else {
      updateData.closedAt = null;
    }
    await updateDoc(doc(db, 'supportTickets', ticketId), updateData);
  } catch (error) {
    console.error('[updateTicketStatus] Error updating ticket status:', error);
    throw error;
  }
}

/**
 * Updates a ticket's priority level.
 */
export async function updateTicketPriority(
  ticketId: string,
  priority: TicketPriority,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'supportTickets', ticketId), {
      priority,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[updateTicketPriority] Error updating ticket priority:', error);
    throw error;
  }
}

/**
 * Sets an internal, admin-only note on the ticket.
 */
export async function setAdminNote(ticketId: string, note: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'supportTickets', ticketId), {
      adminNote: note || null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[setAdminNote] Error setting admin note:', error);
    throw error;
  }
}

/**
 * Appends a new reply from an admin to a ticket.
 */
export async function sendAdminReply(
  ticketId: string,
  adminUid: string,
  body: string,
): Promise<void> {
  try {
    await addDoc(collection(db, 'supportTickets', ticketId, 'messages'), {
      senderType: 'admin',
      senderUid: adminUid,
      senderName: 'Admin',
      body,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[sendAdminReply] Error sending admin reply:', error);
    throw error;
  }
}

/**
 * Marks a ticket as read by the admin (clears the unread user message badge).
 */
export async function markTicketAsReadByAdmin(ticketId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'supportTickets', ticketId), {
      hasUnreadAdmin: false,
    });
  } catch (error) {
    console.error('[markTicketAsReadByAdmin] Error marking ticket as read by admin:', error);
    throw error;
  }
}

/**
 * Counts all tickets in the system that have unread user messages for the admin.
 */
export async function getUnreadTicketCount(): Promise<number> {
  try {
    const q = query(collection(db, 'supportTickets'), where('hasUnreadAdmin', '==', true));
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    console.error('[getUnreadTicketCount] Error getting unread count:', error);
    return 0;
  }
}
