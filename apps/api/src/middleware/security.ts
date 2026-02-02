/**
 * Advanced Security Middleware (WAF-like protection)
 *
 * Features:
 * - IP blacklisting/whitelisting
 * - Request validation and sanitization
 * - Bot detection
 * - SQL injection prevention
 * - XSS prevention
 * - Request fingerprinting
 * - Anomaly detection
 */

import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

// ============================================
// TYPES
// ============================================

interface SecurityConfig {
  enabled: boolean;
  ipBlacklist: Set<string>;
  ipWhitelist: Set<string>;
  blockTor: boolean;
  blockVpn: boolean;
  maxRequestSize: number;
  maxUrlLength: number;
  maxHeaderSize: number;
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  patterns: {
    sqlInjection: RegExp[];
    xss: RegExp[];
    pathTraversal: RegExp[];
    commandInjection: RegExp[];
  };
}

interface RequestFingerprint {
  ip: string;
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  hash: string;
}

interface ThreatLog {
  timestamp: Date;
  ip: string;
  path: string;
  method: string;
  threatType: string;
  details: string;
  blocked: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

const defaultConfig: SecurityConfig = {
  enabled: process.env.WAF_ENABLED !== 'false',
  ipBlacklist: new Set(process.env.IP_BLACKLIST?.split(',') || []),
  ipWhitelist: new Set(process.env.IP_WHITELIST?.split(',') || []),
  blockTor: process.env.BLOCK_TOR === 'true',
  blockVpn: process.env.BLOCK_VPN === 'true',
  maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760', 10), // 10MB
  maxUrlLength: parseInt(process.env.MAX_URL_LENGTH || '2048', 10),
  maxHeaderSize: parseInt(process.env.MAX_HEADER_SIZE || '8192', 10),
  rateLimit: {
    windowMs: 60000,
    maxRequests: 1000,
  },
  patterns: {
    sqlInjection: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|UNION|DECLARE)\b)/gi,
      /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi,
      /(--|\#|\/\*|\*\/)/g,
      /(\b(SLEEP|BENCHMARK|WAITFOR)\b)/gi,
      /(\bINFORMATION_SCHEMA\b)/gi,
    ],
    xss: [
      /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /expression\s*\(/gi,
      /vbscript:/gi,
    ],
    pathTraversal: [
      /\.\.\//g,
      /\.\.%2f/gi,
      /\.\.%5c/gi,
      /%2e%2e%2f/gi,
      /%2e%2e\//gi,
      /\.\.\\+/g,
    ],
    commandInjection: [
      /[;&|`$(){}]/g,
      /\$\([^)]+\)/g,
      /`[^`]+`/g,
      /\|\|/g,
      /&&/g,
    ],
  },
};

// ============================================
// THREAT DETECTION
// ============================================

const threatLogs: ThreatLog[] = [];
const requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
const suspiciousIPs: Map<string, { score: number; lastSeen: number }> = new Map();

function logThreat(log: ThreatLog): void {
  threatLogs.push(log);

  // Keep only last 10000 logs
  if (threatLogs.length > 10000) {
    threatLogs.shift();
  }

  // Update suspicious IP score
  const current = suspiciousIPs.get(log.ip) || { score: 0, lastSeen: 0 };
  current.score += log.blocked ? 10 : 5;
  current.lastSeen = Date.now();
  suspiciousIPs.set(log.ip, current);

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[WAF] ${log.threatType}: ${log.ip} - ${log.path} - ${log.details}`);
  }
}

function checkSQLInjection(value: string): boolean {
  return defaultConfig.patterns.sqlInjection.some((pattern) => pattern.test(value));
}

function checkXSS(value: string): boolean {
  return defaultConfig.patterns.xss.some((pattern) => pattern.test(value));
}

function checkPathTraversal(value: string): boolean {
  return defaultConfig.patterns.pathTraversal.some((pattern) => pattern.test(value));
}

function checkCommandInjection(value: string): boolean {
  // Only check in specific contexts
  return defaultConfig.patterns.commandInjection.some((pattern) => pattern.test(value));
}

// ============================================
// FINGERPRINTING
// ============================================

function generateFingerprint(req: Request): RequestFingerprint {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';

  const hash = createHash('sha256')
    .update(`${ip}:${userAgent}:${acceptLanguage}:${acceptEncoding}`)
    .digest('hex')
    .slice(0, 16);

  return {
    ip,
    userAgent,
    acceptLanguage,
    acceptEncoding,
    hash,
  };
}

function getClientIP(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const ips = Array.isArray(xff) ? xff[0] : xff.split(',')[0];
    return ips?.trim() || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// ============================================
// BOT DETECTION
// ============================================

const knownBotPatterns = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /go-http-client/i,
  /java\//i,
  /libwww/i,
];

const allowedBots = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
];

function isBot(userAgent: string): { isBot: boolean; isAllowed: boolean } {
  const isAllowed = allowedBots.some((pattern) => pattern.test(userAgent));
  const isBot = knownBotPatterns.some((pattern) => pattern.test(userAgent));

  return { isBot, isAllowed };
}

// ============================================
// MIDDLEWARE
// ============================================

export function securityMiddleware(config: Partial<SecurityConfig> = {}) {
  const cfg = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    if (!cfg.enabled) {
      return next();
    }

    const ip = getClientIP(req);
    const fingerprint = generateFingerprint(req);

    // 1. IP Whitelist check (bypass all other checks)
    if (cfg.ipWhitelist.size > 0 && cfg.ipWhitelist.has(ip)) {
      return next();
    }

    // 2. IP Blacklist check
    if (cfg.ipBlacklist.has(ip)) {
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'IP_BLACKLISTED',
        details: 'IP is blacklisted',
        blocked: true,
      });
      return res.status(403).json({ error: 'Access denied' });
    }

    // 3. Suspicious IP check
    const suspiciousScore = suspiciousIPs.get(ip)?.score || 0;
    if (suspiciousScore > 100) {
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'SUSPICIOUS_IP',
        details: `Suspicious score: ${suspiciousScore}`,
        blocked: true,
      });
      return res.status(403).json({ error: 'Access denied' });
    }

    // 4. URL length check
    if (req.url.length > cfg.maxUrlLength) {
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'URL_TOO_LONG',
        details: `URL length: ${req.url.length}`,
        blocked: true,
      });
      return res.status(414).json({ error: 'URI too long' });
    }

    // 5. Path traversal check
    if (checkPathTraversal(req.url)) {
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'PATH_TRAVERSAL',
        details: 'Path traversal attempt detected',
        blocked: true,
      });
      return res.status(400).json({ error: 'Invalid request' });
    }

    // 6. SQL injection check on query params
    const queryString = JSON.stringify(req.query);
    if (checkSQLInjection(queryString)) {
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'SQL_INJECTION',
        details: 'SQL injection pattern detected in query',
        blocked: true,
      });
      return res.status(400).json({ error: 'Invalid request' });
    }

    // 7. XSS check on query params
    if (checkXSS(queryString)) {
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'XSS',
        details: 'XSS pattern detected in query',
        blocked: true,
      });
      return res.status(400).json({ error: 'Invalid request' });
    }

    // 8. Bot detection
    const botCheck = isBot(fingerprint.userAgent);
    if (botCheck.isBot && !botCheck.isAllowed) {
      // Don't block, but log and add to fingerprint
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'SUSPICIOUS_BOT',
        details: `Bot UA: ${fingerprint.userAgent.slice(0, 100)}`,
        blocked: false,
      });
    }

    // 9. Rate limiting by IP
    const now = Date.now();
    const rateKey = ip;
    let rateData = requestCounts.get(rateKey);

    if (!rateData || now > rateData.resetTime) {
      rateData = { count: 0, resetTime: now + cfg.rateLimit.windowMs };
      requestCounts.set(rateKey, rateData);
    }

    rateData.count++;

    if (rateData.count > cfg.rateLimit.maxRequests) {
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'RATE_LIMIT_EXCEEDED',
        details: `Requests: ${rateData.count}/${cfg.rateLimit.maxRequests}`,
        blocked: true,
      });
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((rateData.resetTime - now) / 1000),
      });
    }

    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Request-ID', fingerprint.hash);

    // Attach fingerprint to request for logging
    (req as any).fingerprint = fingerprint;

    next();
  };
}

// ============================================
// BODY VALIDATION MIDDLEWARE
// ============================================

export function bodyValidationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    const ip = getClientIP(req);
    const bodyString = JSON.stringify(req.body);

    // SQL injection check
    if (checkSQLInjection(bodyString)) {
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'SQL_INJECTION',
        details: 'SQL injection pattern detected in body',
        blocked: true,
      });
      return res.status(400).json({ error: 'Invalid request body' });
    }

    // XSS check
    if (checkXSS(bodyString)) {
      logThreat({
        timestamp: new Date(),
        ip,
        path: req.path,
        method: req.method,
        threatType: 'XSS',
        details: 'XSS pattern detected in body',
        blocked: true,
      });
      return res.status(400).json({ error: 'Invalid request body' });
    }

    next();
  };
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

export function getSecurityStats() {
  return {
    totalThreats: threatLogs.length,
    recentThreats: threatLogs.slice(-100),
    suspiciousIPs: Array.from(suspiciousIPs.entries())
      .filter(([, data]) => data.score > 10)
      .map(([ip, data]) => ({ ip, ...data })),
    blacklistedIPs: Array.from(defaultConfig.ipBlacklist),
    whitelistedIPs: Array.from(defaultConfig.ipWhitelist),
  };
}

export function addToBlacklist(ip: string): void {
  defaultConfig.ipBlacklist.add(ip);
}

export function removeFromBlacklist(ip: string): void {
  defaultConfig.ipBlacklist.delete(ip);
}

export function addToWhitelist(ip: string): void {
  defaultConfig.ipWhitelist.add(ip);
}

export function removeFromWhitelist(ip: string): void {
  defaultConfig.ipWhitelist.delete(ip);
}

export function clearSuspiciousIP(ip: string): void {
  suspiciousIPs.delete(ip);
}

export default securityMiddleware;
