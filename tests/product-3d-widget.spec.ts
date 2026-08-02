import { expect, test, type Page } from 'playwright/test';

const configuration = {
  productId: 'product-1',
  glbUrl: '/tests/fixtures/product.gltf',
  colors: [
    { id: 'original', label: 'Original', swatch: '#3366cc', isDefault: true, isBase: true, materialNames: [], hiddenNodeNames: ['RibsNode'] },
    { id: 'red', label: 'Red', swatch: '#ff0000', isDefault: false, isBase: false, materialNames: ['Body'], hiddenNodeNames: ['RibsNode'] },
    { id: 'ribbed', label: 'Ribbed', swatch: '#3366cc', isDefault: false, isBase: false, materialNames: ['Body'], visibleNodeNames: ['RibsNode'] },
  ],
  variants: [
    { id: 'base', label: 'Base', isDefault: true, isBase: true, visibleNodeNames: [], hiddenNodeNames: [] },
    { id: 'alt', label: 'Alternative', isDefault: false, isBase: false, visibleNodeNames: ['AltNode'], hiddenNodeNames: ['BaseNode'] },
  ],
  animations: [
    { id: 'pulse-all', label: 'Pulse all', source: { kind: 'clip', clipName: 'Pulse' }, compatibleVariantIds: ['base', 'alt'] },
    { id: 'pulse-base', label: 'Pulse base', source: { kind: 'range', clipName: 'Pulse', startSeconds: 0.1, endSeconds: 0.8 }, compatibleVariantIds: ['base'] },
  ],
  scenarios: [
    {
      id: 'tour',
      label: 'Tour',
      steps: [
        { id: 'one', description: 'First', animationId: 'pulse-all' },
        { id: 'two', description: 'Second', animationId: 'pulse-base' },
      ],
    },
  ],
};

async function openFixture(page: Page): Promise<void> {
  await page.goto('/tests/fixtures/');
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);
}

async function configureWidget(page: Page, config: object = configuration): Promise<Record<string, unknown>> {
  return page.evaluate(async (value) => {
    const widget = document.createElement('product-3d-widget') as HTMLElement & {
      configure(config: object): Promise<Record<string, unknown>>;
    };
    widget.id = 'widget';
    widget.style.width = '400px';
    document.body.append(widget);
    return widget.configure(value);
  }, config);
}

