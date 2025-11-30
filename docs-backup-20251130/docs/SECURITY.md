# Security Policy - Aethermind AgentOS

> Security policies and vulnerability reporting for Aethermind AgentOS v0.1.0

## Reporting Security Vulnerabilities

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead, please report security issues via email to: **security@aethermind.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and provide updates every 72 hours until resolved.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Yes    |
| < 0.1.0 | ❌ No     |

## Security Features

### Authentication
- API key authentication with bcrypt hashing
- WebSocket authentication
- Rate limiting (100 requests per 15 minutes)

### Data Protection
- Credential sanitization in logs
- SQL injection protection (prepared statements)
- CORS configuration
- Security headers (Helmet)

### Best Practices

1. **Never commit secrets** to version control
2. **Use strong API keys** (generated with `pnpm generate-api-key`)
3. **Keep dependencies updated** (`pnpm update`)
4. **Enable HTTPS** in production
5. **Use environment variables** for all secrets

## Security Checklist

- [ ] API keys stored in `.env` (not committed)
- [ ] Strong PostgreSQL password
- [ ] HTTPS enabled in production
- [ ] Rate limiting configured
- [ ] CORS whitelist configured
- [ ] Regular dependency updates
- [ ] Logs sanitized of sensitive data

## Disclosure Policy

- **Immediate disclosure**: Critical vulnerabilities affecting all users
- **30-day disclosure**: High-severity vulnerabilities
- **90-day disclosure**: Medium/low-severity issues

---

**Last Updated**: 2025-11-26  
**Version**: 0.1.0
