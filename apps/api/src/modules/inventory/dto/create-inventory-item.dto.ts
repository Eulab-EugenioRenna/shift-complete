import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateInventoryItemDto {
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  maintenanceDueAt?: string;
}
