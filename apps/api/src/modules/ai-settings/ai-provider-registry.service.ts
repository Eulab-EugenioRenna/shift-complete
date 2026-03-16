import { Injectable } from '@nestjs/common';
import { AiProvider } from './providers/ai-provider.interface';
import { AnthropicAiProvider } from './providers/anthropic-ai.provider';
import { DisabledAiProvider } from './providers/disabled-ai.provider';
import { OllamaAiProvider } from './providers/ollama-ai.provider';
import { OpenAiAiProvider } from './providers/openai-ai.provider';

@Injectable()
export class AiProviderRegistryService {
  constructor(
    private readonly disabledAiProvider: DisabledAiProvider,
    private readonly ollamaAiProvider: OllamaAiProvider,
    private readonly openAiAiProvider: OpenAiAiProvider,
    private readonly anthropicAiProvider: AnthropicAiProvider
  ) {}

  get(provider: string): AiProvider {
    switch (provider) {
      case 'ollama':
        return this.ollamaAiProvider;
      case 'openai':
        return this.openAiAiProvider;
      case 'anthropic':
        return this.anthropicAiProvider;
      default:
        return this.disabledAiProvider;
    }
  }

  capabilities() {
    return [
      this.disabledAiProvider.capabilities(),
      this.ollamaAiProvider.capabilities(),
      this.openAiAiProvider.capabilities(),
      this.anthropicAiProvider.capabilities()
    ];
  }
}
