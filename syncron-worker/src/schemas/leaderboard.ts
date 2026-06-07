import { z } from 'zod';

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  around_me: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  friends_only: z.preprocess((val) => val === 'true', z.boolean()).default(false),
});
