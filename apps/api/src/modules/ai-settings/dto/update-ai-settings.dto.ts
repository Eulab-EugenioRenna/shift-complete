import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
  resourceStoragePath?: string;

  @IsOptional()
  @IsString()
  resourceTempPath?: string;

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
