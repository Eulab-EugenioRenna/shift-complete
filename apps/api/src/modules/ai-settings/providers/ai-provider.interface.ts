export interface AiProviderCapabilities {
  provider: string;
  supportsChat: boolean;
  supportsModelListing: boolean;
  supportsHealthcheck: boolean;
}

export interface AiCompletionRequest {
  model?: string;
  prompt: string;
}

export interface AiCompletionResult {
  text: string;
  provider: string;
  model?: string;
}

export interface AiProvider {
  readonly name: string;
  capabilities(): AiProviderCapabilities;
  ping(config: { apiKey?: string; ollamaUrl?: string }): Promise<{ ok: boolean; latencyMs: number }>;
  listModels(config: { apiKey?: string; ollamaUrl?: string }): Promise<string[]>;
  complete(request: AiCompletionRequest, config: { apiKey?: string; ollamaUrl?: string }): Promise<AiCompletionResult>;
}