test('lifecycle, exact host API, immutable state and styling surface', async ({ page }) => {
  await openFixture(page);

  const before = await page.evaluate(() => {
    const ctor = customElements.get('product-3d-widget')!;
    const widget = document.createElement('product-3d-widget') as HTMLElement & { getState(): unknown };
    widget.id = 'widget';
    widget.style.width = '400px';
    document.body.append(widget);
    const prototypeMethods = Object.getOwnPropertyNames(ctor.prototype)
      .filter((name) => !['constructor', 'connectedCallback', 'disconnectedCallback'].includes(name))
      .filter((name) => typeof Object.getOwnPropertyDescriptor(ctor.prototype, name)?.value === 'function')
      .sort();
    const parts = [...widget.shadowRoot!.querySelectorAll('[part]')].map((element) => element.getAttribute('part')).sort();
    const css = widget.shadowRoot!.querySelector('style')!.textContent!;
    return {
      lifecycle: (widget.getState() as { lifecycle: string }).lifecycle,
      prototypeMethods,
      parts,
      customProperties: [...css.matchAll(/--product-3d-[\w-]+/g)].map((match) => match[0]),
      rect: widget.getBoundingClientRect().toJSON(),
      hasStopAnimation: 'stopAnimation' in widget,
    };
  });

  expect(before.lifecycle).toBe('STATE-NOT-CONFIGURED');
  expect(before.prototypeMethods).toEqual([
    'cancelCameraTransition',
    'configure',
    'focusOnNode',
    'focusOnNodes',
    'getState',
    'launchAR',
    'nextScenarioStep',
    'playAnimation',
    'previousScenarioStep',
    'restoreCameraView',
    'selectColor',
    'selectVariant',
    'setCameraView',
    'startScenario',
    'stopScenario',
  ]);
  expect(before.hasStopAnimation).toBe(false);
  expect(before.parts).toEqual(['error', 'loading', 'viewer']);
  expect([...new Set(before.customProperties)]).toEqual(['--product-3d-aspect-ratio']);
  expect(before.rect.width).toBe(400);
  expect(before.rect.height).toBe(300);

  const result = await page.evaluate(async (config) => {
    const widget = document.querySelector('#widget') as HTMLElement & {
      configure(config: object): Promise<{ outcome: string; state: unknown }>;
      getState(): Record<string, unknown>;
    };
    const initialized = await widget.configure(config);
    const state = widget.getState() as Record<string, unknown>;
    const selection = state.selection as Record<string, unknown>;
    const capabilities = state.capabilities as Record<string, unknown>;
    return {
      outcome: initialized.outcome,
      state,
      frozen: Object.isFrozen(state)
        && Object.isFrozen(selection)
        && Object.isFrozen(capabilities)
        && Object.isFrozen(capabilities.colors),
      canvases: widget.shadowRoot!.querySelectorAll('canvas').length,
      loadingHidden: (widget.shadowRoot!.querySelector('[part="loading"]') as HTMLElement).hidden,
      errorHidden: (widget.shadowRoot!.querySelector('[part="error"]') as HTMLElement).hidden,
    };
  }, configuration);

  expect(result.outcome).toBe('ready');
  expect((result.state as { lifecycle: string }).lifecycle).toBe('STATE-READY');
  expect(result.frozen).toBe(true);
  expect(result.canvases).toBe(1);
  expect(result.loadingHidden).toBe(true);
  expect(result.errorHidden).toBe(true);

  await page.evaluate(() => {
    const widget = document.querySelector('#widget') as HTMLElement;
    widget.style.height = '180px';
  });
  await expect.poll(() => page.locator('#widget').evaluate((element) => element.getBoundingClientRect().height)).toBe(180);
});

test('color geometry is composed independently with structural variants', async ({ page }) => {
  await openFixture(page);
  await configureWidget(page);

  const topScreenshot = async (): Promise<Buffer> => {
    const box = await page.locator('#widget').boundingBox();
    if (box === null) throw new Error('widget bounds are unavailable');
    return page.screenshot({
      clip: { x: box.x, y: box.y, width: box.width, height: box.height * 0.38 },
    });
  };

  const original = await topScreenshot();
  await page.locator('#widget').evaluate(async (widget: any) => widget.selectVariant('alt'));
  const originalAfterVariant = await topScreenshot();
  await page.locator('#widget').evaluate(async (widget: any) => widget.selectColor('ribbed'));
  const ribbed = await topScreenshot();
  const stateAfterRibbed = await page.locator('#widget').evaluate((widget: any) => widget.getState());
  await page.locator('#widget').evaluate(async (widget: any) => widget.selectVariant('base'));
  const ribbedAfterVariant = await topScreenshot();
  await page.locator('#widget').evaluate(async (widget: any) => widget.selectColor('original'));
  const restored = await topScreenshot();

  expect(originalAfterVariant.equals(original)).toBe(true);
  expect(ribbed.equals(original)).toBe(false);
  expect(ribbedAfterVariant.equals(ribbed)).toBe(true);
  expect(restored.equals(original)).toBe(true);
  expect(stateAfterRibbed.selection).toEqual({ colorId: 'ribbed', variantId: 'alt' });
});

