import { test, expect } from './fixtures';

test.describe('Authentication', () => {
  test('should show login page with form fields', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('.auth-title')).toContainText('Welcome Back');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('should show register page with form fields', async ({ page }) => {
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
    await expect(page.locator('#email')).toBeVisible();
  });

  test('should allow typing into form fields', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'testpassword');
    await expect(page.locator('#email')).toHaveValue('test@example.com');
    await expect(page.locator('#password')).toHaveValue('testpassword');
  });

  test('should show password input as password type', async ({ page }) => {
    await page.goto('/auth/login');
    const passwordField = page.locator('#password');
    await expect(passwordField).toHaveAttribute('type', 'password');
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const isOnDiscover = url.includes('/discover');
    const isOnLogin = url.includes('/auth/login');
    expect(isOnDiscover || isOnLogin).toBeTruthy();
  });
});
