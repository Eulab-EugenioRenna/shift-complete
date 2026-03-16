import { z } from 'zod';
import { AvailabilityTypeEnum } from './core.schema';

export const CreateAvailabilitySchema = z.object({
  teamId: z.string().cuid().or(z.string().uuid()).optional(),
  type: AvailabilityTypeEnum,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().optional(),
});
export type CreateAvailabilityDto = z.infer<typeof CreateAvailabilitySchema>;

export const UpdateAvailabilitySchema = CreateAvailabilitySchema.partial();
export type UpdateAvailabilityDto = z.infer<typeof UpdateAvailabilitySchema>;
