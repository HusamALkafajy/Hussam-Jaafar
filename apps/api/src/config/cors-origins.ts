const LOCAL_DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
];

export function resolveCorsOrigins(frontendUrl: string, nodeEnvironment?: string): string[] {
  if (nodeEnvironment === 'production') {
    return [frontendUrl];
  }

  return [...new Set([frontendUrl, ...LOCAL_DEVELOPMENT_ORIGINS])];
}
