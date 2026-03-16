import { z } from 'zod';
import { RoleEnum } from './core.schema';

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  teamId: z.string().cuid().or(z.string().uuid()).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    fullName: z.string(),
    role: RoleEnum,
    onboardingCompleted: z.boolean(),
    activeTeamIds: z.array(z.string()),
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email(),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const CompletePasswordResetRequestSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(6),
});
export type CompletePasswordResetRequest = z.infer<typeof CompletePasswordResetRequestSchema>;

export const VerifyEmailRequestSchema = z.object({
  token: z.string().min(20),
});
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const RegisterResponseSchema = z.object({
  message: z.string(),
  onboardingRequired: z.boolean(),
  userId: z.string().optional(),
  requestId: z.string().optional(),
  pendingApproval: z.boolean().optional(),
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
