import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { EventType } from '@prisma/client';

class CreateEventSlotDto {
  @IsString()
  teamId!: string;

  @IsString()
  dutyId!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  requiredVolunteers?: number;
}

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(EventType)
  type!: EventType;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsString()
  recurrenceTz?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEventSlotDto)
  slots!: CreateEventSlotDto[];
}
