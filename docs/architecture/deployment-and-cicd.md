# Deployment Strategy & CI/CD Pipeline

## Overview
This document outlines the production deployment strategy for MixologyHub, moving from local Docker development to cloud-based infrastructure with automated CI/CD pipelines.

## Current State (Local Development)
- **Docker Compose**: All services run locally in containers
- **Single Environment**: Development-only configuration
- **Manual Processes**: No automated testing or deployment

## Target Production Architecture

### Infrastructure Components

#### 1. Frontend Deployment
```
[ Angular Build ] → [ NGINX Container ] → [ Cloud Platform ]
       ↓                    ↓                     ↓
   Static Files     Alpine-based image    AWS/Google Cloud/Vercel
```

**Options:**
- **AWS**: S3 + CloudFront + Route 53
- **Google Cloud**: Cloud Storage + Cloud CDN
- **Vercel**: Zero-config deployment with automatic previews
- **Netlify**: Similar to Vercel with Git integration

#### 2. Backend Deployment
```
[ NestJS Build ] → [ Node.js Container ] → [ Stateful Virtual Machine ]
       ↓                    ↓                          ↓
   JavaScript      Multi-stage build         AWS EC2 / DigitalOcean
```

**Options:**
- **AWS EC2 / Elastic Beanstalk (EC2 Mode)**: Persistent VMs with EBS volumes
- **DigitalOcean Droplets**: Standard persistent VMs
- **Any standard VPS**: Ensures /uploads/ directory survives restarts

### Architectural Decision: Stateful Monolith Deployment Mandate (Rejection of Serverless)
**Explicit Trade-off:** Because the "No Image URLs" mandate forces us to store processed .webp files directly on the local Node.js file system (`/uploads/cocktails/`), we explicitly reject ephemeral, scale-to-zero serverless orchestration (e.g., AWS ECS Fargate, Google Cloud Run). The application MUST be deployed on a stateful, persistent Virtual Machine (e.g., AWS EC2, DigitalOcean Droplet) with persistent block storage attached. We trade cloud-native serverless auto-scaling for absolute adherence to the local-asset-only security policy.

### Architectural Decision: Single-VM Vertical Scaling Mandate
**Explicit Trade-off:** Because we enforce the "No Image URLs" mandate by storing assets on the local file system (`/uploads/cocktails/`), we explicitly forbid multi-VM horizontal scaling (e.g., deploying across multiple EC2 instances behind an AWS ALB without a shared EFS volume). To adhere to the "No Distributed State" mandate (which forbids shared network drives), the application MUST be scaled vertically on a single Virtual Machine, utilizing only the native Node.js cluster module to span multiple CPU cores across a shared physical disk. We trade cloud-native horizontal load balancing for absolute architectural simplicity and secure local asset storage.

### Architectural Decision: Abandonment of Blue-Green Deployments for Asset Persistence
**Explicit Trade-off:** Because we enforce the "No Image URLs" mandate by storing assets strictly on the local file system (`/uploads/`), we explicitly abandon immutable infrastructure patterns like Blue-Green deployments. We mandate that CI/CD pipelines execute In-Place Rolling Restarts (via PM2 or Docker Compose) against persistent host-volume mounts. We trade zero-downtime deployment purity for the absolute guarantee of local asset persistence without utilizing distributed storage.

#### 3. Database (Production)
```
[ PostgreSQL ] → [ Managed Service ] → [ High Availability ]
      ↓                 ↓                      ↓
   Local DB      AWS RDS / Google Cloud SQL   Multi-AZ setup
```

**Options:**
- **AWS RDS**: Automated backups, read replicas
- **Google Cloud SQL**: Similar features, GCP integration
- **Supabase**: Open-source Firebase alternative
- **Neon**: Serverless PostgreSQL with branching

#### 4. Caching (Production)
```
[ Redis ] → [ Managed Service ] → [ Cluster Mode ]
    ↓              ↓                     ↓
  Local       AWS ElastiCache       High availability
            Google Memorystore
```

## Environment Configuration

