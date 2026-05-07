import { test, expect } from './fixtures';

test.describe('AI Bartender', () => {
  test('should load AI bartender page', async ({ page }) => {
    await page.goto('/ai-bartender');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-title')).toContainText('AI Bartender');
  });

  test('should show ingredient input form', async ({ page }) => {
    await page.goto('/ai-bartender');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#ai-ingredients')).toBeVisible();
  });

  test('should disable generate button when empty', async ({ page }) => {
    await page.goto('/ai-bartender');
    await page.waitForLoadState('networkidle');
    const generateBtn = page.getByText('Generate Recipe');
    await expect(generateBtn).toBeDisabled();
  });
});
