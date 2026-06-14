import { test, expect } from './fixtures';

test.describe('Cocktail Preparation', () => {
  test('should load cocktail detail page from discover', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    const card = page.locator('app-cocktail-card a').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.detail-title')).toBeVisible();
    }
  });

  test('should show ingredients list on detail page', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    const card = page.locator('app-cocktail-card a').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForLoadState('networkidle');
      const ingredients = page.locator('.ingredient-list, .ingredients, .ingredient-item');
      const hasIngredients = await ingredients.isVisible().catch(() => false);
      expect(hasIngredients).toBeTruthy();
    }
  });

  test('should show preparation button or status', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    const card = page.locator('app-cocktail-card a').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForLoadState('networkidle');

      const prepareBtn = page.getByText('Prepare This Cocktail');
      const prepared = page.getByText('Prepared!');
      const queued = page.getByText('Queueing...');
      const anyVisible = (await prepareBtn.isVisible().catch(() => false)) ||
        (await prepared.isVisible().catch(() => false)) ||
        (await queued.isVisible().catch(() => false));
      expect(anyVisible).toBeTruthy();
    }
  });

  test('should show star rating component on detail page', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    const card = page.locator('app-cocktail-card a').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForLoadState('networkidle');
      const stars = page.locator('app-star-rating');
      const hasStars = await stars.isVisible().catch(() => false);
      expect(hasStars).toBeTruthy();
    }
  });

  test('should show recipe instructions on detail page', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');

    const card = page.locator('app-cocktail-card a').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForLoadState('networkidle');
      const instructions = page.locator('.instructions, .recipe-instructions');
      const hasInstructions = await instructions.isVisible().catch(() => false);
      expect(hasInstructions).toBeTruthy();
    }
  });
});