### Development vs Production
```env
# Development (.env)
NODE_ENV=development
DB_HOST=postgres
REDIS_HOST=redis
ENABLE_MOCK_AUTH=true

# Production (Secrets Manager)
NODE_ENV=production
DB_HOST=production-db.cluster-xyz.us-east-1.rds.amazonaws.com
REDIS_HOST=production-cache.xxxxxx.ng.0001.use1.cache.amazonaws.com
ENABLE_MOCK_AUTH=false
AI_API_KEY=${secrets:AI_API_KEY}
```

## CI/CD Pipeline Design

### GitHub Actions Workflow
```yaml
name: Production Deployment
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Setup Node.js
      - Install Dependencies
      - Run Linter
      - Run Unit Tests
      - Run E2E Tests
        # For Playwright E2E tests:
        # - name: Install Playwright browsers
        #   run: npx playwright install --with-deps
        # - name: Run Playwright tests
        #   run: npm run test:e2e
      - Build Backend
      - Build Frontend
      - Upload Artifacts
  
  deploy-staging:
    needs: test-and-build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - Download Artifacts
      - Deploy to Staging
      - Run Integration Tests
      - Health Check
  
  deploy-production:
    needs: deploy-staging
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - Manual Approval (optional)
      - Deploy to Production
      - Run Smoke Tests
      - Notify Team
```

### Pipeline Stages

#### 1. Continuous Integration
- **Trigger**: Push to any branch
- **Actions**:
  - Code quality checks (ESLint, Prettier)
  - Security scanning (Snyk, npm audit)
  - Unit tests with coverage reporting
  - Build verification

#### 2. Staging Deployment
- **Trigger**: Merge to main branch
- **Actions**:
  - Deploy to staging environment
  - Run integration tests
  - Load testing (optional)
  - UI snapshot testing

#### 3. Production Deployment
- **Trigger**: Successful staging deployment
- **Actions**:
  - In-Place Rolling Restarts
  - Database migrations (with rollback plan)
  - Smoke tests
  - Monitoring verification

## Database Migration Strategy

### Safe Deployment Process
1. **Backup**: Automatic backup before migration
2. **Migration**: Apply TypeORM migrations
3. **Verification**: Check data integrity
4. **Rollback Plan**: Pre-tested rollback scripts
5. **Monitoring**: Watch for errors post-deployment

### Zero-Downtime Migrations
- Use backward-compatible schema changes
- Deploy application changes after schema updates
- Use feature flags for behavioral changes

## Monitoring & Observability

### Required Metrics
- **Application**: Response times, error rates, throughput
- **Database**: Connection pool, query performance, locks
- **Cache**: Hit/miss ratio, memory usage, evictions
- **Infrastructure**: CPU, memory, network I/O

### Tools
- **APM**: Datadog, New Relic, AWS X-Ray
- **Logging**: ELK Stack, CloudWatch Logs, Papertrail
- **Alerting**: PagerDuty, Opsgenie, Slack webhooks

## Security Considerations

### Secrets Management
- Never commit secrets to repository
- Use environment-specific secret stores:
  - AWS Secrets Manager
  - Google Secret Manager
  - HashiCorp Vault
  - GitHub Secrets (for CI/CD)

### Network Security
- VPC isolation for database and cache
- Security groups with minimum required access
- WAF for public-facing endpoints
- DDoS protection (Cloudflare, AWS Shield)

## Cost Optimization

### Right-Sizing
- Start with smallest instance types
- Use auto-scaling based on metrics
- Implement cost alerts
- Regular review of unused resources

### Serverless Options
- Use CDN edge-caching for local /uploads/ image delivery to reduce Node.js bandwidth costs
- Use S3 for static assets
- Implement caching aggressively
- Schedule non-essential tasks during off-peak

## Disaster Recovery

### Backup Strategy
- **Database**: Daily automated backups with 30-day retention
- **Application**: Versioned deployments with rollback capability
- **Configuration**: Infrastructure as Code (Terraform)

### Recovery Procedures
1. **Database Failure**: Restore from latest backup
2. **Application Failure**: Roll back to previous version
3. **Infrastructure Failure**: Re-deploy from Terraform state
4. **Data Corruption**: Point-in-time recovery

## Next Steps
1. Implement GitHub Actions CI pipeline
2. Set up staging environment
3. Configure production infrastructure
4. Implement monitoring and alerting
5. Create runbooks for common operations