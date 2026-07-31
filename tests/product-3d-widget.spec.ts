import { expect, test, type Page } from 'playwright/test';

const configuration = {
  productId: 'product-1',
  glbUrl: '/tests/fixtures/product.gltf',
  colors: [
    { id: 'original', label: 'Original', swatch: '#3366cc', isDefault: true, isBase: true, materialNames: [] },
    { id: 'red', label: 'Red', swatch: '#ff0000', isDefault: false, isBase: false, materialNames: ['Body'] },
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
    {
      id: 'tour-short',
      label: 'Short tour',
      steps: [
        { id: 'only', description: 'Only step', animationId: 'pulse-all' },
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
    'configure',
    'getState',
    'launchAR',
    'nextScenarioStep',
    'playAnimation',
    'previousScenarioStep',
    'selectColor',
    'selectVariant',
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
      mutationPreserved: (() => {
        const before = JSON.stringify(widget.getState());
        Reflect.set(selection, 'colorId', 'tampered');
        Reflect.set(capabilities.colors as object, '0', { id: 'tampered', label: 'Tampered' });
        return JSON.stringify(widget.getState()) === before;
      })(),
      canvases: widget.shadowRoot!.querySelectorAll('canvas').length,
      loadingHidden: (widget.shadowRoot!.querySelector('[part="loading"]') as HTMLElement).hidden,
      errorHidden: (widget.shadowRoot!.querySelector('[part="error"]') as HTMLElement).hidden,
    };
  }, configuration);

  expect(result.outcome).toBe('ready');
  expect((result.state as { lifecycle: string }).lifecycle).toBe('STATE-READY');
  expect(result.frozen).toBe(true);
  expect(result.mutationPreserved).toBe(true);
  expect(result.canvases).toBe(1);
  expect(result.loadingHidden).toBe(true);
  expect(result.errorHidden).toBe(true);

  await page.evaluate(() => {
    const widget = document.querySelector('#widget') as HTMLElement;
    widget.style.setProperty('--product-3d-aspect-ratio', '1 / 1');
  });
  await expect.poll(() => page.locator('#widget').evaluate((element) => element.getBoundingClientRect().height)).toBe(400);

  await page.evaluate(() => {
    const widget = document.querySelector('#widget') as HTMLElement;
    widget.style.height = '180px';
  });
  await expect.poll(() => page.locator('#widget').evaluate((element) => element.getBoundingClientRect().height)).toBe(180);
});

