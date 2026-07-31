import { expect, test } from 'playwright/test';

test('manual harness initializes the real widget and executes a public command', async ({ page }) => {
  await page.goto('/examples/manual/');

  await expect(page.getByTestId('status')).toHaveText('STATE-READY');

  const widget = page.getByTestId('widget');
  await expect.poll(() => widget.evaluate((element) => element.shadowRoot?.querySelectorAll('canvas').length ?? 0)).toBe(1);

  await page.locator('#color-select').selectOption('red');
  await page.locator('#apply-color').click();

  await expect(page.getByTestId('state-output')).toContainText('"colorId": "red"');
  await expect(page.getByTestId('event-log')).toContainText('product-3d-selection-change');
  await expect(page.getByTestId('result-output')).toContainText('"accepted": true');
});
