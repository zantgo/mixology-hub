# Security Tests

*Note: Security tests are covered in other domain-specific test files:*
- **Prompt injection defense**: See `ai-bartender-tests.md`
- **XSS prevention**: Implementation-specific tests would be added here
- **SQL injection prevention**: Covered by TypeORM's parameterized queries (implicit)
- **Rate limiting**: See `ai-bartender-tests.md` for AI rate limiting examples

**Example structure for XSS prevention tests:**
```typescript
describe('InputSanitizerService - XSS Prevention', () => {
  it('should strip script tags from user input', () => {
    const sanitizer = new InputSanitizerService();
    
    const maliciousInput = 'My Cocktail<script>alert("xss")</script>';
    const sanitized = sanitizer.sanitize(maliciousInput);
    
    expect(sanitized).toBe('My Cocktail');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert');
  });
  
  it('should escape HTML entities in user input', () => {
    const sanitizer = new InputSanitizerService();
    
    const input = 'Cocktail & Tonic';
    const sanitized = sanitizer.sanitize(input);
    
    expect(sanitized).toBe('Cocktail &amp; Tonic');
  });
});

**Example structure for CSRF protection tests (Refresh Token endpoint only):**
```typescript
describe('CSRF Protection - Refresh Token Endpoint', () => {
  it('should block POST /auth/refresh requests missing the X-CSRF-Token header', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['refresh_token=valid_refresh_token'])
      // Intentionally omitting CSRF header
      .send();
      
    expect(response.status).toBe(403);
    expect(response.body.message).toContain('CSRF token mismatch');
  });
  
  it('should allow POST /auth/refresh with valid CSRF token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['refresh_token=valid_refresh_token'])
      .set('X-CSRF-Token', 'valid_csrf_token')
      .send();
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('access_token');
  });
});
```

**Example TDD for Rate Limiting Custom Cocktail Creation (UC 2.16):**
```typescript
describe('Cocktail Service - Rate Limiting', () => {
  it('should block excessive custom cocktail creation requests', async () => {
    const cocktailService = new CocktailService();
    
    // Mock rate limiter that blocks after 5 requests
    const mockLimiter = {
      check: jest.fn()
        .mockResolvedValueOnce(true)  // 1st request
        .mockResolvedValueOnce(true)  // 2nd request
        .mockResolvedValueOnce(true)  // 3rd request
        .mockResolvedValueOnce(true)  // 4th request
        .mockResolvedValueOnce(true)  // 5th request
        .mockResolvedValueOnce(false) // 6th request - blocked
    };
    cocktailService.rateLimiter = mockLimiter;
    
    // First 5 requests should succeed
    for (let i = 0; i < 5; i++) {
      await expect(cocktailService.createCustomCocktail('user123', { name: `Cocktail ${i}` }))
        .resolves.not.toThrow();
    }
    
    // 6th request should be rate limited
    await expect(cocktailService.createCustomCocktail('user123', { name: 'Cocktail 6' }))
      .rejects
      .toThrow('Rate limit exceeded');
  });

  it('should apply different rate limits for different endpoints', async () => {
    const cocktailService = new CocktailService();
    
    // Mock different limiters for different endpoints
    const creationLimiter = { check: jest.fn().mockResolvedValue(false) }; // Blocked
    const searchLimiter = { check: jest.fn().mockResolvedValue(true) }; // Allowed
    
    cocktailService.creationLimiter = creationLimiter;
    cocktailService.searchLimiter = searchLimiter;
    
    // Creation should be blocked
    await expect(cocktailService.createCustomCocktail('user123', { name: 'Test' }))
      .rejects
      .toThrow('Rate limit exceeded');
    
    // Search should still be allowed
    await expect(cocktailService.searchCocktails('test')).resolves.not.toThrow();
  });

  it('should reset rate limit after time window expires', async () => {
    const cocktailService = new CocktailService();
    
    const mockLimiter = {
      check: jest.fn()
        .mockResolvedValueOnce(false) // Initially blocked
        .mockResolvedValueOnce(true), // Allowed after reset
    };
    cocktailService.rateLimiter = mockLimiter;
    
    // First attempt - blocked
    await expect(cocktailService.createCustomCocktail('user123', { name: 'Test' }))
      .rejects
      .toThrow('Rate limit exceeded');
    
    // Simulate time passing (61 seconds)
    jest.advanceTimersByTime(61 * 1000);
    
    // Second attempt - should succeed after reset
    await expect(cocktailService.createCustomCocktail('user123', { name: 'Test 2' }))
      .resolves.not.toThrow();
  });
});
```

**Example TDD for Refresh Token Reuse Detection (UC 9.14):**
```typescript
describe('Auth Service - Refresh Token Security', () => {
  it('should detect refresh token reuse and invalidate token family', async () => {
    const authService = new AuthService();
    
    // User has active refresh token
    const validRefreshToken = 'valid-refresh-token';
    const tokenFamily = 'token-family-123';
    
    // Mock token validation
    jest.spyOn(authService, 'validateRefreshToken').mockResolvedValue({
      userId: 'user123',
      tokenFamily,
      isRevoked: false
    });
    
    // First use - should succeed
    const firstResult = await authService.refreshAccessToken(validRefreshToken);
    expect(firstResult).toHaveProperty('accessToken');
    
    // Simulate attacker using same refresh token
    // Mock that token was already used (isRevoked: true)
    jest.spyOn(authService, 'validateRefreshToken').mockResolvedValue({
      userId: 'user123',
      tokenFamily,
      isRevoked: true // Token was already used!
    });
    
    // Second use - should detect reuse
    await expect(authService.refreshAccessToken(validRefreshToken))
      .rejects
      .toThrow('Security alert: Token reuse detected');
    
    // Verify token family was invalidated
    const mockInvalidate = jest.spyOn(authService, 'invalidateTokenFamily');
    expect(mockInvalidate).toHaveBeenCalledWith('user123', tokenFamily);
  });

  it('should force password re-authentication after token reuse detection', async () => {
    const authService = new AuthService();
    
    // Mock token reuse detection
    jest.spyOn(authService, 'validateRefreshToken').mockRejectedValue(
      new Error('Security alert: Token reuse detected')
    );
    
    // Mock user needs to re-authenticate
    jest.spyOn(authService, 'requirePasswordReauth').mockResolvedValue(true);
    
    const refreshToken = 'compromised-token';
    
    await expect(authService.refreshAccessToken(refreshToken))
      .rejects
      .toThrow('Security alert: Please login with your password');
    
    // Verify all tokens for user were invalidated
    const mockInvalidateAll = jest.spyOn(authService, 'invalidateAllUserTokens');
    expect(mockInvalidateAll).toHaveBeenCalledWith('user123');
  });

  it('should allow normal refresh token rotation', async () => {
    const authService = new AuthService();
    
    // Valid refresh token usage
    const oldRefreshToken = 'old-refresh-token';
    const tokenFamily = 'token-family-456';
    
    jest.spyOn(authService, 'validateRefreshToken').mockResolvedValue({
      userId: 'user123',
      tokenFamily,
      isRevoked: false
    });
    
    // Mock token rotation (issue new refresh token, revoke old)
    const mockRotate = jest.spyOn(authService, 'rotateRefreshToken')
      .mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });
    
    const result = await authService.refreshAccessToken(oldRefreshToken);
    
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(mockRotate).toHaveBeenCalledWith('user123', tokenFamily, oldRefreshToken);
  });
});

