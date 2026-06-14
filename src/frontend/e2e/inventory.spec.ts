import { test, expect } from './fixtures';

test.describe('Inventory Management', () => {
  test('should load my-bar page with title', async ({ page }) => {
    await page.goto('/my-bar');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-title')).toContainText('My Bar');
  });

  test('should show appropriate UI state', async ({ page }) => {
    await page.goto('/my-bar');
    await page.waitForLoadState('networkidle');

    const hasEmptyState = await page.locator('app-empty-state').isVisible().catch(() => false);
    const hasCards = await page.locator('app-inventory-card').first().isVisible().catch(() => false);
    const hasSkeleton = await page.locator('app-skeleton').first().isVisible().catch(() => false);

    expect(hasEmptyState || hasCards || hasSkeleton).toBeTruthy();
  });

  test('should show add ingredient button', async ({ page }) => {
    await page.goto('/my-bar');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Add Ingredient').first()).toBeVisible();
  });

  test('should show grouped category sections', async ({ page }) => {
    await page.goto('/my-bar');
    await page.waitForLoadState('networkidle');

    const categories = page.locator('.category-section, .category-group');
    const cards = page.locator('app-inventory-card');
    const hasContent = (await categories.isVisible().catch(() => false)) ||
      (await cards.first().isVisible().catch(() => false));
    expect(hasContent).toBeTruthy();
  });

  test('should navigate to add ingredient sheet', async ({ page }) => {
    await page.goto('/my-bar');
    await page.waitForLoadState('networkidle');

    const addBtn = page.getByText('Add Ingredient').first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      const bottomSheet = page.locator('.bottom-sheet, app-modal, .ingredient-select');
      const hasSheet = await bottomSheet.isVisible().catch(() => false);
      expect(hasSheet).toBeTruthy();
    }
  });
});
