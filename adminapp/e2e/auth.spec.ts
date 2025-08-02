import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login page by default', async ({ page }) => {
    await page.goto('/');
    
    await expect(page).toHaveTitle(/LetsOrder/);
    await expect(page.getByText('Sign In')).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
  });

  test('should show validation errors for invalid login', async ({ page }) => {
    await page.goto('/');
    
    // Try to submit without credentials
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show validation errors
    await expect(page.getByText(/email is required/i)).toBeVisible();
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.goto('/');
    
    await page.getByText('Create an account').click();
    
    await expect(page.getByText('Create Account')).toBeVisible();
    await expect(page.getByPlaceholder('Restaurant Name')).toBeVisible();
  });

  test('should show registration form validation', async ({ page }) => {
    await page.goto('/register');
    
    // Try to submit without required fields
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show validation errors
    await expect(page.getByText(/restaurant name is required/i)).toBeVisible();
  });

  test('should handle invalid login credentials', async ({ page }) => {
    await page.goto('/');
    
    await page.getByPlaceholder('Email').fill('invalid@example.com');
    await page.getByPlaceholder('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });
});