test('all pre-ready commands reject without events or queued execution', async ({ page }) => {
  await openFixture(page);
  const result = await page.evaluate(async (config) => {
    const disconnected = document.createElement('product-3d-widget') as any;
    const disconnectedConfigure = await disconnected.configure(config);

    const widget = document.createElement('product-3d-widget') as any;
    document.body.append(widget);
    const events: string[] = [];
    for (const name of [
      'product-3d-state-change',
      'product-3d-selection-change',
      'product-3d-animation-change',
      'product-3d-scenario-change',
      'product-3d-ar-availability-change',
      'product-3d-ar-launched',
      'product-3d-ar-returned',
      'product-3d-error',
    ]) widget.addEventListener(name, () => events.push(name));

    const stateBefore = widget.getState();
    const eventCountBefore = events.length;
    const rejected = await Promise.all([
      widget.selectColor('red'),
      widget.selectVariant('alt'),
      widget.playAnimation('pulse-all'),
      widget.startScenario('tour'),
      widget.previousScenarioStep(),
      widget.nextScenarioStep(),
      widget.stopScenario(),
      widget.launchAR(),
    ]);
    const eventsAfterRejected = events.slice(eventCountBefore);
    const initialized = await widget.configure(config);
    return {
      disconnectedConfigure,
      stateBefore,
      rejected,
      eventsAfterRejected,
      initialized,
      final: widget.getState(),
    };
  }, configuration);

  expect(result.disconnectedConfigure).toMatchObject({ accepted: false, outcome: 'rejected', reason: 'disconnected' });
  expect(result.stateBefore.lifecycle).toBe('STATE-NOT-CONFIGURED');
  expect(result.rejected.map((item: any) => item.accepted)).toEqual(Array(8).fill(false));
  expect(result.rejected.map((item: any) => item.reason)).toEqual([
    'not-ready',
    'not-ready',
    'not-ready',
    'not-ready',
    'no-active-scenario',
    'no-active-scenario',
    'no-active-scenario',
    'not-ready',
  ]);
  expect(result.eventsAfterRejected).toEqual([]);
  expect(result.initialized.outcome).toBe('ready');
  expect(result.final.selection).toEqual({ colorId: 'original', variantId: 'base' });
  expect(result.final.animation).toEqual({ id: null, status: 'idle' });
  expect(result.final.scenario).toMatchObject({ id: null, stepIndex: null, status: 'idle' });
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
    const replacementOrder: string[] = [];
    for (const name of ['product-3d-state-change', 'product-3d-animation-change']) {
      widget.addEventListener(name, () => replacementOrder.push(name), { once: true });
    }
    const replacement = await widget.playAnimation('pulse-all').then((value: any) => {
      replacementOrder.push('resolved');
      return value;
    });
    const compatibleVariant = await widget.selectVariant('alt');
    const invalidScenario = await widget.startScenario('tour');
    const stateAfterInvalidScenario = widget.getState();
    await widget.selectVariant('base');
    const scenarioOrder: string[] = [];
    for (const name of ['product-3d-state-change', 'product-3d-scenario-change', 'product-3d-animation-change']) {
      widget.addEventListener(name, () => scenarioOrder.push(name), { once: true });
    }
    const scenario = await widget.startScenario('tour').then((value: any) => {
      scenarioOrder.push('resolved');
      return value;
    });
    const boundaryBack = await widget.previousScenarioStep();
    const next = await widget.nextScenarioStep();
    const boundaryNext = await widget.nextScenarioStep();
    const beforeInvalidReplacement = widget.getState();
    const invalidReplacement = await widget.startScenario('missing-scenario');
    const afterInvalidReplacement = widget.getState();
    const restarted = await widget.startScenario('tour');
    const replaced = await widget.startScenario('tour-short');
    const stopped = await widget.stopScenario();

    return {
      baseAnimation,
      color,
      animationAfterColor,
      incompatibleVariant,
      stateAfterRejectedVariant,
      replacement,
      replacementOrder,
      compatibleVariant,
      invalidScenario,
      stateAfterInvalidScenario,
      scenario,
      scenarioOrder,
      boundaryBack,
      next,
      boundaryNext,
      beforeInvalidReplacement,
      invalidReplacement,
      afterInvalidReplacement,
      restarted,
      replaced,
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
  expect(result.replacementOrder).toEqual(['product-3d-state-change', 'product-3d-animation-change', 'resolved']);
  expect(result.compatibleVariant.state.selection.variantId).toBe('alt');
  expect(result.invalidScenario).toMatchObject({ accepted: false, reason: 'incompatible-scenario', compatibleVariantIds: ['base'] });
  expect(result.stateAfterInvalidScenario.animation.id).toBe('pulse-all');
  expect(result.scenario.state).toMatchObject({ lifecycle: 'STATE-SCENARIO-ACTIVE', scenario: { id: 'tour', stepIndex: 0 } });
  expect(result.scenarioOrder).toEqual([
    'product-3d-state-change',
    'product-3d-scenario-change',
    'product-3d-animation-change',
    'resolved',
  ]);
  expect(result.boundaryBack).toMatchObject({ accepted: false, reason: 'scenario-boundary' });
  expect(result.next.state.scenario.stepIndex).toBe(1);
  expect(result.boundaryNext).toMatchObject({ accepted: false, reason: 'scenario-boundary' });
  expect(result.invalidReplacement).toMatchObject({ accepted: false, reason: 'unknown-scenario' });
  expect(result.afterInvalidReplacement).toEqual(result.beforeInvalidReplacement);
  expect(result.restarted.state.scenario).toMatchObject({ id: 'tour', stepIndex: 0, status: 'playing' });
  expect(result.replaced.state.scenario).toMatchObject({ id: 'tour-short', stepIndex: 0, status: 'playing' });
  expect(result.stopped.state.lifecycle).toBe('STATE-READY');
  expect(result.final.scenario).toMatchObject({ id: null, stepIndex: null, status: 'idle' });
  const selectionIndex = result.order.lastIndexOf('product-3d-selection-change');
  expect(result.order[selectionIndex - 1]).toBe('product-3d-state-change');
});

test('accepted animation and scenario start failures commit ordinary state before error', async ({ page }) => {
  await openFixture(page);
  await configureWidget(page);

  const result = await page.evaluate(async () => {
    const widget = document.querySelector('#widget') as any;
    const viewerModule = await import('/src/three-viewer.ts');
    const ThreeViewer = viewerModule.ThreeViewer;

    await widget.playAnimation('pulse-all');
    const originalPlayAnimation = ThreeViewer.prototype.playAnimation;
    const originalStartScenario = ThreeViewer.prototype.startScenario;
    const animationOrder: string[] = [];
    for (const name of ['product-3d-state-change', 'product-3d-animation-change', 'product-3d-error']) {
      widget.addEventListener(name, () => animationOrder.push(name), { once: true });
    }
    ThreeViewer.prototype.playAnimation = async function(animationId: string): Promise<any> {
      await this.stopAnimationAndReset('replacement');
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: 'VIEWER_OPERATION_FAILED',
          scope: 'animation',
          message: 'Synthetic accepted animation failure.',
          entityId: animationId,
        }),
      });
    };
    const animationPromise = widget.playAnimation('pulse-base').then((value: any) => {
      animationOrder.push('resolved');
      return value;
    });
    const animationFailure = await animationPromise;
    ThreeViewer.prototype.playAnimation = originalPlayAnimation;

    await widget.playAnimation('pulse-all');
    const scenarioOrder: string[] = [];
    for (const name of ['product-3d-state-change', 'product-3d-scenario-change', 'product-3d-animation-change', 'product-3d-error']) {
      widget.addEventListener(name, () => scenarioOrder.push(name), { once: true });
    }
    ThreeViewer.prototype.startScenario = async function(scenarioId: string): Promise<any> {
      await this.stopAnimationAndReset('scenario');
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: 'VIEWER_OPERATION_FAILED',
          scope: 'scenario',
          message: 'Synthetic accepted scenario failure.',
          entityId: scenarioId,
        }),
      });
    };
    const scenarioPromise = widget.startScenario('tour').then((value: any) => {
      scenarioOrder.push('resolved');
      return value;
    });
    const scenarioFailure = await scenarioPromise;
    ThreeViewer.prototype.startScenario = originalStartScenario;

    return {
      animationFailure,
      animationOrder,
      scenarioFailure,
      scenarioOrder,
      final: widget.getState(),
    };
  });

  expect(result.animationFailure).toMatchObject({
    accepted: true,
    outcome: 'failed',
    state: { lifecycle: 'STATE-READY', animation: { id: null, status: 'idle' } },
  });
  expect(result.animationOrder).toEqual([
    'product-3d-state-change',
    'product-3d-animation-change',
    'product-3d-error',
    'resolved',
  ]);
  expect(result.scenarioFailure).toMatchObject({
    accepted: true,
    outcome: 'failed',
    state: {
      lifecycle: 'STATE-READY',
      animation: { id: null, status: 'idle' },
      scenario: { id: null, stepIndex: null, status: 'idle' },
    },
  });
  expect(result.scenarioOrder).toEqual([
    'product-3d-state-change',
    'product-3d-scenario-change',
    'product-3d-animation-change',
    'product-3d-error',
    'resolved',
  ]);
  expect(result.final.lifecycle).toBe('STATE-READY');
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
  await page.evaluate(async () => {
    const source = await fetch('/src/three-viewer.ts').then((response) => response.text());
    const threeImport = source.match(/from\s*["']([^"']*\/three\.js[^"']*)["']/)?.[1];
    if (threeImport === undefined) throw new Error('Unable to resolve the transformed Three.js import.');
    const three = await import(threeImport) as typeof import('three');

    const nativeRendererDispose = three.WebGLRenderer.prototype.dispose;
    const nativeForceContextLoss = three.WebGLRenderer.prototype.forceContextLoss;
    const nativeGeometryDispose = three.BufferGeometry.prototype.dispose;
    const nativeMaterialDispose = three.Material.prototype.dispose;
    let rendererDispose = 0;
    let forceContextLoss = 0;
    let geometryDispose = 0;
    let materialDispose = 0;
    three.WebGLRenderer.prototype.dispose = function(): void {
      rendererDispose += 1;
      nativeRendererDispose.call(this);
    };
    three.WebGLRenderer.prototype.forceContextLoss = function(): void {
      forceContextLoss += 1;
      nativeForceContextLoss.call(this);
    };
    three.BufferGeometry.prototype.dispose = function(): void {
      geometryDispose += 1;
      nativeGeometryDispose.call(this);
    };
    three.Material.prototype.dispose = function(): void {
      materialDispose += 1;
      nativeMaterialDispose.call(this);
    };

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

    const nativeObserve = ResizeObserver.prototype.observe;
    const nativeDisconnect = ResizeObserver.prototype.disconnect;
    const activeObservers = new WeakSet<ResizeObserver>();
    let observed = 0;
    ResizeObserver.prototype.observe = function(target: Element, options?: ResizeObserverOptions): void {
      if (!activeObservers.has(this)) {
        activeObservers.add(this);
        observed += 1;
      }
      nativeObserve.call(this, target, options);
    };
    ResizeObserver.prototype.disconnect = function(): void {
      if (activeObservers.delete(this)) observed -= 1;
      nativeDisconnect.call(this);
    };

    let contextListeners = 0;
    const canvasAdd = HTMLCanvasElement.prototype.addEventListener;
    const canvasRemove = HTMLCanvasElement.prototype.removeEventListener;
    HTMLCanvasElement.prototype.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
      if (type === 'webglcontextlost') contextListeners += 1;
      canvasAdd.call(this, type, listener, options);
    };
    HTMLCanvasElement.prototype.removeEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
      if (type === 'webglcontextlost') contextListeners -= 1;
      canvasRemove.call(this, type, listener, options);
    };

    const modelViewer = customElements.get('model-viewer')!;
    const modelViewerAdd = modelViewer.prototype.addEventListener;
    const modelViewerRemove = modelViewer.prototype.removeEventListener;
    let arStatusListeners = 0;
    modelViewer.prototype.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
      if (type === 'ar-status' && this.getAttribute('aria-hidden') === 'true') arStatusListeners += 1;
      modelViewerAdd.call(this, type, listener, options);
    };
    modelViewer.prototype.removeEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
      if (type === 'ar-status' && this.getAttribute('aria-hidden') === 'true') arStatusListeners -= 1;
      modelViewerRemove.call(this, type, listener, options);
    };

    Object.assign(window, {
      __resources: {
        pending,
        observed: () => observed,
        contextListeners: () => contextListeners,
        arStatusListeners: () => arStatusListeners,
        rendererDispose: () => rendererDispose,
        forceContextLoss: () => forceContextLoss,
        geometryDispose: () => geometryDispose,
        materialDispose: () => materialDispose,
      },
    });
  });

  await configureWidget(page, { ...configuration, ar: { enabled: true } });
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
    const canvas = widget.shadowRoot.querySelector('canvas') as HTMLCanvasElement;
    Object.assign(window, {
      __removedWidget: widget,
      __removedContext: canvas.getContext('webgl2'),
    });
    widget.remove();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__resources.pending.size)).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).__resources.forceContextLoss())).toBe(1);
  expect(await page.evaluate(() => {
    const widget = (window as any).__removedWidget as HTMLElement;
    return {
      observed: (window as any).__resources.observed(),
      contextListeners: (window as any).__resources.contextListeners(),
      arStatusListeners: (window as any).__resources.arStatusListeners(),
      rendererDispose: (window as any).__resources.rendererDispose(),
      forceContextLoss: (window as any).__resources.forceContextLoss(),
      geometryDispose: (window as any).__resources.geometryDispose(),
      materialDispose: (window as any).__resources.materialDispose(),
      contextLost: (window as any).__removedContext.isContextLost(),
      canvases: widget.shadowRoot!.querySelectorAll('canvas').length,
      modelViewers: widget.shadowRoot!.querySelectorAll('model-viewer').length,
    };
  })).toEqual({
    observed: 0,
    contextListeners: 0,
    arStatusListeners: 0,
    rendererDispose: 1,
    forceContextLoss: 1,
    geometryDispose: 1,
    materialDispose: 1,
    contextLost: true,
    canvases: 0,
    modelViewers: 0,
  });

  const reconnected = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as any;
    document.body.append(widget);
    const result = await widget.configure(config);
    const selection = widget.getState().selection;
    widget.remove();
    document.body.append(widget);
    while (widget.getState().lifecycle === 'STATE-LOADING-MODEL') await new Promise((resolve) => setTimeout(resolve, 20));
    return {
      initial: result.outcome,
      lifecycle: widget.getState().lifecycle,
      selection,
      reconnectedSelection: widget.getState().selection,
      canvases: widget.shadowRoot.querySelectorAll('canvas').length,
    };
  }, configuration);
  expect(reconnected).toEqual({
    initial: 'ready',
    lifecycle: 'STATE-READY',
    selection: { colorId: 'original', variantId: 'base' },
    reconnectedSelection: { colorId: 'original', variantId: 'base' },
    canvases: 1,
  });
});

