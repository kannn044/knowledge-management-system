/**
 * Global Jest setup — runs after the test framework is installed.
 * Silences Winston logger output to keep test output clean.
 */

// Set test-only environment variables before any module imports
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/kms_test';
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_chars_long!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_long!!';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PYTHON_SERVICE_URL = 'http://localhost:8000';
process.env.INTERNAL_API_SECRET = 'test_internal_secret_32_chars_ok!!';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.UPLOAD_DIR = '/tmp/kms_test_uploads';
process.env.MAX_FILE_SIZE_MB = '50';

jest.setTimeout(15000);
