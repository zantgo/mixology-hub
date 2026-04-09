# Authentication Tests

**Example TDD for Multi-Tenant Isolation (UC 9.1):**
```typescript
describe('UserInventoryService - Multi-Tenant Isolation', () => {
  it('should only return inventory for authenticated user', async () => {
    const inventoryService = new UserInventoryService();
    
    // Mock repository with user-scoped query
    const mockRepo = {
      find: jest.fn().mockImplementation((options) => {
        // Verify query includes user_id filter
        expect(options.where).toHaveProperty('user_id', 'user123');
        return Promise.resolve([{ ingredientId: 'vodka', quantity: 500 }]);
      })
    };
    
    inventoryService.inventoryRepo = mockRepo;
    
    const result = await inventoryService.getUserInventory('user123');
    expect(result).toHaveLength(1);
    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { user_id: 'user123' }
  });
});
```

**Example TDD for Stateless Access Token Revocation Mitigation (UC 9.17):**
```typescript
describe('Auth Service - Access Token Revocation', () => {
  it('should reject access tokens issued before last logout', async () => {
    const authService = new AuthService();
    
    // User logged out at timestamp 1000
    const userRecord = {
      id: 'user123',
      last_logout_timestamp: 1000,
      token_version: 5
    };
    
    jest.spyOn(authService, 'findUserById').mockResolvedValue(userRecord);
    
    // Access token was issued at timestamp 900 (before logout)
    const accessToken = authService.generateAccessToken('user123', 900, 5);
    
    await expect(authService.validateAccessToken(accessToken))
      .rejects
      .toThrow('Token invalidated by logout');
  });

  it('should accept access tokens issued after last logout', async () => {
    const authService = new AuthService();
    
    // User logged out at timestamp 1000
    const userRecord = {
      id: 'user123',
      last_logout_timestamp: 1000,
      token_version: 5
    };
    
    jest.spyOn(authService, 'findUserById').mockResolvedValue(userRecord);
    
    // Access token issued at timestamp 1100 (after logout)
    const accessToken = authService.generateAccessToken('user123', 1100, 5);
    
    const result = await authService.validateAccessToken(accessToken);
    
    expect(result.userId).toBe('user123');
    expect(result.isValid).toBe(true);
  });

  it('should reject access tokens with outdated token_version', async () => {
    const authService = new AuthService();
    
    // User changed password, token_version incremented to 6
    const userRecord = {
      id: 'user123',
      token_version: 6
    };
    
    jest.spyOn(authService, 'findUserById').mockResolvedValue(userRecord);
    
    // Access token issued with token_version 5 (outdated)
    const accessToken = authService.generateAccessToken('user123', Date.now() / 1000, 5);
    
    await expect(authService.validateAccessToken(accessToken))
      .rejects
      .toThrow('Token version mismatch');
  });

  it('should update last_logout_timestamp on logout', async () => {
    const authService = new AuthService();
    const userRepo = { findOne: jest.fn(), save: jest.fn() };
    authService.userRepo = userRepo;
    
    const userRecord = {
      id: 'user123',
      last_logout_timestamp: null
    };
    
    jest.spyOn(userRepo, 'findOne').mockResolvedValue(userRecord);
    
    const mockTimestamp = 1234567890;
    jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp * 1000);
    
    await authService.logout('user123');
    
    // Should update last_logout_timestamp
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user123',
      last_logout_timestamp: mockTimestamp
    }));
  });

  it('should include iat (issued at) claim in JWT', () => {
    const authService = new AuthService();
    
    const iat = Math.floor(Date.now() / 1000);
    const token = authService.generateAccessToken('user123', iat, 1);
    
    // Decode token to verify iat claim
    const decoded = authService.decodeToken(token);
    
    expect(decoded.iat).toBe(iat);
    expect(decoded.userId).toBe('user123');
    expect(decoded.token_version).toBe(1);
  });

  it('should handle token validation without database hit for valid tokens', async () => {
    const authService = new AuthService();
    
    // Generate valid token
    const iat = Math.floor(Date.now() / 1000);
    const token = authService.generateAccessToken('user123', iat, 5);
    
    // First validation should check database
    const mockFindUser = jest.spyOn(authService, 'findUserById')
      .mockResolvedValue({ id: 'user123', token_version: 5, last_logout_timestamp: null });
    
    const result1 = await authService.validateAccessToken(token);
    expect(mockFindUser).toHaveBeenCalledTimes(1);
    
    // Second validation could cache user state (implementation specific)
    const result2 = await authService.validateAccessToken(token);
    expect(result2.isValid).toBe(true);
  });

  it('should reject tokens with future iat (clock skew)', async () => {
    const authService = new AuthService();
    
    // Token issued 5 minutes in the future (clock skew)
    const futureIat = Math.floor(Date.now() / 1000) + 300;
    const token = authService.generateAccessToken('user123', futureIat, 1);
    
    await expect(authService.validateAccessToken(token))
      .rejects
      .toThrow('Token issued in the future');
  });

  it('should allow reasonable clock skew (e.g., 5 minutes)', async () => {
    const authService = new AuthService();
    
    // Token issued 2 minutes in the future (acceptable skew)
    const slightlyFutureIat = Math.floor(Date.now() / 1000) + 120;
    const token = authService.generateAccessToken('user123', slightlyFutureIat, 1);
    
    jest.spyOn(authService, 'findUserById').mockResolvedValue({
      id: 'user123',
      token_version: 1,
      last_logout_timestamp: null
    });
    
    // Should accept with reasonable skew
    await expect(authService.validateAccessToken(token)).resolves.not.toThrow();
  });

  it('should invalidate all tokens on password change', async () => {
    const authService = new AuthService();
    const userRepo = { findOne: jest.fn(), save: jest.fn() };
    authService.userRepo = userRepo;
    
    const userRecord = {
      id: 'user123',
      token_version: 5,
      last_logout_timestamp: 1000
    };
    
    jest.spyOn(userRepo, 'findOne').mockResolvedValue(userRecord);
    
    await authService.changePassword('user123', 'oldPass', 'newPass');
    
    // Should increment token_version AND update last_logout_timestamp
    const savedUser = userRepo.save.mock.calls[0][0];
    expect(savedUser.token_version).toBe(6);
    expect(savedUser.last_logout_timestamp).toBeGreaterThan(1000);
  });

  it('should provide security logging for token revocation events', async () => {
    const authService = new AuthService();
    const logger = { warn: jest.fn() };
    authService.logger = logger;
    
    // Mock token issued before logout
    jest.spyOn(authService, 'findUserById').mockResolvedValue({
      id: 'user123',
      last_logout_timestamp: 1000,
      token_version: 5
    });
    
    const token = authService.generateAccessToken('user123', 900, 5);
    
    try {
      await authService.validateAccessToken(token);
    } catch (error) {
      // Should log security event
      expect(logger.warn).toHaveBeenCalledWith(
        'Access token revoked by logout',
        expect.objectContaining({
          userId: 'user123',
          tokenIat: 900,
          logoutTime: 1000
        })
      );
    }
  });
});
```

