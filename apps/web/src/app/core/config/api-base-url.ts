declare global {
  interface Window {
    __SHIFT_API_BASE_URL__?: string;
  }
}

export function resolveApiBaseUrl(): string {
  const configured = typeof window !== 'undefined' ? window.__SHIFT_API_BASE_URL__ : undefined;
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined' && window.location.port === '4200') {
    return 'http://localhost:3333/api';
  }

  return '/api';
}
