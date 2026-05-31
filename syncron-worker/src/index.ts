import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext, Env } from './types';
import { gameRouter } from './routes/game';
import { ticketsRouter } from './routes/tickets';
import { internalLogRouter } from './routes/internalLog';
import { adminApiRouter } from './routes/adminApi';
import { runLogRetention } from './scheduled/logRetention';

const app = new Hono<AppContext>();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// GET is required for admin read endpoints (/admin/users/:uid/logs, etc.)
// /internal/log is server-to-server only but still benefits from CORS config
app.use('*', (c, next) => {
  return cors({
    origin: c.env.ALLOWED_ORIGIN,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Timestamp', 'X-Signature'],
    maxAge: 86400,
  })(c, next);
});

// ─── Route handlers ───────────────────────────────────────────────────────────
app.route('/', gameRouter);
app.route('/', ticketsRouter);
app.route('/', internalLogRouter);  // POST /internal/log
app.route('/', adminApiRouter);     // GET  /admin/users/:uid/logs, etc.

// ─── Error handlers ───────────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled worker error:', err);
  c.header('Access-Control-Allow-Origin', c.env.ALLOWED_ORIGIN);
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return c.json({ success: false, error: 'Internal error' }, 500);
});

app.notFound((c) => c.text('Not Found', 404));

// ─── Exports ──────────────────────────────────────────────────────────────────
export default {
  // HTTP handler
  fetch: app.fetch,

  // Cron Trigger: runs weekly log retention (archive old logs to R2, delete from D1)
  // Schedule: "0 3 * * 0" = every Sunday at 03:00 UTC (configured in wrangler.jsonc)
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runLogRetention(env));
  },
};

