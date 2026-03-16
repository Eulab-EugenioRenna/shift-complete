export function normalizeOllamaUrl(input?: string) {
  const raw = (input || process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
  const runningInDocker = process.env.RUNNING_IN_DOCKER === 'true' || process.env.DOCKER_ENV === 'true';

  if (!runningInDocker) {
    return raw;
  }

  return raw
    .replace('http://localhost:', 'http://host.docker.internal:')
    .replace('http://127.0.0.1:', 'http://host.docker.internal:')
    .replace('https://localhost:', 'https://host.docker.internal:')
    .replace('https://127.0.0.1:', 'https://host.docker.internal:');
}