test('configured UV channel is validated against target meshes', async ({ page }) => {
  await openFixture(page);
  const texture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z6pQAAAAASUVORK5CYII=';
  const result = await configureWidget(page, {
    productId: 'uv-product',
    glbUrl: '/tests/fixtures/product.gltf',
    colors: [
      { id: 'original', label: 'Original', swatch: '#3366cc', isDefault: true, isBase: true, materialNames: [] },
      { id: 'uv1', label: 'UV 1', swatch: '#ffffff', isDefault: false, isBase: false, materialNames: ['Body'], surface: { baseColorTextureUrl: texture, uvChannel: 1 } },
      { id: 'uv2-missing', label: 'UV 2', swatch: '#ffffff', isDefault: false, isBase: false, materialNames: ['Body'], surface: { baseColorTextureUrl: texture, uvChannel: 2 } },
    ],
  });
  expect(result.outcome).toBe('ready');
  const state = await page.locator('#widget').evaluate((widget: any) => widget.getState());
  expect(state.capabilities.colors.map((color: any) => color.id)).toEqual(['original', 'uv1']);
  expect(state.capabilities.localErrors).toContainEqual(expect.objectContaining({ code: 'COLOR_DISABLED', entityId: 'uv2-missing' }));
  const selected = await page.locator('#widget').evaluate(async (widget: any) => widget.selectColor('uv1'));
  expect(selected).toMatchObject({ accepted: true, outcome: 'completed' });
});

test('mandatory rejection is correctable once and accepted assignment is immutable', async ({ page }) => {
  await openFixture(page);
  const result = await page.evaluate(async (valid) => {
    const widget = document.createElement('product-3d-widget') as HTMLElement & {
      configure(config: object): Promise<any>;
      getState(): any;
    };
    document.body.append(widget);
    let events = 0;
    widget.addEventListener('product-3d-state-change', () => { events += 1; });
    const invalid = await widget.configure({ productId: '', glbUrl: '' });
    const afterInvalid = widget.getState();
    const corrected = await widget.configure(valid);
    const acceptedState = widget.getState();
    const eventCountBeforeRepeat = events;
    const repeated = await widget.configure({ ...valid, productId: 'other' });
    return {
      invalid,
      afterInvalid,
      corrected,
      acceptedState,
      repeated,
      repeatEmitted: events !== eventCountBeforeRepeat,
      canvases: widget.shadowRoot!.querySelectorAll('canvas').length,
    };
  }, configuration);

  expect(result.invalid).toMatchObject({ accepted: false, outcome: 'rejected' });
  expect(result.invalid.reason).toBeUndefined();
  expect(result.invalid.errors).toHaveLength(2);
  expect(result.afterInvalid.lifecycle).toBe('STATE-ERROR');
  expect(result.afterInvalid.productId).toBeNull();
  expect(result.corrected.outcome).toBe('ready');
  expect(result.acceptedState.productId).toBe('product-1');
  expect(result.repeated).toMatchObject({ accepted: false, outcome: 'rejected', reason: 'already-configured' });
  expect(result.repeated.state).toEqual(result.acceptedState);
  expect(result.repeatEmitted).toBe(false);
  expect(result.canvases).toBe(1);
});

