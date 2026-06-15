require('reflect-metadata');

// Suppress NestJS Logger LOG/WARN/DEBUG/VERBOSE output during tests.
// NOTE: Logger.error() output may still appear because NestJS Logger writes
// directly to process.stderr in some code paths, bypassing the console.
// ERROR logs during tests that exercise error paths (e.g. health check failures,
// LLM config checks) are expected and indicate correct test behavior.
const { Logger } = require('@nestjs/common');
Logger.overrideLogger([]);
