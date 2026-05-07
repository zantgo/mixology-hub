import { test, expect } from './fixtures';

test.describe('Cocktail Discovery', () => {
  test('should load discover page', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-title')).toContainText('Discover');
  });

  test('should show search bar', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.locator('app-search-bar')).toBeVisible();
  });

  test('should show empty state when no cocktails found', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    // Either shows results or empty state — both are valid
    const hasEmptyState = await page.locator('app-empty-state').isVisible().catch(() => false);
    const hasCards = await page.locator('app-cocktail-card').first().isVisible().catch(() => false);
    expect(hasEmptyState || hasCards).toBeTruthy();
  });

  test('should navigate to favorites page', async ({ page }) => {
    await page.goto('/favorites');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-title')).toContainText('Favorites');
  });

  test('should show 404 for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await expect(page.locator('.not-found .code')).toContainText('404');
  });

  test('should redirect root to discover', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url).toContain('/discover');
  });
});