test('selection, compatibility, animation, scenario and event order are atomic', async ({ page }) => {
  await openFixture(page);
  await configureWidget(page);

  const result = await page.evaluate(async () => {
    const widget = document.querySelector('#widget') as HTMLElement & {
      selectColor(id: string): Promise<any>;
      selectVariant(id: string): Promise<any>;
      playAnimation(id: string): Promise<any>;
      startScenario(id: string): Promise<any>;
      nextScenarioStep(): Promise<any>;
      previousScenarioStep(): Promise<any>;
      stopScenario(): Promise<any>;
      getState(): any;
    };
    const order: string[] = [];
    for (const name of ['product-3d-state-change', 'product-3d-selection-change']) {
      widget.addEventListener(name, () => order.push(name));
    }

    const baseAnimation = await widget.playAnimation('pulse-base');
    const color = await widget.selectColor('red');
    const animationAfterColor = widget.getState().animation;
    const incompatibleVariant = await widget.selectVariant('alt');
    const stateAfterRejectedVariant = widget.getState();
    const replacement = await widget.playAnimation('pulse-all');
    const compatibleVariant = await widget.selectVariant('alt');
    const invalidScenario = await widget.startScenario('tour');
    const stateAfterInvalidScenario = widget.getState();
    await widget.selectVariant('base');
    const scenario = await widget.startScenario('tour');
    const boundaryBack = await widget.previousScenarioStep();
    const next = await widget.nextScenarioStep();
    const boundaryNext = await widget.nextScenarioStep();
    const stopped = await widget.stopScenario();

    return {
      baseAnimation,
      color,
      animationAfterColor,
      incompatibleVariant,
      stateAfterRejectedVariant,
      replacement,
      compatibleVariant,
      invalidScenario,
      stateAfterInvalidScenario,
      scenario,
      boundaryBack,
      next,
      boundaryNext,
      stopped,
      order,
      final: widget.getState(),
    };
  });

  expect(result.baseAnimation.outcome).toBe('completed');
  expect(result.color.outcome).toBe('completed');
  expect(result.animationAfterColor).toEqual({ id: 'pulse-base', status: 'playing' });
  expect(result.incompatibleVariant).toMatchObject({
    accepted: false,
    reason: 'incompatible-variant',
    compatibleVariantIds: ['base'],
  });
  expect(result.stateAfterRejectedVariant.selection.variantId).toBe('base');
  expect(result.stateAfterRejectedVariant.animation.id).toBe('pulse-base');
  expect(result.replacement.state.animation.id).toBe('pulse-all');
  expect(result.compatibleVariant.state.selection.variantId).toBe('alt');
  expect(result.invalidScenario).toMatchObject({ accepted: false, reason: 'incompatible-scenario', compatibleVariantIds: ['base'] });
  expect(result.stateAfterInvalidScenario.animation.id).toBe('pulse-all');
  expect(result.scenario.state).toMatchObject({ lifecycle: 'STATE-SCENARIO-ACTIVE', scenario: { id: 'tour', stepIndex: 0 } });
  expect(result.boundaryBack).toMatchObject({ accepted: false, reason: 'scenario-boundary' });
  expect(result.next.state.scenario.stepIndex).toBe(1);
  expect(result.boundaryNext).toMatchObject({ accepted: false, reason: 'scenario-boundary' });
  expect(result.stopped.state.lifecycle).toBe('STATE-READY');
  expect(result.final.scenario).toMatchObject({ id: null, stepIndex: null, status: 'idle' });
  const selectionIndex = result.order.lastIndexOf('product-3d-selection-change');
  expect(result.order[selectionIndex - 1]).toBe('product-3d-state-change');
});

test('natural completion and scenario final-frame holding are observable', async ({ page }) => {
  await openFixture(page);
  await configureWidget(page);

  await page.evaluate(async () => {
    const widget = document.querySelector('#widget') as any;
    await widget.playAnimation('pulse-all');
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().lifecycle)).toBe('STATE-READY');
  expect(await page.locator('#widget').evaluate((widget: any) => widget.getState().animation)).toEqual({ id: null, status: 'idle' });

  await page.evaluate(async () => {
    const widget = document.querySelector('#widget') as any;
    await widget.startScenario('tour');
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().scenario.status)).toBe('holding-final-frame');
  expect(await page.locator('#widget').evaluate((widget: any) => widget.getState().lifecycle)).toBe('STATE-SCENARIO-ACTIVE');
});

