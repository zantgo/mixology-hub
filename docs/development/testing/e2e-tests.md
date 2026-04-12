# End-to-End (E2E) Tests (Playwright)

## 🎯 Purpose
E2E tests simulate real user interactions with the complete application stack (frontend + backend + database). They validate critical user journeys that span multiple components and services.

## 📋 Test Organization

### Critical User Journeys
These are the most important flows that must always work:

1. **Authentication Flow**: Registration, login, logout
2. **Inventory Management**: Adding, updating, deleting ingredients
3. **Cocktail Discovery**: Searching, filtering, viewing details
4. **Cocktail Preparation**: Making drinks, inventory deduction
5. **AI Bartender**: Generating and saving AI recipes
6. **Favorites**: Adding, removing, viewing favorites

## 🧪 Example E2E Tests

### Critical Flow: Prepare a Cocktail
```typescript
import { test, expect } from '@playwright/test';

test.describe('Critical Flow: Prepare a Cocktail', () => {
  test('User can log in, view makeable cocktails, and prepare one', async ({ page }) => {
    // 1. Authenticate
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    // 2. Add inventory (Setup state)
    await page.goto('/inventory');
    await page.click('button:has-text("Add Ingredient")');
    await page.fill('input[name="ingredientSearch"]', 'Vodka');
    await page.fill('input[name="quantity"]', '500');
    await page.selectOption('select[name="unit"]', 'ml');
    await page.click('button:has-text("Save")');

    // 3. Verify Makeable list updates
    await page.goto('/makeable');
    await expect(page.locator('.cocktail-card', { hasText: 'Vodka Martini' })).toBeVisible();

    // 4. Prepare the drink
    await page.click('button:has-text("Prepare Drink")');
    
    // 5. Verify UI signal updated inventory correctly
    await expect(page.locator('.toast-success')).toContainText('Prepared successfully');
    await page.goto('/inventory');
    await expect(page.locator('.inventory-item:has-text("Vodka") .quantity')).toContainText('440 ml'); // 500 - 60
  });
});
```

### User Registration Flow
```typescript
test.describe('User Registration Flow', () => {
  test('New user can register and access protected routes', async ({ page }) => {
    // 1. Navigate to registration
    await page.goto('/register');
    
    // 2. Fill registration form
    const testEmail = `test-${Date.now()}@test.com`;
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'SecurePassword123!');
    await page.fill('input[name="confirmPassword"]', 'SecurePassword123!');
    
    // 3. Submit registration
    await page.click('button[type="submit"]');
    
    // 4. Verify successful registration and auto-login
    await expect(page).toHaveURL('/inventory');
    await expect(page.locator('.welcome-message')).toContainText('Welcome');
    
    // 5. Verify protected route is accessible
    await page.goto('/makeable');
    await expect(page).toHaveURL('/makeable'); // Not redirected to login
  });
  
  test('Registration fails with invalid password', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'weak'); // Too short
    await page.fill('input[name="confirmPassword"]', 'weak');
    
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('.password-error')).toBeVisible();
    await expect(page.locator('.password-error')).toContainText('Password must be at least 8 characters');
  });
});
```

### AI Recipe Generation Flow
```typescript
test.describe('AI Bartender Flow', () => {
  test('User can generate and save AI recipe', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Navigate to AI bartender
    await page.goto('/ai-bartender');
    
    // Enter ingredients
    await page.fill('textarea[name="ingredients"]', 'Vodka, Lime Juice, Simple Syrup');
    
    // Generate recipe
    await page.click('button:has-text("Generate Recipe")');
    
    // Wait for AI response
    await expect(page.locator('.ai-recipe-card')).toBeVisible({ timeout: 30000 });
    
    // Verify recipe details
    await expect(page.locator('.recipe-name')).toBeVisible();
    await expect(page.locator('.ingredient-list')).toContainText('Vodka');
    
    // Save recipe
    await page.click('button:has-text("Save Recipe")');
    
    // Verify saved
    await expect(page.locator('.toast-success')).toContainText('Recipe saved');
    
    // Navigate to saved recipes
    await page.goto('/my-cocktails');
    await expect(page.locator('.cocktail-card')).toContainText('AI Generated');
  });
});

### Deterministic AI Testing Strategy with WireMock

**Architectural Decision:** E2E tests must NOT mock `/api/ai/generate` at the browser level using Playwright's `page.route()`. This bypasses backend validation, DTO parsing, prompt injection defenses, and AI adapter logic. Instead:

1. **WireMock Server:** Run a local WireMock instance during CI/CD that simulates the external AI API
2. **Environment Configuration:** Set `AI_API_URL=http://localhost:8081` (WireMock) instead of real AI provider
3. **Backend Integration:** Backend makes actual HTTP requests to WireMock, executing full controller logic
4. **Deterministic Responses:** WireMock returns predefined responses for consistent testing

