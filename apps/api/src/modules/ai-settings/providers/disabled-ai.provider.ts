import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';

@Injectable()
export class DisabledAiProvider implements AiProvider {
  readonly name = 'disabled';

  capabilities() {
    return { provider: this.name, supportsChat: false, supportsModelListing: false, supportsHealthcheck: true };
  }

  async ping() {
    return { ok: false, latencyMs: 0 };
  }

  async listModels() {
    return [];
  }

  async complete() {
    return { text: 'AI provider disabilitato', provider: this.name };
  }
}
