import { SetMetadata } from '@nestjs/common';

/**
 * TokenCost — Route metadata decorator.
 *
 * Marks an AI-generating endpoint with an estimated token cost.
 * The QuotaInterceptor reads this value to reserve tokens before the handler
 * executes and to release the difference after it completes.
 *
 * Business rules (quota amounts, tier limits) live in packages/domain.
 * This decorator carries only the cost estimate for the specific operation.
 *
 * Usage:
 *   @TokenCost(512)
 *   @Post('generate')
 *   async generate() { ... }
 */
export const TOKEN_COST_KEY = 'token_cost';
export const TokenCost = (tokens: number) => SetMetadata(TOKEN_COST_KEY, tokens);
