import '@google/model-viewer';
import type { ModelViewerElement } from '@google/model-viewer';
import type { NormalizedProductConfiguration } from './configuration.js';
import type { ConfirmedSelection, WidgetError } from './product-3d-widget.js';

export type ArInitializationResult =
  | Readonly<{ ok: true; available: boolean; localErrors: readonly WidgetError[] }>
  | Readonly<{ ok: false; error: WidgetError }>;
export type ArSyncResult = Readonly<{ ok: true }> | Readonly<{ ok: false; error: WidgetError }>;
export type ArRequestResult =
  | Readonly<{ ok: true; outcome: 'initiated' }>
  | Readonly<{ ok: false; error: WidgetError }>;

type ArCallbacks = Readonly<{
  onAvailabilityChange(available: boolean): void;
  onWebXRStart(): void;
  onWebXREnd(): void;
  onError(error: WidgetError): void;
}>;

type ArStatusEvent = CustomEvent<Readonly<{ status: string }>>;

const arSelectionKey = (selection: ConfirmedSelection): string =>
  JSON.stringify([selection.colorId, selection.variantId]);

const resolvedUrl = (value: string | null): string | null =>
  value === null ? null : new URL(value, document.baseURI).href;

const arError = (
  code: Extract<WidgetError['code'], 'USDZ_UNUSABLE' | 'AR_INITIALIZATION_FAILED' | 'AR_SYNC_FAILED' | 'AR_REQUEST_FAILED'>,
  message: string,
): WidgetError => Object.freeze({ code, scope: 'ar' as const, message });

// <SEMANTIC_BLOCK id="CFC-CLASS-MODEL-VIEWER-AR-ADAPTER">
// <INTENT>Use one hidden model-viewer through public mode-neutral AR APIs only.</INTENT>
// <LINKS><MODULE ref="MOD-AR-ADAPTER"/><MODULE_CONTRACT ref="CONTRACT-MOD-AR-ADAPTER"/><FUNCTION_CONTRACT ref="CFC-FN-AR-INITIALIZE"/></LINKS>
export class ModelViewerArAdapter {
  readonly #hiddenHost: HTMLElement;
  readonly #callbacks: ArCallbacks;
  #element: ModelViewerElement | null = null;
  #config: NormalizedProductConfiguration | null = null;
  #selection: ConfirmedSelection | null = null;
  #webxrObserved = false;
  #disposed = false;
  #available = false;
  #loaded: Promise<void> | null = null;
  #sourceLoaded = false;
  readonly #baseColors = new Map<string, readonly number[]>();

