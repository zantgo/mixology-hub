# ADR 0007: SSRF Prevention vs. Image Link Rot Validation Trade-off

## Status
Deprecated (Replaced by Native Uploads - ADR 0016)

## Context
**Update:** This ADR has been completely voided by [ADR 0016 (Native File Uploads)](./0016-local-image-processing-via-sharp.md). We explicitly trade the ability for users to link external images for absolute SSRF immunity. Because the system no longer accepts URLs, both SSRF prevention and Link Rot validation are no longer applicable threat vectors.

The system accepts user-submitted image URLs for custom cocktails (UC 2.7). There are two competing security and user experience concerns:

1. **Server-Side Request Forgery (SSRF) Prevention**: If the backend fetches user-provided URLs to validate them, attackers could:
   - Probe internal network services (`http://169.254.169.254/` for AWS metadata)
   - Attack internal services via the application server
   - Consume outbound bandwidth with large files
   - Cause denial of service through slow responses

2. **Image Link Rot Validation**: Without server-side validation, the system stores potentially broken URLs:
   - Users submit URLs that return 404 Not Found
   - External services change or remove images
   - URLs point to inappropriate or malicious content
   - Database contains invalid data that breaks user experience

UC 13.5 (SSRF Prevention) explicitly states the backend never fetches image URLs directly. UC 2.32 (External API Image Link Rot) relies entirely on frontend `<img (error)="fallback">` directives.

## Decision
We prioritize **SSRF prevention over link validation** with the following implementation:

1. **Zero Server-Side Fetching**: The backend validates URL format only (regex, protocol, length) but never makes HTTP requests to user-provided URLs
2. **Client-Side Fallback**: Frontend handles broken images at runtime with Angular directives
3. **Accept Stale/Broken URLs**: We accept that some percentage of image URLs in the database will be broken
4. **Monitoring Alternative**: Log client-side image errors to analytics for monitoring external API reliability

### Validation Rules (Server-Side)
```typescript
function validateImageUrl(url: string): boolean {
  // 1. Format validation only
  const urlRegex = /^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/;
  
  // 2. Block internal/private IPs
  const blockedPatterns = [
    /^https?:\/\/localhost/,
    /^https?:\/\/127\./,
    /^https?:\/\/192\.168\./,
    /^https?:\/\/10\./,
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^https?:\/\/169\.254\./,
    /^https?:\/\/(?:0*:){2}0*1/ // IPv6 localhost
  ];
  
  // 3. Length limit (2048 chars per UC 10.7)
  if (url.length > 2048) return false;
  
  // 4. Protocol must be HTTPS
  if (!url.startsWith('https://')) return false;
  
  // 5. No query parameters that could be malicious
  // (Basic check - full SSRF protection requires more)
  
  return urlRegex.test(url) && 
         !blockedPatterns.some(pattern => pattern.test(url));
}
```

### Client-Side Handling (Frontend)
```typescript
// Angular component template
<img 
  [src]="cocktail.imageUrl" 
  (error)="onImageError($event)"
  referrerpolicy="no-referrer"
  alt="{{ cocktail.name }}"
  class="cocktail-image"
>

// Component logic
onImageError(event: Event): void {
  const img = event.target as HTMLImageElement;
  img.src = '/assets/images/cocktail-placeholder.jpg';
  
  // Log to analytics for monitoring
  this.analyticsService.logBrokenImage(
    this.cocktail.id,
    this.cocktail.imageUrl
  );
}
```

## Consequences

### Positive
- **SSRF Protection**: Zero risk of server-side request forgery attacks
- **Performance**: No outbound HTTP requests from backend, reducing latency
- **Cost Savings**: No bandwidth costs for validating external images
- **Simplicity**: Straightforward implementation without complex HTTP client configuration

### Negative
- **Broken Images**: Database contains invalid URLs that degrade user experience
- **Content Risk**: Cannot validate that images are appropriate/safe
- **External Dependency**: Relies on external services remaining available
- **No Pre-validation**: Users may not realize their image is broken until viewing

## Alternatives Considered

### 1. Server-Side Validation with Safe HTTP Client
- **Pros**: Can validate URLs before storing, better user experience
- **Cons**: Complex SSRF protection needed, bandwidth costs, latency
- **Decision**: Rejected due to security complexity and performance impact

### 2. Proxy Service with Sanitization
- **Pros**: Fetch through a secured proxy that sanitizes responses
- **Cons**: Additional infrastructure, still has bandwidth costs
- **Decision**: Rejected for MVP due to infrastructure complexity

### 3. Allow HTTP (not just HTTPS) with Validation
- **Pros**: More flexible for users
- **Cons**: Major security risk, mixed content warnings
- **Decision**: Rejected - HTTPS requirement is non-negotiable for security

### 4. Image Upload Instead of URLs
- **Pros**: Full control over image storage and validation
- **Cons**: Storage costs, CDN complexity, moderation burden
- **Decision**: Rejected for MVP - URL-based approach is simpler

## Implementation Details

### Frontend Monitoring
```typescript
// Analytics service for monitoring broken images
@Injectable()
export class ImageAnalyticsService {
  logBrokenImage(cocktailId: string, imageUrl: string): void {
    this.http.post('/api/analytics/broken-images', {
      cocktailId,
      imageUrl,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    }).subscribe();
  }
  
  // Dashboard metrics
  getBrokenImageRate(): Observable<number> {
    return this.http.get<number>('/api/analytics/broken-image-rate');
  }
}
```

### Database Cleanup Strategy
```typescript
// Periodic job to identify likely-broken URLs
async function cleanupBrokenImageUrls(): Promise<void> {
  // 1. Get URLs with high failure rate from analytics
  const brokenUrls = await analyticsService.getFrequentlyBrokenUrls();
  
  // 2. Mark cocktails for review (not auto-delete)
  for (const url of brokenUrls) {
    await cocktailRepo.update(
      { imageUrl: url },
      { needsImageReview: true }
    );
  }
  
  // 3. Notify cocktail authors
  await notificationService.notifyAuthorsOfBrokenImages();
}
```

### User Experience Mitigations
1. **Clear UI Indicators**: Show warning icon for cocktails needing image review
2. **Author Notifications**: Email cocktail authors when their image appears broken
3. **Community Reporting**: Allow users to report broken images
4. **Admin Dashboard**: View cocktails with broken images for manual cleanup

## Related Decisions
- UC 2.32: External API Image Link Rot (frontend fallback)
- UC 13.5: SSRF and Client IP Leakage Prevention via Secure Image Proxy
- UC 10.7: Maximum URL Length Enforcement (2048 character limit)
- ADR 0011: Client IP Leakage via External Images Despite SSRF Prevention

## Evolution Plan
1. **Phase 2**: Implement community reporting for broken images
2. **Phase 3**: Add optional image upload for verified users
3. **Phase 4**: Implement secure image proxy to prevent client IP leakage (see ADR 0011)