test('resize, disconnect, reconnect and cleanup release owned browser resources', async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    const nativeRaf = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const pending = new Set<number>();
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      let id = 0;
      id = nativeRaf((time) => {
        pending.delete(id);
        callback(time);
      });
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id: number): void => {
      pending.delete(id);
      nativeCancel(id);
    };

    const NativeResizeObserver = window.ResizeObserver;
    let observed = 0;
    let contextListeners = 0;
    window.ResizeObserver = class extends NativeResizeObserver {
      #active = false;
      override observe(target: Element, options?: ResizeObserverOptions): void {
        if (!this.#active) { observed += 1; this.#active = true; }
        super.observe(target, options);
      }
      override disconnect(): void {
        if (this.#active) { observed -= 1; this.#active = false; }
        super.disconnect();
      }
    };
    const add = HTMLCanvasElement.prototype.addEventListener;
    const remove = HTMLCanvasElement.prototype.removeEventListener;
    HTMLCanvasElement.prototype.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
      if (type === 'webglcontextlost') contextListeners += 1;
      add.call(this, type, listener, options);
    };
    HTMLCanvasElement.prototype.removeEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
      if (type === 'webglcontextlost') contextListeners -= 1;
      remove.call(this, type, listener, options);
    };
    Object.assign(window, {
      __resources: {
        pending,
        observed: () => observed,
        contextListeners: () => contextListeners,
      },
    });
  });

  await configureWidget(page);
  const initialCanvas = await page.locator('#widget').evaluate((widget) => {
    const canvas = widget.shadowRoot!.querySelector('canvas')!;
    return { width: canvas.width, height: canvas.height };
  });
  await page.locator('#widget').evaluate((widget: HTMLElement) => {
    widget.style.width = '640px';
    widget.style.height = '360px';
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget) => widget.shadowRoot!.querySelector('canvas')!.width)).not.toBe(initialCanvas.width);

  await page.evaluate(async () => {
    const widget = document.querySelector('#widget') as any;
    await widget.playAnimation('pulse-all');
    widget.remove();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__resources.pending.size)).toBe(0);
  expect(await page.evaluate(() => ({
    observed: (window as any).__resources.observed(),
    contextListeners: (window as any).__resources.contextListeners(),
    canvases: document.querySelectorAll('canvas').length,
    modelViewers: document.querySelectorAll('model-viewer').length,
  }))).toEqual({ observed: 0, contextListeners: 0, canvases: 0, modelViewers: 0 });

  const reconnected = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as any;
    document.body.append(widget);
    const result = await widget.configure(config);
    widget.remove();
    document.body.append(widget);
    while (widget.getState().lifecycle === 'STATE-LOADING-MODEL') await new Promise((resolve) => setTimeout(resolve, 20));
    return {
      initial: result.outcome,
      lifecycle: widget.getState().lifecycle,
      selection: widget.getState().selection,
      canvases: widget.shadowRoot.querySelectorAll('canvas').length,
    };
  }, configuration);
  expect(reconnected).toEqual({
    initial: 'ready',
    lifecycle: 'STATE-READY',
    selection: { colorId: 'original', variantId: 'base' },
    canvases: 1,
  });
});

test('WebGL context recovery is single-attempt and a second loss becomes blocking', async ({ page }) => {
  await openFixture(page);
  await configureWidget(page);
  await page.locator('#widget').evaluate((widget) => {
    widget.shadowRoot!.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => ({
    lifecycle: widget.getState().lifecycle,
    canvases: widget.shadowRoot.querySelectorAll('canvas').length,
  }))).toEqual({ lifecycle: 'STATE-READY', canvases: 1 });

  await page.locator('#widget').evaluate((widget) => {
    widget.shadowRoot!.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().error?.code)).toBe('WEBGL_RECOVERY_FAILED');
});

test('mode-neutral AR exposes only availability and publicly observed WebXR lifecycle', async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    const ctor = customElements.get('model-viewer')!;
    let available = false;
    let activations = 0;
    Object.defineProperty(ctor.prototype, 'canActivateAR', {
      configurable: true,
      get: () => available,
    });
    Object.defineProperty(ctor.prototype, 'activateAR', {
      configurable: true,
      value: async () => { activations += 1; },
    });
    Object.assign(window, {
      __setArAvailable(value: boolean) { available = value; },
      __arActivations() { return activations; },
    });
  });

  await configureWidget(page, { ...configuration, ar: { enabled: true } });
  expect(await page.locator('#widget').evaluate((widget: any) => widget.getState().ar.available)).toBe(false);

  await page.locator('#widget').evaluate((widget) => {
    (window as any).__setArAvailable(true);
    widget.shadowRoot!.querySelector('model-viewer')!.dispatchEvent(new Event('load'));
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().ar.available)).toBe(true);

  await page.evaluate(() => {
    const widget = document.querySelector('#widget') as any;
    const events: string[] = [];
    widget.addEventListener('product-3d-ar-launched', () => events.push('launched'));
    widget.addEventListener('product-3d-ar-returned', () => events.push('returned'));
    const button = document.createElement('button');
    button.id = 'launch';
    button.addEventListener('click', async () => {
      (window as any).__launchResult = await widget.launchAR();
      (window as any).__arEvents = events;
    });
    document.body.append(button);
  });
  await page.click('#launch');
  await expect.poll(() => page.evaluate(() => (window as any).__launchResult?.outcome)).toBe('initiated');
  expect(await page.evaluate(() => ({
    lifecycle: (document.querySelector('#widget') as any).getState().lifecycle,
    activations: (window as any).__arActivations(),
    events: (window as any).__arEvents,
  }))).toEqual({ lifecycle: 'STATE-READY', activations: 1, events: [] });

  await page.locator('#widget').evaluate((widget) => {
    widget.shadowRoot!.querySelector('model-viewer')!.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'session-started' } }));
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().lifecycle)).toBe('STATE-AR-ACTIVE');

  const beforeFocusSignals = await page.locator('#widget').evaluate((widget: any) => JSON.stringify(widget.getState()));
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  expect(await page.locator('#widget').evaluate((widget: any) => JSON.stringify(widget.getState()))).toBe(beforeFocusSignals);

  await page.locator('#widget').evaluate((widget) => {
    widget.shadowRoot!.querySelector('model-viewer')!.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'not-presenting' } }));
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().lifecycle)).toBe('STATE-READY');
  const publicState = await page.locator('#widget').evaluate((widget: any) => widget.getState());
  expect(publicState.ar).toEqual({ available: true, webxrActive: false });
  expect(JSON.stringify(publicState)).not.toMatch(/scene-viewer|quick-look|selectedMode|arMode/i);
});

