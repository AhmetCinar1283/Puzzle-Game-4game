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
