import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_SUBJECT_MIN,
  TICKET_SUBJECT_MAX,
  TICKET_BODY_MIN,
  TICKET_BODY_MAX,
} from '../types';

export const createTicketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES, {
    errorMap: () => ({ message: 'INVALID_CATEGORY' }),
  }),
  subject: z.string({
    required_error: 'INVALID_SUBJECT_LENGTH',
    invalid_type_error: 'INVALID_SUBJECT_LENGTH',
  })
    .min(TICKET_SUBJECT_MIN, 'INVALID_SUBJECT_LENGTH')
    .max(TICKET_SUBJECT_MAX, 'INVALID_SUBJECT_LENGTH'),
  body: z.string({
    required_error: 'INVALID_BODY_LENGTH',
    invalid_type_error: 'INVALID_BODY_LENGTH',
  })
    .min(TICKET_BODY_MIN, 'INVALID_BODY_LENGTH')
    .max(TICKET_BODY_MAX, 'INVALID_BODY_LENGTH'),
});
