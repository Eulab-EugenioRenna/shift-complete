import { z } from 'zod';

export const RoleEnum = z.enum(['administrator', 'service_leader', 'volunteer']);
export const EventTypeEnum = z.enum(['single', 'recurring']);
export const OnboardingStateEnum = z.enum(['REGISTERED', 'PROFILE_COMPLETE', 'FULLY_ONBOARDED']);
export const TokenTypeEnum = z.enum(['PASSWORD_RESET', 'EMAIL_VERIFICATION']);
export const AvailabilityTypeEnum = z.enum(['AVAILABLE', 'UNAVAILABLE']);
export const ReplacementStatusEnum = z.enum(['PENDING', 'APPROVED', 'DECLINED']);
export const AssignmentStatusEnum = z.enum(['open', 'assigned', 'confirmed', 'declined']);
export const NotificationChannelEnum = z.enum(['in_app', 'email', 'websocket']);

export type Role = z.infer<typeof RoleEnum>;
export type EventType = z.infer<typeof EventTypeEnum>;
export type OnboardingState = z.infer<typeof OnboardingStateEnum>;
export type TokenType = z.infer<typeof TokenTypeEnum>;
export type AvailabilityType = z.infer<typeof AvailabilityTypeEnum>;
export type ReplacementStatus = z.infer<typeof ReplacementStatusEnum>;
export type AssignmentStatus = z.infer<typeof AssignmentStatusEnum>;
export type NotificationChannel = z.infer<typeof NotificationChannelEnum>;
