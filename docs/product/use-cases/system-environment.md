# ⚙️ Domain 8: System & Environment

**UC 8.1: Developer Environment Initialization (Mock Auth)**
* **Given** a developer spins up the backend using Docker Compose.
* **When** the NestJS `AppModule` initializes for the first time.
* **Then** the `SeederService` automatically inserts `mock@test.com` into the database.
* **And** fulfills all Foreign Key requirements without manual SQL intervention.