import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiJobsService } from './ai-jobs.service';
import { AiSettingsService } from './ai-settings.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { PingAiProviderDto } from './dto/ping-ai-provider.dto';

@Controller('ai-settings')
export class AiSettingsController {
  constructor(
    private readonly aiSettingsService: AiSettingsService,
    private readonly aiJobsService: AiJobsService
  ) {}

  @Get()
  getSettings() {
    return this.aiSettingsService.getSettings();
  }

  @Patch()
  updateSettings(@Body() body: UpdateAiSettingsDto, @CurrentUser() user: { sub: string }) {
    return this.aiSettingsService.updateSettings(body, user.sub);
  }

  @Post('ping')
  ping(@Body() body: PingAiProviderDto) {
    return this.aiSettingsService.pingProvider(body);
  }

  @Get('models')
  models(@Query('provider') provider: string, @Query('apiKey') apiKey?: string, @Query('ollamaUrl') ollamaUrl?: string) {
    return this.aiSettingsService.getModels(provider, apiKey, ollamaUrl);
  }

  @Get('capabilities')
  capabilities() {
    return this.aiSettingsService.capabilities();
  }

  @Post('jobs')
  createJob(@Body() body: { provider: string; model?: string; prompt: string; apiKey?: string; ollamaUrl?: string }, @CurrentUser() user: { sub: string }) {
    return this.aiJobsService.enqueuePrompt({
      actorId: user.sub,
      provider: body.provider,
      model: body.model,
      prompt: body.prompt,
      apiKey: body.apiKey,
      ollamaUrl: body.ollamaUrl
    });
  }

  @Post('test-smtp')
  testSmtp(@Body() body: { to: string }) {
    return this.aiSettingsService.testSmtp(body);
  }

  @Post('test-webhook')
  testWebhook() {
    return this.aiSettingsService.testWebhook();
  }
}
