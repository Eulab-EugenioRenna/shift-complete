import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  teamId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsDateString()
  maintenanceDueAt?: string;
}
