import { z } from 'zod';

export const CreateTeamJoinRequestSchema = z.object({
  teamId: z.string().cuid().or(z.string().uuid()),
  userId: z.string().cuid().or(z.string().uuid()),
});
export type CreateTeamJoinRequestDto = z.infer<typeof CreateTeamJoinRequestSchema>;

export const ResolveTeamJoinRequestSchema = z.object({
  status: z.enum(['APPROVED', 'DECLINED']),
});
export type ResolveTeamJoinRequestDto = z.infer<typeof ResolveTeamJoinRequestSchema>;
