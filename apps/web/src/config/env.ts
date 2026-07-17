/**
 * Frontend Configuration Module
 * 
 * Centralized, validated environment configuration for the web application.
 * This is the ONLY file in the web app allowed to access `process.env`.
 */

export interface FrontendConfig {
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly apiBaseUrl: string;
}

// Read environment once
const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

// Construct the immutable configuration object
export const env: FrontendConfig = Object.freeze({
  isProduction: isProd,
  isDevelopment: !isProd,
  apiBaseUrl: typeof window === 'undefined'
    ? (isProd ? 'http://api:4000' : 'http://localhost:4000')
    : ''
});
