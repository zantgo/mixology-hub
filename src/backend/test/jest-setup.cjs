require('reflect-metadata');

const { Logger } = require('@nestjs/common');

// Suppress ALL NestJS Logger output during tests.
// Logger.overrideLogger([]) disables all log levels,
// but NestJS TestingModuleBuilder.compile() reinstalls a TestingLogger
// that re-enables error output. We patch applyLogger to keep suppression.
Logger.overrideLogger([]);

try {
  const { TestingModuleBuilder } = require('@nestjs/testing');
  const origApplyLogger = TestingModuleBuilder.prototype.applyLogger;
  TestingModuleBuilder.prototype.applyLogger = function () {
    Logger.overrideLogger([]);
  };
} catch (_) {
  // @nestjs/testing not available outside test suites
}

// Suppress fire-and-forget console.error from auth.service.ts
// that trigger when SMTP is not configured during tests.
const origError = console.error;
console.error = (...args) => {
  const msg = args.join(' ');
  if (
    msg.includes('Failed to send') ||
    msg.includes('verification email') ||
    msg.includes('session eviction email') ||
    msg.includes('password reset email') ||
    msg.includes('unlock email')
  ) {
    return;
  }
  origError.apply(console, args);
};
