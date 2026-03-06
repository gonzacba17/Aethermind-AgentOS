/**
 * @aethermind/agent - Lightweight SDK for AI cost monitoring
 *
 * Main entry point for the Aethermind Agent SDK.
 * Provides automatic telemetry capture for OpenAI and Anthropic API calls.
 */

// Configuration
export { initAethermind, type AethermindConfig } from './config/index.js';

// Transport
export { BatchTransport, getTransport, createTransport, type BatchTransportConfig } from './transport/BatchTransport.js';
export { type TelemetryEvent, type TokenUsage, type IngestionResponse } from './transport/types.js';

// Budget enforcement
export { AethermindBudgetExceededError } from './errors/AethermindBudgetExceededError.js';
export { budgetChecker } from './budget/BudgetChecker.js';

// Cache
export { cacheService, type CacheHit } from './cache/CacheService.js';

// Compression (Phase 4)
export { compressionService, type CompressionResult } from './compression/CompressionService.js';

// Dead Letter Queue
export { EventQueue, type EventQueueConfig, type QueueStats, type FailedEventEntry } from './queue/index.js';

// Utilities
export { retryWithBackoff, type RetryConfig } from './utils/retry.js';

// Interceptors (for advanced usage)
export { OpenAIInterceptor } from './interceptors/OpenAIInterceptor.js';
export { AnthropicInterceptor } from './interceptors/AnthropicInterceptor.js';
export { GeminiInterceptor } from './interceptors/GeminiInterceptor.js';
export { FetchInterceptor } from './interceptors/FetchInterceptor.js';
export { OllamaInterceptor, type OllamaConfig, type OllamaChatRequest, type OllamaChatResponse, type OllamaGenerateRequest, type OllamaGenerateResponse } from './interceptors/OllamaInterceptor.js';

// Version
export const VERSION = '0.1.5';
