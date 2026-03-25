import { z } from 'zod';

export const PreferenceCatalogTypeSchema = z.enum(['shift', 'competency', 'location']);

export const UpsertPreferenceCatalogItemSchema = z.object({
  type: PreferenceCatalogTypeSchema,
  value: z.string().min(2),
  label: z.string().min(2),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpsertPreferenceCatalogItemDto = z.infer<typeof UpsertPreferenceCatalogItemSchema>;

export const SyncHolidayCalendarSchema = z.object({
  years: z.array(z.number().int().min(2020).max(2100)).min(1),
});

export type SyncHolidayCalendarDto = z.infer<typeof SyncHolidayCalendarSchema>;