test('AR selection assets preload the exact confirmed color and structural source before launch', async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    const ctor = customElements.get('model-viewer')!;
    let activations = 0;
    Object.defineProperty(ctor.prototype, 'canActivateAR', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(ctor.prototype, 'activateAR', {
      configurable: true,
      value: async () => { activations += 1; },
    });
    Object.assign(window, { __arActivations: () => activations });
  });

  await configureWidget(page, {
    ...configuration,
    ar: {
      enabled: true,
      selectionAssets: [
        { colorId: 'original', variantId: 'base', glbUrl: '/tests/fixtures/product.gltf?ar=original-base' },
        { colorId: 'red', variantId: 'base', glbUrl: '/tests/fixtures/product.gltf?ar=red-base' },
        {
          colorId: 'red',
          variantId: 'alt',
          glbUrl: '/tests/fixtures/product.gltf?ar=red-alt',
          usdzUrl: '/tests/fixtures/product.usdz?ar=red-alt',
        },
      ],
    },
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().ar.available)).toBe(true);

  const initial = await page.locator('#widget').evaluate((widget) => {
    const element = widget.shadowRoot!.querySelector('model-viewer') as any;
    return { src: element.src, iosSrc: element.iosSrc };
  });
  expect(initial.src).toContain('product.gltf?ar=original-base');
  expect(initial.iosSrc).toBeNull();

  expect(await page.locator('#widget').evaluate(async (widget: any) => (await widget.selectColor('red')).outcome)).toBe('completed');
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().ar.available)).toBe(true);
  const redBase = await page.locator('#widget').evaluate((widget) => {
    const element = widget.shadowRoot!.querySelector('model-viewer') as any;
    return { src: element.src, iosSrc: element.iosSrc };
  });
  expect(redBase.src).toContain('product.gltf?ar=red-base');
  expect(redBase.iosSrc).toBeNull();

  expect(await page.locator('#widget').evaluate(async (widget: any) => (await widget.selectVariant('alt')).outcome)).toBe('completed');
  const redAlt = await page.locator('#widget').evaluate((widget) => {
    const element = widget.shadowRoot!.querySelector('model-viewer') as any;
    return { src: element.src, iosSrc: element.iosSrc, selection: (widget as any).getState().selection };
  });
  expect(redAlt.src).toContain('product.gltf?ar=red-alt');
  expect(redAlt.iosSrc).toContain('product.usdz?ar=red-alt');
  expect(redAlt.selection).toEqual({ colorId: 'red', variantId: 'alt' });

  await page.evaluate(() => {
    const widget = document.querySelector('#widget') as any;
    const button = document.createElement('button');
    button.id = 'launch-selection-asset';
    button.addEventListener('click', async () => {
      (window as any).__selectionAssetLaunch = await widget.launchAR();
    });
    document.body.append(button);
  });
  await page.click('#launch-selection-asset');
  await expect.poll(() => page.evaluate(() => (window as any).__selectionAssetLaunch?.outcome)).toBe('initiated');
  expect(await page.evaluate(() => (window as any).__arActivations())).toBe(1);
});

