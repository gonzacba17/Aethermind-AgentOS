// Simple verification script for sanitizer functionality
import { sanitizeLog, sanitizeObject } from '../apps/api/src/utils/sanitizer.js';

console.log('🧪 Testing Sanitizer Utility\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (error) {
        console.log(`❌ ${name}`);
        console.error(`   Error: ${error.message}`);
        failed++;
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

// Test sanitizeLog
test('Should redact API keys', () => {
    const result = sanitizeLog('Using API key: sk-1234567890abcdefghij');
    assert(!result.includes('sk-1234567890abcdefghij'), 'API key not redacted');
    assert(result.includes('***REDACTED***'), 'Redaction marker not found');
});

test('Should redact passwords', () => {
    const result = sanitizeLog('User password: MySecretPass123!');
    assert(!result.includes('MySecretPass123!'), 'Password not redacted');
    assert(result.includes('***REDACTED***'), 'Redaction marker not found');
});

test('Should redact JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = sanitizeLog(`Token: ${jwt}`);
    assert(!result.includes(jwt), 'JWT not redacted');
    assert(result.includes('jwt.***REDACTED***.***'), 'JWT redaction marker not found');
});

test('Should redact email addresses', () => {
    const result = sanitizeLog('Contact: user@example.com for support');
    assert(!result.includes('user@example.com'), 'Email not redacted');
    assert(result.includes('***@***.***'), 'Email redaction marker not found');
});

test('Should redact URLs with credentials', () => {
    const result = sanitizeLog('Database: https://user:password@db.example.com/mydb');
    assert(!result.includes('user:password'), 'URL credentials not redacted');
    assert(result.includes('https://***:***@'), 'URL redaction marker not found');
});

test('Should redact credit card numbers', () => {
    const result = sanitizeLog('Card: 4532-1234-5678-9010');
    assert(!result.includes('4532'), 'Credit card not redacted');
    assert(result.includes('****-****-****-****'), 'Credit card redaction marker not found');
});

test('Should preserve non-sensitive data', () => {
    const input = 'User logged in successfully at 2024-01-15 10:30:00';
    const result = sanitizeLog(input);
    assert(result === input, 'Non-sensitive data was modified');
});

// Test sanitizeObject
test('Should redact sensitive object keys', () => {
    const input = { username: 'john', password: 'secret123', apiKey: 'sk-1234567890' };
    const result = sanitizeObject(input);
    assert(result.username === 'john', 'Username was modified');
    assert(result.password === '***REDACTED***', 'Password not redacted');
    assert(result.apiKey === '***REDACTED***', 'API key not redacted');
});

test('Should sanitize nested objects', () => {
    const input = {
        user: {
            name: 'John',
            credentials: {
                password: 'secret',
                token: 'abc123'
            }
        }
    };
    const result = sanitizeObject(input);
    assert(result.user.name === 'John', 'Name was modified');
    assert(result.user.credentials.password === '***REDACTED***', 'Nested password not redacted');
    assert(result.user.credentials.token === '***REDACTED***', 'Nested token not redacted');
});

test('Should sanitize arrays', () => {
    const input = [
        { username: 'john', password: 'secret1' },
        { username: 'jane', password: 'secret2' }
    ];
    const result = sanitizeObject(input);
    assert(result[0].username === 'john', 'First username was modified');
    assert(result[0].password === '***REDACTED***', 'First password not redacted');
    assert(result[1].username === 'jane', 'Second username was modified');
    assert(result[1].password === '***REDACTED***', 'Second password not redacted');
});

test('Should sanitize string values with sensitive patterns', () => {
    const input = {
        message: 'User email is user@example.com',
        description: 'API key: sk-1234567890abcdefghij'
    };
    const result = sanitizeObject(input);
    assert(!result.message.includes('user@example.com'), 'Email in string not redacted');
    assert(!result.description.includes('sk-1234567890abcdefghij'), 'API key in string not redacted');
});

test('Should handle null and undefined', () => {
    assert(sanitizeLog(null) === null, 'Null handling failed');
    assert(sanitizeLog(undefined) === undefined, 'Undefined handling failed');
    assert(sanitizeObject(null) === null, 'Object null handling failed');
    assert(sanitizeObject(undefined) === undefined, 'Object undefined handling failed');
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
    process.exit(1);
}

console.log('✨ All sanitizer tests passed!\n');
