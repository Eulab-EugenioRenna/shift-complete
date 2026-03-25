import { z } from 'zod';
import { EventEditModeSchema } from './event.schema';

export const CreateMeetingGroupSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  leaderId: z.string().cuid().or(z.string().uuid()).optional().nullable(),
  groupId: z.string().cuid().or(z.string().uuid()).optional().nullable(),
});
export type CreateMeetingGroupDto = z.infer<typeof CreateMeetingGroupSchema>;

export const UpdateMeetingGroupSchema = CreateMeetingGroupSchema.partial();
export type UpdateMeetingGroupDto = z.infer<typeof UpdateMeetingGroupSchema>;

export const AddMeetingGroupMemberSchema = z.object({
  userId: z.string().cuid().or(z.string().uuid()),
});
export type AddMeetingGroupMemberDto = z.infer<typeof AddMeetingGroupMemberSchema>;

const MeetingSchemaFields = {
  meetingGroupId: z.string().cuid().or(z.string().uuid()).optional().nullable(),
  teamId: z.string().cuid().or(z.string().uuid()).optional().nullable(),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  locationValue: z.string().optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  recurrenceRule: z.string().optional().nullable(),
  recurrenceTz: z.string().optional().nullable(),
  recurrenceUntil: z.string().datetime().optional().nullable(),
  recurrenceDurationMonths: z.number().int().min(1).max(60).optional().nullable(),
  recurrenceAutoRenew: z.boolean().optional().nullable(),
  recurrenceRenewMonths: z.number().int().min(1).max(60).optional().nullable(),
} satisfies z.ZodRawShape;

const MeetingBaseSchema = z.object(MeetingSchemaFields);

export const CreateMeetingSchema = MeetingBaseSchema.superRefine((value, ctx) => {
  const hasMeetingGroup = Boolean(value.meetingGroupId);
  const hasTeam = Boolean(value.teamId);

  if (!hasMeetingGroup && !hasTeam) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Specifica un team o un gruppo riunione.',
      path: ['meetingGroupId'],
    });
  }

  if (hasMeetingGroup && hasTeam) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Una riunione puo appartenere solo a un team o a un gruppo riunione.',
      path: ['teamId'],
    });
  }
});
export type CreateMeetingDto = z.infer<typeof CreateMeetingSchema>;

export const UpdateMeetingSchema = MeetingBaseSchema.partial().superRefine((value, ctx) => {
  const hasMeetingGroup = Boolean(value.meetingGroupId);
  const hasTeam = Boolean(value.teamId);

  if (hasMeetingGroup && hasTeam) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Una riunione puo appartenere solo a un team o a un gruppo riunione.',
      path: ['teamId'],
    });
  }
});
export type UpdateMeetingDto = z.infer<typeof UpdateMeetingSchema>;

export const ExtendedUpdateMeetingSchema = UpdateMeetingSchema.extend({
  editMode: EventEditModeSchema.optional(),
  occurrenceStart: z.string().datetime().optional(),
});
export type ExtendedUpdateMeetingDto = z.infer<typeof ExtendedUpdateMeetingSchema>;