**WireMock Setup:**
```typescript
// wiremock/mappings/ai-generate.json
{
  "request": {
    "method": "POST",
    "url": "/v1/chat/completions",
    "headers": {
      "Authorization": {
        "contains": "Bearer"
      }
    }
  },
  "response": {
    "status": 200,
    "jsonBody": {
      "choices": [{
        "message": {
          "content": "{\"name\": \"Mocked Vodka Drink\", \"ingredients\": [{\"name\": \"vodka\", \"measure\": \"2 oz\"}], \"instructions\": \"Test instructions\"}"
        }
      }]
    }
  }
}
```

**CI/CD Configuration:**
```yaml
# docker-compose.test.yml
services:
  wiremock:
    image: wiremock/wiremock:latest
    ports:
      - "8081:8080"
    volumes:
      - ./wiremock/mappings:/home/wiremock/mappings
      - ./wiremock/__files:/home/wiremock/__files
  
  backend:
    environment:
      - AI_API_URL=http://wiremock:8080
      - AI_API_KEY=mock-key-for-testing
```
```typescript
test.describe('E2E - AI Determinism & Cost Control', () => {
  test('Should use WireMock for AI API during CI/CD execution', async ({ page }) => {
    // DO NOT intercept /api/ai/generate - this bypasses backend validation
    // Instead, configure the backend's AI_API_URL environment variable to point to WireMock
    // WireMock runs locally and provides deterministic responses
    
    await page.goto('/ai-bartender');
    await page.fill('textarea[name="ingredients"]', 'Vodka');
    await page.click('button:has-text("Generate Recipe")');
    
    // Wait for backend to process request (hits WireMock, not real AI API)
    await page.waitForResponse(response => 
      response.url().includes('/api/ai/generate') && response.status() === 200
    );
    
    // Assert against the deterministic response from WireMock
    await expect(page.locator('.recipe-name')).toContainText('Mocked Vodka Drink');
  });

  test('Should handle AI API timeouts gracefully', async ({ page }) => {
    // Configure WireMock to simulate timeout for this test
    // DO NOT intercept /api/ai/generate at browser level
    // WireMock configuration: delay response by 30 seconds to trigger backend timeout
    
    await page.goto('/ai-bartender');
    await page.fill('textarea[name="ingredients"]', 'Vodka');
    await page.click('button:has-text("Generate Recipe")');
    
    // Assert timeout UI is shown
    await expect(page.locator('.error-message')).toContainText('Request timed out');
  });

  test('Should handle AI API errors gracefully', async ({ page }) => {
    // WireMock configured to return 500 for this test
    
    await page.goto('/ai-bartender');
    await page.fill('textarea[name="ingredients"]', 'Vodka');
    await page.click('button:has-text("Generate Recipe")');
    
    // Should show error UI
    await expect(page.locator('.ai-error-message')).toBeVisible();
    await expect(page.locator('.ai-error-message')).toContainText('AI service timeout');
  });

  test('Should handle AI API rate limits', async ({ page }) => {
    // WireMock configured to return 429 for this test
    // WireMock mapping: /wiremock/mappings/ai-rate-limit.json
    // {
    //   "request": {
    //     "method": "POST",
    //     "url": "/v1/chat/completions"
    //   },
    //   "response": {
    //     "status": 429,
    //     "headers": {
    //       "Retry-After": "60"
    //     },
    //     "jsonBody": {
    //       "error": {
    //         "message": "Rate limit exceeded",
    //         "type": "rate_limit_error"
    //       }
    //     }
    //   }
    // }

    await page.goto('/ai-bartender');
    await page.fill('textarea[name="ingredients"]', 'Vodka');
    await page.click('button:has-text("Generate Recipe")');
    
    // Should show rate limit UI (backend translates WireMock 429 to application error)
    await expect(page.locator('.rate-limit-message')).toBeVisible();
    await expect(page.locator('.rate-limit-message')).toContainText('Please wait 60 seconds');
  });
});
```

