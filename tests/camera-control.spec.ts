import { expect, test } from 'playwright/test';

const configuration = {
  productId: 'camera-control',
  glbUrl: '/tests/fixtures/camera-control.gltf',
  cameraViews: [
    { id: 'close', positionNodeName: 'CAM_Close', targetNodeName: 'FOCUS_Product', durationMs: 0 },
    { id: 'side', positionNodeName: 'CAM_Side', targetNodeName: 'FOCUS_Product', durationMs: 1000 },
  ],
  variants: [{ id: 'base', label: 'Base', isDefault: true, isBase: true, visibleNodeNames: [], hiddenNodeNames: [] }],
  animations: [{ id: 'pulse', label: 'Pulse', source: { kind: 'clip', clipName: 'Pulse' }, compatibleVariantIds: ['base'] }],
  scenarios: [{ id: 'assembly', label: 'Assembly', steps: [{ id: 'one', description: 'One', animationId: 'pulse' }] }],
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
      const difference = Math.abs(pixels[index] - background[0]) + Math.abs(pixels[index + 1] - background[1]) + Math.abs(pixels[index + 2] - background[2]) + Math.abs(pixels[index + 3] - background[3]);
      if (difference > 40) count += 1;
    }
    bitmap.close();
    return count;
  }, image.toString('base64'));
};

test('supports named views, multi-node focus, restore and cancellation during a scenario', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Deterministic camera rendering assertions run in Chromium.');
  await page.goto('/tests/fixtures/');
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);
  const outcome = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as any;
    widget.id = 'widget';
    widget.style.width = '400px';
    widget.style.height = '300px';
    document.body.append(widget);
    return (await widget.configure(config)).outcome;
  }, configuration);
  expect(outcome).toBe('ready');
  expect(await page.locator('#widget').evaluate((widget: any) => widget.getState().capabilities.cameraViews)).toEqual([{ id: 'close' }, { id: 'side' }]);

  const initialPixels = await visiblePixelCount(page);
  expect(await page.locator('#widget').evaluate((widget: any) => widget.setCameraView('close'))).toMatchObject({ accepted: true, outcome: 'completed' });
  const closePixels = await visiblePixelCount(page);
  expect(closePixels).toBeGreaterThan(initialPixels * 1.5);

  expect(await page.locator('#widget').evaluate((widget: any) => widget.focusOnNodes(['Focus_Left', 'Focus_Right'], { durationMs: 0, distance: 1.4 }))).toMatchObject({ accepted: true, outcome: 'completed' });
  expect(await page.locator('#widget').evaluate((widget: any) => widget.restoreCameraView({ durationMs: 0 }))).toMatchObject({ accepted: true, outcome: 'completed' });
  const restoredPixels = await visiblePixelCount(page);
  expect(Math.abs(restoredPixels - initialPixels) / initialPixels).toBeLessThan(0.05);

  expect(await page.locator('#widget').evaluate((widget: any) => widget.focusOnNode('missing', { durationMs: 0 }))).toMatchObject({ accepted: false, reason: 'unknown-node' });
  expect(await page.locator('#widget').evaluate((widget: any) => widget.startScenario('assembly'))).toMatchObject({ accepted: true, outcome: 'completed' });
  const cancellation = await page.locator('#widget').evaluate(async (widget: any) => {
    const moving = widget.setCameraView('side');
    await new Promise((resolve) => setTimeout(resolve, 80));
    const cancelled = await widget.cancelCameraTransition();
    return { moving: await moving, cancelled, lifecycle: widget.getState().lifecycle };
  });
  expect(cancellation.moving).toMatchObject({ accepted: true, outcome: 'cancelled' });
  expect(cancellation.cancelled).toMatchObject({ accepted: true, outcome: 'completed' });
  expect(cancellation.lifecycle).toBe('STATE-SCENARIO-ACTIVE');
});
