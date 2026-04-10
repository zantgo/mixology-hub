# ADR 0016: Local Image Processing via Sharp

## Status
Accepted

## Context
The system previously used URL-based image fetching with complex proxy architecture to prevent SSRF and client IP leakage (ADR 0007, ADR 0011). This approach had significant drawbacks:

1. **Security Complexity**: Required extensive SSRF protection, URL validation, and proxy infrastructure
2. **Performance Issues**: External image fetching added latency and bandwidth costs
3. **User Experience**: Broken image links, CORS issues, and inconsistent aspect ratios
4. **Infrastructure Burden**: Proxy caching, rate limiting, and monitoring overhead

## Decision
Replace URL-based image fetching with a secure, optimized local file upload system using Sharp for image processing:

1. **Local File Storage**: Store images locally in `uploads/cocktails/` directory
2. **Sharp Processing**: Use Sharp library for consistent image processing (1024x1024 full, 300x300 thumb, WebP format)
3. **Native File Upload**: Replace URL input with native file picker (2MB max, JPG/PNG/WebP)
4. **Static File Serving**: Serve processed images via NestJS static file serving
5. **Consistent Aspect Ratio**: Enforce 1:1 aspect ratio for uniform UI

### Architecture
```
User Browser → Frontend (File Picker) → Backend (Multer + Sharp) → Local Storage (uploads/)
       ↑                                        ↑
       └─────────── Response ←──────────────────┘
                    (Local Image Paths)
```

### Implementation

#### 1. Image Processing Service
```typescript
@Injectable()
export class ImageService {
  private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'cocktails');

  async processAndSaveImage(file: Express.Multer.File): Promise<{ full: string; thumb: string }> {
    // Validate MIME type (JPG, PNG, WebP)
    // Generate UUID filename
    // Process full image: 1024x1024, WebP, ~80% quality (<300KB)
    // Process thumbnail: 300x300, WebP, 75% quality
    // Return local paths: /uploads/cocktails/{uuid}-full.webp
  }
}
```

#### 2. Database Schema Update
```sql
ALTER TABLE "cocktails" DROP COLUMN "image_url";
ALTER TABLE "cocktails" ADD COLUMN "image_full" VARCHAR(255) DEFAULT NULL;
ALTER TABLE "cocktails" ADD COLUMN "image_thumb" VARCHAR(255) DEFAULT NULL;
```

#### 3. Entity Update
```typescript
@Entity('cocktails')
export class Cocktail {
  @Column({ type: 'varchar', length: 255, nullable: true })
  imageFull: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageThumb: string;
}
```

#### 4. Frontend File Upload
```html
<input 
  type="file" 
  accept="image/jpeg, image/png, image/webp"
  (change)="onFileSelected($event)" 
/>
```

## Consequences

### Positive
- **Security**: Eliminates SSRF and client IP leakage risks entirely
- **Performance**: Local file serving is faster than external fetching
- **Consistency**: Enforced 1:1 aspect ratio and WebP format for uniform UI
- **Reliability**: No broken external links or CORS issues
- **Cost Reduction**: Eliminates proxy bandwidth and caching infrastructure
- **User Experience**: Native file picker is more intuitive than URL input

### Negative
- **Storage Requirements**: Local disk space for uploaded images
- **File Management**: Need for cleanup of unused images
- **Migration Complexity**: Requires database schema changes
- **Initial Setup**: Need to install and configure Sharp library

### Technical Specifications
1. **File Size Limit**: 2MB maximum upload
2. **Accepted Formats**: JPG, PNG, WebP
3. **Output Format**: WebP (optimized for web)
4. **Dimensions**: 
   - Full: 1024x1024 (1:1 aspect ratio)
   - Thumbnail: 300x300 (1:1 aspect ratio)
5. **Quality**: 
   - Full: 80% (target <300KB)
   - Thumbnail: 75%
6. **Storage**: Local `uploads/cocktails/` directory

