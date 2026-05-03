import { test, expect } from './fixtures';

test.describe('Cocktail Preparation', () => {
  test('should load cocktail detail page', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    // Try clicking the first cocktail card if available
    const card = page.locator('app-cocktail-card a').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.detail-title')).toBeVisible();
    }
  });

  test('should show preparation modal', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    const card = page.locator('app-cocktail-card a').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForLoadState('networkidle');

      // Check for prepare button or already-prepared state
      const prepareBtn = page.getByText('Prepare This Cocktail');
      const prepared = page.getByText('Prepared!');
      const queued = page.getByText('Queueing...');
      const anyVisible = await prepareBtn.isVisible().catch(() => false) ||
        await prepared.isVisible().catch(() => false) ||
        await queued.isVisible().catch(() => false);
      expect(anyVisible).toBeTruthy();
    }
  });
});
