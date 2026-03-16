import { Controller, Get } from '@nestjs/common';

@Controller('ai-settings')
export class AiSettingsController {
  @Get()
  getSettings() {
    return {
      provider: process.env.AI_PROVIDER ?? 'disabled',
      model: process.env.AI_MODEL ?? null,
      agnostic: true
    };
  }
}
