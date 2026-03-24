import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class GenerateScheduleDto {
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
  @IsBoolean()
  apply?: boolean;
}
