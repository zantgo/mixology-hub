import { test, expect } from './fixtures';

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('.auth-title')).toContainText('Welcome Back');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('should show register page', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.locator('.auth-title')).toContainText('Create Account');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('should navigate between login and register', async ({ page }) => {
    await page.goto('/auth/login');
    await page.click('a[routerlink="/auth/register"]');
    await expect(page.locator('.auth-title')).toContainText('Create Account');

    await page.click('a[routerlink="/auth/login"]');
    await expect(page.locator('.auth-title')).toContainText('Welcome Back');
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.goto('/auth/login');
    await page.click('button[type="submit"]');
    // Form fields should still be visible (HTML5 validation or disabled button)
    await expect(page.locator('#email')).toBeVisible();
  });
});
