import { Injectable } from '@nestjs/common';
import { AiCompletionRequest, AiCompletionResult, AiProvider } from './ai-provider.interface';
import { normalizeOllamaUrl } from './ollama-url.util';

@Injectable()
export class OllamaAiProvider implements AiProvider {
  readonly name = 'ollama';

  capabilities() {
    return { provider: this.name, supportsChat: true, supportsModelListing: true, supportsHealthcheck: true };
  }

  async ping(config: { ollamaUrl?: string }) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${normalizeOllamaUrl(config.ollamaUrl)}/api/tags`);
      return { ok: response.ok, latencyMs: Date.now() - startedAt };
    } catch {
      return { ok: false, latencyMs: Date.now() - startedAt };
    }
  }

  async listModels(config: { ollamaUrl?: string }) {
    const response = await fetch(`${normalizeOllamaUrl(config.ollamaUrl)}/api/tags`);
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    return (data.models ?? []).map((item) => item.name).filter((item): item is string => Boolean(item));
  }

  async complete(request: AiCompletionRequest, config: { ollamaUrl?: string }): Promise<AiCompletionResult> {
    const response = await fetch(`${normalizeOllamaUrl(config.ollamaUrl)}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        stream: false
      })
    });

    const data = (await response.json()) as { response?: string };
    return {
      text: data.response ?? '',
      provider: this.name,
      model: request.model
    };
  }
}
