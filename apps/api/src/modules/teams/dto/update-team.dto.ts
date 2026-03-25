import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  leaderId?: string;

  @IsOptional()
  @IsArray()
  requiredCompetencies?: string[];
}
