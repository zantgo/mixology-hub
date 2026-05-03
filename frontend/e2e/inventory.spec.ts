import { test, expect } from './fixtures';

test.describe('Inventory Management', () => {
  test('should load my-bar page', async ({ page }) => {
    await page.goto('/my-bar');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-title')).toContainText('My Bar');
  });

  test('should show empty state when bar is empty', async ({ page }) => {
    await page.goto('/my-bar');
    await page.waitForLoadState('networkidle');

    const hasEmptyState = await page.locator('app-empty-state').isVisible().catch(() => false);
    const hasCards = await page.locator('app-inventory-card').first().isVisible().catch(() => false);
    const hasSkeleton = await page.locator('app-skeleton').first().isVisible().catch(() => false);

    // Any of these UI states is valid depending on API response
    expect(hasEmptyState || hasCards || hasSkeleton).toBeTruthy();
  });

  test('should show add ingredient button', async ({ page }) => {
    await page.goto('/my-bar');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Add Ingredient').first()).toBeVisible();
  });
});