test('a stale disconnected initialization cannot commit after a fresh reconnect cycle', async ({ page }) => {
  await openFixture(page);
  const result = await page.evaluate(async (config) => {
    const nativeFetch = window.fetch.bind(window);
    let requestCount = 0;
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/tests/fixtures/product.gltf')) {
        requestCount += 1;
        if (requestCount === 1) await firstGate;
      }
      return nativeFetch(input, init);
    };

    const widget = document.createElement('product-3d-widget') as any;
    document.body.append(widget);
    let readyEvents = 0;
    widget.addEventListener('product-3d-state-change', (event: CustomEvent) => {
      if (event.detail.lifecycle === 'STATE-READY') readyEvents += 1;
    });
    const stale = widget.configure(config);
    while (requestCount < 1) await new Promise((resolve) => setTimeout(resolve, 0));
    widget.remove();
    document.body.append(widget);
    while (requestCount < 2) await new Promise((resolve) => setTimeout(resolve, 0));
    while (widget.getState().lifecycle !== 'STATE-READY') await new Promise((resolve) => setTimeout(resolve, 10));
    const fresh = widget.getState();
    releaseFirst();
    const staleResult = await stale;
    await new Promise((resolve) => setTimeout(resolve, 50));
    window.fetch = nativeFetch;
    return {
      staleResult,
      fresh,
      final: widget.getState(),
      readyEvents,
      canvases: widget.shadowRoot.querySelectorAll('canvas').length,
    };
  }, configuration);

  expect(result.staleResult).toMatchObject({ accepted: false, outcome: 'rejected', reason: 'disconnected' });
  expect(result.final).toEqual(result.fresh);
  expect(result.readyEvents).toBe(1);
  expect(result.canvases).toBe(1);
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
  const initial = await page.locator('#widget').evaluate((widget: any) => {
    const modelViewer = widget.shadowRoot.querySelector('model-viewer');
    return {
      sourcePath: new URL(modelViewer.src).pathname,
      iosSrc: modelViewer.iosSrc,
      available: widget.getState().ar.available,
    };
  });
  expect(initial).toEqual({ sourcePath: '/tests/fixtures/product.gltf', iosSrc: null, available: false });

  await page.locator('#widget').evaluate((widget) => {
    (window as any).__setArAvailable(true);
    widget.shadowRoot!.querySelector('model-viewer')!.dispatchEvent(new Event('load'));
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().ar.available)).toBe(true);

  const withoutActivation = await page.locator('#widget').evaluate((widget: any) => widget.launchAR());
  expect(withoutActivation).toMatchObject({ accepted: false, outcome: 'rejected', reason: 'user-activation-required' });
  expect(await page.evaluate(() => (window as any).__arActivations())).toBe(0);

  await page.evaluate(async () => {
    const widget = document.querySelector('#widget') as any;
    await widget.playAnimation('pulse-all');
    const events: string[] = [];
    for (const name of [
      'product-3d-state-change',
      'product-3d-animation-change',
      'product-3d-ar-launched',
      'product-3d-ar-returned',
      'product-3d-error',
    ]) widget.addEventListener(name, () => events.push(name));
    const button = document.createElement('button');
    button.id = 'launch';
    button.addEventListener('click', async () => {
      (window as any).__launchResult = await widget.launchAR();
      events.push('resolved');
    });
    document.body.append(button);
    Object.assign(window, { __arEvents: events });
  });
  await page.click('#launch');
  await expect.poll(() => page.evaluate(() => (window as any).__launchResult?.outcome)).toBe('initiated');
  expect(await page.evaluate(() => ({
    lifecycle: (document.querySelector('#widget') as any).getState().lifecycle,
    animation: (document.querySelector('#widget') as any).getState().animation,
    activations: (window as any).__arActivations(),
    events: (window as any).__arEvents,
  }))).toEqual({
    lifecycle: 'STATE-READY',
    animation: { id: null, status: 'idle' },
    activations: 1,
    events: ['product-3d-state-change', 'product-3d-animation-change', 'resolved'],
  });

  await page.locator('#widget').evaluate((widget) => {
    const modelViewer = widget.shadowRoot!.querySelector('model-viewer')!;
    modelViewer.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'not-presenting' } }));
    modelViewer.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'session-started' } }));
    modelViewer.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'session-started' } }));
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().lifecycle)).toBe('STATE-AR-ACTIVE');
  expect(await page.evaluate(() => (window as any).__arEvents.filter((name: string) => name === 'product-3d-ar-launched').length)).toBe(1);

  const beforeFocusSignals = await page.locator('#widget').evaluate((widget: any) => JSON.stringify(widget.getState()));
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  expect(await page.locator('#widget').evaluate((widget: any) => JSON.stringify(widget.getState()))).toBe(beforeFocusSignals);

  await page.locator('#widget').evaluate((widget) => {
    const modelViewer = widget.shadowRoot!.querySelector('model-viewer')!;
    modelViewer.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'not-presenting' } }));
    modelViewer.dispatchEvent(new CustomEvent('ar-status', { detail: { status: 'not-presenting' } }));
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().lifecycle)).toBe('STATE-READY');
  const publicState = await page.locator('#widget').evaluate((widget: any) => widget.getState());
  expect(publicState.ar).toEqual({ available: true, webxrActive: false });
  expect(publicState.animation).toEqual({ id: null, status: 'idle' });
  expect(await page.evaluate(() => (window as any).__arEvents.filter((name: string) => name === 'product-3d-ar-returned').length)).toBe(1);
  expect(JSON.stringify(publicState)).not.toMatch(/scene-viewer|quick-look|selectedMode|arMode/i);
});