**Testing Strategy Documentation:**
1. **CI/CD Environment:** All E2E tests mock the LLM API to prevent flakiness and costs
2. **Deterministic Responses:** Mocked responses ensure consistent test outcomes
3. **Error Scenarios:** Tests cover timeouts, rate limits, and network failures
4. **Cost Control:** No real API calls during automated testing
5. **Environment Detection:** Tests detect CI environment and auto-enable mocking
6. **Local Development:** Developers can toggle between real/mocked AI via environment variable
```

### Unified Search Flow
```typescript
test.describe('Unified Search Flow', () => {
  test('User can search cocktails with debouncing', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    
    // Navigate to search
    await page.goto('/search');
    
    // Type search term slowly (should trigger multiple requests)
    await page.fill('input[name="search"]', 'm');
    await page.waitForTimeout(100);
    await page.fill('input[name="search"]', 'ma');
    await page.waitForTimeout(100);
    await page.fill('input[name="search"]', 'mar');
    await page.waitForTimeout(100);
    await page.fill('input[name="search"]', 'marg');
    
    // Wait for debounce and results
    await page.waitForTimeout(350); // Slightly more than 300ms debounce
    
    // Verify results appear
    await expect(page.locator('.search-results .cocktail-card')).toBeVisible();
    
    // Verify both local and external results
    await expect(page.locator('.cocktail-card .source-local')).toBeVisible();
    await expect(page.locator('.cocktail-card .source-external')).toBeVisible();
  });
});
```

## 🔧 Configuration & Setup

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // INJECT THE RATE-LIMIT BYPASS HEADER FOR ALL E2E BROWSER CONTEXTS
    // This bypasses the internal ThrottlerGuard (UC 13.3) but NOT external API rate limits
    extraHTTPHeaders: {
      'x-test-bypass-ratelimit': 'true'
    }
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  
  webServer: {
    command: 'npm run start:test', // Starts both backend and frontend for testing
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Test Data Management
```typescript
// e2e/fixtures.ts
import { test as base } from '@playwright/test';
import { UserFactory } from './factories/UserFactory';

export const test = base.extend({
  // Create a fresh user for each test
  user: async ({ }, use) => {
    const user = await UserFactory.create();
    await use(user);
    await UserFactory.cleanup(user); // Clean up after test
  },
  
  // Page with authenticated user
  authenticatedPage: async ({ page, user }, use) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/inventory');
    await use(page);
  },
});
```

## 🚀 Running E2E Tests

```bash
# Install Playwright browsers
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- --grep "Prepare a Cocktail"

# Run tests in headed mode (visible browser)
npm run test:e2e -- --headed

# Generate HTML report
npm run test:e2e -- --reporter=html
```

## 📊 Best Practices

1. **Isolate Tests**: Each test should be independent and not rely on other tests
2. **Clean Up**: Always clean up test data after tests complete
3. **Use Fixtures**: Leverage Playwright fixtures for common setup/teardown
4. **Wait Strategically**: Use `waitFor` and `expect` instead of fixed timeouts
5. **Test Critical Paths**: Focus on user journeys that matter most
6. **Run in CI**: Integrate E2E tests into your CI/CD pipeline
7. **Parallelize**: Run tests in parallel when possible for speed
8. **Visual Testing**: Consider adding visual regression tests for UI components

## 🔍 Debugging Tips

```typescript
// Add debugging helpers
test('debug example', async ({ page }) => {
  // Pause test execution
  await page.pause();
  
  // Take screenshot
  await page.screenshot({ path: 'debug.png' });
  
  // Log page content
  console.log(await page.content());
  
  // Evaluate JavaScript in browser context
  const windowSize = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }));
  console.log('Window size:', windowSize);
});
```