# MixologyHub Product Roadmap

## Overview
This document outlines the strategic direction and planned features for MixologyHub. The roadmap is organized into phases, with each phase building upon the previous to deliver increasing value to users while maintaining technical excellence.

## Current Status: Phase 1 Complete, Phase 2 Partially Complete ✅
**Completed Features (as of May 2026):**

### Core Domain
- ✅ Cocktail discovery from TheCocktailDB API (circuit breaker + rate limiter)
- ✅ AI-powered recipe generation (provider-agnostic with tool calling)
- ✅ Personal cocktail creation and management (dynamic forms + image upload)
- ✅ Favorites system (polymorphic: local + external cocktails)
- ✅ Unified search (local + external + AI) with Redis caching
- ✅ Fuzzy search with pg_trgm (typo-tolerant)
- ✅ Strict inclusion search (filter by required ingredients)
- ✅ Advanced filtering (category, glassware, ingredient count)
- ✅ Docker-based development environment
- ✅ B2B shared `bar_inventory` (single-bar POS model)

### Authentication & Security
- ✅ JWT authentication (register/login/refresh/logout)
- ✅ Refresh token rotation + reuse detection + session management (5 max)
- ✅ RBAC (admin/bartender roles with AdminGuard)
- ✅ Password strength enforcement (common password blacklist)
- ✅ Brute-force lockout (5 attempts → 15min) + unlock recovery flow
- ✅ CSRF protection (refresh token in httpOnly sameSite:strict cookie)
- ✅ GDPR (data export, deletion, anonymization, scheduled cleanup)
- ✅ Rate limiting (ThrottlerModule, MCP-specific limits)

### Inventory & Preparation
- ✅ Smart inventory dashboard (category-grouped, admin-only mutations)
- ✅ Bulk add/delete inventory
- ✅ Unit conversion engine (13 units, mass↔volume via density)
- ✅ Measure parsing (fractions, decimals, qualitative measures)
- ✅ Makeability intelligence (hierarchical ingredient resolution)
- ✅ Cocktail preparation via BullMQ queue (concurrency:1, ACID transactions)
- ✅ Async preparation UX (202 Accepted → polling → toast)
- ✅ Batch preparation + undo (single atomic transaction)
- ✅ Optional ingredient conditional deduction
- ✅ Undo with 15-min window + idempotency guard

### AI & MCP
- ✅ AI recipe generation with multi-attempt validation
- ✅ AI recipe regeneration (same ingredients, different output)
- ✅ AI stylistic modifiers + unit system awareness
- ✅ AI daily quota enforcement (atomic DB upsert)
- ✅ AI prompt injection defense + safety validation
- ✅ MCP (Model Context Protocol) server with 6 tools
- ✅ MCP tool call audit trail + parameter validation
- ✅ AI response payload size bounding (50KB)

### Developer Experience
- ✅ Frontend lint/format scripts (Prettier)
- ✅ Health check endpoint (GET /health: db + redis)
- ✅ CI/CD pipeline (GitHub Actions: lint, build, test, E2E)
- ✅ Response time monitoring (slow request logging >1s)
- ✅ Error alerting hook (structured 5xx logging)
- ✅ PWA manifest (standalone display)
- ✅ Frontend session timeout (30-min idle → auto-logout)
- ✅ Backend tests: 10 suites, 174 tests
- ✅ Frontend tests: 7 files, 21 tests
- ✅ E2E test scaffold (8 scenarios)

## Phase 1: Enhanced User Experience & Core Features (Q2 2026)

### 1.1 Authentication & User Management
- ✅ **JWT-based Authentication**: Replace mock auth with proper JWT token system
- ✅ **User Registration & Profiles**: Email/password registration with profile management
- ~~**Social Login**: OAuth2 integration (Google, GitHub, etc.)~~ → Phase 2
- ✅ **Password Reset**: Secure password recovery flow
- ✅ **Session Management**: Token refresh, logout, multiple device support (max 5 sessions)

