import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ResourceTeamQuotaRuleDto {
  @IsString()
  teamId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  storageLimitBytes?: number;
}

export class UpdateAiSettingsDto {
  @IsString()
  @IsIn(['disabled', 'openai', 'anthropic', 'ollama'])
  provider!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  ollamaUrl?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsBoolean()
  agnostic?: boolean;

  @IsOptional()
  @IsString()
  automationMode?: string;

  @IsOptional()
  @IsBoolean()
  remindersEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  quietHours?: boolean;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  smtpPort?: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @IsOptional()
  @IsString()
  smtpFromEmail?: string;

  @IsOptional()
  @IsString()
  smtpFromName?: string;

  @IsOptional()
  @IsString()
  smtpReplyTo?: string;

  @IsOptional()
  @IsString()
  redisUrl?: string;

  @IsOptional()
  @IsString()
  webAppUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['local', 's3'])
  resourceStorageDriver?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalStorageLimitBytes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultTeamStorageLimitBytes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResourceTeamQuotaRuleDto)
  resourceTeamQuotaRules?: ResourceTeamQuotaRuleDto[];

  @IsOptional()
  @IsString()
  resourceS3Endpoint?: string;

  @IsOptional()
  @IsString()
  resourceS3Region?: string;

  @IsOptional()
  @IsString()
  resourceS3Bucket?: string;

  @IsOptional()
  @IsString()
  resourceS3AccessKey?: string;

  @IsOptional()
  @IsString()
  resourceS3SecretKey?: string;

  @IsOptional()
  @IsBoolean()
  resourceS3ForcePathStyle?: boolean;

  @IsOptional()
  @IsBoolean()
  resourceS3UseSsl?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  resourceJobConcurrency?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  notificationJobConcurrency?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  aiJobConcurrency?: number;

  @IsOptional()
  @IsBoolean()
  inAppNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  websocketNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
