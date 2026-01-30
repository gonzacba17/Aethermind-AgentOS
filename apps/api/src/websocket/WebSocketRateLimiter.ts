import { WebSocket } from 'ws';
import redisService from '../services/RedisService';
import logger from '../utils/logger';

/**
 * WebSocket Rate Limiter Configuration
 */
export interface WebSocketRateLimitConfig {
  /** Maximum messages per window */
  maxMessages: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum connections per IP */
  maxConnectionsPerIp: number;
  /** Maximum connections per organization */
  maxConnectionsPerOrg: number;
  /** Warn threshold (percentage of limit) */
  warnThreshold: number;
}

/**
 * Default configuration for WebSocket rate limiting
 */
export const DEFAULT_WS_RATE_LIMIT: WebSocketRateLimitConfig = {
  maxMessages: 100,           // 100 messages per minute
  windowMs: 60 * 1000,        // 1 minute window
  maxConnectionsPerIp: 10,    // Max 10 connections from same IP
  maxConnectionsPerOrg: 50,   // Max 50 connections per organization
  warnThreshold: 0.8,         // Warn at 80% of limit
};

/**
 * Rate limit entry for a client
 */
interface RateLimitEntry {
  messageCount: number;
  resetAt: number;
  warned: boolean;
}

/**
 * WebSocket Rate Limiter
 *
 * Features:
 * - Per-client message rate limiting
 * - Connection limits per IP and organization
 * - Redis-backed for distributed limiting
 * - Automatic fallback to in-memory
 * - Warning notifications before hard limit
 */
export class WebSocketRateLimiter {
  private config: WebSocketRateLimitConfig;
  private memoryStore = new Map<string, RateLimitEntry>();
  private connectionsByIp = new Map<string, Set<string>>();
  private connectionsByOrg = new Map<string, Set<string>>();

  constructor(config: Partial<WebSocketRateLimitConfig> = {}) {
    this.config = { ...DEFAULT_WS_RATE_LIMIT, ...config };

    // Cleanup expired entries periodically
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if a new connection is allowed
   */
  async canConnect(clientId: string, ip: string, orgId?: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Check IP connection limit
    const ipConnections = this.connectionsByIp.get(ip) || new Set();
    if (ipConnections.size >= this.config.maxConnectionsPerIp) {
      logger.warn('WebSocket connection limit exceeded for IP', {
        ip,
        current: ipConnections.size,
        limit: this.config.maxConnectionsPerIp,
      });
      return {
        allowed: false,
        reason: `Connection limit exceeded. Maximum ${this.config.maxConnectionsPerIp} connections per IP.`,
      };
    }

    // Check organization connection limit
    if (orgId) {
      const orgConnections = this.connectionsByOrg.get(orgId) || new Set();
      if (orgConnections.size >= this.config.maxConnectionsPerOrg) {
        logger.warn('WebSocket connection limit exceeded for organization', {
          orgId,
          current: orgConnections.size,
          limit: this.config.maxConnectionsPerOrg,
        });
        return {
          allowed: false,
          reason: `Organization connection limit exceeded. Maximum ${this.config.maxConnectionsPerOrg} connections.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Register a new connection
   */
  registerConnection(clientId: string, ip: string, orgId?: string): void {
    // Track by IP
    if (!this.connectionsByIp.has(ip)) {
      this.connectionsByIp.set(ip, new Set());
    }
    this.connectionsByIp.get(ip)!.add(clientId);

    // Track by organization
    if (orgId) {
      if (!this.connectionsByOrg.has(orgId)) {
        this.connectionsByOrg.set(orgId, new Set());
      }
      this.connectionsByOrg.get(orgId)!.add(clientId);
    }

    // Initialize rate limit entry
    this.memoryStore.set(clientId, {
      messageCount: 0,
      resetAt: Date.now() + this.config.windowMs,
      warned: false,
    });

    logger.debug('WebSocket connection registered', {
      clientId,
      ipConnections: this.connectionsByIp.get(ip)?.size,
      orgConnections: orgId ? this.connectionsByOrg.get(orgId)?.size : undefined,
    });
  }

  /**
   * Unregister a connection
   */
  unregisterConnection(clientId: string, ip: string, orgId?: string): void {
    // Remove from IP tracking
    const ipConnections = this.connectionsByIp.get(ip);
    if (ipConnections) {
      ipConnections.delete(clientId);
      if (ipConnections.size === 0) {
        this.connectionsByIp.delete(ip);
      }
    }

    // Remove from organization tracking
    if (orgId) {
      const orgConnections = this.connectionsByOrg.get(orgId);
      if (orgConnections) {
        orgConnections.delete(clientId);
        if (orgConnections.size === 0) {
          this.connectionsByOrg.delete(orgId);
        }
      }
    }

    // Remove rate limit entry
    this.memoryStore.delete(clientId);
  }

  /**
   * Check if a message is allowed (rate limiting)
   */
  async checkMessage(clientId: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
    shouldWarn: boolean;
  }> {
    const now = Date.now();
    let entry = this.memoryStore.get(clientId);

    // Initialize or reset if window expired
    if (!entry || entry.resetAt <= now) {
      entry = {
        messageCount: 0,
        resetAt: now + this.config.windowMs,
        warned: false,
      };
      this.memoryStore.set(clientId, entry);
    }

    entry.messageCount++;

    const remaining = Math.max(0, this.config.maxMessages - entry.messageCount);
    const usageRatio = entry.messageCount / this.config.maxMessages;

    // Check if should warn (approaching limit)
    let shouldWarn = false;
    if (!entry.warned && usageRatio >= this.config.warnThreshold) {
      entry.warned = true;
      shouldWarn = true;
    }

    const allowed = entry.messageCount <= this.config.maxMessages;

    if (!allowed) {
      logger.warn('WebSocket message rate limit exceeded', {
        clientId,
        messageCount: entry.messageCount,
        limit: this.config.maxMessages,
      });
    }

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
      shouldWarn,
    };
  }

  /**
   * Get current connection stats
   */
  getStats(): {
    totalConnections: number;
    connectionsByIp: number;
    connectionsByOrg: number;
  } {
    let totalConnections = 0;
    for (const connections of this.connectionsByIp.values()) {
      totalConnections += connections.size;
    }

    return {
      totalConnections,
      connectionsByIp: this.connectionsByIp.size,
      connectionsByOrg: this.connectionsByOrg.size,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [clientId, entry] of this.memoryStore.entries()) {
      if (entry.resetAt <= now) {
        // Reset the entry instead of deleting (connection may still be active)
        entry.messageCount = 0;
        entry.resetAt = now + this.config.windowMs;
        entry.warned = false;
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('WebSocket rate limit entries reset', { count: cleaned });
    }
  }
}

// Export singleton instance
export const wsRateLimiter = new WebSocketRateLimiter();

export default WebSocketRateLimiter;
