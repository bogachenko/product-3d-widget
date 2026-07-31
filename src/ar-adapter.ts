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

const arError = (
  code: Extract<WidgetError['code'], 'USDZ_UNUSABLE' | 'AR_INITIALIZATION_FAILED' | 'AR_SYNC_FAILED' | 'AR_REQUEST_FAILED'>,
  message: string,
): WidgetError => Object.freeze({ code, scope: 'ar' as const, message });

// <SEMANTIC_BLOCK id="CFC-CLASS-MODEL-VIEWER-AR-ADAPTER">
// <INTENT>Use one hidden model-viewer through public mode-neutral AR APIs only.</INTENT>
// <LINKS><MODULE ref="MOD-AR-ADAPTER"/><MODULE_CONTRACT ref="CONTRACT-MOD-AR-ADAPTER"/><FUNCTION_CONTRACT ref="CFC-FN-AR-INITIALIZE"/><REQUIREMENT ref="FR-AR-AVAILABILITY-REFLECTION"/><BUSINESS_PROCESS ref="BP-AR-PLACEMENT"/></LINKS>
export class ModelViewerArAdapter {
  readonly #hiddenHost: HTMLElement;
  readonly #callbacks: ArCallbacks;
  #element: ModelViewerElement | null = null;
  #config: NormalizedProductConfiguration | null = null;
  #webxrObserved = false;
  #disposed = false;
  #available = false;
  #loaded: Promise<void> | null = null;
  #resolveLoaded: (() => void) | null = null;
  #rejectLoaded: ((reason: Error) => void) | null = null;
  readonly #baseColors = new Map<string, readonly number[]>();

  readonly #handleLoad = (): void => {
    this.#resolveLoaded?.();
    this.#resolveLoaded = null;
    this.#rejectLoaded = null;
    this.#updateAvailability();
  };

  readonly #handleError = (): void => {
    this.#rejectLoaded?.(new Error('model-viewer could not load the AR source.'));
    this.#resolveLoaded = null;
    this.#rejectLoaded = null;
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
  // <INTENT>Create one hidden model-viewer, configure mode-neutral public AR inputs and observe public availability.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-AR-AVAILABILITY-REFLECTION"/><BUSINESS_PROCESS ref="BP-AR-PLACEMENT"/><MODULE ref="MOD-AR-ADAPTER"/><MODULE_CONTRACT ref="CONTRACT-MOD-AR-ADAPTER"/><FUNCTION_CONTRACT ref="CFC-FN-AR-INITIALIZE"/></LINKS>
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
      element.src = config.glbUrl;
      element.ar = true;
      if (config.usdzUrl !== null) {
        try {
          new URL(config.usdzUrl, document.baseURI);
          element.iosSrc = config.usdzUrl;
        } catch {
          element.iosSrc = null;
          localErrors.push(arError('USDZ_UNUSABLE', 'The optional USDZ URL is unusable; the primary GLB remains configured for platform fallback.'));
        }
      }

      element.addEventListener('load', this.#handleLoad);
      element.addEventListener('error', this.#handleError);
      element.addEventListener('ar-status', this.#handleArStatusEvent);
      this.#loaded = new Promise<void>((resolve, reject) => {
        this.#resolveLoaded = resolve;
        this.#rejectLoaded = reject;
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

  #updateAvailability(): void {
    const available = this.#element?.canActivateAR === true;
    if (available === this.#available) return;
    this.#available = available;
    this.#callbacks.onAvailabilityChange(available);
  }

  // <SEMANTIC_BLOCK id="CFC-FN-AR-SYNC-SELECTION">
  // <INTENT>Apply the current confirmed color and structural selection only through model-viewer public supported capabilities.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-AR-SELECTION-SYNCHRONIZATION"/><BUSINESS_PROCESS ref="BP-AR-PLACEMENT"/><MODULE ref="MOD-AR-ADAPTER"/><MODULE_CONTRACT ref="CONTRACT-MOD-AR-ADAPTER"/><FUNCTION_CONTRACT ref="CFC-FN-AR-SYNC-SELECTION"/></LINKS>
  async syncSelection(selection: ConfirmedSelection): Promise<ArSyncResult> {
    if (this.#disposed || this.#element === null || this.#config === null || this.#loaded === null) {
      return Object.freeze({ ok: false, error: arError('AR_SYNC_FAILED', 'AR selection cannot be synchronized before initialization.') });
    }
    try {
      await this.#loaded;
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
  // <INTENT>Call public activateAR() once from the host user activation and report only initiation or an observable generic failure.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-AR-LAUNCH"/><BUSINESS_PROCESS ref="BP-AR-PLACEMENT"/><MODULE ref="MOD-AR-ADAPTER"/><MODULE_CONTRACT ref="CONTRACT-MOD-AR-ADAPTER"/><FUNCTION_CONTRACT ref="CFC-FN-AR-LAUNCH"/></LINKS>
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
  // <INTENT>Translate only public model-viewer WebXR status evidence into one start/end pair.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-AR-LIFECYCLE-OBSERVABILITY"/><BUSINESS_PROCESS ref="BP-AR-PLACEMENT"/><MODULE ref="MOD-AR-ADAPTER"/><MODULE_CONTRACT ref="CONTRACT-MOD-AR-ADAPTER"/><FUNCTION_CONTRACT ref="CFC-FN-AR-HANDLE-STATUS"/></LINKS>
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
  // <INTENT>Idempotently remove owned public listeners, hidden model-viewer and retained asset/selection references.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-DISCONNECT-CLEANUP"/><BUSINESS_PROCESS ref="BP-AR-PLACEMENT"/><MODULE ref="MOD-AR-ADAPTER"/><MODULE_CONTRACT ref="CONTRACT-MOD-AR-ADAPTER"/><FUNCTION_CONTRACT ref="CFC-FN-AR-DISPOSE"/></LINKS>
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
    this.#rejectLoaded?.(new Error('AR adapter disposed before its source became ready.'));
    this.#resolveLoaded = null;
    this.#rejectLoaded = null;
    this.#loaded = null;
    this.#available = false;
    this.#webxrObserved = false;
    this.#baseColors.clear();
  }
  // </SEMANTIC_BLOCK>
}
// </SEMANTIC_BLOCK>
