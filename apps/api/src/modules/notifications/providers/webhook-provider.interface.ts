export interface WebhookPayload {
  event: string;
  timestamp: string;
  payload: unknown;
}

export interface WebhookProvider {
  send(message: WebhookPayload): Promise<{ delivered: boolean; statusCode?: number }>;
}
