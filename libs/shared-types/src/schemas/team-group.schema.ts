import { z } from 'zod';

export const CreateTeamGroupSchema = z.object({
  name: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  meetingGroupIds: z.array(z.string().cuid().or(z.string().uuid())).optional(),
});
export type CreateTeamGroupDto = z.infer<typeof CreateTeamGroupSchema>;

export const UpdateTeamGroupSchema = CreateTeamGroupSchema.partial();
export type UpdateTeamGroupDto = z.infer<typeof UpdateTeamGroupSchema>;

export const AssignTeamsToGroupSchema = z.object({
  teamIds: z.array(z.string().cuid().or(z.string().uuid())),
});
export type AssignTeamsToGroupDto = z.infer<typeof AssignTeamsToGroupSchema>;

export const AssignMeetingGroupsToGroupSchema = z.object({
  meetingGroupIds: z.array(z.string().cuid().or(z.string().uuid())),
});
export type AssignMeetingGroupsToGroupDto = z.infer<typeof AssignMeetingGroupsToGroupSchema>;
