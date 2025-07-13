import { test, expect } from '@playwright/test';

test.describe('Development Workflow', () => {
  test('should load the application successfully', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check that the main title is present - this verifies React loaded
    await expect(page.locator('h5')).toContainText('Firefly-III File Importer', { timeout: 15000 });
    
    // Additional check - the page should have our main container
    await expect(page.locator('[data-testid="app-container"]').or(page.locator('.MuiPaper-root'))).toBeVisible();
  });

  test('should not display credential form fields', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for React to render
    await expect(page.locator('h5')).toContainText('Firefly-III File Importer');
    
    // Verify no credential form fields are present
    await expect(page.locator('input[type="url"]')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[type="text"]')).toHaveCount(0);
    
    // Should only have the file input
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
  });

  test('should show upload interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for the main content to load
    await expect(page.locator('h5')).toContainText('Firefly-III File Importer');
    
    // Check that some form of upload interface exists
    // This could be a button or file input
    const hasUploadButton = await page.locator('button').count() > 0;
    const hasFileInput = await page.locator('input[type="file"]').count() > 0;
    
    expect(hasUploadButton || hasFileInput).toBeTruthy();
  });
});