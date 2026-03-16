import { z } from 'zod';
import { ReplacementStatusEnum } from './core.schema';

export const CreateReplacementSchema = z.object({
  assignmentId: z.string().cuid().or(z.string().uuid()),
  reason: z.string().optional(),
});
export type CreateReplacementDto = z.infer<typeof CreateReplacementSchema>;

export const ResolveReplacementSchema = z.object({
  status: ReplacementStatusEnum,
  replacementAssigneeId: z.string().cuid().or(z.string().uuid()).optional(),
});
export type ResolveReplacementDto = z.infer<typeof ResolveReplacementSchema>;
