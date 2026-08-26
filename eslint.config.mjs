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
  },
  {
    // Phase 4-D Architectural Governance: Knowledge Graph Isolation
    files: ['apps/api/src/modules/**/*.ts'],
    ignores: [
      'apps/api/src/modules/knowledge/providers/knowledge-graph-consumer.ts',
      'apps/api/src/modules/knowledge/knowledge.module.ts',
      '**/*.spec.ts',
      '**/*.test.ts'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/knowledge-graph.repository'],
              message: 'Architecture Violation: KnowledgeGraphRepository must only be consumed by the KnowledgeGraphConsumer.'
            }
          ]
        }
      ]
    }
  },
  {
    // Phase 4-D Architectural Governance: Consumer Isolation
    // Consumers must not import KnowledgeEvidenceAssembler (wait, Tutor needs it, so we restrict who can import Assembler)
    files: ['apps/api/src/modules/**/*.ts'],
    ignores: [
      'apps/api/src/modules/tutor/retrieval.orchestrator.ts',
      'apps/api/src/modules/tutor/tutor.module.ts',
      'apps/api/src/modules/quizzes/engine/quiz.generator.ts',
      'apps/api/src/modules/quizzes/quizzes.module.ts',
      'apps/api/src/modules/knowledge/knowledge.module.ts',
      '**/*.spec.ts'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/knowledge-evidence-assembler'],
              message: 'Architecture Violation: KnowledgeEvidenceAssembler is restricted to approved consumers (e.g., Tutor).'
            }
          ]
        }
      ]
    }
  },
  {
    // Phase 4-D Architectural Governance: Consumer Graph Assembly Bypass
    // Consumers (like Flashcards/Quiz) must use the KnowledgeGraphConsumer, not bypass it
    files: ['apps/api/src/modules/flashcards/engine/**/*.ts', 'apps/api/src/modules/quizzes/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/knowledge-graph.repository'],
              message: 'Architecture Violation: Educational engines must use KnowledgeGraphConsumer, not the Repository.'
            }
          ]
        }
      ]
    }
  },
  {
    // Phase 4-D Architectural Governance: Assembler Purity
    // Assembler must not import Tutor or Flashcard engine specifics (circular logic)
    // It may only import contracts.
    files: ['apps/api/src/modules/knowledge/**/*.ts'],
    ignores: [
      'apps/api/src/modules/knowledge/knowledge.module.ts',
      '**/*.spec.ts'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../tutor/!(contracts)/**', '../../flashcards/engine/!(contracts)/**', '../../quizzes/engine/!(contracts)/**'],
              message: 'Architecture Violation: Knowledge layer must remain domain-agnostic and not depend on consumer engines (only contracts are allowed).'
            }
          ]
        }
      ]
    }
  }
];
