import { expect, test, type Page } from 'playwright/test';

const configuration = {
  productId: 'cleanup-product',
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
      id: 'pulse',
      label: 'Pulse',
      source: { kind: 'clip', clipName: 'Pulse' },
      compatibleVariantIds: ['base'],
    },
  ],
  ar: { enabled: true },
};

async function openFixture(page: Page): Promise<void> {
  await page.goto('/tests/fixtures/');
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);
}

test('owned browser resources are released across resize and reconnect cycles', async ({ page }) => {
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

    const activeObservers = new WeakSet<ResizeObserver>();
    let observed = 0;
    const observe = ResizeObserver.prototype.observe;
    const disconnect = ResizeObserver.prototype.disconnect;
    ResizeObserver.prototype.observe = function(
      this: ResizeObserver,
      target: Element,
      options?: ResizeObserverOptions,
    ): void {
      if (!activeObservers.has(this)) {
        activeObservers.add(this);
        observed += 1;
      }
      observe.call(this, target, options);
    };
    ResizeObserver.prototype.disconnect = function(this: ResizeObserver): void {
      if (activeObservers.delete(this)) observed -= 1;
      disconnect.call(this);
    };

    let contextListeners = 0;
    const add = HTMLCanvasElement.prototype.addEventListener;
    const remove = HTMLCanvasElement.prototype.removeEventListener;
    HTMLCanvasElement.prototype.addEventListener = function(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): void {
      if (type === 'webglcontextlost') contextListeners += 1;
      add.call(this, type, listener, options);
    };
    HTMLCanvasElement.prototype.removeEventListener = function(
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ): void {
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

  const initialized = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as HTMLElement & {
      configure(value: object): Promise<unknown>;
    };
    widget.id = 'widget';
    widget.style.width = '400px';
    document.body.append(widget);
    return widget.configure(config);
  }, configuration);
  expect(initialized).toMatchObject({ accepted: true, outcome: 'ready' });

  const initial = await page.locator('#widget').evaluate((widget) => {
    const canvas = widget.shadowRoot!.querySelector('canvas')!;
    return {
      width: canvas.width,
      observed: (window as any).__resources.observed(),
      contextListeners: (window as any).__resources.contextListeners(),
      canvases: widget.shadowRoot!.querySelectorAll('canvas').length,
      modelViewers: widget.shadowRoot!.querySelectorAll('model-viewer').length,
    };
  });
  expect(initial).toMatchObject({ observed: 1, contextListeners: 1, canvases: 1, modelViewers: 1 });

  await page.locator('#widget').evaluate((widget: HTMLElement) => {
    widget.style.width = '640px';
    widget.style.height = '360px';
  });
  await expect.poll(() => page.locator('#widget').evaluate((widget) => (
    widget.shadowRoot!.querySelector('canvas') as HTMLCanvasElement
  ).width)).not.toBe(initial.width);

  await page.evaluate(async () => {
    const widget = document.querySelector('#widget') as HTMLElement & {
      playAnimation(id: string): Promise<unknown>;
    };
    await widget.playAnimation('pulse');
    (window as any).__detachedWidget = widget;
    widget.remove();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__resources.pending.size)).toBe(0);
  expect(await page.evaluate(() => {
    const widget = (window as any).__detachedWidget as HTMLElement;
    return {
      observed: (window as any).__resources.observed(),
      contextListeners: (window as any).__resources.contextListeners(),
      canvases: widget.shadowRoot!.querySelectorAll('canvas').length,
      modelViewers: widget.shadowRoot!.querySelectorAll('model-viewer').length,
    };
  })).toEqual({ observed: 0, contextListeners: 0, canvases: 0, modelViewers: 0 });

  const reconnected = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as HTMLElement & {
      configure(value: object): Promise<{ outcome: string }>;
      getState(): {
        lifecycle: string;
        selection: { colorId: string | null; variantId: string | null };
      };
    };
    document.body.append(widget);
    const result = await widget.configure(config);
    widget.remove();
    document.body.append(widget);

    const deadline = performance.now() + 10_000;
    while (!['STATE-READY', 'STATE-ERROR'].includes(widget.getState().lifecycle)) {
      if (performance.now() >= deadline) throw new Error('Reconnect did not settle.');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    const snapshot = {
      initial: result.outcome,
      lifecycle: widget.getState().lifecycle,
      selection: widget.getState().selection,
      canvases: widget.shadowRoot!.querySelectorAll('canvas').length,
      modelViewers: widget.shadowRoot!.querySelectorAll('model-viewer').length,
    };
    (window as any).__reconnectedWidget = widget;
    widget.remove();
    return snapshot;
  }, configuration);
  expect(reconnected).toEqual({
    initial: 'ready',
    lifecycle: 'STATE-READY',
    selection: { colorId: null, variantId: 'base' },
    canvases: 1,
    modelViewers: 1,
  });

  await expect.poll(() => page.evaluate(() => ({
    pending: (window as any).__resources.pending.size,
    observed: (window as any).__resources.observed(),
    contextListeners: (window as any).__resources.contextListeners(),
    canvases: ((window as any).__reconnectedWidget as HTMLElement).shadowRoot!.querySelectorAll('canvas').length,
    modelViewers: ((window as any).__reconnectedWidget as HTMLElement).shadowRoot!.querySelectorAll('model-viewer').length,
  }))).toEqual({ pending: 0, observed: 0, contextListeners: 0, canvases: 0, modelViewers: 0 });
});
