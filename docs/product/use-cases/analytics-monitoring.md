# 📈 Domain 14: Analytics & Monitoring

**UC 14.1: Usage Analytics Collection**
* **Given** a user prepares a cocktail.
* **When** the preparation transaction completes.
* **Then** the system logs the event to an analytics service.
* **And** tracks metrics like "most prepared cocktails", "peak usage times", and "inventory depletion rates".

**UC 14.2: Error Monitoring & Alerting**
* **Given** an unexpected error occurs in production.
* **When** the error is caught by the global exception filter.
* **Then** it's logged with full context (user ID, request details, stack trace).
* **And** triggers an alert to the engineering team if it's a critical or recurring issue.

**UC 14.3: Performance Monitoring**
* **Given** the application is running in production.
* **When** API endpoints are called.
* **Then** response times, database query durations, and external API latencies are tracked.
* **And** dashboards display performance trends and identify bottlenecks.

**UC 14.4: Zero-Result Search Tracking (Product Growth)**
* **Given** a user searches for "Malort" and gets 0 unified results.
* **When** the response is returned.
* **Then** a fire-and-forget background event logs the "Zero Result Query" to the database.
* **And** this allows Admins to see highly requested missing ingredients/cocktails to manually add to the global catalog.
* **And** tracks search patterns to identify gaps in the ingredient/cocktail database for product improvement.