## Alternatives Considered

### 1. Cloud Storage (S3/R2)
- **Pros**: Scalable, durable, CDN integration
- **Cons**: Additional cost, complexity, vendor lock-in
- **Decision**: Rejected for MVP - local storage is sufficient initially

### 2. External Image Processing Service (Imgix, Cloudinary)
- **Pros**: Advanced features, automatic optimization
- **Cons**: Cost, external dependency, privacy concerns
- **Decision**: Rejected - Sharp provides sufficient capabilities locally

### 3. Keep URL System with Enhanced Proxy
- **Pros**: Maintains existing architecture
- **Cons**: Doesn't solve fundamental UX and security issues
- **Decision**: Rejected - root cause needs addressing

### 4. Hybrid Approach (Upload + URL)
- **Pros**: Flexible for users
- **Cons**: Complex implementation, maintains security risks
- **Decision**: Rejected - clean break to local-only simplifies security model

## Implementation Phases

### Phase 1: Clean Up Dead Code
- Delete image proxy services and controllers
- Update documentation (mark ADR 0007, 0011 as deprecated)
- Remove URL validation utilities

### Phase 2: Database Migration
- Execute SQL migration to drop `image_url`, add `image_full`, `image_thumb`
- Update TypeORM entity

### Phase 3: Backend Implementation
- Install Sharp and Multer dependencies
- Create ImageService with Sharp processing
- Update cocktail controller for file upload
- Configure static file serving

### Phase 4: Frontend Updates
- Replace URL input with file picker
- Update form handling for FormData
- Update display components to use local paths
- Update CSS for 1:1 aspect ratio

### Phase 5: External API Integration
- Update CocktailAggregatorService to download and process external images
- Server-side ingestion of TheCocktailDB images

## Migration Strategy

1. **Backward Compatibility**: During migration, handle both URL and file-based images
2. **Data Migration**: Script to download and process existing external images
3. **Feature Flag**: Gradual rollout with ability to revert
4. **Monitoring**: Track upload success rates, file sizes, processing times

## Related Decisions
- ADR 0007: SSRF Prevention vs. Image Link Rot Validation Trade-off (Deprecated)
- ADR 0011: Client IP Leakage via External Images Despite SSRF Prevention (Deprecated)
- UC 7.14: MVP Image URL Constraint (No File Upload) - To be deleted
- UC 7.21: Secure Image Proxy Rendering (IP Privacy) - To be deleted
- UC 13.5: SSRF and Client IP Leakage Prevention - Deleted (SSRF is no longer an applicable threat vector since users upload files directly rather than providing URLs for the server to fetch)

## Security Considerations

1. **File Upload Validation**:
   - MIME type validation (not just extension)
   - File size limits (2MB)
   - Image content validation via Sharp

2. **Path Traversal Prevention**:
   - Use UUID filenames, not original names
   - Validate file paths don't contain `..` or absolute paths

3. **Storage Security**:
   - Store outside web root with proper permissions
   - Regular cleanup of orphaned files

4. **Content Safety**:
   - Sharp validates image format during processing
   - Reject non-image files even if MIME type is spoofed

## Performance Considerations

1. **Image Optimization**:
   - WebP format provides ~30% smaller files than JPEG
   - Appropriate quality settings balance size vs. visual quality
   - Resizing reduces bandwidth and improves load times

2. **Caching**:
   - Browser caching via Cache-Control headers
   - CDN integration possible for future scaling

3. **Processing Overhead**:
   - Sharp is highly optimized C++ library
   - Async processing prevents blocking event loop
   - Consider queue for high-volume scenarios

## Future Evolution

1. **Cloud Storage Migration**: Move to S3/R2 when storage needs grow
2. **Advanced Processing**: Add watermarking, filters, or AI enhancements
3. **Video Support**: Extend to short recipe videos
4. **Progressive Loading**: Implement blur-up placeholders
5. **Accessibility**: Automatic alt-text generation via AI