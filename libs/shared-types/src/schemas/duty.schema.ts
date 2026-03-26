import { z } from 'zod';

export const CreateDutySchema = z.object({
  teamId: z.string().cuid().or(z.string().uuid()),
  name: z.string().min(2),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  requiredCompetencies: z.array(z.string()).optional(),
  recommendedEventVolunteers: z.number().int().min(1).max(99).optional(),
});
export type CreateDutyDto = z.infer<typeof CreateDutySchema>;

export const UpdateDutySchema = CreateDutySchema.omit({ teamId: true }).partial();
export type UpdateDutyDto = z.infer<typeof UpdateDutySchema>;
