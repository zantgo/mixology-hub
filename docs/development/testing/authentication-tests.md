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
```
```
```