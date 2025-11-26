import { describe, it, expect } from '@jest/globals';

// Direct import without .js extension for ts-jest
const { sanitizeLog, sanitizeObject } = await import('../../apps/api/src/utils/sanitizer');

describe('Log Sanitizer', () => {
    describe('sanitizeLog', () => {
        it('should redact API keys', () => {
            const input = 'Using API key: sk-1234567890abcdefghij';
            const output = sanitizeLog(input);
            expect(output).not.toContain('sk-1234567890abcdefghij');
            expect(output).toContain('***REDACTED***');
        });

        it('should redact API keys with various formats', () => {
            const inputs = [
                'api_key=sk-1234567890abcdefghij',
                'apiKey: "sk-1234567890abcdefghij"',
                'API-KEY=sk-1234567890abcdefghij',
                "key='sk-1234567890abcdefghij'"
            ];

            inputs.forEach(input => {
                const output = sanitizeLog(input);
                expect(output).not.toContain('sk-1234567890abcdefghij');
                expect(output).toContain('***REDACTED***');
            });
        });

        it('should redact passwords', () => {
            const input = 'User password: MySecretPass123!';
            const output = sanitizeLog(input);
            expect(output).not.toContain('MySecretPass123!');
            expect(output).toContain('***REDACTED***');
        });

        it('should redact passwords with various formats', () => {
            const inputs = [
                'password=MySecret123',
                'passwd: "MySecret123"',
                "pwd='MySecret123'"
            ];

            inputs.forEach(input => {
                const output = sanitizeLog(input);
                expect(output).not.toContain('MySecret123');
                expect(output).toContain('***REDACTED***');
            });
        });

        it('should redact bearer tokens', () => {
            const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
            const output = sanitizeLog(input);
            expect(output).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
            expect(output).toContain('***REDACTED***');
        });

        it('should redact JWT tokens', () => {
            const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
            const input = `Token: ${jwt}`;
            const output = sanitizeLog(input);
            expect(output).not.toContain(jwt);
            expect(output).toContain('jwt.***REDACTED***.***');
        });

        it('should redact email addresses', () => {
            const input = 'Contact: user@example.com for support';
            const output = sanitizeLog(input);
            expect(output).not.toContain('user@example.com');
            expect(output).toContain('***@***.***');
        });

        it('should redact multiple email addresses', () => {
            const input = 'Send to admin@test.com and support@example.org';
            const output = sanitizeLog(input);
            expect(output).not.toContain('admin@test.com');
            expect(output).not.toContain('support@example.org');
            expect(output).toContain('***@***.***');
        });

        it('should redact URLs with credentials', () => {
            const input = 'Database: https://user:password@db.example.com/mydb';
            const output = sanitizeLog(input);
            expect(output).not.toContain('user:password');
            expect(output).toContain('https://***:***@');
        });

        it('should redact credit card numbers', () => {
            const inputs = [
                '4532-1234-5678-9010',
                '4532 1234 5678 9010',
                '4532123456789010'
            ];

            inputs.forEach(input => {
                const output = sanitizeLog(input);
                expect(output).toContain('****-****-****-****');
                expect(output).not.toContain('4532');
            });
        });

        it('should redact secret tokens', () => {
            const inputs = [
                'secret=abc123def456ghi789',
                'token: "abc123def456ghi789"',
                "auth='abc123def456ghi789'"
            ];

            inputs.forEach(input => {
                const output = sanitizeLog(input);
                expect(output).not.toContain('abc123def456ghi789');
                expect(output).toContain('***REDACTED***');
            });
        });

        it('should handle multiple sensitive patterns', () => {
            const input = 'API_KEY=secret123 and password=pass456 for user@test.com';
            const output = sanitizeLog(input);
            expect(output).not.toContain('secret123');
            expect(output).not.toContain('pass456');
            expect(output).not.toContain('user@test.com');
            expect(output).toContain('***REDACTED***');
            expect(output).toContain('***@***.***');
        });

        it('should preserve non-sensitive data', () => {
            const input = 'User logged in successfully at 2024-01-15 10:30:00';
            const output = sanitizeLog(input);
            expect(output).toBe(input);
        });

        it('should handle null and undefined', () => {
            expect(sanitizeLog(null as any)).toBeNull();
            expect(sanitizeLog(undefined as any)).toBeUndefined();
        });

        it('should handle empty strings', () => {
            expect(sanitizeLog('')).toBe('');
        });

        it('should handle non-string inputs', () => {
            expect(sanitizeLog(123 as any)).toBe(123);
            expect(sanitizeLog({} as any)).toEqual({});
        });
    });

    describe('sanitizeObject', () => {
        it('should redact sensitive keys', () => {
            const input = {
                username: 'john',
                password: 'secret123',
                apiKey: 'sk-1234567890'
            };
            const output = sanitizeObject(input);
            expect(output.username).toBe('john');
            expect(output.password).toBe('***REDACTED***');
            expect(output.apiKey).toBe('***REDACTED***');
        });

        it('should redact all sensitive key variations', () => {
            const input = {
                password: 'secret1',
                passwd: 'secret2',
                pwd: 'secret3',
                secret: 'secret4',
                token: 'secret5',
                apiKey: 'secret6',
                api_key: 'secret7',
                apikey: 'secret8',
                authorization: 'secret9',
                auth: 'secret10',
                credential: 'secret11',
                private_key: 'secret12',
                privateKey: 'secret13'
            };

            const output = sanitizeObject(input);

            // All sensitive keys should be redacted
            Object.keys(input).forEach(key => {
                expect(output[key]).toBe('***REDACTED***');
            });
        });

        it('should sanitize nested objects', () => {
            const input = {
                user: {
                    name: 'John',
                    credentials: {
                        password: 'secret',
                        token: 'abc123'
                    }
                }
            };
            const output = sanitizeObject(input);
            expect(output.user.name).toBe('John');
            expect(output.user.credentials.password).toBe('***REDACTED***');
            expect(output.user.credentials.token).toBe('***REDACTED***');
        });

        it('should sanitize arrays', () => {
            const input = [
                { username: 'john', password: 'secret1' },
                { username: 'jane', password: 'secret2' }
            ];
            const output = sanitizeObject(input);
            expect(output[0].username).toBe('john');
            expect(output[0].password).toBe('***REDACTED***');
            expect(output[1].username).toBe('jane');
            expect(output[1].password).toBe('***REDACTED***');
        });

        it('should sanitize string values with sensitive patterns', () => {
            const input = {
                message: 'User email is user@example.com',
                description: 'API key: sk-1234567890abcdefghij'
            };
            const output = sanitizeObject(input);
            expect(output.message).not.toContain('user@example.com');
            expect(output.message).toContain('***@***.***');
            expect(output.description).not.toContain('sk-1234567890abcdefghij');
            expect(output.description).toContain('***REDACTED***');
        });

        it('should preserve non-sensitive data', () => {
            const input = {
                id: 123,
                name: 'Test User',
                active: true,
                metadata: {
                    created: '2024-01-15',
                    count: 42
                }
            };
            const output = sanitizeObject(input);
            expect(output).toEqual(input);
        });

        it('should handle null and undefined', () => {
            expect(sanitizeObject(null)).toBeNull();
            expect(sanitizeObject(undefined)).toBeUndefined();
        });

        it('should handle primitive values', () => {
            expect(sanitizeObject('string')).toBe('string');
            expect(sanitizeObject(123)).toBe(123);
            expect(sanitizeObject(true)).toBe(true);
        });

        it('should handle deeply nested structures', () => {
            const input = {
                level1: {
                    level2: {
                        level3: {
                            password: 'secret',
                            data: 'normal'
                        }
                    }
                }
            };
            const output = sanitizeObject(input);
            expect(output.level1.level2.level3.password).toBe('***REDACTED***');
            expect(output.level1.level2.level3.data).toBe('normal');
        });

        it('should handle mixed arrays and objects', () => {
            const input = {
                users: [
                    { name: 'John', apiKey: 'secret1' },
                    { name: 'Jane', token: 'secret2' }
                ],
                config: {
                    password: 'secret3',
                    timeout: 5000
                }
            };
            const output = sanitizeObject(input);
            expect(output.users[0].name).toBe('John');
            expect(output.users[0].apiKey).toBe('***REDACTED***');
            expect(output.users[1].name).toBe('Jane');
            expect(output.users[1].token).toBe('***REDACTED***');
            expect(output.config.password).toBe('***REDACTED***');
            expect(output.config.timeout).toBe(5000);
        });

        it('should handle case-insensitive key matching', () => {
            const input = {
                PASSWORD: 'secret1',
                ApiKey: 'secret2',
                PRIVATE_KEY: 'secret3'
            };
            const output = sanitizeObject(input);
            expect(output.PASSWORD).toBe('***REDACTED***');
            expect(output.ApiKey).toBe('***REDACTED***');
            expect(output.PRIVATE_KEY).toBe('***REDACTED***');
        });
    });
});
