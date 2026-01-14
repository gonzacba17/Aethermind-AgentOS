// Test environment setup
// Configura variables de entorno necesarias para los tests

process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long-for-security';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
