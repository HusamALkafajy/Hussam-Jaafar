import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**", "**/Hussam-Jaafar/**"]
  },
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooksPlugin
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooksPlugin.configs.recommended.rules
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Accessing process.env directly is forbidden outside of the Configuration Platform.'
        }
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              importNames: ['PrismaClient'],
              message: 'PrismaClient can only be imported within the Infrastructure layer.'
            },
            {
              name: 'bullmq',
              message: 'Direct Queue SDK usage is forbidden. Use the queue abstractions in the Infrastructure layer.'
            },
            {
              name: '@aws-sdk/client-s3', // example storage SDK
              message: 'Direct Object Storage SDK usage is forbidden. Use the Object Storage Platform.'
            }
          ]
        }
      ]
    }
  },
  {
    // Permanent structural exceptions for process.env
    // - Infrastructure configuration layers must read env variables.
    // - Next.js config files inherently require Node.js environment access.
    // - API config files map process.env to the ConfigService boundary.
    // - Spec/test files mock environment variables for unit testing scenarios.
    files: [
      'packages/infrastructure/src/config/**/*.ts',
      'packages/infrastructure/src/composition/**/*.ts',
      'packages/database/**/*.ts',
      'apps/web/src/config/**/*.ts',
      'apps/web/next.config.ts',
      'apps/web/src/app/robots.ts',
      'apps/web/src/app/sitemap.ts',
      'apps/web/src/app/**/layout.tsx',
      'apps/web/src/app/**/page.tsx',
      'apps/api/src/scratch/**/*.ts',
      'packages/ast/scripts/**/*.ts',
      'apps/api/src/config/**/*.ts',
      'apps/api/scripts/**/*.ts',
      'apps/api/src/modules/study-groups/study-groups.gateway.ts',
      'packages/infrastructure/src/**/*.spec.ts',
      'apps/api/src/**/*.spec.ts'
    ],
    rules: {
      'no-restricted-syntax': 'off'
    }
  },
  {
    // Permanent structural exceptions for PrismaClient and queue engines in Infrastructure
    // Infrastructure layer is the only domain allowed to orchestrate the database and queues.
    files: ['packages/infrastructure/src/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off'
    }
  },
  {
    // Domain rule: No infrastructure imports
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@studyai/infrastructure', '@studyai/api', '@studyai/web'],
              message: 'Domain layer must not import from Infrastructure, API, or Web packages.'
            }
          ]
        }
      ]
    }
  }
];
