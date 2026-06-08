/**
 * Minimal Firestore REST API client.
 * All writes use the Admin access token (bypasses Firestore security rules).
 */

import type {
  LevelData,
  LevelEdges,
  LevelObjectDef,
  LevelTargetDef,
  BoxDef,
  Position,
  CellType,
} from '../../../app/src/games/types';

// ─── Firestore value types ────────────────────────────────────────────────────

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

type FsFields = Record<string, FsValue>;

export interface FsDocument {
  name: string;
  fields: FsFields;
}

// ─── Deserialize ─────────────────────────────────────────────────────────────

function fromValue(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fromValue);
  if ('mapValue' in v) {
    const obj: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) {
      obj[k] = fromValue(val);
    }
    return obj;
  }
  return null;
}

export function fromDoc(doc: FsDocument): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields)) out[k] = fromValue(v);
  return out;
}

// ─── Serialize ───────────────────────────────────────────────────────────────

function toValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return { integerValue: String(Math.trunc(v)) };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') {
    const fields: FsFields = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      fields[k] = toValue(val);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function toFields(obj: Record<string, unknown>): FsFields {
  const fields: FsFields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toValue(v);
  return fields;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function base(projectId: string): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function authHeader(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
}

/** GET a document. Returns null if 404. */
export async function fsGet(
  projectId: string,
  path: string,
  accessToken: string,
): Promise<FsDocument | null> {
  const res = await fetch(`${base(projectId)}/${path}`, {
    headers: authHeader(accessToken),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<FsDocument>;
}

/** PATCH (upsert) a document — replaces all fields. */
export async function fsSet(
  projectId: string,
  path: string,
  data: Record<string, unknown>,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${base(projectId)}/${path}`, {
    method: 'PATCH',
    headers: authHeader(accessToken),
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore PATCH failed: ${res.status} ${await res.text()}`);
}

/**
 * Commit a batch of writes atomically.
 * Supports regular `update` writes and `transform` writes (e.g., field increments).
 */
export async function fsCommit(
  projectId: string,
  writes: unknown[],
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${base(projectId)}:commit`, {
    method: 'POST',
    headers: authHeader(accessToken),
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) throw new Error(`Firestore commit failed: ${res.status} ${await res.text()}`);
}

/** PATCH (update) specific fields of a document. */
export async function fsPatch(
  projectId: string,
  path: string,
  data: Record<string, unknown>,
  updateFields: string[],
  accessToken: string,
): Promise<void> {
  const queryParams = updateFields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${base(projectId)}/${path}?${queryParams}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: authHeader(accessToken),
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore PATCH failed: ${res.status} ${await res.text()}`);
}

/** DELETE a document. */
export async function fsDelete(
  projectId: string,
  path: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(`${base(projectId)}/${path}`, {
    method: 'DELETE',
    headers: authHeader(accessToken),
  });
  if (res.status !== 200 && res.status !== 204 && res.status !== 404) {
    throw new Error(`Firestore DELETE failed: ${res.status} ${await res.text()}`);
  }
}

/** Build the full document resource name. */
export function docPath(projectId: string, path: string): string {
  return `projects/${projectId}/databases/(default)/documents/${path}`;
}

// ─── Level data parser ────────────────────────────────────────────────────────

/** Convert a Firestore levels/{id} document to LevelData for game engine replay. */
export function parseLevelDoc(doc: FsDocument, firestoreId: string): LevelData {
  const d = fromDoc(doc) as Record<string, unknown>;
  return {
    id: 0, // Dexie ID not needed for verification
    firestoreId,
    name: d.name as string,
    width: d.width as number,
    height: d.height as number,
    edges: d.edges as LevelEdges,
    grid: (typeof d.grid === 'string' ? JSON.parse(d.grid) : d.grid) as CellType[][],
    initialObjects: d.initialObjects as LevelObjectDef[],
    targets: d.targets as LevelTargetDef[],
    trailCollision: d.trailCollision as boolean | undefined,
    initialBoxes: d.initialBoxes as BoxDef[] | undefined,
    conveyorPowerRequired: d.conveyorPowerRequired as Position[] | undefined,
  };
}

/** Timestamp string for Firestore timestampValue fields. */
export function nowTimestamp(): string {
  return new Date().toISOString();
}
