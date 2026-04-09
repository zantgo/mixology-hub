# ⚙️ Domain 8: System & Environment

**UC 8.1: Developer Environment Initialization (Mock Auth)**
* **Given** a developer spins up the backend using Docker Compose.
* **When** the NestJS `AppModule` initializes for the first time.
* **Then** the `SeederService` automatically inserts `mock@test.com` into the database.
* **And** fulfills all Foreign Key requirements without manual SQL intervention.

**UC 8.2: Initializing Global Ingredient Taxonomy**
* **Given** a fresh database deployment.
* **When** the application bootstraps.
* **Then** the `SeederService` parses a static `ingredients-seed.json` file.
* **And** automatically populates the `Ingredients` table with top 100 common spirits and mixers, correctly assigning `baseUnit` (`ml` vs `g` vs `count`) to ensure the math engine functions immediately.