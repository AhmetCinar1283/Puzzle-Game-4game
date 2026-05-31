import { z } from 'zod';
import { MOVES_LIMIT } from '../types';

export const completeLevelSchema = z.object({
  levelId: z.string({ required_error: 'Missing levelId' }).min(1, 'Missing levelId'),
  moves: z.array(z.string(), { required_error: 'Missing moves' })
    .min(1, 'Missing moves')
    .max(MOVES_LIMIT, `Too many moves (max ${MOVES_LIMIT})`),
  timeSpent: z.number({ required_error: 'Invalid timeSpent' })
    .min(0, 'Invalid timeSpent'),
});
