# ADR 0010: Offline Logout Impeding JWT Revocation Gap

## Status
Accepted

## Context
The offline sync system (UC 12.11) allows users to queue operations while offline and log out. However, when a device is offline:

1. **Frontend Logout**: User clicks logout, frontend clears local storage/auth state
2. **Backend Unreachable**: `POST /auth/logout` HTTP call fails (no network)
3. **Token Still Valid**: Refresh token remains active in `REFRESH_TOKENS` table
4. **Security Gap**: Session remains valid server-side until natural expiration (7 days)

This creates a security vulnerability where:
- User believes they've logged out
- Token remains usable if intercepted/stolen
- Attacker has window of opportunity until token expires
- Particularly risky on shared/public devices

## Decision
Accept this security gap as a necessary trade-off for offline functionality with the following mitigations:

1. **Clear User Communication**: Inform users about the limitation
2. **Short Token Expiry**: Default 24-hour refresh token expiry (not 7 days)
3. **Device-Specific Tokens**: Each device gets unique token, limiting blast radius
4. **Re-authentication Required**: Sensitive operations require fresh authentication
5. **Monitoring**: Track offline logout attempts for security analysis

### Implementation
```typescript
// Frontend logout with offline awareness
@Injectable()
export class AuthService {
  async logout(): Promise<void> {
    // 1. Clear local state immediately
    this.clearLocalAuthState();
    
    // 2. Try to notify backend (best effort)
    try {
      await this.http.post('/auth/logout').toPromise();
      this.ui.showMessage('Successfully logged out');
    } catch (error) {
      if (this.networkService.isOffline()) {
        // Offline - show warning about limitation
        this.ui.showWarning(
          'Logged out locally, but session may still be active on server. ' +
          'For complete security, please log out again when online.'
        );
        
        // Store pending logout for when back online
        this.offlineQueue.addLogoutOperation();
      } else {
        // Online but error - different handling
        this.ui.showError('Logout failed. Please try again.');
      }
    }
    
    // 3. Navigate to login page
    this.router.navigate(['/login']);
  }
  
  private clearLocalAuthState(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    this.authState.set(null);
  }
}
```

## Consequences

### Positive
- **Offline Usability**: Users can logout while offline (local state cleared)
- **Simple Implementation**: No complex synchronization needed
- **Predictable Behavior**: Clear user experience with warnings
- **Progressive Enhancement**: Works offline, better online

### Negative
- **Security Gap**: Tokens remain valid until expiration
- **User Confusion**: Users may believe they're fully logged out
- **Shared Device Risk**: Public/shared devices remain vulnerable
- **False Sense of Security**: Users may take less care with device security

