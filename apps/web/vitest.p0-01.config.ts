import { fileURLToPath } from 'node:url';
import publicationConfig from './vitest.config';

// Separate test-only configuration; the publication configuration is unmodified.
// Preserve its plugins, setup, environment, exclusions and aliases. Replace the
// include array directly so the ordinary Web suite is not silently appended.
const webRoot = fileURLToPath(new URL('./', import.meta.url));

export default {
  ...publicationConfig,
  root: webRoot,
  test: {
    ...publicationConfig.test,
    // Avoid interpreting the literal [id] directory as a glob character class.
    // Preparation must find exactly one matching file: the colocated chat test.
    include: ['src/app/**/chat/**/page.test.tsx'],
  },
};
