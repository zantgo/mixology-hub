import { test, expect } from './fixtures';

const TEST_COCKTAIL_ID = 'test-cocktail-1';
const TEST_LOG_ID = 'test-log-1';

function mockCocktailApi(page: import('@playwright/test').Page) {
  return page.route('**/api/cocktails/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'GET' && url.includes(`/cocktails/${TEST_COCKTAIL_ID}`) && !url.includes('prepare')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: TEST_COCKTAIL_ID,
          name: 'E2E Test Cocktail',
          description: 'A cocktail for E2E testing',
          instructions: 'Mix everything together.',
          isPublic: true,
          makeability: 'makeable',
          rating: 4.5,
          ratingCount: 10,
          ingredients: [
            {
              id: 'ci-1',
              measure: '50 ml',
              amount: 50,
              unit: 'ml',
              ingredient: { id: 'ing-1', name: 'Vodka', baseUnit: 'ml' },
            },
            {
              id: 'ci-2',
              measure: '25 ml',
              amount: 25,
              unit: 'ml',
              ingredient: { id: 'ing-2', name: 'Lime Juice', baseUnit: 'ml' },
            },
          ],
          user: { id: 'user-1', displayName: 'Test User' },
        }),
      });
    } else if (method === 'POST' && url.includes('prepare') && !url.includes('undo') && !url.includes('cancel')) {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Cocktail preparation queued',
          preparationLogId: TEST_LOG_ID,
          jobId: 'job-1',
          status: 'queued',
          statusUrl: `/cocktails/preparations/${TEST_LOG_ID}/status`,
        }),
      });
    } else {
      await route.continue();
    }
  });
}

function mockPreparationStatus(page: import('@playwright/test').Page) {
  let callCount = 0;

  return page.route(`**/api/cocktails/preparations/${TEST_LOG_ID}/status`, async (route) => {
    callCount++;
    let status: string;
    let deductedIngredients: unknown[] = [];

    if (callCount <= 2) {
      status = 'queued';
    } else if (callCount <= 4) {
      status = 'evaluating';
    } else if (callCount <= 6) {
      status = 'preparing';
    } else {
      status = 'completed';
      deductedIngredients = [
        { ingredientId: 'ing-1', ingredientName: 'Vodka', amount: '50', unit: 'ml' },
        { ingredientId: 'ing-2', ingredientName: 'Lime Juice', amount: '25', unit: 'ml' },
      ];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        preparationLogId: TEST_LOG_ID,
        cocktailName: 'E2E Test Cocktail',
        servings: 1,
        status,
        deductedIngredients,
        undone: false,
        createdAt: new Date().toISOString(),
      }),
    });
  });
}

test.describe('Cocktail Preparation - State Transitions', () => {
  test('should cycle through preparation states and show success toast', async ({ page }) => {
    await mockCocktailApi(page);
    await mockPreparationStatus(page);

    await page.goto(`/discover/cocktail/${TEST_COCKTAIL_ID}`);
    await page.waitForLoadState('networkidle');

    const prepareBtn = page.getByText('Prepare This Cocktail');
    await expect(prepareBtn).toBeVisible({ timeout: 5000 });

    await prepareBtn.click();

    const modal = page.locator('app-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(modal.getByText('Prepare Cocktail')).toBeVisible();

    const sendOrderBtn = modal.getByText('Send Order');
    await expect(sendOrderBtn).toBeVisible();

    await sendOrderBtn.click();

    await expect(page.getByText('Queueing in Production Line...')).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('Evaluating Stock Integrity...')).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Pouring and Preparing...')).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Prepared!')).toBeVisible({ timeout: 10000 });

    const toast = page.locator('app-toast');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast.getByText('prepared successfully')).toBeVisible({ timeout: 3000 });
  });

  test('should show cancel button during queued/evaluating states', async ({ page }) => {
    await mockCocktailApi(page);
    await page.route(`**/api/cocktails/preparations/${TEST_LOG_ID}/status`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          preparationLogId: TEST_LOG_ID,
          cocktailName: 'E2E Test Cocktail',
          servings: 1,
          status: 'queued',
          deductedIngredients: null,
          undone: false,
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`/discover/cocktail/${TEST_COCKTAIL_ID}`);
    await page.waitForLoadState('networkidle');

    const prepareBtn = page.getByText('Prepare This Cocktail');
    await expect(prepareBtn).toBeVisible({ timeout: 5000 });
    await prepareBtn.click();

    const modal = page.locator('app-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await modal.getByText('Send Order').click();

    await expect(page.getByText('Cancel Order')).toBeVisible({ timeout: 5000 });
  });

  test('should show insufficient stock error toast', async ({ page }) => {
    await mockCocktailApi(page);
    let callCount = 0;
    await page.route(`**/api/cocktails/preparations/${TEST_LOG_ID}/status`, async (route) => {
      callCount++;
      const status = callCount <= 2 ? 'queued' : 'failed_insufficient_stock';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          preparationLogId: TEST_LOG_ID,
          cocktailName: 'E2E Test Cocktail',
          servings: 1,
          status,
          deductedIngredients: null,
          undone: false,
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`/discover/cocktail/${TEST_COCKTAIL_ID}`);
    await page.waitForLoadState('networkidle');

    const prepareBtn = page.getByText('Prepare This Cocktail');
    await expect(prepareBtn).toBeVisible({ timeout: 5000 });
    await prepareBtn.click();

    const modal = page.locator('app-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await modal.getByText('Send Order').click();

    const toast = page.locator('app-toast');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast.getByText('Not enough stock')).toBeVisible({ timeout: 3000 });
  });
});
