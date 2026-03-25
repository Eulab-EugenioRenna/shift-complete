import { IsArray, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateManagedUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  fullName!: string;

  @IsString()
  @IsIn(['administrator', 'service_leader', 'volunteer'])
  role!: string;

  @IsOptional()
  @IsArray()
  teamIds?: string[];

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  emergencyName?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @IsOptional()
  @IsArray()
  preferredShifts?: string[];

  @IsOptional()
  @IsArray()
  preferredTeamIds?: string[];

  @IsOptional()
  @IsArray()
  preferredDutyIds?: string[];

  @IsOptional()
  @IsArray()
  preferredLocationValues?: string[];

  @IsOptional()
  @IsArray()
  competencies?: string[];

  @IsOptional()
  @IsString()
  serviceNotes?: string;
}
