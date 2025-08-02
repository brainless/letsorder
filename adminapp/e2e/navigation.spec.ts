import { test, expect } from '@playwright/test';

test.describe('Application Navigation', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.getByText('Sign In')).toBeVisible();
  });

  test('should show proper page titles', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LetsOrder/);
  });

  test('should show responsive design elements', async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Should show mobile-friendly layout
    await expect(page.getByText('Sign In')).toBeVisible();
    
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    
    await expect(page.getByText('Sign In')).toBeVisible();
  });
});