test('missing exact AR selection asset preserves the viewer selection and blocks stale launch', async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    const ctor = customElements.get('model-viewer')!;
    let activations = 0;
    Object.defineProperty(ctor.prototype, 'canActivateAR', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(ctor.prototype, 'activateAR', {
      configurable: true,
      value: async () => { activations += 1; },
    });
    Object.assign(window, { __arActivations: () => activations });
  });

  await configureWidget(page, {
    ...configuration,
    ar: {
      enabled: true,
      selectionAssets: [
        { colorId: 'original', variantId: 'base', glbUrl: '/tests/fixtures/product.gltf?ar=original-base' },
        { colorId: 'red', variantId: 'base', glbUrl: '/tests/fixtures/product.gltf?ar=red-base' },
      ],
    },
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().ar.available)).toBe(true);
  await page.locator('#widget').evaluate((widget) => {
    (widget as any).__arErrors = [];
    widget.addEventListener('product-3d-error', (event: Event) => {
      (widget as any).__arErrors.push((event as CustomEvent).detail.error.code);
    });
  });

  expect(await page.locator('#widget').evaluate(async (widget: any) => (await widget.selectColor('red')).outcome)).toBe('completed');
  const outcome = await page.locator('#widget').evaluate(async (widget: any) => (await widget.selectVariant('alt')).outcome);
  expect(outcome).toBe('completed');

  const state = await page.locator('#widget').evaluate((widget: any) => ({
    selection: widget.getState().selection,
    ar: widget.getState().ar,
    errors: widget.__arErrors,
    src: widget.shadowRoot.querySelector('model-viewer').src,
  }));
  expect(state.selection).toEqual({ colorId: 'red', variantId: 'alt' });
  expect(state.ar.available).toBe(false);
  expect(state.errors).toContain('AR_SYNC_FAILED');
  expect(state.src).toContain('product.gltf?ar=red-base');

  const launch = await page.locator('#widget').evaluate(async (widget: any) => widget.launchAR());
  expect(launch).toMatchObject({ accepted: false, outcome: 'rejected', reason: 'ar-unavailable' });
  expect(await page.evaluate(() => (window as any).__arActivations())).toBe(0);
});

test('WebGL2 absence and primary GLB failure produce exact blocking outcomes', async ({ page }) => {
  await openFixture(page);
  const webgl = await page.evaluate(async (config) => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(contextId: string, options?: unknown): RenderingContext | null {
      if (contextId === 'webgl2') return null;
      return original.call(this, contextId as any, options as any) as RenderingContext | null;
    };
    const widget = document.createElement('product-3d-widget') as any;
    document.body.append(widget);
    const result = await widget.configure(config);
    HTMLCanvasElement.prototype.getContext = original;
    return result;
  }, configuration);
  expect(webgl).toMatchObject({ accepted: true, outcome: 'failed', error: { code: 'WEBGL2_UNAVAILABLE' } });

  await page.reload();
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);
  const glb = await page.evaluate(async () => {
    const widget = document.createElement('product-3d-widget') as any;
    document.body.append(widget);
    const result = await widget.configure({ productId: 'broken', glbUrl: '/tests/fixtures/missing.glb' });
    widget.remove();
    document.body.append(widget);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      result,
      reconnectLifecycle: widget.getState().lifecycle,
      canvases: widget.shadowRoot.querySelectorAll('canvas').length,
    };
  });
  expect(glb.result).toMatchObject({ accepted: true, outcome: 'failed', error: { code: 'PRIMARY_GLB_FAILED' } });
  expect(glb.reconnectLifecycle).toBe('STATE-ERROR');
  expect(glb.canvases).toBe(0);
});
