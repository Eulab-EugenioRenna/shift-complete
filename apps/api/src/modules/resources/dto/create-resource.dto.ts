import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  name!: string;

  @IsString()
  path!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(0)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  teamId?: string;
}
