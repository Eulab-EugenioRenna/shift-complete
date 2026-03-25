import { z } from 'zod';

export const UpdateUserProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  preferredShifts: z.array(z.string()).optional(),
  preferredTeamIds: z.array(z.string().cuid().or(z.string().uuid())).optional(),
  preferredDutyIds: z.array(z.string().cuid().or(z.string().uuid())).optional(),
  preferredLocationValues: z.array(z.string()).optional(),
  competencies: z.array(z.string()).optional(),
  serviceNotes: z.string().optional(),
});
export type UpdateUserProfileDto = z.infer<typeof UpdateUserProfileSchema>;

export const ManagedUserProfileSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['administrator', 'service_leader', 'volunteer']),
  teamIds: z.array(z.string()).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  preferredShifts: z.array(z.string()).optional(),
  preferredTeamIds: z.array(z.string().cuid().or(z.string().uuid())).optional(),
  preferredDutyIds: z.array(z.string().cuid().or(z.string().uuid())).optional(),
  preferredLocationValues: z.array(z.string()).optional(),
  competencies: z.array(z.string()).optional(),
  serviceNotes: z.string().optional(),
});
export type ManagedUserProfileDto = z.infer<typeof ManagedUserProfileSchema>;

export const UpdateManagedUserProfileSchema = ManagedUserProfileSchema.partial();
export type UpdateManagedUserProfileDto = z.infer<typeof UpdateManagedUserProfileSchema>;

export const ChangeMyPasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});
export type ChangeMyPasswordDto = z.infer<typeof ChangeMyPasswordSchema>;
