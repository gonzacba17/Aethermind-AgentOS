/**
 * Sanitizes log messages by removing sensitive information
 */
export function sanitizeLog(message: string): string {
    if (!message || typeof message !== 'string') {
        return message;
    }

    let sanitized = message;

    // API Keys (various formats)
    sanitized = sanitized.replace(
        /(?:api[_-]?key|apikey|key)[\s:="']+[\w\-./+=]{20,}/gi,
        'api_key=***REDACTED***'
    );

    // Bearer tokens
    sanitized = sanitized.replace(
        /bearer\s+[\w\-./+=]{20,}/gi,
        'bearer ***REDACTED***'
    );

    // Passwords
    sanitized = sanitized.replace(
        /(?:password|passwd|pwd)[\s:="']+[\w\-!@#$%^&*()+=]{6,}/gi,
        'password=***REDACTED***'
    );

    // JWT tokens
    sanitized = sanitized.replace(
        /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
        'jwt.***REDACTED***.***'
    );

    // Email addresses
    sanitized = sanitized.replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '***@***.***'
    );

    // URLs with credentials
    sanitized = sanitized.replace(
        /(https?:\/\/)([^:]+):([^@]+)@/g,
        '$1***:***@'
    );

    return sanitized;
}

/**
 * Sanitizes objects recursively
 */
export function sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
    }

    const sanitized: any = {};
    const sensitiveKeys = [
        'password', 'passwd', 'pwd', 'secret', 'token',
        'apiKey', 'api_key', 'apikey', 'authorization',
        'auth', 'credential', 'private_key', 'privateKey'
    ];

    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
            sanitized[key] = '***REDACTED***';
        } else if (typeof value === 'string') {
            sanitized[key] = sanitizeLog(value);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}