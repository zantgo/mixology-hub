# 🍸 MixologyHub


<p align="center">

<img src="https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Angular" />

<img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />

<img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />

<img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />

<img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />

</p>
 

## 📖 Project Overview
  

MixologyHub is a modern, enterprise-grade full-stack web application designed for professional bars and bartenders. It serves as a unified Point-of-Sale and inventory management platform to discover recipes, manage a shared bar ingredient inventory, and generate unique cocktail recipes using Generative AI.
 

Built as a showcase of **Senior Full-Stack Engineering** practices, this project demonstrates clean architecture, scalable API design, third-party API aggregation, strict data modeling, and containerized deployment.
  
## ✨ Key Features & Technical Highlights
 

- **🧠 MCP-Powered AI Bartender:** Uses the Model Context Protocol (MCP) instead of prompt stuffing. The LLM selectively invokes backend tools (`get_bar_inventory`, `search_cocktails`, `convert_units`, `prepare_cocktail`) to query only the data it needs, reducing token usage by >90% while maintaining mathematical accuracy.

- **🌍 Unified API Aggregation (Adapter Pattern):** Seamlessly merges local database user-recipes with thousands of public recipes from `TheCocktailDB`. The backend normalizes dirty external JSON into strict internal DTOs on the fly.

- **📦 B2B Shared Inventory & Math Engine:** A single shared `bar_inventory` table serves all bartenders. Strict base-unit conversions (e.g., ounces to milliliters) ensure mathematical precision. The system dynamically calculates exactly which cocktails the bar can make based on real-time stock.

- **🔄 Queue-Based Concurrency (BullMQ):** Cocktail preparation orders are serialized through a Redis-backed BullMQ queue with `concurrency: 1`, mathematically eliminating race conditions and double-deductions when multiple bartenders operate simultaneously.

- **⚡ High Performance Caching:** Integrates **Redis** to cache external API searches (TTL-based), drastically reducing third-party API calls and improving response times.

- **🔐 Modern Reactive UI:** The frontend is built with **Angular 18+**, utilizing Standalone Components, the new Zoneless Change Detection (`provideZonelessChangeDetection`), Angular Signals for state management, and strict RxJS streams.


> **🔐 Note on Authentication (MVP State):** To simplify the local developer experience and code review process, Auth is currently bypassed. A `SeederService` automatically provisions a mock admin (`mock@test.com`) on boot to satisfy all Foreign Key database constraints. Full JWT/OAuth2 implementation with admin/bartender roles is slated for the next roadmap phase.

> **🏢 B2B Single-Bar Architecture:** MixologyHub is now a Point-of-Sale system for a single physical bar. All bartenders share a single `bar_inventory`. Concurrency is managed via BullMQ queue serialization. The application requires a persistent internet connection to function.

  
## 🏗️ High-Level Architecture

The system is fully containerized and divided into distinct micro-services operating within a Docker network:

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Browser Client] -->|HTTP| Frontend
    end
    
    subgraph "Application Layer"
        Frontend[Angular 21 SPA<br/>Signals • RxJS • Reactive] -->|REST API| Backend
        Backend[NestJS Backend<br/>Gateway • Adapters • AI Prompts]
        Worker[BullMQ Worker<br/>concurrency: 1]
    end
    
    subgraph "Data & External Services"
        Backend -->|Enqueue| Worker
        Worker --> PostgreSQL[(PostgreSQL<br/>Shared Bar Inventory)]
        Backend --> Redis[(Redis<br/>Cache • BullMQ Queue)]
        Worker --> Redis
        Backend --> External[External APIs<br/>TheCocktailDB • LLM Providers]
    end
    
    style Frontend fill:#dd0031,color:#fff
    style Backend fill:#e0234e,color:#fff
    style Worker fill:#e0234e,color:#fff
    style PostgreSQL fill:#336791,color:#fff
    style Redis fill:#dc382d,color:#fff
    style External fill:#10a37f,color:#fff
```

## 🚀 Quick Start
 

The entire application infrastructure is orchestrated via Docker Compose. You do not need to install Node.js, PostgreSQL, or Redis on your host machine to run this project.
  

### 1. Clone & Configure

```bash

git clone https://github.com/zantgo/mixology-hub.git

cd mixology-hub