**Example TDD for IDOR Prevention in Cocktail Preparation:**
```typescript
describe('IDOR Prevention - Cocktail Preparation', () => {
  it('should prevent User A from preparing cocktails using User B\'s preparation log', async () => {
    // Setup: User A and User B have different preparation logs
    const userA = { id: 'user-a', email: 'a@test.com' };
    const userB = { id: 'user-b', email: 'b@test.com' };
    
    const preparationLogRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'log-123',
        user_id: 'user-b', // This log belongs to User B
        cocktail_id: 'cocktail-456',
        created_at: new Date()
      })
    };

    const preparationService = new PreparationService();
    preparationService.preparationLogRepo = preparationLogRepo;

    // User A attempts to undo User B's preparation
    await expect(
      preparationService.undoPreparation('log-123', userA.id)
    ).rejects.toThrow('Unauthorized');

    expect(preparationLogRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'log-123' }
    });
  });

  it('should allow users to undo their own preparations', async () => {
    const user = { id: 'user-123', email: 'user@test.com' };
    
    const preparationLogRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'log-123',
        user_id: 'user-123', // This log belongs to the same user
        cocktail_id: 'cocktail-456',
        created_at: new Date()
      }),
      save: jest.fn().mockResolvedValue({ id: 'log-123', undone: true })
    };

    const inventoryService = {
      restoreFromPreparation: jest.fn().mockResolvedValue(undefined)
    };

    const preparationService = new PreparationService();
    preparationService.preparationLogRepo = preparationLogRepo;
    preparationService.inventoryService = inventoryService;

    // User should be able to undo their own preparation
    const result = await preparationService.undoPreparation('log-123', user.id);

    expect(result).toHaveProperty('undone', true);
    expect(inventoryService.restoreFromPreparation).toHaveBeenCalled();
  });
});
```
```