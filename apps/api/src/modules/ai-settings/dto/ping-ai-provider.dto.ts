import { IsIn, IsOptional, IsString } from 'class-validator';

export class PingAiProviderDto {
  @IsString()
  @IsIn(['disabled', 'openai', 'anthropic', 'ollama'])
  provider!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  ollamaUrl?: string;
}