```

  
Copy the example environment file and configure your variables:

```bash
cp .env.example .env
```

Then edit `.env` to add your actual API keys (this file is ignored by git). The `.env.example` file contains all required variables including AI provider configuration for DeepSeek, OpenAI, or Anthropic.

  
### 2. Start the Stack

We provide a `Makefile` wrapper for Docker Compose commands:

```bash

make start

```

  
### 3. Access the Application

- **Frontend App:** [http://localhost:8080](http://localhost:8080)

- **Backend API:** [http://localhost:3000](http://localhost:3000)

- **Swagger API Docs:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

  
To stop the application, run `make stop`. To completely reset the database and volumes, run `make clean`.
 

## 📚 Technical Documentation

  
To keep this README concise, detailed engineering documentation has been separated into the `docs/` directory. These documents explain the *why* and *how* behind the technical decisions:
 

* **Architecture & System Design:**
  * [System Overview](./docs/architecture/system-overview.md) – Containerized microservices, provider-agnostic AI integration
  * [Backend Architecture](./docs/architecture/backend-architecture.md) – NestJS patterns, database optimization strategies
  * [Frontend Architecture](./docs/architecture/frontend-architecture.md) – Angular 18+ Signals, zoneless change detection
  * [Observability Strategy](./docs/architecture/observability.md) – Logging, monitoring, and tracing for production
  * [Deployment Strategy & CI/CD](./docs/architecture/deployment-and-cicd.md) – Production deployment patterns and automation
  * [Architecture Decision Records (ADRs)](./docs/architecture/adrs/) – Context on tech stack choices and trade-offs

* **Data & APIs:**
  * [Database Schema & ERD](./docs/database/database-schema.md) – PostgreSQL design with unit conversion considerations
  * [API Documentation & Testing Hub](./docs/api/README.md) – Postman collection, testing guide, and REST API specification

* **Product & Features:**
  * [Product Use Cases (BDD/TDD)](./docs/product/use-cases.md) – Gherkin scenarios driving test-driven development
  * [Features Deep-Dive](./docs/product/features.md) – Use cases and business logic implementation
  * [Future Roadmap](./docs/product/roadmap.md) – Phased development plan and scalability roadmap

* **Design & User Experience:**
  * [Design System](./docs/design/design-system.md) – Colors, typography, spacing, and visual tokens
  * [Component Library](./docs/design/component-library.md) – Reusable UI components and specifications
  * [UI/UX Flows](./docs/design/ui-ux-flows.md) – User journeys and screen interactions
  * [Responsive Layout](./docs/design/responsive-layout.md) – Breakpoints, grids, and device-specific rules
  * [Motion & States](./docs/design/motion-and-states.md) – Animations, loading, and interactive feedback
  * [Accessibility (A11Y)](./docs/design/accessibility-a11y.md) – Screen reader support and WCAG compliance
  * [Asset Management](./docs/design/asset-management.md) – Icons, images, and fallback strategies

* **Development & DevOps:**
  * [Local Setup Guide](./docs/development/setup.md) – Docker-first development environment
  * [Coding Standards](./docs/development/coding-standards.md) – TypeScript best practices, LLM security patterns
  * [Testing Strategy](./docs/development/testing.md) – TDD approach, testing pyramid, Red-Green-Refactor
  * [TypeORM Decimal Transformers](./docs/development/typeorm-decimal-transformers.md) – Handling floating-point precision issues in Node.js

* **Security:**
  * [LLM Prompt Security](./docs/security/llm-prompt-security.md) – Defending against Prompt Injection attacks

  

## 💻 Tech Stack Summary
 
| Layer              | Technologies Used                                        |
| ------------------ | -------------------------------------------------------- |
| **Frontend**       | Angular 21, TypeScript, RxJS, Signals, SCSS, Vitest      |
| **Backend**        | NestJS, Node.js, TypeORM, BullMQ, Swagger (OpenAPI)      |
| **Database**       | PostgreSQL                                               |
| **Queue/Cache**    | Redis (BullMQ Queue + API Cache)                         |
| **Infrastructure** | Docker, Docker Compose, Nginx                            |
  
## 👨‍💻 Author
  
**Santiago Rojas**

*Software Engineer*

* [LinkedIn](https://www.linkedin.com/in/santiago-tomas-rojas-jimenez)
* [Portfolio](https://www.zantgo.dev)
  
---

*This project is licensed under the MIT License.*