  readonly #handleLoad = (): void => {
    this.#sourceLoaded = true;
    this.#updateAvailability();
  };

  readonly #handleError = (): void => {
    this.#sourceLoaded = false;
    this.#updateAvailability();
  };

  readonly #handleArStatusEvent = (event: Event): void => {
    this.#handleArStatus(event);
  };

  constructor(hiddenHost: HTMLElement, callbacks: ArCallbacks) {
    this.#hiddenHost = hiddenHost;
    this.#callbacks = callbacks;
  }

  // <SEMANTIC_BLOCK id="CFC-FN-AR-INITIALIZE">
  async initialize(config: NormalizedProductConfiguration): Promise<ArInitializationResult> {
    if (this.#disposed || this.#element !== null || !config.arEnabled) {
      return Object.freeze({
        ok: false,
        error: arError('AR_INITIALIZATION_FAILED', 'AR cannot be initialized in the current lifecycle.'),
      });
    }

    try {
      this.#config = config;
      const localErrors: WidgetError[] = [];
      const element = document.createElement('model-viewer') as ModelViewerElement;
      element.setAttribute('aria-hidden', 'true');
      element.style.position = 'absolute';
      element.style.width = '1px';
      element.style.height = '1px';
      element.style.opacity = '0';
      element.style.pointerEvents = 'none';
      element.style.clipPath = 'inset(50%)';
      element.style.overflow = 'hidden';
      element.loading = 'eager';
      const initialAsset = config.arSelectionAssetsByKey?.get(arSelectionKey(config.initialSelection));
      if (config.arSelectionAssetsByKey !== null && initialAsset === undefined) {
        return Object.freeze({
          ok: false,
          error: arError('AR_INITIALIZATION_FAILED', 'No AR selection asset matches the initial confirmed selection.'),
        });
      }
      element.src = initialAsset?.glbUrl ?? config.glbUrl;
      element.ar = true;
      const initialUsdzUrl = initialAsset?.usdzUrl ?? (initialAsset === undefined ? config.usdzUrl : null);
      if (initialUsdzUrl !== null) {
        try {
          new URL(initialUsdzUrl, document.baseURI);
          element.iosSrc = initialUsdzUrl;
        } catch {
          element.iosSrc = null;
          localErrors.push(arError('USDZ_UNUSABLE', 'The optional USDZ URL is unusable; Quick Look will use GLB conversion fallback.'));
        }
      } else {
        element.iosSrc = null;
      }
      this.#selection = Object.freeze({ ...config.initialSelection });

      element.addEventListener('load', this.#handleLoad);
      element.addEventListener('error', this.#handleError);
      element.addEventListener('ar-status', this.#handleArStatusEvent);
      this.#loaded = new Promise<void>((resolve, reject) => {
        const loaded = (): void => {
          element.removeEventListener('error', failed);
          resolve();
        };
        const failed = (): void => {
          element.removeEventListener('load', loaded);
          reject(new Error('model-viewer could not load the AR source.'));
        };
        element.addEventListener('load', loaded, { once: true });
        element.addEventListener('error', failed, { once: true });
      });
      void this.#loaded.catch(() => undefined);
      this.#element = element;
      this.#hiddenHost.append(element);
      this.#updateAvailability();
      return Object.freeze({ ok: true, available: this.#available, localErrors: Object.freeze(localErrors) });
    } catch (cause) {
      this.dispose();
      return Object.freeze({
        ok: false,
        error: arError(
          'AR_INITIALIZATION_FAILED',
          `AR initialization failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      });
    }
  }
  // </SEMANTIC_BLOCK>

  #setAvailability(available: boolean): void {
    if (available === this.#available) return;
    this.#available = available;
    this.#callbacks.onAvailabilityChange(available);
  }

  #updateAvailability(): void {
    this.#setAvailability(this.#sourceLoaded && this.#selection !== null && this.#element?.canActivateAR === true);
  }

  // <SEMANTIC_BLOCK id="CFC-FN-AR-SYNC-SELECTION">
  async syncSelection(selection: ConfirmedSelection): Promise<ArSyncResult> {
    if (this.#disposed || this.#element === null || this.#config === null || this.#loaded === null) {
      return Object.freeze({ ok: false, error: arError('AR_SYNC_FAILED', 'AR selection cannot be synchronized before initialization.') });
    }
    try {
      const assets = this.#config.arSelectionAssetsByKey;
      if (assets !== null) {
        const asset = assets.get(arSelectionKey(selection));
        if (asset === undefined) {
          this.#selection = null;
          this.#sourceLoaded = false;
          this.#setAvailability(false);
          return Object.freeze({
            ok: false,
            error: arError('AR_SYNC_FAILED', 'No AR selection asset matches the current confirmed selection.'),
          });
        }

        const sameSource = resolvedUrl(this.#element.src) === resolvedUrl(asset.glbUrl)
          && resolvedUrl(this.#element.iosSrc) === resolvedUrl(asset.usdzUrl);
        this.#selection = Object.freeze({ ...selection });
        if (!sameSource) {
          this.#sourceLoaded = false;
          this.#setAvailability(false);
          this.#loaded = new Promise<void>((resolve, reject) => {
            const loaded = (): void => {
              this.#element?.removeEventListener('error', failed);
              resolve();
            };
            const failed = (): void => {
              this.#element?.removeEventListener('load', loaded);
              reject(new Error('model-viewer could not load the selected AR source.'));
            };
            this.#element?.addEventListener('load', loaded, { once: true });
            this.#element?.addEventListener('error', failed, { once: true });
          });
          this.#element.iosSrc = asset.usdzUrl;
          this.#element.src = asset.glbUrl;
          void this.#loaded.catch(() => undefined);
        }
        await this.#loaded;
        this.#sourceLoaded = true;
        this.#updateAvailability();
        return Object.freeze({ ok: true });
      }

      await this.#loaded;
      this.#selection = Object.freeze({ ...selection });
      const model = this.#element.model;
      if (model !== undefined) {
        if (this.#baseColors.size === 0) {
          for (const color of this.#config.colorsById.values()) {
            for (const materialName of color.materialNames) {
              const material = model.getMaterialByName(materialName);
              if (material !== null && !this.#baseColors.has(materialName)) {
                await material.ensureLoaded();
                this.#baseColors.set(materialName, Object.freeze([...material.pbrMetallicRoughness.baseColorFactor]));
              }
            }
          }
        }
        for (const [materialName, baseColor] of this.#baseColors) {
          const material = model.getMaterialByName(materialName);
          if (material !== null) material.pbrMetallicRoughness.setBaseColorFactor([...baseColor] as [number, number, number, number]);
        }
        const color = selection.colorId === null ? undefined : this.#config.colorsById.get(selection.colorId);
        if (color !== undefined && !color.isBase) {
          for (const materialName of color.materialNames) {
            const material = model.getMaterialByName(materialName);
            if (material !== null) material.pbrMetallicRoughness.setBaseColorFactor(color.swatch);
          }
        }
      }
      return Object.freeze({ ok: true });
    } catch (cause) {
      return Object.freeze({
        ok: false,
        error: arError('AR_SYNC_FAILED', `AR selection synchronization failed: ${cause instanceof Error ? cause.message : String(cause)}`),
      });
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-AR-LAUNCH">
  async launch(): Promise<ArRequestResult> {
    if (this.#disposed || this.#element === null) {
      return Object.freeze({ ok: false, error: arError('AR_REQUEST_FAILED', 'AR is not initialized.') });
    }
    try {
      await this.#element.activateAR();
      return Object.freeze({ ok: true, outcome: 'initiated' });
    } catch (cause) {
      return Object.freeze({
        ok: false,
        error: arError('AR_REQUEST_FAILED', `The AR request failed: ${cause instanceof Error ? cause.message : String(cause)}`),
      });
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-AR-HANDLE-STATUS">
  #handleArStatus(event: Event): void {
    const status = (event as ArStatusEvent).detail?.status;
    this.#updateAvailability();
    if (status === 'session-started') {
      if (!this.#webxrObserved) {
        this.#webxrObserved = true;
        this.#callbacks.onWebXRStart();
      }
      return;
    }
    if (status === 'not-presenting') {
      if (this.#webxrObserved) {
        this.#webxrObserved = false;
        this.#callbacks.onWebXREnd();
      }
      return;
    }
    if (status === 'failed') {
      this.#callbacks.onError(arError('AR_REQUEST_FAILED', 'The AR request failed before a publicly observable WebXR session started.'));
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-AR-DISPOSE">
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const element = this.#element;
    if (element !== null) {
      element.removeEventListener('load', this.#handleLoad);
      element.removeEventListener('error', this.#handleError);
      element.removeEventListener('ar-status', this.#handleArStatusEvent);
      element.remove();
    }
    this.#element = null;
    this.#config = null;
    this.#selection = null;
    this.#loaded = null;
    this.#available = false;
    this.#sourceLoaded = false;
    this.#webxrObserved = false;
    this.#baseColors.clear();
  }
  // </SEMANTIC_BLOCK>
}
// </SEMANTIC_BLOCK>
