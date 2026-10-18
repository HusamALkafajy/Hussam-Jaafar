/** These are signing credentials, never defaults or public application IDs. */
export function assertJwtSecrets(
  access: unknown,
  refresh: unknown,
  production: boolean,
): void {
  if (typeof access !== 'string' || typeof refresh !== 'string' ||
      !access.trim() || !refresh.trim()) {
    throw new Error('Independent access and refresh signing secrets are required.');
  }
  if (access === refresh) {
    throw new Error('Access and refresh signing secrets must be different.');
  }
  if (production && [access, refresh].some((value) =>
    value.trim().length < 32 ||
    /your[-_ ]|replace[-_ ]|change[-_ ]?me|placeholder|example|development[-_ ]only|^test[-_ ]|^<|^__.*__$|^\$\{/i.test(value) ||
    new Set(value).size < 8
  )) {
    throw new Error('Production signing material must be strong, explicit and non-placeholder.');
  }
}
