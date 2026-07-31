import { expect, test } from 'playwright/test';

const configuration = {
  productId: 'scenario-hold-performance',
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
      id: 'step-one',
      label: 'Step one',
      source: {
        kind: 'range',
        clipName: 'Pulse',
        startSeconds: 0,
        endSeconds: 0.05,
      },
      compatibleVariantIds: ['base'],
    },
    {
      id: 'step-two',
      label: 'Step two',
      source: {
        kind: 'range',
        clipName: 'Pulse',
        startSeconds: 0.05,
        endSeconds: 0.1,
      },
      compatibleVariantIds: ['base'],
    },
  ],
  scenarios: [
    {
      id: 'assembly',
      label: 'Пошаговая сборка',
      steps: [
        { id: 'one', description: 'Первый шаг', animationId: 'step-one' },
        { id: 'two', description: 'Второй шаг', animationId: 'step-two' },
      ],
    },
  ],
};

test('holds a completed scenario step without repeatedly emitting completion during camera damping', async ({ page }) => {
  await page.goto('/tests/fixtures/');
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);

  const initialized = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as HTMLElement & {
      configure(value: object): Promise<{ outcome: string }>;
      getState(): {
        capabilities: { scenarios: readonly { id: string }[] };
      };
    };
    widget.id = 'widget';
    widget.style.width = '400px';
    widget.style.height = '300px';
    document.body.append(widget);
    const result = await widget.configure(config);
    (window as any).scenarioChangeCount = 0;
    widget.addEventListener('product-3d-scenario-change', () => {
      (window as any).scenarioChangeCount += 1;
    });
    return {
      outcome: result.outcome,
      scenarioIds: widget.getState().capabilities.scenarios.map((item) => item.id),
    };
  }, configuration);

  expect(initialized.outcome).toBe('ready');
  expect(initialized.scenarioIds).toEqual(['assembly']);

  const startResult = await page.locator('#widget').evaluate(async (widget: any) => (
    widget.startScenario('assembly')
  ));
  expect(startResult).toMatchObject({ accepted: true, outcome: 'completed' });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => ({
    stepIndex: widget.getState().scenario.stepIndex,
    status: widget.getState().scenario.status,
  }))).toEqual({ stepIndex: 0, status: 'holding-final-frame' });

  await page.waitForTimeout(150);
  const eventsBeforeCameraMove = await page.evaluate(() => (window as any).scenarioChangeCount as number);
  const canvas = page.locator('#widget canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.55, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const eventsAfterCameraMove = await page.evaluate(() => (window as any).scenarioChangeCount as number);
  expect(eventsAfterCameraMove).toBe(eventsBeforeCameraMove);

  const nextResult = await page.locator('#widget').evaluate(async (widget: any) => (
    widget.nextScenarioStep()
  ));
  expect(nextResult).toMatchObject({ accepted: true, outcome: 'completed' });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => ({
    stepIndex: widget.getState().scenario.stepIndex,
    status: widget.getState().scenario.status,
  }))).toEqual({ stepIndex: 1, status: 'holding-final-frame' });
});
