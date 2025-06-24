import { test, expect } from '@playwright/test';

test('should load the application', async ({ page }) => {
  await page.goto('/');
  
  await expect(page).toHaveTitle('Stream Tag Inventory');
});

test('should show login screen when not authenticated', async ({ page }) => {
  await page.goto('/');
  
  await expect(page.getByText('Stream Tag Inventory')).toBeVisible();
});