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
  isNewBestSolution: boolean;
  stars: StarCount;      // stars earned THIS submission (1, 2, or 3)
  scoreDelta: number;    // points actually added to totalScore (0 if no improvement)
}

export const MOVES_LIMIT = 500;
