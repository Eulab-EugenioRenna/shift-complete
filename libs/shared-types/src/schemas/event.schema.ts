import { z } from 'zod';
import { EventTypeEnum, AssignmentStatusEnum } from './core.schema';

export const CreateEventSlotSchema = z.object({
  teamId: z.string().cuid().or(z.string().uuid()),
  dutyId: z.string().cuid().or(z.string().uuid()),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  required: z.boolean().optional().default(true),
});
export type CreateEventSlotDto = z.infer<typeof CreateEventSlotSchema>;

export const CreateEventSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  type: EventTypeEnum,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  recurrenceRule: z.string().optional(),
  recurrenceTz: z.string().optional(),
  slots: z.array(CreateEventSlotSchema).default([]),
});
export type CreateEventDto = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = CreateEventSchema.partial();
export type UpdateEventDto = z.infer<typeof UpdateEventSchema>;

export const EventEditModeSchema = z.enum(['single', 'series']);

export const ExtendedUpdateEventSchema = UpdateEventSchema.extend({
  editMode: EventEditModeSchema.optional(),
  occurrenceStart: z.string().datetime().optional(),
});

export type ExtendedUpdateEventDto = z.infer<typeof ExtendedUpdateEventSchema>;

export const AssignVolunteerSchema = z.object({
  slotId: z.string().cuid().or(z.string().uuid()),
  assigneeId: z.string().cuid().or(z.string().uuid()).optional().nullable(),
  status: AssignmentStatusEnum.optional(),
  autoAssigned: z.boolean().optional(),
});
export type AssignVolunteerDto = z.infer<typeof AssignVolunteerSchema>;
