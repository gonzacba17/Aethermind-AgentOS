/**
 * Event Queue Module
 *
 * Provides Dead Letter Queue functionality for reliable event delivery.
 * Failed events are persisted to disk and retried with exponential backoff.
 */

export { EventQueue } from './EventQueue.js';
export {
  DEFAULT_QUEUE_CONFIG,
  FailedEventEntrySchema,
  type FailedEventEntry,
  type EventQueueConfig,
  type QueueStats,
  type OnEventProcessed,
  type OnEventFailed,
  type OnQueueFull,
} from './types.js';