test('AR maps usable USDZ and preserves GLB fallback for unusable USDZ', async ({ page }) => {
  await openFixture(page);
  const usable = await configureWidget(page, {
    ...configuration,
    productId: 'usable-usdz',
    usdzUrl: '/tests/fixtures/product.usdz',
    ar: { enabled: true },
  });
  expect(usable.outcome).toBe('ready');
  expect(await page.locator('#widget').evaluate((widget: any) => {
    const modelViewer = widget.shadowRoot.querySelector('model-viewer');
    return {
      sourcePath: new URL(modelViewer.src).pathname,
      iosPath: new URL(modelViewer.iosSrc, document.baseURI).pathname,
    };
  })).toEqual({ sourcePath: '/tests/fixtures/product.gltf', iosPath: '/tests/fixtures/product.usdz' });

  await page.reload();
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);
  const unusable = await configureWidget(page, {
    ...configuration,
    productId: 'unusable-usdz',
    usdzUrl: 'http://[',
    ar: { enabled: true },
  });
  expect(unusable.outcome).toBe('ready');
  expect(await page.locator('#widget').evaluate((widget: any) => {
    const state = widget.getState();
    const modelViewer = widget.shadowRoot.querySelector('model-viewer');
    return {
      sourcePath: new URL(modelViewer.src).pathname,
      iosSrc: modelViewer.iosSrc,
      errorCodes: state.capabilities.localErrors.map((error: any) => error.code),
    };
  })).toEqual({ sourcePath: '/tests/fixtures/product.gltf', iosSrc: null, errorCodes: ['USDZ_UNUSABLE'] });
});

