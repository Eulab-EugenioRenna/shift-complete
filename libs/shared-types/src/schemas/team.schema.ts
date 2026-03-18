import { z } from 'zod';

export const CreateTeamSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  leaderId: z.string().cuid().or(z.string().uuid()).optional(),
});
export type CreateTeamDto = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = CreateTeamSchema.partial();
export type UpdateTeamDto = z.infer<typeof UpdateTeamSchema>;

export const AddTeamMemberSchema = z.object({
  userId: z.string().cuid().or(z.string().uuid()),
});
export type AddTeamMemberDto = z.infer<typeof AddTeamMemberSchema>;

export const AssignMemberDutiesSchema = z.object({
  dutyIds: z.array(z.string().cuid().or(z.string().uuid())),
});
export type AssignMemberDutiesDto = z.infer<typeof AssignMemberDutiesSchema>;
