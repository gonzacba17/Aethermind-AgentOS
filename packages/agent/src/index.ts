/**
 * @aethermind/agent - Lightweight SDK for AI cost monitoring
 * 
 * Main entry point for the Aethermind Agent SDK.
 * Provides automatic telemetry capture for OpenAI and Anthropic API calls.
 */

export { initAethermind, type AethermindConfig } from './config/index.js';
export { type TelemetryEvent } from './transport/types.js';

// Version
export const VERSION = '0.1.2';
