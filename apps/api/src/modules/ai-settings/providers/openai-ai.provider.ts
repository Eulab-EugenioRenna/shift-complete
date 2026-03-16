import { Injectable } from '@nestjs/common';
import { AiCompletionRequest, AiCompletionResult, AiProvider } from './ai-provider.interface';

@Injectable()
export class OpenAiAiProvider implements AiProvider {
  readonly name = 'openai';

  capabilities() {
    return { provider: this.name, supportsChat: true, supportsModelListing: true, supportsHealthcheck: true };
  }

  async ping(config: { apiKey?: string }) {
    const startedAt = Date.now();
    if (!config.apiKey) {
      return { ok: false, latencyMs: Date.now() - startedAt };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      });
      return { ok: response.ok, latencyMs: Date.now() - startedAt };
    } catch {
      return { ok: false, latencyMs: Date.now() - startedAt };
    }
  }

  async listModels(config?: { apiKey?: string }) {
    if (!config?.apiKey) {
      return ['gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'];
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      });
      if (!response.ok) {
        return ['gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'];
      }
      const data = (await response.json()) as { data?: Array<{ id?: string }> };
      return (data.data ?? []).map((item) => item.id).filter((item): item is string => Boolean(item)).slice(0, 50);
    } catch {
      return ['gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'];
    }
  }

  async complete(request: AiCompletionRequest, config: { apiKey?: string }): Promise<AiCompletionResult> {
    if (!config.apiKey) {
      return {
        text: 'API key OpenAI mancante',
        provider: this.name,
        model: request.model
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: request.model ?? 'gpt-4o-mini',
        messages: [{ role: 'user', content: request.prompt }]
      })
    });

    if (!response.ok) {
      return {
        text: `OpenAI error ${response.status}`,
        provider: this.name,
        model: request.model
      };
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      provider: this.name,
      model: request.model
    };
  }
}
