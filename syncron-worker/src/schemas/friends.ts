import { z } from 'zod';

export const friendRequestSchema = z.object({
  targetUid: z.string().min(1).max(128).optional(),
  targetTag: z.string().min(2).max(20).regex(/^[a-zA-Z0-9]+$/).optional(),
}).refine(data => data.targetUid || data.targetTag, {
  message: "Either targetUid or targetTag must be provided",
  path: ["targetUid"],
});

export const friendActionSchema = z.object({
  uid: z.string().min(1).max(128),
});

export const tagSearchSchema = z.object({
  tag: z.string().min(2).max(20).regex(/^[a-zA-Z0-9]+$/),
});

