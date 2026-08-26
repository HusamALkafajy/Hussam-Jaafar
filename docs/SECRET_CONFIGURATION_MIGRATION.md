# Secret Configuration Migration

## Purpose

This repository no longer contains local service credentials, signing material,
or credential-bearing connection strings. Sensitive configuration is supplied at
runtime from ignored environment files or the deployment secret manager.

This document changes configuration handling only. It does not rotate a
credential, rewrite Git history, alter a database, or change Drizzle migration
authority.

## Old configuration

Local database connection defaults, service passwords, authentication signing
values, provider credentials, and selected test settings were embedded in
tracked Compose files, source defaults, examples, documentation, and generated
E2E output. Some code paths silently selected those defaults when environment
variables were absent.

## New configuration

All sensitive values are read from the environment. The application and tooling
now fail clearly when a required database connection variable is absent instead
of selecting a tracked default. Compose reads its sensitive variables through
standard Compose interpolation; it validates required database and JWT values
before starting services.

The following tracked files are templates only and contain blank values for
sensitive settings:

- `.env.example` for root development and root Compose services.
- `apps/api/.env.example` for the API.
- `docker/.env.prod.example` for the production Compose definition.

## Required local environment files

Create these ignored files from their corresponding examples and populate them
through the approved local secret-management workflow:

- `.env` for root development Compose. It must provide `POSTGRES_PASSWORD` and
  `TEST_POSTGRES_PASSWORD`; database-backed application processes also need
  `DATABASE_URL`.
- `apps/api/.env` for API development. Provide `DATABASE_URL` and `JWT_SECRET`
  for the enabled API features, plus only the provider credentials used locally.
- `apps/api/.env.test` for database-backed API tests. Provide
  `DATABASE_URL`, `JWT_SECRET`, and `STRIPE_SECRET_KEY` where the test requires
  them.
- `docker/.env.prod` for `docker/docker-compose.prod.yml`. It must provide
  `DATABASE_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`.
  Supply provider and SMTP values only for enabled services.

Drizzle tooling reads `DRIZZLE_DATABASE_URL` when set, otherwise it uses the
externally supplied `DATABASE_URL`. Repository integration tests require
`TEST_DATABASE_URL`.

## Validation procedure

1. Populate the appropriate ignored environment file through the approved
   secret workflow. Do not echo values into the terminal or save them in logs.
2. For Compose, run the relevant configuration render command with that external
   environment file and confirm that it completes without missing-variable
   errors.
3. Run `pnpm security:scan`. The guard scans tracked text files and prints only
   file paths, line numbers, and finding categories when it detects a prohibited
   pattern.
4. Run the normal targeted application or test command only with the required
   external environment variables present.

## Guardrails and remaining risk

The generated E2E result artifacts are no longer tracked and `e2e-results/` is
ignored to prevent browser output from being committed. The repository guard
blocks literal sensitive assignments, credential-bearing connection URIs,
private-key blocks, and common provider key signatures.

This migration removes sensitive values from the current repository state only.
Earlier commits may still contain the previous values. Credential rotation and
separate history-remediation authorization remain owner-controlled follow-up
work.
