import { test, expect } from '@playwright/test';
import { setupMockApi } from './fixtures/mockApi';

test.beforeEach(async ({ page }) => {
  // Setup mock API before navigation
  await setupMockApi(page);
  await page.goto('/');
  
  // Wait for authentication to complete and main page to load
  await page.waitForTimeout(1000);
  
  // Wait for avatar to be visible (indicates successful auth)
  await page.locator('.avatar').waitFor({ state: 'visible', timeout: 5000 });
});

test.describe('Authenticated User Flow', () => {
  test('should show main inventory page when authenticated', async ({ page }) => {
    // Should not show login page entrance
    await expect(page.getByText('Stream Tag Inventory').first()).toBeVisible();
    
    // Should show user avatar button in navbar
    await expect(page.locator('button.avatar')).toBeVisible();
  });

  test('should show current channel information', async ({ page }) => {
    // Wait for channel data to load
    await page.waitForLoadState('networkidle');
    
    // Check if category input shows current game (in first template card)
    const categoryInput = page.locator('.card #category').first();
    await expect(categoryInput).toHaveValue('Just Chatting');
    
    // Check if title input shows current title
    const titleInput = page.locator('.card input[name="title"]').first();
    await expect(titleInput).toHaveValue('Test Stream Title');
  });

  test('should allow searching for categories', async ({ page }) => {
    // Find and click on category search input in first card
    const categoryInput = page.locator('.card #category').first();
    await categoryInput.click();
    await categoryInput.clear();
    await categoryInput.fill('League');
    
    // Wait for search results dropdown
    await page.waitForTimeout(500); // Debounce delay
    
    // Should show search results in dropdown
    const dropdown = page.locator('[data-testid="dropdown-content"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByText('League of Legends')).toBeVisible();
  });

  test('should allow updating channel information', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Find and update title in first template card
    const titleInput = page.locator('.card input[name="title"]').first();
    
    await titleInput.click();
    await titleInput.clear();
    await titleInput.fill('New Stream Title');
    
    // First save the changes
    const saveButton = page.locator('.card').first().getByRole('button', { name: 'save template' });
    await saveButton.click();
    
    // Then apply the template
    const applyButton = page.locator('.card').first().getByRole('button', { name: 'apply template' });
    await applyButton.click();
    
    // Should keep the new title
    await expect(titleInput).toHaveValue('New Stream Title');
  });

  test('should display tags in template cards', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if tags are displayed in the template cards
    const tagElements = page.locator('.inline-flex.items-center.rounded.px-2.py-1.me-2.text-sm.font-medium.text-blue-800.bg-blue-100');
    
    // Should show at least one tag
    await expect(tagElements.first()).toBeVisible();
  });

  test('should allow logout', async ({ page }) => {
    // Click on user avatar to open dropdown
    const avatarButton = page.locator('button.avatar');
    await avatarButton.click();
    
    // Click logout button in dropdown
    const logoutButton = page.getByRole('button').filter({ hasText: /logout|ログアウト/i });
    await logoutButton.click();
    
    // Should redirect back to login page
    await expect(page.getByRole('link')).toBeVisible();
  });
});