import { expect, test } from 'playwright/test';

const configuration = {
  productId: 'animation-range-tolerance',
  glbUrl: '/tests/fixtures/product.gltf',
  variants: [
    {
      id: 'base',
      label: 'Base',
      isDefault: true,
      isBase: true,
      visibleNodeNames: [],
      hiddenNodeNames: [],
    },
  ],
  animations: [
    {
      id: 'near-duration',
      label: 'Near duration',
      source: {
        kind: 'range',
        clipName: 'Pulse',
        startSeconds: 0.1,
        endSeconds: 1.0000005,
      },
      compatibleVariantIds: ['base'],
    },
    {
      id: 'too-long',
      label: 'Too long',
      source: {
        kind: 'range',
        clipName: 'Pulse',
        startSeconds: 0.1,
        endSeconds: 1.001,
      },
      compatibleVariantIds: ['base'],
    },
  ],
  scenarios: [
    {
      id: 'near-scenario',
      label: 'Near scenario',
      steps: [
        { id: 'one', description: 'Near duration step', animationId: 'near-duration' },
      ],
    },
    {
      id: 'too-long-scenario',
      label: 'Too long scenario',
      steps: [
        { id: 'one', description: 'Too long step', animationId: 'too-long' },
      ],
    },
  ],
};

test('accepts float32-sized range drift, clamps playback, and rejects material overflow', async ({ page }) => {
  await page.goto('/tests/fixtures/');
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);

  const initialized = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as HTMLElement & {
      configure(value: object): Promise<{ outcome: string }>;
      getState(): {
        capabilities: {
          animations: readonly { id: string }[];
          scenarios: readonly { id: string }[];
          localErrors: readonly { entityId?: string }[];
        };
      };
    };
    widget.id = 'widget';
    widget.style.width = '400px';
    document.body.append(widget);
    const result = await widget.configure(config);
    return {
      outcome: result.outcome,
      capabilities: widget.getState().capabilities,
    };
  }, configuration);

  expect(initialized.outcome).toBe('ready');
  expect(initialized.capabilities.animations.map((item) => item.id)).toEqual(['near-duration']);
  expect(initialized.capabilities.scenarios.map((item) => item.id)).toEqual(['near-scenario']);
  expect(initialized.capabilities.localErrors.map((error) => error.entityId)).toContain('too-long');
  expect(initialized.capabilities.localErrors.map((error) => error.entityId)).toContain('too-long-scenario');

  const animationResult = await page.locator('#widget').evaluate(async (widget: any) => (
    widget.playAnimation('near-duration')
  ));
  expect(animationResult).toMatchObject({ accepted: true, outcome: 'completed' });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().lifecycle)).toBe('STATE-READY');

  const scenarioResult = await page.locator('#widget').evaluate(async (widget: any) => (
    widget.startScenario('near-scenario')
  ));
  expect(scenarioResult).toMatchObject({ accepted: true, outcome: 'completed' });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().scenario.status)).toBe('holding-final-frame');
});
