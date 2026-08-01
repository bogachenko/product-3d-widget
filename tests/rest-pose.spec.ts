import { expect, test } from 'playwright/test';

const configuration = {
  productId: 'configured-rest-pose',
  glbUrl: '/tests/fixtures/rest-pose.gltf',
  restPose: { kind: 'animation-end', animationId: 'assemble' },
  variants: [{
    id: 'base', label: 'Base', isDefault: true, isBase: true,
    visibleNodeNames: [], hiddenNodeNames: [],
  }],
  animations: [{
    id: 'assemble', label: 'Assemble',
    source: { kind: 'clip', clipName: 'Assemble' },
    compatibleVariantIds: ['base'],
  }],
};

const visiblePixelCount = async (page: any): Promise<number> => {
  const image = await page.locator('#widget').screenshot();
  return page.evaluate(async (encoded: string) => {
    const response = await fetch(`data:image/png;base64,${encoded}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('2D context is unavailable.');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const background = [pixels[0], pixels[1], pixels[2], pixels[3]];
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const difference = Math.abs(pixels[index] - background[0])
        + Math.abs(pixels[index + 1] - background[1])
        + Math.abs(pixels[index + 2] - background[2])
        + Math.abs(pixels[index + 3] - background[3]);
      if (difference > 40) count += 1;
    }
    bitmap.close();
    return count;
  }, image.toString('base64'));
};

test('shows an animation-end rest pose initially and restores it after playback', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Deterministic rendered-pixel assertion runs in Chromium.');
  await page.goto('/tests/fixtures/');
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);

  const outcome = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as HTMLElement & {
      configure(value: object): Promise<{ outcome: string }>;
    };
    widget.id = 'widget';
    widget.style.width = '400px';
    widget.style.height = '300px';
    document.body.append(widget);
    return (await widget.configure(config)).outcome;
  }, configuration);
  expect(outcome).toBe('ready');

  const initialPixels = await visiblePixelCount(page);
  expect(initialPixels).toBeGreaterThan(100);
  expect(await page.locator('#widget').evaluate((widget: any) => widget.getState().error)).toBeNull();

  const startResult = await page.locator('#widget').evaluate(async (widget: any) => widget.playAnimation('assemble'));
  expect(startResult).toMatchObject({ accepted: true, outcome: 'completed' });
  await page.waitForTimeout(120);
  const earlyPixels = await visiblePixelCount(page);
  expect(earlyPixels).toBeLessThan(initialPixels * 0.8);

  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().lifecycle)).toBe('STATE-READY');
  const restoredPixels = await visiblePixelCount(page);
  expect(Math.abs(restoredPixels - initialPixels) / initialPixels).toBeLessThan(0.03);
});
