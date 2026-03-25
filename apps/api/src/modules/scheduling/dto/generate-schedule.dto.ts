import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class GenerateScheduleDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  occurrenceStart?: string;

  @IsOptional()
  @IsString()
  scope?: 'single' | 'series' | 'range';

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsBoolean()
  includeExistingAssignments?: boolean;

  @IsOptional()
  manualSelections?: Array<{ slotId: string; assigneeId: string }>;

  @IsOptional()
  @IsString()
  applyScope?: 'event' | 'month' | 'cycle' | 'year' | 'all';
}
