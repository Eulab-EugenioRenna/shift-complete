import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class GenerateScheduleDto {
  @IsOptional()
  @IsString()
  teamId?: string;

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
