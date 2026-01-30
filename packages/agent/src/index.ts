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

// Dead Letter Queue
export { EventQueue, type EventQueueConfig, type QueueStats, type FailedEventEntry } from './queue/index.js';

// Utilities
export { retryWithBackoff, type RetryConfig } from './utils/retry.js';

// Interceptors (for advanced usage)
export { OpenAIInterceptor } from './interceptors/OpenAIInterceptor.js';
export { AnthropicInterceptor } from './interceptors/AnthropicInterceptor.js';

// Version
export const VERSION = '0.1.2';
