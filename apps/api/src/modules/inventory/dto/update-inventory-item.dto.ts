import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  name?: string;

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
