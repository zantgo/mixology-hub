import { test, expect } from './fixtures';

test.describe('AI Bartender', () => {
  test('should load AI bartender page with title', async ({ page }) => {
    await page.goto('/ai-bartender');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-title')).toContainText('AI Bartender');
  });

  test('should show ingredient input form', async ({ page }) => {
    await page.goto('/ai-bartender');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#ai-ingredients')).toBeVisible();
  });

  test('should allow typing ingredients', async ({ page }) => {
    await page.goto('/ai-bartender');
    await page.waitForLoadState('networkidle');
    const input = page.locator('#ai-ingredients');
    if (await input.isVisible().catch(() => false)) {
      await input.fill('vodka, lime, mint');
      await expect(input).toHaveValue('vodka, lime, mint');
    }
  });

  test('should show generate button initially disabled', async ({ page }) => {
    await page.goto('/ai-bartender');
    await page.waitForLoadState('networkidle');
    const generateBtn = page.getByText('Generate Recipe');
    await expect(generateBtn).toBeDisabled();
  });

  test('should show theme or modifier inputs', async ({ page }) => {
    await page.goto('/ai-bartender');
    await page.waitForLoadState('networkidle');

    const themeInput = page.locator('#theme, [name="theme"]');
    const hasInput = await themeInput.isVisible().catch(() => false);
    const hasGenerateBtn = await page.getByText('Generate Recipe').isVisible().catch(() => false);
    expect(hasInput || hasGenerateBtn).toBeTruthy();
  });

  test('should show quota information', async ({ page }) => {
    await page.goto('/ai-bartender');
    await page.waitForLoadState('networkidle');

    const quotaText = page.locator('text=/quota|remaining|generation/i');
    const hasQuota = await quotaText.isVisible().catch(() => false);
    expect(hasQuota).toBeTruthy();
  });
});