### 1.2 Advanced Inventory Management
- ✅ **Smart Inventory Dashboard**: Visual overview of ingredient stock
- ~~**Barcode Scanning**: Mobile app integration for easy inventory updates~~ → Phase 2
- ~~**Expiration Tracking**: Notifications for expiring ingredients~~ → Phase 2
- ~~**Shopping List Generation**: Auto-generated shopping lists based on missing ingredients~~ → Phase 2
- ✅ **Batch Updates**: Bulk import/export of inventory data

### 1.3 Enhanced Recipe Features
- ✅ **Recipe Ratings & Reviews**: User ratings and written reviews
- ~~**Recipe Collections**: User-curated collections (e.g., "Summer Cocktails", "Party Drinks")~~ → Phase 2
- ~~**Recipe Sharing**: Social sharing with generated images~~ → Phase 2
- ~~**Recipe Variations**: User-submitted variations of existing recipes~~ → Phase 2
- ~~**Seasonal Recommendations**: Time-based recipe suggestions~~ → Phase 2

## Phase 2: Social & Community Features (Q3 2026)

### 2.1 Social Platform
- **User Profiles**: Public profiles with recipe collections and favorites
- **Follow System**: Follow other users to see their creations
- **Activity Feed**: Recent activity from followed users
- **Comments & Discussions**: Recipe discussions and Q&A
- **Achievements & Badges**: Gamification for recipe creation and engagement

### 2.2 Advanced AI Features
- **Personalized Recommendations**: AI-powered suggestions based on taste preferences
- **Dietary Restrictions**: Filter recipes by dietary needs (gluten-free, vegan, low-sugar)
- **Ingredient Substitutions**: AI suggests alternatives for missing ingredients
- **Cocktail Pairing**: Food pairing recommendations
- **Batch Scaling**: Automatically scale recipes for different serving sizes

### 2.3 Mobile Application
- **React Native App**: Cross-platform mobile application
- **Camera Integration**: Photo-based ingredient recognition
- **Push Notifications**: Recipe reminders, inventory alerts
- **Mobile-Optimized UI**: Touch-friendly interface for bartending

## Phase 3: Professional Features (Q4 2026)

### 3.1 Bar Management Tools
- **Commercial Features**: Cost calculation, profit margins
- **Supplier Integration**: Direct ordering from suppliers
- **Menu Planning**: Digital menu creation and management
- **Staff Management**: Role-based access for bar staff
- **Sales Analytics**: Track popular drinks, peak hours, revenue

### 3.2 Advanced Analytics
- **Personal Analytics**: Drinking habits, cost tracking, health insights
- **Trend Analysis**: Popular ingredients, emerging cocktail trends
- **Seasonal Analytics**: Consumption patterns by season/weather
- **Taste Profile**: Machine learning to understand user preferences
- **Recommendation Engine**: Advanced collaborative filtering

### 3.3 Integration Ecosystem
- **Smart Home Integration**: Alexa/Google Home voice commands
- **Calendar Integration**: Plan cocktails for events
- **Music Pairing**: Spotify integration for mood-based recommendations
- **Weather Integration**: Weather-appropriate drink suggestions
- **API Platform**: Public API for third-party integrations

## Phase 4: Enterprise & Scale (Q1 2027)

### Architectural Decision: Phase 4 Identity Mutation
**Explicit Trade-off:** Phase 4 represents a significant evolution from the application's foundational architecture. We explicitly mandate that no MVP code should be abstracted, engineered, or "future-proofed" to accommodate Phase 4. We trade future migration ease for absolute development velocity today.

### 4.1 Multi-Tenancy & White Label
- **Bar/Brand Customization**: White-label versions for bars/restaurants
- **Custom Domain Support**: Branded instances for businesses
- **Bulk User Management**: For hospitality businesses
- **Custom Recipe Libraries**: Proprietary recipes for businesses
- **Billing & Subscription**: SaaS pricing tiers

