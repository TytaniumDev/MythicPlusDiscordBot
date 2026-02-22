import { test, expect } from '@playwright/test';
import { mockSession, mockGroups } from '../src/mockData';

const encodeData = (data: unknown) => Buffer.from(JSON.stringify(data)).toString('base64');

test('Copy button appears in results view', async ({ page }) => {
  const completedData = {
    ...mockSession,
    status: 'completed',
    groups: mockGroups,
  };

  await page.goto(`/?data=${encodeData(completedData)}`);

  const copyBtn = page.locator('#copy-results-btn');
  await expect(copyBtn).toBeVisible();
  await expect(copyBtn).toHaveText('Copy Groups');

  const resultsActions = page.locator('.results-actions');
  await expect(resultsActions).toBeVisible();
});
