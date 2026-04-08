```markdown
# 🍸 MixologyHub

<p align="center">
  <img src="https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white" alt="Angular" />
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

## 📖 Project Overview

MixologyHub is a modern, enterprise-grade full-stack web application designed for cocktail enthusiasts and professional bartenders. It serves as a unified platform to discover new recipes, manage a personal ingredient inventory, and generate completely unique cocktail recipes using Generative AI.

Built as a showcase of **Senior Full-Stack Engineering** practices, this project demonstrates clean architecture, scalable API design, third-party API aggregation, strict data modeling, and containerized deployment.

## ✨ Key Features & Technical Highlights

- **🧠 Agnostic AI Bartender:** Implements the Dependency Inversion principle to integrate LLMs (Large Language Models). Configured via environment variables, you can plug in **DeepSeek, OpenAI, Anthropic**, or any compatible API to generate strict JSON recipes based on a user's available ingredients.
- **🌍 Unified API Aggregation (Adapter Pattern):** Seamlessly merges local database user-recipes with thousands of public recipes from `TheCocktailDB`. The backend normalizes dirty external JSON into strict internal DTOs on the fly.
- **📦 Smart Inventory & Math Engine:** Tracks user ingredients with strict base-unit conversions (e.g., converting ounces to milliliters mathematically). The system dynamically queries and calculates exactly which cocktails a user can make based on real-time stock.
- **⚡ High Performance Caching:** Integrates **Redis** to cache external API searches (TTL-based), drastically reducing third-party API calls and improving response times.
- **🔐 Modern Reactive UI:** The frontend is built with **Angular 18+**, utilizing Standalone Components, the new Zoneless Change Detection (`provideZonelessChangeDetection`), Angular Signals for state management, and strict RxJS streams.

## 🏗️ High-Level Architecture

The system is fully containerized and divided into distinct micro-services operating within a Docker network:

```text
                           [ Angular SPA ]
                       (Signals, RxJS, Reactive)
                                  │
                               REST API
                                  │
                          [ NestJS Backend ]
                    (Gateway, Adapters, AI Prompts)
                        /         |         \
                       /          |          \
           [ PostgreSQL ]     [ Redis ]     [ External APIs ]
            (Relational       (Cache &       (TheCocktailDB &
             Data Model)    Rate Limits)      DeepSeek/OpenAI)
```

## 🚀 Quick Start

The entire application infrastructure is orchestrated via Docker Compose. You do not need to install Node.js, PostgreSQL, or Redis on your host machine to run this project.

### 1. Clone & Configure
```bash
git clone https://github.com/yourusername/mixology-hub.git
cd mixology-hub
```

Configure your environment variables (specifically for the AI Provider) in a `.env` file in the `backend/` directory:
```ini
AI_API_URL=https://api.deepseek.com/v1/chat/completions
AI_API_KEY=your_api_key_here
AI_MODEL=deepseek-chat
```

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

*   **Architecture & System Design:**
    *   [System Overview](./docs/architecture/system-overview.md)
    *   [Backend Architecture](./docs/architecture/backend-architecture.md)
    *   [Frontend Architecture](./docs/architecture/frontend-architecture.md)
*   **Data & APIs:**
    *   [Database Schema & ERD](./docs/database/database-schema.md)
    *   [REST API Specification](./docs/api/api-spec.md)
*   **Product & Features:**
    *   [Features Deep-Dive](./docs/product/features.md)
    *   [Future Roadmap](./docs/product/roadmap.md)
*   **Development & DevOps:**
    *   [Local Setup Guide](./docs/development/setup.md)
    *   [Coding Standards](./docs/development/coding-standards.md)

## 💻 Tech Stack Summary

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | Angular, TypeScript, RxJS, Angular Signals, SCSS, Vitest |
| **Backend** | NestJS, Node.js, TypeORM, Swagger (OpenAPI) |
| **Database** | PostgreSQL |
| **Cache** | Redis |
| **Infrastructure** | Docker, Docker Compose, Nginx |

## 👨‍💻 Author

**Santiago Rojas**
*Senior Full-Stack Software Engineer*
* [LinkedIn](https://www.linkedin.com/in/santiago-tomas-rojas-jimenez)
* [Portfolio](https://www.zantgo.dev)

---
*This project is licensed under the MIT License.*
```