### 4.2 Advanced Technical Infrastructure
- **Microservices Architecture**: Split monolith into domain services
- **Advanced Caching**: Redis cluster for global scale
- **CDN Integration**: Global asset delivery
- **Database Sharding**: Horizontal scaling for user data
- **Database Materialized Views**: Pre-computed aggregations for complex queries
- **Read Replicas**: Geographic distribution for global performance

### 4.3 Internationalization
- **Multi-language Support**: Spanish, French, German, Japanese
- **Regional Adaptations**: Local ingredients, measurement systems
- **Cultural Customization**: Region-specific cocktail traditions
- **Currency Support**: Local pricing for premium features
- **Timezone Support**: Global user base management

## Technical Debt & Maintenance

### Immediate (Q2 2026)
- ✅ Implement proper authentication (replacing mock auth)
- ✅ Add comprehensive error handling and logging
- ✅ Improve test coverage (10 backend suites, 174 tests; 7 frontend files, 21 tests)
- ✅ Implement proper CI/CD pipeline
- ✅ Add monitoring and alerting (ResponseTimeInterceptor + 5xx alerting)

### Short-term (Q3 2026)
- Add E2E test coverage for critical paths
- Add database indexing and query optimization

### Long-term (Q4 2026+)
- Migrate to microservices architecture
- Implement event-driven architecture for advanced workflows
- Add advanced monitoring and APM
- Implement blue-green deployments
- Add disaster recovery procedures

## Success Metrics

### User Metrics
- **Monthly Active Users (MAU)**: Target: 10,000 by end of Phase 1
- **User Retention**: 30-day retention > 40%
- **Recipe Creation**: Average 2 recipes per active user monthly
- **Engagement**: Daily session duration > 8 minutes

### Technical Metrics
- **API Performance**: P95 response time < 200ms
- **System Uptime**: 99.9% availability
- **Error Rate**: < 0.1% of requests
- **Test Coverage**: > 80% for critical paths

### Business Metrics (Future)
- **Conversion Rate**: Free to paid conversion > 5%
- **Customer Acquisition Cost (CAC)**: < $10 per user
- **Lifetime Value (LTV)**: LTV:CAC ratio > 3:1
- **Monthly Recurring Revenue (MRR)**: Target growth of 20% monthly

## Risk Management

### Technical Risks
- **API Dependency**: Mitigation: Cache aggressively, implement fallbacks
- **Scalability**: Mitigation: Design for horizontal scaling from start
- **Security**: Mitigation: Regular security audits, bug bounty program
- **Data Loss**: Mitigation: Automated backups, point-in-time recovery

### Market Risks
- **Competition**: Mitigation: Focus on unique AI features and community
- **User Adoption**: Mitigation: Simple onboarding, viral sharing features
- **Monetization**: Mitigation: Freemium model with clear value proposition
- **Regulatory**: Mitigation: Age verification, responsible drinking messaging

## Feedback & Iteration
- **User Feedback Loop**: Regular user surveys and feedback collection
- **A/B Testing**: Test new features with subsets of users
- **Analytics-Driven**: Data-informed decision making
- **Community Involvement**: Engage power users in feature planning
- **Regular Reviews**: Quarterly roadmap reviews and adjustments

## How to Contribute
1. **Feature Requests**: Submit via GitHub Issues with "enhancement" label
2. **Bug Reports**: Use GitHub Issues with detailed reproduction steps
3. **Code Contributions**: Follow contribution guidelines in CONTRIBUTING.md
4. **Documentation**: Help improve docs for new users
5. **Testing**: Participate in beta testing programs

## Changelog
- **2026-05-06**: Phase 1 complete. Fuzzy search, batch prep, MCP Polish, multi-session auth, test coverage expanded (174+21 tests)
- **2026-04-08**: Initial roadmap created
- **2026-04-07**: MVP feature set completed
- **2026-03-15**: Project inception and architecture design

---

*This roadmap is a living document and will be updated regularly based on user feedback, market changes, and technical considerations. Last updated: April 8, 2026*