**Example TDD for Authentication (UC 9.3/9.4):**
```typescript
describe('Auth Service - Security', () => {
  it('should hash passwords before saving to database', async () => {
    const authService = new AuthService();
    const mockUserRepo = { create: jest.fn(), save: jest.fn() };
    authService.userRepo = mockUserRepo;

    await authService.register('test@test.com', 'PlaintextPassword123!');
    
    const savedUser = mockUserRepo.save.mock.calls[0][0];
    expect(savedUser.password).not.toBe('PlaintextPassword123!');
    expect(savedUser.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt regex
  });

  it('should validate password hashes on login', async () => {
    const authService = new AuthService();
    
    // Mock user with bcrypt hash
    const mockUser = {
      id: 'user123',
      email: 'test@test.com',
      password: '$2b$10$N9qo8uLOickgx2ZMRZoMye.Kj7cF1t7HdHlB7WvRfL6Q4UcJQ5W6a' // hash of 'password123'
    };
    
    jest.spyOn(authService, 'findUserByEmail').mockResolvedValue(mockUser);
    
    const result = await authService.login('test@test.com', 'password123');
    expect(result).toHaveProperty('token');
    expect(result.token).toBeTruthy();
  });

  it('should reject invalid passwords', async () => {
    const authService = new AuthService();
    
    const mockUser = {
      id: 'user123',
      email: 'test@test.com',
      password: '$2b$10$N9qo8uLOickgx2ZMRZoMye.Kj7cF1t7HdHlB7WvRfL6Q4UcJQ5W6a'
    };
    
    jest.spyOn(authService, 'findUserByEmail').mockResolvedValue(mockUser);
    
    await expect(authService.login('test@test.com', 'wrongpassword'))
      .rejects
      .toThrow('Invalid credentials');
  });
});

**Example TDD for Case-Insensitive Email Login (UC 9.12):**
```typescript
describe('Auth Service - Case-Insensitive Email', () => {
  it('should normalize email to lowercase during registration', async () => {
    const authService = new AuthService();
    const mockUserRepo = { create: jest.fn(), save: jest.fn() };
    authService.userRepo = mockUserRepo;

    await authService.register('John.Doe@Example.com', 'Password123!');
    
    const savedUser = mockUserRepo.save.mock.calls[0][0];
    expect(savedUser.email).toBe('john.doe@example.com');
  });

  it('should authenticate user regardless of email case', async () => {
    const authService = new AuthService();
    
    // User registered with 'John.Doe@Example.com'
    const mockUser = {
      id: 'user123',
      email: 'john.doe@example.com', // stored lowercase
      password: '$2b$10$N9qo8uLOickgx2ZMRZoMye.Kj7cF1t7HdHlB7WvRfL6Q4UcJQ5W6a'
    };
    
    jest.spyOn(authService, 'findUserByEmail').mockImplementation(async (email) => {
      // Simulate case-insensitive lookup
      if (email.toLowerCase() === 'john.doe@example.com') {
        return mockUser;
      }
      return null;
    });

    // Login with different case variations
    await expect(authService.login('JOHN.DOE@EXAMPLE.COM', 'password123')).resolves.toHaveProperty('token');
    await expect(authService.login('john.doe@example.com', 'password123')).resolves.toHaveProperty('token');
    await expect(authService.login('John.Doe@Example.com', 'password123')).resolves.toHaveProperty('token');
  });

  it('should prevent duplicate registration with different email cases', async () => {
    const authService = new AuthService();
    
    // First registration with 'user@example.com'
    jest.spyOn(authService, 'findUserByEmail').mockResolvedValue({
      id: 'user123',
      email: 'user@example.com',
      password: 'hashed'
    });

    // Try to register with 'USER@EXAMPLE.COM'
    await expect(authService.register('USER@EXAMPLE.COM', 'Password123!'))
      .rejects
      .toThrow('Email already registered');
  });
});
```

**Example TDD for Session Invalidation on Password Change (UC 9.13):**
```typescript
describe('Auth Service - Session Invalidation', () => {
  it('should increment token_version on password change', async () => {
    const authService = new AuthService();
    const mockUserRepo = { 
      findOne: jest.fn().mockResolvedValue({ id: 'user123', token_version: 1 }),
      save: jest.fn() 
    };
    authService.userRepo = mockUserRepo;

    await authService.changePassword('user123', 'oldPass', 'newPass');
    
    const savedUser = mockUserRepo.save.mock.calls[0][0];
    expect(savedUser.token_version).toBe(2); // Incremented
  });

  it('should reject JWT with outdated token_version', async () => {
    const authService = new AuthService();
    
    // User changed password, token_version incremented from 1 to 2
    const mockUser = { id: 'user123', token_version: 2 };
    jest.spyOn(authService, 'findUserById').mockResolvedValue(mockUser);

    // JWT was issued with token_version: 1
    const oldToken = authService.generateToken('user123', 1);
    
    await expect(authService.validateToken(oldToken))
      .rejects
      .toThrow('Token invalidated - please login again');
  });

  it('should accept JWT with current token_version', async () => {
    const authService = new AuthService();
    
    const mockUser = { id: 'user123', token_version: 2 };
    jest.spyOn(authService, 'findUserById').mockResolvedValue(mockUser);

    // JWT issued with current token_version: 2
    const currentToken = authService.generateToken('user123', 2);
    
    const result = await authService.validateToken(currentToken);
    expect(result.userId).toBe('user123');
    expect(result.isValid).toBe(true);
  });

  it('should invalidate all sessions on password reset', async () => {
    const authService = new AuthService();
    const mockUserRepo = { 
      findOne: jest.fn().mockResolvedValue({ id: 'user123', token_version: 5 }),
      save: jest.fn() 
    };
    authService.userRepo = mockUserRepo;

    // Reset password (no old password required)
    await authService.resetPassword('user123', 'newSecurePass');
    
    const savedUser = mockUserRepo.save.mock.calls[0][0];
    expect(savedUser.token_version).toBe(6); // Incremented, invalidating all sessions
  });
});