### Architectural Trade-off: Stateless JWT Vulnerability Window
**Explicit Trade-off:** Access Tokens are standard, stateless JWTs that cannot be immediately revoked without a Redis blocklist (which we don't implement for Access Tokens). This creates a vulnerability window where:

1. **Immediate Revocation Impossible**: If a user logs out on a public computer, their Access Token remains valid for its remaining lifespan (15 minutes).
2. **Attack Vector**: An attacker could extract the token from browser memory and make API calls until it expires.
3. **Performance vs. Security**: We trade absolute immediate revocation for zero-latency authentication checks (avoiding Redis lookup on every API call).

**Acceptance Rationale:**
- **Short Lifespan**: 15-minute Access Token expiry limits the attack window
- **Refresh Token Protection**: Refresh tokens ARE revocable (database-backed) and have shorter 24-hour expiry
- **Sensitive Operations**: Critical operations (password change, email update) require re-authentication
- **Practical Risk**: The effort to extract tokens from memory vs. reward (access to cocktail app) makes this an acceptable risk for MVP

**Mitigation Strategy:**
- Monitor for suspicious patterns (rapid token usage from new IPs)
- Implement token versioning to invalidate all tokens on password change
- Consider Redis blocklist for Phase 2 if security requirements increase

## Alternatives Considered

### 1. Block Offline Logout
- **Pros**: No security gap
- **Cons**: Poor UX, users trapped in app when offline
- **Decision**: Rejected - worse than security gap

### 2. Queue Logout for Later Sync
- **Pros**: Eventually consistent logout
- **Cons**: Complex sync logic, still has window of vulnerability
- **Decision**: Rejected - complexity outweighs benefit

### 3. Very Short Token Expiry (1 hour)
- **Pros**: Limits window of vulnerability
- **Cons**: Poor UX, frequent re-authentication
- **Decision**: Partially adopted - 24 hours not 7 days

### 4. Client-Side Token Invalidation
- **Pros**: Immediate local invalidation
- **Cons**: Server doesn't know, token still works from other devices
- **Decision**: Already implemented (local storage clear)

## Mitigation Strategies

### 1. User Education
```typescript
// Clear warnings about offline logout limitations
@Component({
  template: `
    <div *ngIf="showOfflineWarning" class="security-warning">
      <h3>⚠️ Offline Logout Notice</h3>
      <p>
        You have logged out while offline. Your session has been cleared from this device,
        but <strong>may still be active on the server</strong> until the token expires
        (24 hours) or you log out again when online.
      </p>
      <p>
        <strong>For shared devices:</strong> Consider changing your password when back online
        to fully invalidate all sessions.
      </p>
      <button (click)="dismissWarning()">I Understand</button>
    </div>
  `
})
class LogoutComponent {
  showOfflineWarning = false;
  
  constructor(private networkService: NetworkService) {}
  
  async logout() {
    if (this.networkService.isOffline()) {
      this.showOfflineWarning = true;
    }
    // ... rest of logout logic
  }
}
```

### 2. Token Expiry Reduction
```typescript
// Shorter default token expiry for MVP
@Injectable()
export class TokenService {
  // 24 hours instead of 7 days for MVP
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 1;
  private readonly ACCESS_TOKEN_EXPIRY_MINUTES = 15;
  
  generateRefreshToken(userId: string): string {
    const payload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * this.REFRESH_TOKEN_EXPIRY_DAYS),
      jti: uuidv4(), // Unique token ID for revocation
      device: this.getDeviceFingerprint() // Device-specific
    };
    
    return jwt.sign(payload, this.refreshSecret);
  }
}
```

### 3. Sensitive Operation Re-authentication
```typescript
// Critical operations require fresh auth even with valid token
@Injectable()
export class SecurityService {
  async requireFreshAuth(operation: string): Promise<boolean> {
    const lastAuth = await this.getLastAuthenticationTime();
    const now = new Date();
    const hoursSinceAuth = (now.getTime() - lastAuth.getTime()) / (1000 * 60 * 60);
    
    // Require re-auth for sensitive operations if > 1 hour since last auth
    const sensitiveOperations = [
      'change_password',
      'update_email',
      'delete_account',
      'export_data'
    ];
    
    if (sensitiveOperations.includes(operation) && hoursSinceAuth > 1) {
      await this.forceReauthentication();
      return false;
    }
    
    return true;
  }
}
```

### 4. Security Monitoring
```typescript
// Track offline logout patterns
@Injectable()
export class SecurityMonitorService {
  async trackLogoutEvent(
    userId: string,
    wasOffline: boolean,
    deviceId: string
  ): Promise<void> {
    await this.auditRepo.save({
      event: 'logout',
      userId,
      wasOffline,
      deviceId,
      timestamp: new Date(),
      ipAddress: this.getClientIp()
    });
    
    // Alert on suspicious patterns
    if (wasOffline) {
      const offlineLogoutCount = await this.getOfflineLogoutCount(userId, '24h');
      
      if (offlineLogoutCount > 5) {
        this.alertService.sendAlert({
          severity: 'warning',
          title: 'Frequent Offline Logouts',
          message: `User ${userId} has logged out offline ${offlineLogoutCount} times in 24 hours`,
          details: {
            userId,
            offlineLogoutCount,
            deviceId
          }
        });
      }
    }
  }
}
```

## User Recovery Procedures

### 1. Online Logout Confirmation
```typescript
// When user comes back online, prompt for confirmation logout
@Injectable()
export class NetworkAwareLogoutService {
  constructor(private networkService: NetworkService) {
    // When network comes back online
    this.networkService.online$.subscribe(() => {
      this.checkForPendingLogout();
    });
  }
  
  private async checkForPendingLogout(): Promise<void> {
    const hasPendingLogout = localStorage.getItem('pending_logout') === 'true';
    
    if (hasPendingLogout) {
      const confirmed = await this.ui.confirm(
        'You logged out while offline. ' +
        'Would you like to complete the logout on the server now?'
      );
      
      if (confirmed) {
        await this.completeServerLogout();
        localStorage.removeItem('pending_logout');
      }
    }
  }
}
```

### 2. Password Change Invalidation
```typescript
// Password change invalidates all tokens
@Post('/auth/change-password')
async changePassword(
  @Body() dto: ChangePasswordDto,
  @Req() request: Request
): Promise<void> {
  const userId = request.user.id;
  
  // 1. Change password
  await this.userService.updatePassword(userId, dto.newPassword);
  
  // 2. Invalidate ALL refresh tokens for this user
  await this.tokenService.revokeAllUserTokens(userId);
  
  // 3. Notify user about logged out devices
  await this.notificationService.sendPasswordChangeNotification(
    userId,
    request.headers['user-agent']
  );
  
  // 4. Return new token for current session
  const newToken = await this.tokenService.generateRefreshToken(userId);
  this.setRefreshTokenCookie(newToken);
}
```

## Related Decisions
- UC 12.11: Multi-User Device Isolation (offline queue)
- ADR 0005: Rate Limiter Failure State Strategy (Redis degradation)
- UC 9.15: Refresh Token Reuse Detection with Grace Period

## Critical Security Trade-off: Offline Logout Queue Purge
**Senior Architectural Decision: Offline Logout Drops the Mutation Queue**
**Explicit Trade-off:** We cannot securely sync offline operations (like inventory deductions) without a valid JWT. Because an offline logout instantly purges the JWT from local storage to ensure device security, any pending offline operations in the IndexedDB queue lose their cryptographic authorization. We explicitly dictate that triggering an offline logout MUST irrevocably purge the entire pending offline queue. We trade the preservation of unsynced offline data (which is lost) for absolute security on shared devices and the avoidance of "Login-to-Logout" sync loops. The UI must present a severe warning dialog: *"You have X unsynced actions. Logging out offline will permanently delete them. Continue?"*

**Implementation:**
```typescript
@Injectable()
export class AuthService {
  async logout(): Promise<void> {
    // Check if offline
    if (!this.networkService.isOnline()) {
      // Get pending operation count
      const pendingCount = await this.syncService.getPendingOperationCount();
      
      if (pendingCount > 0) {
        // Show warning dialog
        const confirmed = await this.ui.confirmDialog(
          `You have ${pendingCount} unsynced actions. ` +
          `Logging out offline will permanently delete them. Continue?`,
          'Warning: Data Loss Risk',
          'Delete & Logout',
          'Cancel'
        );
        
        if (!confirmed) {
          return; // User cancelled
        }
      }
      
      // Purge offline queue
      await this.syncService.purgeOfflineQueue();
    }
    
    // Clear local auth state
    this.clearLocalAuthState();
    
    // Try to notify backend (best effort)
    try {
      await this.http.post('/auth/logout').toPromise();
    } catch (error) {
      // Offline - already handled
    }
  }
}
```

## Evolution Plan
1. **Phase 2**: Implement token versioning to invalidate all tokens on password change
2. **Phase 3**: Add device management UI to view/revoke active sessions
3. **Phase 4**: Implement push notification-based token revocation for critical security events