test('observable activateAR failure is accepted, generic and mode-neutral', async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    const ctor = customElements.get('model-viewer')!;
    Object.defineProperty(ctor.prototype, 'canActivateAR', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(ctor.prototype, 'activateAR', {
      configurable: true,
      value: async () => { throw new Error('platform request rejected'); },
    });
  });
  await configureWidget(page, { ...configuration, ar: { enabled: true } });
  await page.locator('#widget').evaluate((widget) => {
    widget.shadowRoot!.querySelector('model-viewer')!.dispatchEvent(new Event('load'));
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().ar.available)).toBe(true);

  await page.evaluate(() => {
    const widget = document.querySelector('#widget') as any;
    const errors: unknown[] = [];
    widget.addEventListener('product-3d-error', (event: CustomEvent) => errors.push(event.detail));
    const button = document.createElement('button');
    button.id = 'launch-failure';
    button.addEventListener('click', async () => {
      (window as any).__failedLaunch = await widget.launchAR();
      (window as any).__failedLaunchErrors = errors;
    });
    document.body.append(button);
  });
  await page.click('#launch-failure');
  await expect.poll(() => page.evaluate(() => (window as any).__failedLaunch?.outcome)).toBe('failed');
  const result = await page.evaluate(() => ({
    result: (window as any).__failedLaunch,
    errors: (window as any).__failedLaunchErrors,
    state: (document.querySelector('#widget') as any).getState(),
  }));
  expect(result.result).toMatchObject({
    accepted: true,
    outcome: 'failed',
    error: { code: 'AR_REQUEST_FAILED', scope: 'ar' },
    state: { lifecycle: 'STATE-READY' },
  });
  expect(result.errors).toHaveLength(1);
  expect(JSON.stringify(result)).not.toMatch(/scene-viewer|quick-look|selectedMode|arMode/i);
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