**Example TDD for Expired Verification Link & Resend Flow (UC 9.15):**
```typescript
describe('Auth Service - Email Verification Edge Cases', () => {
  it('should reject expired verification tokens', async () => {
    const authService = new AuthService();
    
    // Create token that expired 25 hours ago (beyond 24-hour limit)
    const expiredToken = authService.generateVerificationToken('user123', {
      expiresIn: '-25h' // Already expired
    });
    
    await expect(authService.verifyEmail(expiredToken))
      .rejects
      .toThrow('Verification token expired');
  });

  it('should accept valid verification tokens within 24-hour window', async () => {
    const authService = new AuthService();
    const mockUserRepo = { 
      findOne: jest.fn().mockResolvedValue({ id: 'user123', email_verified: false }),
      save: jest.fn().mockResolvedValue({ id: 'user123', email_verified: true })
    };
    authService.userRepo = mockUserRepo;
    
    // Create valid token
    const validToken = authService.generateVerificationToken('user123', {
      expiresIn: '24h'
    });
    
    const result = await authService.verifyEmail(validToken);
    
    expect(result.success).toBe(true);
    expect(result.user.email_verified).toBe(true);
  });

  it('should rate limit verification email resend requests', async () => {
    const authService = new AuthService();
    
    // Mock rate limiter
    const mockLimiter = {
      check: jest.fn()
        .mockResolvedValueOnce(true)  // First request allowed
        .mockResolvedValueOnce(true)  // Second request allowed
        .mockResolvedValueOnce(false) // Third request blocked (rate limited)
    };
    authService.rateLimiter = mockLimiter;
    
    // First two resend requests should succeed
    await expect(authService.resendVerificationEmail('user123')).resolves.not.toThrow();
    await expect(authService.resendVerificationEmail('user123')).resolves.not.toThrow();
    
    // Third request should be rate limited
    await expect(authService.resendVerificationEmail('user123'))
      .rejects
      .toThrow('Please wait before requesting another verification email');
  });

  it('should generate fresh token when resending verification email', async () => {
    const authService = new AuthService();
    const mockUserRepo = {
      findOne: jest.fn().mockResolvedValue({ 
        id: 'user123', 
        email: 'test@example.com',
        email_verified: false 
      })
    };
    authService.userRepo = mockUserRepo;
    
    // Mock email service
    const mockEmailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(true)
    };
    authService.emailService = mockEmailService;
    
    const result = await authService.resendVerificationEmail('user123');
    
    expect(result.success).toBe(true);
    expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.stringContaining('token=') // Should contain fresh token
    );
  });

  it('should prevent resending verification to already verified accounts', async () => {
    const authService = new AuthService();
    const mockUserRepo = {
      findOne: jest.fn().mockResolvedValue({ 
        id: 'user123', 
        email: 'test@example.com',
        email_verified: true // Already verified
      })
    };
    authService.userRepo = mockUserRepo;
    
    await expect(authService.resendVerificationEmail('user123'))
      .rejects
      .toThrow('Email already verified');
  });
});

**Example TDD for Secure Email Change (UC 9.16):**
```typescript
describe('Auth Service - Secure Email Change', () => {
  it('should send verification link to new email before updating', async () => {
    const authService = new AuthService();
    const emailService = { sendEmailChangeVerification: jest.fn().mockResolvedValue(true) };
    const userRepo = { findOne: jest.fn(), save: jest.fn() };
    
    authService.emailService = emailService;
    authService.userRepo = userRepo;
    
    // Mock existing user
    jest.spyOn(userRepo, 'findOne').mockResolvedValue({
      id: 'user123',
      email: 'old@example.com',
      email_verified: true
    });
    
    await authService.initiateEmailChange('user123', 'new@example.com');
    
    // Should send verification to NEW email
    expect(emailService.sendEmailChangeVerification).toHaveBeenCalledWith(
      'new@example.com',
      expect.stringContaining('token=') // Verification token
    );
    
    // Should NOT update email in database yet
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('should send security notice to old email', async () => {
    const authService = new AuthService();
    const emailService = {
      sendEmailChangeVerification: jest.fn().mockResolvedValue(true),
      sendSecurityNotice: jest.fn().mockResolvedValue(true)
    };
    
    authService.emailService = emailService;
    
    jest.spyOn(authService.userRepo, 'findOne').mockResolvedValue({
      id: 'user123',
      email: 'old@example.com'
    });
    
    await authService.initiateEmailChange('user123', 'new@example.com');
    
    // Should send security notice to OLD email
    expect(emailService.sendSecurityNotice).toHaveBeenCalledWith(
      'old@example.com',
      'Email change requested',
      expect.stringContaining('new@example.com')
    );
  });

  it('should only update email after verification token is confirmed', async () => {
    const authService = new AuthService();
    const userRepo = { findOne: jest.fn(), save: jest.fn() };
    authService.userRepo = userRepo;
    
    // Mock pending email change
    const pendingChange = {
      userId: 'user123',
      newEmail: 'new@example.com',
      token: 'verification-token-123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    
    jest.spyOn(authService, 'validateEmailChangeToken').mockResolvedValue(pendingChange);
    jest.spyOn(userRepo, 'findOne').mockResolvedValue({
      id: 'user123',
      email: 'old@example.com'
    });
    
    await authService.confirmEmailChange('verification-token-123');
    
    // Should update email in database
    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user123',
      email: 'new@example.com',
      email_verified: true // Should re-verify new email
    }));
  });

  it('should reject expired email change tokens', async () => {
    const authService = new AuthService();
    
    // Mock expired token
    const expiredChange = {
      userId: 'user123',
      newEmail: 'new@example.com',
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 1) // Already expired
    };
    
    jest.spyOn(authService, 'validateEmailChangeToken').mockResolvedValue(expiredChange);
    
    await expect(authService.confirmEmailChange('expired-token'))
      .rejects
      .toThrow('Email change token expired');
  });

  it('should prevent email change to already registered email', async () => {
    const authService = new AuthService();
    
    // Mock that new email is already taken
    jest.spyOn(authService, 'findUserByEmail').mockResolvedValue({
      id: 'other-user',
      email: 'new@example.com'
    });
    
    await expect(authService.initiateEmailChange('user123', 'new@example.com'))
      .rejects
      .toThrow('Email already registered');
  });

  it('should invalidate all sessions after email change', async () => {
    const authService = new AuthService();
    const userRepo = { findOne: jest.fn(), save: jest.fn() };
    authService.userRepo = userRepo;
    
    // Mock user with token_version
    jest.spyOn(userRepo, 'findOne').mockResolvedValue({
      id: 'user123',
      email: 'old@example.com',
      token_version: 5
    });
    
    jest.spyOn(authService, 'validateEmailChangeToken').mockResolvedValue({
      userId: 'user123',
      newEmail: 'new@example.com',
      token: 'valid-token'
    });
    
    await authService.confirmEmailChange('valid-token');
    
    // Should increment token_version to invalidate all sessions
    const savedUser = userRepo.save.mock.calls[0][0];
    expect(savedUser.token_version).toBe(6); // Incremented
  });

  it('should allow canceling pending email change', async () => {
    const authService = new AuthService();
    
    // Mock pending change exists
    jest.spyOn(authService, 'getPendingEmailChange').mockResolvedValue({
      userId: 'user123',
      newEmail: 'new@example.com',
      token: 'pending-token'
    });
    
    const deleteSpy = jest.spyOn(authService, 'deletePendingEmailChange').mockResolvedValue(true);
    
    await authService.cancelEmailChange('user123');
    
    expect(deleteSpy).toHaveBeenCalledWith('user123');
  });
});
```

**Example TDD for Mock Auth Bypass (ENABLE_MOCK_AUTH=true):**
```typescript
describe('Auth Guard - Mock Authentication Bypass', () => {
  it('should auto-inject mock user when ENABLE_MOCK_AUTH=true', async () => {
    const authGuard = new JwtAuthGuard();
    
    // Set mock auth environment variable
    process.env.ENABLE_MOCK_AUTH = 'true';
    process.env.MOCK_USER_EMAIL = 'mock@test.com';
    process.env.MOCK_USER_ID = 'mock-user-uuid';
    
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {} // No auth header
        })
      }),
      getHandler: () => ({}),
      getClass: () => ({})
    };
    
    // Should allow request and inject mock user
    const canActivate = await authGuard.canActivate(mockExecutionContext as any);
    
    expect(canActivate).toBe(true);
    
    // Verify mock user is injected
    const request = mockExecutionContext.switchToHttp().getRequest();
    expect(request.user).toBeDefined();
    expect(request.user.email).toBe('mock@test.com');
    expect(request.user.id).toBe('mock-user-uuid');
  });

  it('should respect @Public() decorator even with mock auth enabled', async () => {
    const authGuard = new JwtAuthGuard();
    
    process.env.ENABLE_MOCK_AUTH = 'true';
    
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} })
      }),
      getHandler: () => ({
        // Handler has @Public() decorator
        [PUBLIC_METADATA_KEY]: true
      }),
      getClass: () => ({})
    };
    
    const canActivate = await authGuard.canActivate(mockExecutionContext as any);
    
    // Should allow public endpoints without injecting mock user
    expect(canActivate).toBe(true);
    
    const request = mockExecutionContext.switchToHttp().getRequest();
    expect(request.user).toBeUndefined(); // No mock user for public endpoints
  });

  it('should use real JWT authentication when ENABLE_MOCK_AUTH=false', async () => {
    const authGuard = new JwtAuthGuard();
    const jwtService = new JwtService({ secret: 'test-secret' });
    
    authGuard.jwtService = jwtService;
    
    process.env.ENABLE_MOCK_AUTH = 'false';
    
    const validToken = jwtService.sign({ userId: 'real-user-123' });
    
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: `Bearer ${validToken}` }
        })
      }),
      getHandler: () => ({}),
      getClass: () => ({})
    };
    
    const canActivate = await authGuard.canActivate(mockExecutionContext as any);
    
    expect(canActivate).toBe(true);
    
    // Should use real JWT user, not mock user
    const request = mockExecutionContext.switchToHttp().getRequest();
    expect(request.user.userId).toBe('real-user-123');
    expect(request.user.email).not.toBe('mock@test.com');
  });

  it('should reject requests without auth when mock auth is disabled', async () => {
    const authGuard = new JwtAuthGuard();
    
    process.env.ENABLE_MOCK_AUTH = 'false';
    
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {} // No auth header
        })
      }),
      getHandler: () => ({}),
      getClass: () => ({})
    };
    
    await expect(authGuard.canActivate(mockExecutionContext as any))
      .rejects
      .toThrow('Unauthorized');
  });

  it('should allow configuration of mock user via environment variables', async () => {
    const authGuard = new JwtAuthGuard();
    
    // Custom mock user configuration
    process.env.ENABLE_MOCK_AUTH = 'true';
    process.env.MOCK_USER_EMAIL = 'custom@test.com';
    process.env.MOCK_USER_ID = 'custom-uuid-123';
    process.env.MOCK_USER_NAME = 'Custom Test User';
    
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} })
      }),
      getHandler: () => ({}),
      getClass: () => ({})
    };
    
    await authGuard.canActivate(mockExecutionContext as any);
    
    const request = mockExecutionContext.switchToHttp().getRequest();
    expect(request.user.email).toBe('custom@test.com');
    expect(request.user.id).toBe('custom-uuid-123');
    expect(request.user.name).toBe('Custom Test User');
  });

  it('should log mock auth usage for security auditing', async () => {
    const authGuard = new JwtAuthGuard();
    const logger = { warn: jest.fn() };
    authGuard.logger = logger;
    
    process.env.ENABLE_MOCK_AUTH = 'true';
    
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          ip: '127.0.0.1',
          method: 'GET',
          url: '/api/inventory'
        })
      }),
      getHandler: () => ({}),
      getClass: () => ({})
    };
    
    await authGuard.canActivate(mockExecutionContext as any);
    
    // Should log security warning about mock auth usage
    expect(logger.warn).toHaveBeenCalledWith(
      'Mock authentication enabled',
      expect.objectContaining({
        ip: '127.0.0.1',
        endpoint: '/api/inventory',
        mockUser: 'mock@test.com'
      })
    );
  });

  it('should disable certain security features when mock auth is enabled', async () => {
    const authGuard = new JwtAuthGuard();
    
    process.env.ENABLE_MOCK_AUTH = 'true';
    
    // Mock rate limiter - should be disabled for mock auth
    const mockRateLimiter = {
      consume: jest.fn()
    };
    authGuard.rateLimiter = mockRateLimiter;
    
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} })
      }),
      getHandler: () => ({}),
      getClass: () => ({})
    };
    
    await authGuard.canActivate(mockExecutionContext as any);
    
    // Rate limiter should NOT be called for mock auth
    expect(mockRateLimiter.consume).not.toHaveBeenCalled();
  });

  it('should work with SeederService integration for MVP testing', async () => {
    const authGuard = new JwtAuthGuard();
    const seederService = new SeederService();
    
    authGuard.seederService = seederService;
    
    process.env.ENABLE_MOCK_AUTH = 'true';
    
    // Mock seeder service to ensure mock user exists
    const ensureMockUserSpy = jest.spyOn(seederService, 'ensureMockUserExists')
      .mockResolvedValue({
        id: 'seeder-mock-uuid',
        email: 'seeder@test.com'
      });
    
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} })
      }),
      getHandler: () => ({}),
      getClass: () => ({})
    };
    
    await authGuard.canActivate(mockExecutionContext as any);
    
    // Should ensure mock user exists in database
    expect(ensureMockUserSpy).toHaveBeenCalled();
    
    const request = mockExecutionContext.switchToHttp().getRequest();
    expect(request.user.id).toBe('seeder-mock-uuid');
  });

  it('should validate mock auth configuration at application startup', () => {
    // This test would be in app configuration
    process.env.ENABLE_MOCK_AUTH = 'true';
    process.env.NODE_ENV = 'production'; // Mock auth in production is dangerous!
    
    expect(() => {
      if (process.env.ENABLE_MOCK_AUTH === 'true' && process.env.NODE_ENV === 'production') {
        throw new Error('Mock authentication cannot be enabled in production environment');
      }
    }).toThrow('Mock authentication cannot be enabled in production environment');
  });

  it('should allow gradual transition from mock auth to real auth', async () => {
    const authGuard = new JwtAuthGuard();
    
    // Test mixed mode: some endpoints use mock, some use real auth
    process.env.ENABLE_MOCK_AUTH = 'true';
    
    const mockEndpoints = ['/api/inventory', '/api/cocktails'];
    const realAuthEndpoints = ['/api/admin', '/api/billing'];
    
    // Simulate request to mock endpoint
    const mockRequestContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          url: '/api/inventory'
        })
      }),
      getHandler: () => ({}),
      getClass: () => ({})
    };
    
    const mockResult = await authGuard.canActivate(mockRequestContext as any);
    expect(mockResult).toBe(true);
    
    // Simulate request to real auth endpoint (with token)
    const jwtService = new JwtService({ secret: 'test-secret' });
    authGuard.jwtService = jwtService;
    
    const realAuthContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer valid-token' },
          url: '/api/admin'
        })
      }),
      getHandler: () => ({}),
      getClass: () => ({})
    };
    
    // Should attempt real JWT validation even with mock auth enabled
    // (implementation would check endpoint or use metadata)
    await expect(authGuard.canActivate(realAuthContext as any))
      .rejects
      .toThrow(); // Invalid token
  });
});
```

**Example TDD for RolesGuard - RBAC (UC 9.18):**
```typescript
describe('RolesGuard - RBAC', () => {
  it('should block non-admin users from promoting ingredients', async () => {
    const rolesGuard = new RolesGuard(new Reflector());
    
    const mockContext = {
      getHandler: () => ({}), // Assume @Roles('admin') is set
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user123', role: 'user' } // Normal user
        })
      })
    };
    
    // Guard should throw or return false
    expect(() => rolesGuard.canActivate(mockContext as any)).toThrow('Forbidden');
  });

  it('should allow admin users to access admin-only endpoints', async () => {
    const rolesGuard = new RolesGuard(new Reflector());
    
    // Mock @Roles('admin') decorator
    const reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
    
    const mockContext = {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'admin123', role: 'admin' } // Admin user
        })
      })
    };
    
    rolesGuard.reflector = reflector;
    
    const result = rolesGuard.canActivate(mockContext as any);
    expect(result).toBe(true);
  });

  it('should handle endpoints with multiple allowed roles', async () => {
    const rolesGuard = new RolesGuard(new Reflector());
    const reflector = new Reflector();
    
    // Endpoint allows both 'admin' and 'moderator'
    jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'moderator']);
    
    const mockContext = {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'mod123', role: 'moderator' } // Moderator user
        })
      })
    };
    
    rolesGuard.reflector = reflector;
    
    const result = rolesGuard.canActivate(mockContext as any);
    expect(result).toBe(true);
  });

  it('should handle endpoints without role decorator (allow all authenticated users)', async () => {
    const rolesGuard = new RolesGuard(new Reflector());
    const reflector = new Reflector();
    
    // No @Roles decorator on endpoint
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    
    const mockContext = {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user123', role: 'user' } // Any authenticated user
        })
      })
    };
    
    rolesGuard.reflector = reflector;
    
    const result = rolesGuard.canActivate(mockContext as any);
    expect(result).toBe(true);
  });

  it('should reject unauthenticated requests to role-protected endpoints', async () => {
    const rolesGuard = new RolesGuard(new Reflector());
    const reflector = new Reflector();
    
    jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
    
    const mockContext = {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: null // No user (unauthenticated)
        })
      })
    };
    
    rolesGuard.reflector = reflector;
    
    expect(() => rolesGuard.canActivate(mockContext as any)).toThrow('Unauthorized');
  });

  it('should log admin actions for audit trail', async () => {
    const rolesGuard = new RolesGuard(new Reflector());
    const logger = { info: jest.fn() };
    rolesGuard.logger = logger;
    
    const reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue(['admin']);
    
    const mockContext = {
      getHandler: () => ({ name: 'promoteIngredient' }),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'admin123', role: 'admin', email: 'admin@example.com' },
          method: 'PATCH',
          url: '/api/ingredients/123/promote',
          ip: '192.168.1.1'
        })
      })
    };
    
    rolesGuard.reflector = reflector;
    
    await rolesGuard.canActivate(mockContext as any);
    
    expect(logger.info).toHaveBeenCalledWith(
      'Admin action performed',
      expect.objectContaining({
        userId: 'admin123',
        userEmail: 'admin@example.com',
        action: 'promoteIngredient',
        endpoint: '/api/ingredients/123/promote',
        method: 'PATCH',
        ip: '192.168.1.1'
      })
    );
  });

  it('should work with class-level role decorators', async () => {
    const rolesGuard = new RolesGuard(new Reflector());
    const reflector = new Reflector();
    
    // Class has @Roles('admin') decorator
    jest.spyOn(reflector, 'get')
      .mockImplementation((key, target) => {
        if (key === 'roles') {
          // Check handler first, then class
          if (target === mockContext.getHandler()) {
            return undefined; // No handler decorator
          }
          if (target === mockContext.getClass()) {
            return ['admin']; // Class has decorator
          }
        }
        return undefined;
      });
    
    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'admin123', role: 'admin' }
        })
      })
    };
    
    rolesGuard.reflector = reflector;
    
    const result = rolesGuard.canActivate(mockContext as any);
    expect(result).toBe(true);
  });

  it('should prioritize handler decorator over class decorator', async () => {
    const rolesGuard = new RolesGuard(new Reflector());
    const reflector = new Reflector();
    
    // Class: @Roles('admin'), Handler: @Roles('moderator')
    jest.spyOn(reflector, 'get')
      .mockImplementation((key, target) => {
        if (key === 'roles') {
          if (target === mockContext.getHandler()) {
            return ['moderator']; // Handler decorator takes priority
          }
          if (target === mockContext.getClass()) {
            return ['admin']; // Class decorator
          }
        }
        return undefined;
      });
    
    const mockContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'mod123', role: 'moderator' } // Moderator can access
        })
      })
    };
    
    rolesGuard.reflector = reflector;
    
    const result = rolesGuard.canActivate(mockContext as any);
    expect(result).toBe(true);
  });

  it('should handle inheritance of role decorators', async () => {
    const rolesGuard = new RolesGuard(new Reflector());
    const reflector = new Reflector();
    
    // Parent class has @Roles('admin'), child class inherits
    const parentClass = class ParentController {
      static roles = ['admin'];
    };
    
    const childClass = class ChildController extends ParentController {};
    
    jest.spyOn(reflector, 'get')
      .mockImplementation((key, target) => {
        if (key === 'roles' && target === childClass) {
          // Should inherit from parent
          return ['admin'];
        }
        return undefined;
      });
    
    const mockContext = {
      getHandler: () => ({}),
      getClass: () => childClass,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'admin123', role: 'admin' }
        })
      })
    };
    
    rolesGuard.reflector = reflector;
    
    const result = rolesGuard.canActivate(mockContext as any);
    expect(result).toBe(true);
  });
});

