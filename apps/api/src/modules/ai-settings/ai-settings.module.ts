import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiJobsService } from './ai-jobs.service';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { AnthropicAiProvider } from './providers/anthropic-ai.provider';
import { DisabledAiProvider } from './providers/disabled-ai.provider';
import { OllamaAiProvider } from './providers/ollama-ai.provider';
import { OpenAiAiProvider } from './providers/openai-ai.provider';

@Module({
  imports: [JobsModule, QueueModule, RealtimeModule, NotificationsModule],
  controllers: [AiSettingsController],
  providers: [
    AiSettingsService,
    AiJobsService,
    AiProviderRegistryService,
    DisabledAiProvider,
    OllamaAiProvider,
    OpenAiAiProvider,
    AnthropicAiProvider
  ]
})
export class AiSettingsModule {}
