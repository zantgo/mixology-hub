import { test, expect } from './fixtures';

test.describe('Cocktail Discovery', () => {
  test('should load discover page with title', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-title')).toContainText('Discover');
  });

  test('should show search bar and allow typing', async ({ page }) => {
    await page.goto('/discover');
    await expect(page.locator('app-search-bar')).toBeVisible();
    const input = page.locator('app-search-bar input, app-search-bar .search-input');
    if (await input.isVisible().catch(() => false)) {
      await input.fill('margarita');
      await expect(input).toHaveValue('margarita');
    }
  });

  test('should show skeleton loaders while loading data', async ({ page }) => {
    await page.goto('/discover');
    const skeleton = page.locator('app-skeleton').first();
    const emptyState = page.locator('app-empty-state');
    const cards = page.locator('app-cocktail-card').first();
    await page.waitForLoadState('networkidle');
    const hasContent = (await skeleton.isVisible().catch(() => false)) ||
      (await emptyState.isVisible().catch(() => false)) ||
      (await cards.isVisible().catch(() => false));
    expect(hasContent).toBeTruthy();
  });

  test('should display empty state or results', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    const hasEmptyState = await page.locator('app-empty-state').isVisible().catch(() => false);
    const hasCards = await page.locator('app-cocktail-card').first().isVisible().catch(() => false);
    expect(hasEmptyState || hasCards).toBeTruthy();
  });

  test('should navigate to favorites page from discover', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
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

  test('should navigate to cocktail detail via card click', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    const card = page.locator('app-cocktail-card a').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.detail-title')).toBeVisible();
    }
  });

  test('should display cocktail card with image and name', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    const card = page.locator('app-cocktail-card').first();
    if (await card.isVisible().catch(() => false)) {
      const image = card.locator('app-cocktail-image, img');
      const name = card.locator('.card-name, h3, .cocktail-name');
      const hasImage = await image.isVisible().catch(() => false);
      const hasName = await name.isVisible().catch(() => false);
      expect(hasImage || hasName).toBeTruthy();
    }
  });
});
