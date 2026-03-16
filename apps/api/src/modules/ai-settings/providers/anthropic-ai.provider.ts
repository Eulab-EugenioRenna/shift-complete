import { Injectable } from '@nestjs/common';
import { AiCompletionRequest, AiCompletionResult, AiProvider } from './ai-provider.interface';

@Injectable()
export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';

  capabilities() {
    return { provider: this.name, supportsChat: true, supportsModelListing: true, supportsHealthcheck: true };
  }

  async ping(config: { apiKey?: string }) {
    const startedAt = Date.now();
    if (!config.apiKey) {
      return { ok: false, latencyMs: Date.now() - startedAt };
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });
      return { ok: response.ok, latencyMs: Date.now() - startedAt };
    } catch {
      return { ok: false, latencyMs: Date.now() - startedAt };
    }
  }

  async listModels() {
    return ['claude-3-5-sonnet', 'claude-3-7-sonnet', 'claude-3-haiku'];
  }

  async complete(request: AiCompletionRequest, config: { apiKey?: string }): Promise<AiCompletionResult> {
    if (!config.apiKey) {
      return {
        text: 'API key Anthropic mancante',
        provider: this.name,
        model: request.model
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model ?? 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        messages: [{ role: 'user', content: request.prompt }]
      })
    });

    if (!response.ok) {
      return {
        text: `Anthropic error ${response.status}`,
        provider: this.name,
        model: request.model
      };
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    return {
      text: data.content?.map((item) => item.text ?? '').join('\n') ?? '',
      provider: this.name,
      model: request.model
    };
  }
}