**Example TDD for GDPR Data Export & Account Deletion (UC 9.9 & 9.20):**
```typescript
describe('User Service - GDPR & Account Deletion', () => {
  it('should anonymize public cocktails when user deletes account', async () => {
    const userService = new UserService();
    // Mock user has 1 public and 1 private cocktail
    jest.spyOn(userService.cocktailRepo, 'update').mockResolvedValue({} as any);
    jest.spyOn(userService.cocktailRepo, 'delete').mockResolvedValue({} as any);
    
    await userService.deleteAccount('user123');
    
    // Public cocktails should have created_by set to NULL (anonymized)
    expect(userService.cocktailRepo.update).toHaveBeenCalledWith(
      { created_by: 'user123', is_public: true },
      { created_by: null }
    );
    // Private cocktails should be hard deleted
    expect(userService.cocktailRepo.delete).toHaveBeenCalledWith(
      { created_by: 'user123', is_public: false }
    );
  });

  it('should aggregate all user data into standardized JSON for GDPR export', async () => {
    const userService = new UserService();
    jest.spyOn(userService.inventoryRepo, 'find').mockResolvedValue([{ ingredient: 'Vodka', quantity: 500 }]);
    jest.spyOn(userService.favoritesRepo, 'find').mockResolvedValue([{ cocktailId: '123' }]);
    
    const exportData = await userService.exportUserData('user123');
    
    expect(exportData).toHaveProperty('profile');
    expect(exportData).toHaveProperty('inventory');
    expect(exportData).toHaveProperty('favorites');
    expect(exportData).toHaveProperty('custom_cocktails');
    expect(exportData.export_date).toBeDefined();
  });
});
```
```
```