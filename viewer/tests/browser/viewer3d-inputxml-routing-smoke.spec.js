import { test, expect } from '@playwright/test';

test('3D Viewer XML Diff route selector shell renders', async ({ page }) => {
  await page.goto('/');

  await page.getByText('3D Viewer', { exact: true }).click();

  const xmlDiffTab = page.getByText('XML Diff', { exact: true });
  await expect(xmlDiffTab).toBeVisible();
  await xmlDiffTab.click();

  await expect(page.getByText('InputXML Route')).toBeVisible();
  await expect(page.getByText('UXML Round Trip')).toBeVisible();
  await expect(page.getByText('Native XML Builder')).toBeVisible();

  await expect(page.getByText('Load XML A')).toBeVisible();
  await expect(page.getByText('Load XML B')).toBeVisible();

  await expect(page.getByText('Preview')).toBeVisible();
  await expect(page.getByText('Compare')).toBeVisible();
  await expect(page.getByText('Clear')).toBeVisible();
});
